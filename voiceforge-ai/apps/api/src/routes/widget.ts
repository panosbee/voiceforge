// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Widget Public Routes
// Serves embeddable widget script + public config endpoint
// No auth required — these are accessed from customer websites
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, webhookEvents } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as elevenlabsService from '../services/elevenlabs.js';

const log = createLogger('widget');

export const widgetRoutes = new Hono();

// ── CORS for widget routes ───────────────────────────────────────
// Widget endpoints are called from customer websites (cross-origin).
// Allow any origin so embedded widgets can call tool-call, config, record.
widgetRoutes.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
  maxAge: 86400,
}));

// ── GET /widget/:agentId/config ──────────────────────────────────
// Returns widget configuration for a specific agent (public)
widgetRoutes.get('/:agentId/config', async (c) => {
  const agentId = c.req.param('agentId');

  try {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    if (!agent.widgetEnabled) {
      return c.json({ success: false, error: 'Widget not enabled for this agent' }, 403);
    }

    // Check allowed origins if configured
    const allowedOrigins = (agent.widgetAllowedOrigins as string[]) || [];
    const origin = c.req.header('origin') || c.req.header('referer') || '';

    if (allowedOrigins.length > 0 && origin) {
      const originHost = extractHost(origin);
      const allowed = allowedOrigins.some(
        (o) => o === '*' || extractHost(o) === originHost,
      );
      if (!allowed) {
        log.warn({ agentId, origin }, 'Widget request from unauthorized origin');
        return c.json({ success: false, error: 'Origin not allowed' }, 403);
      }
    }

    // Return only public-safe config
    return c.json({
      success: true,
      data: {
        agentId: agent.id,
        elevenlabsAgentId: agent.elevenlabsAgentId,
        name: agent.name,
        language: agent.language,
        widget: {
          color: agent.widgetColor,
          position: agent.widgetPosition,
          buttonText: agent.widgetButtonText,
          iconType: agent.widgetIconType,
        },
      },
    });
  } catch (error) {
    log.error({ error, agentId }, 'Failed to fetch widget config');
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /widget/:agentId/record ─────────────────────────────────
// Public endpoint: triggers conversation recording for embedded widgets.
// No auth required — validates via agentId + widgetEnabled check.
// The conversation-sync worker also catches these, but this gives
// immediate recording when the user closes the widget.
widgetRoutes.post('/:agentId/record', async (c) => {
  const agentId = c.req.param('agentId');

  try {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: { customer: true },
    });

    if (!agent || !agent.widgetEnabled || !agent.elevenlabsAgentId) {
      return c.json({ success: false, error: 'Not available' }, 404);
    }

    // Fetch recent conversations from ElevenLabs for this agent
    const conversations = await elevenlabsService.getConversations(agent.elevenlabsAgentId);
    if (!conversations || conversations.length === 0) {
      return c.json({ success: true, status: 'no_conversation' });
    }

    // Find the most recent conversation that we haven't recorded yet
    for (const conv of conversations) {
      const conversationId = ((conv as Record<string, unknown>).conversationId ?? (conv as Record<string, unknown>).conversation_id) as string | undefined;
      if (!conversationId) continue;

      // Check dedup
      const existing = await db.query.webhookEvents.findFirst({
        where: eq(webhookEvents.eventId, conversationId),
      });
      if (existing) continue;

      const existingCall = await db.query.calls.findFirst({
        where: eq(calls.telnyxConversationId, conversationId),
      });
      if (existingCall) continue;

      // Found an unrecorded conversation — delegate to the sync worker's logic
      // Import and call the shared function
      const { runConversationSync } = await import('../workers/conversation-sync.js');
      // Trigger a full sync for just this agent — the worker handles everything
      await runConversationSync();

      return c.json({ success: true, status: 'recording_triggered' });
    }

    return c.json({ success: true, status: 'already_recorded' });
  } catch (error) {
    log.error({ error, agentId }, 'Widget record error');
    return c.json({ success: false, error: 'Recording error' }, 500);
  }
});

// ── POST /widget/:agentId/tool-call ──────────────────────────────
// Public proxy for client tool calls from embedded widgets.
// Third-party sites can't call /webhooks/elevenlabs/server-tool directly
// due to CORS, so this endpoint proxies the tool call with CORS *.
widgetRoutes.post('/:agentId/tool-call', async (c) => {
  const agentId = c.req.param('agentId');

  try {
    const body = await c.req.json<{ tool_name: string; parameters: Record<string, unknown> }>();
    if (!body.tool_name) {
      return c.json({ error: true, message: 'Missing tool_name' }, 400);
    }

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent || !agent.widgetEnabled || !agent.elevenlabsAgentId) {
      return c.json({ error: true, message: 'Agent not available' }, 404);
    }

    // Forward to the server-tool handler via internal loopback (works behind reverse proxies)
    const internalResponse = await fetch(`http://127.0.0.1:${env.PORT || 3001}/webhooks/elevenlabs/server-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: body.tool_name,
        agent_id: agent.elevenlabsAgentId,
        parameters: body.parameters || {},
      }),
    });

    const result = await internalResponse.json();
    return c.json(result);
  } catch (error) {
    log.error({ error, agentId }, 'Widget tool-call error');
    return c.json({ error: true, message: 'Tool call failed' }, 500);
  }
});

// ── GET /widget/embed.js ─────────────────────────────────────────
// Serves the embeddable JavaScript widget
widgetRoutes.get('/embed.js', (c) => {
  const apiBaseUrl = env.API_BASE_URL;

  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=300'); // 5 min cache
  c.header('Access-Control-Allow-Origin', '*');

  return c.body(generateWidgetScript(apiBaseUrl));
});

// ── Helpers ──────────────────────────────────────────────────────

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Generate the self-contained embeddable widget script.
 * This runs on the customer's website — creates a floating button
 * and opens an ElevenLabs conversation widget on click.
 */
function generateWidgetScript(apiBaseUrl: string): string {
  return `(() => {
  "use strict";

  const scriptTag = document.currentScript || (() => {
    const s = document.querySelectorAll('script[data-agent-id]');
    return s[s.length - 1];
  })();
  if (!scriptTag) { console.warn('[VoiceForge] Missing data-agent-id attribute'); return; }

  const AGENT_ID = scriptTag.getAttribute('data-agent-id');
  const API_URL = '${apiBaseUrl}';

  const wrapper = scriptTag.parentElement;
  const hasWrapper = wrapper && (wrapper.id === 'vf-widget-wrapper' || wrapper.hasAttribute('data-vf-wrapper'));

  let config = null;
  let isOpen = false;
  let container = null;
  let overlay = null;
  let micStream = null;
  let isMuted = false;

  const micIconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>';
  const micOffIconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 5.29"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>';

  const patchGetUserMedia = () => {
    if (window.__VF_GUM_PATCHED) return;
    window.__VF_GUM_ORIGINAL = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (constraints?.audio) {
        const a = typeof constraints.audio === 'boolean'
          ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
          : { ...constraints.audio, noiseSuppression: true, echoCancellation: true, autoGainControl: true };
        constraints = { ...constraints, audio: a };
      }
      return window.__VF_GUM_ORIGINAL(constraints).then((stream) => {
        if (constraints?.audio) { micStream = stream; }
        return stream;
      });
    };
    window.__VF_GUM_PATCHED = true;
  };

  const restoreGetUserMedia = () => {
    if (window.__VF_GUM_PATCHED && window.__VF_GUM_ORIGINAL) {
      navigator.mediaDevices.getUserMedia = window.__VF_GUM_ORIGINAL;
      window.__VF_GUM_PATCHED = false;
    }
    micStream = null;
    isMuted = false;
  };

  const toggleMute = () => {
    if (!micStream) return;
    isMuted = !isMuted;
    micStream.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
    updateMuteButton();
  };

  const updateMuteButton = () => {
    const btn = document.getElementById('vf-mute-btn');
    const label = document.getElementById('vf-mute-label');
    if (!btn) return;
    if (isMuted) {
      btn.style.background = '#fee2e2';
      btn.style.color = '#dc2626';
      btn.style.borderColor = '#fca5a5';
      btn.innerHTML = micOffIconSvg;
      if (label) { label.textContent = 'Tap to unmute'; label.style.color = '#dc2626'; }
    } else {
      btn.style.background = '#f3f4f6';
      btn.style.color = '#6b7280';
      btn.style.borderColor = '#e5e7eb';
      btn.innerHTML = micIconSvg;
      if (label) { label.textContent = 'Tap to mute'; label.style.color = '#6b7280'; }
    }
  };

  const fetchConfig = (cb) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '/widget/' + encodeURIComponent(AGENT_ID) + '/config');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.data) { config = resp.data; cb(null, config); }
          else { cb('Widget not available'); }
        } catch(e) { cb('Parse error'); }
      } else { cb('HTTP ' + xhr.status); }
    };
    xhr.onerror = () => { cb('Network error'); };
    xhr.send();
  };

  const loadConvaiScript = (cb) => {
    if (window.__VF_CONVAI_LOADED) { cb(); return; }
    if (window.__VF_CONVAI_LOADING) {
      const poll = setInterval(() => {
        if (window.__VF_CONVAI_LOADED) { clearInterval(poll); cb(); }
      }, 50);
      return;
    }
    window.__VF_CONVAI_LOADING = true;
    const s = document.createElement('script');
    s.src = 'https://elevenlabs.io/convai-widget/index.js';
    s.async = true;
    s.onload = () => { window.__VF_CONVAI_LOADED = true; cb(); };
    s.onerror = () => { console.warn('[VoiceForge] Failed to load ElevenLabs widget'); };
    document.head.appendChild(s);
  };

  document.addEventListener('vf-close', () => {
    if (isOpen && window.__VF_ACTIVE !== AGENT_ID) {
      closeWidget(container._vfOpenIcon);
    }
  });

  const setupMarquee = (labelEl) => {
    if (labelEl && labelEl.scrollWidth > labelEl.clientWidth) {
      const overflow = labelEl.scrollWidth - labelEl.clientWidth;
      labelEl.style.setProperty('--vf-overflow', '-' + overflow + 'px');
      const duration = Math.max(3, overflow / 20);
      labelEl.style.animation = 'vf-marquee ' + duration + 's ease-in-out infinite';
      labelEl.style.animationDelay = '2s';
    }
  };

  const createButton = (cfg) => {
    const w = cfg.widget || {};
    const color = w.color || '#6366f1';
    const position = w.position || 'bottom-right';
    const text = hasWrapper ? (cfg.name || w.buttonText || 'Talk to us') : (w.buttonText || 'Talk to us');
    const iconType = w.iconType || 'phone';

    container = document.createElement('div');
    container.id = 'vf-container-' + AGENT_ID;

    if (hasWrapper) {
      container.style.cssText = 'position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    } else {
      container.style.cssText = 'position:fixed;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
      if (position === 'bottom-left') {
        container.style.bottom = '24px';
        container.style.left = '24px';
      } else {
        container.style.bottom = '24px';
        container.style.right = '24px';
      }
    }

    const phoneIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
    const micIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>';
    const chatIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    const closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    const icon = iconType === 'mic' ? micIcon : iconType === 'chat' ? chatIcon : phoneIcon;
    container._vfOpenIcon = icon;

    const fab = document.createElement('button');
    fab.id = 'vf-fab-' + AGENT_ID;
    fab.setAttribute('aria-label', text);
    fab.innerHTML = '<span id="vf-icon-' + AGENT_ID + '" style="display:flex;align-items:center;flex-shrink:0;">' + icon + '</span><span id="vf-label-' + AGENT_ID + '" style="margin-left:8px;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;' + (hasWrapper ? 'max-width:150px;display:inline-block;' : '') + '">' + escapeHtml(text) + '</span>';
    fab.style.cssText = 'display:inline-flex;align-items:center;padding:12px 20px;border:none;border-radius:50px;cursor:pointer;color:#fff;font-size:14px;box-shadow:0 4px 24px rgba(0,0,0,0.18);transition:all 0.3s cubic-bezier(0.4,0,0.2,1);outline:none;background:' + color + ';';
    fab.onmouseenter = () => { fab.style.transform = 'scale(1.05)'; fab.style.boxShadow = '0 6px 32px rgba(0,0,0,0.25)'; };
    fab.onmouseleave = () => { fab.style.transform = 'scale(1)'; fab.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)'; };
    fab.onclick = () => { toggleWidget(cfg, color, closeIcon, icon); };
    container.appendChild(fab);

    if (hasWrapper) {
      wrapper.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    if (hasWrapper) {
      setTimeout(() => {
        const labelEl = document.getElementById('vf-label-' + AGENT_ID);
        setupMarquee(labelEl);
      }, 100);
    } else {
      setTimeout(() => {
        const label = document.getElementById('vf-label-' + AGENT_ID);
        if (label && !isOpen) {
          label.style.maxWidth = '0';
          label.style.opacity = '0';
          label.style.overflow = 'hidden';
          label.style.marginLeft = '0';
          label.style.transition = 'all 0.4s ease';
          fab.style.padding = '14px';
          fab.style.borderRadius = '50%';
          fab.style.width = '56px';
          fab.style.height = '56px';
          fab.style.justifyContent = 'center';
        }
      }, 5000);
    }
  };

  const toggleWidget = (cfg, color, closeIcon, openIcon) => {
    if (isOpen) {
      closeWidget(openIcon);
      return;
    }

    if (window.__VF_ACTIVE && window.__VF_ACTIVE !== AGENT_ID) {
      document.dispatchEvent(new CustomEvent('vf-close'));
    }
    window.__VF_ACTIVE = AGENT_ID;

    isOpen = true;
    const fab = document.getElementById('vf-fab-' + AGENT_ID);
    const iconEl = document.getElementById('vf-icon-' + AGENT_ID);
    const labelEl = document.getElementById('vf-label-' + AGENT_ID);
    if (iconEl) iconEl.innerHTML = closeIcon;
    if (labelEl) { labelEl.style.maxWidth = '0'; labelEl.style.opacity = '0'; labelEl.style.overflow = 'hidden'; labelEl.style.marginLeft = '0'; labelEl.style.animation = 'none'; }
    if (fab) { fab.style.padding = '14px'; fab.style.borderRadius = '50%'; fab.style.width = '56px'; fab.style.height = '56px'; fab.style.justifyContent = 'center'; }

    overlay = document.createElement('div');
    overlay.id = 'vf-widget-overlay';
    const pos = cfg.widget?.position || 'bottom-right';
    const align = pos === 'bottom-left' ? 'left:0;' : 'right:0;';
    overlay.style.cssText = 'position:absolute;bottom:70px;' + align + 'width:380px;height:500px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;animation:vf-slide-up 0.3s ease;display:flex;flex-direction:column;';

    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;background:' + color + ';color:#fff;display:flex;align-items:center;gap:12px;';
    const avatar = document.createElement('div');
    avatar.style.cssText = 'width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;';
    avatar.textContent = (cfg.name || 'AI').charAt(0).toUpperCase();
    const headerInfo = document.createElement('div');
    headerInfo.innerHTML = '<div style="font-weight:600;font-size:15px;">' + escapeHtml(cfg.name || 'AI Assistant') + '</div><div style="font-size:12px;opacity:0.85;">Online</div>';
    const headerClose = document.createElement('button');
    headerClose.setAttribute('aria-label', 'Close');
    headerClose.style.cssText = 'margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;padding:4px;display:flex;align-items:center;opacity:0.85;transition:opacity 0.2s;';
    headerClose.innerHTML = closeIcon;
    headerClose.onmouseenter = () => { headerClose.style.opacity = '1'; };
    headerClose.onmouseleave = () => { headerClose.style.opacity = '0.85'; };
    headerClose.onclick = () => { closeWidget(openIcon); };
    header.appendChild(avatar);
    header.appendChild(headerInfo);
    header.appendChild(headerClose);
    overlay.appendChild(header);

    const body = document.createElement('div');
    body.id = 'vf-widget-body';
    body.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;background:#f9fafb;position:relative;';

    body.innerHTML = '<div style="text-align:center;color:#6b7280;"><div style="margin-bottom:12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:vf-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div><div style="font-size:13px;">Connecting...</div></div>';

    overlay.appendChild(body);

    if (!document.getElementById('vf-widget-styles')) {
      const style = document.createElement('style');
      style.id = 'vf-widget-styles';
      style.textContent = '@keyframes vf-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes vf-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes vf-marquee{0%,20%{transform:translateX(0)}45%,55%{transform:translateX(var(--vf-overflow))}80%,100%{transform:translateX(0)}}';
      document.head.appendChild(style);
    }

    container.appendChild(overlay);

    patchGetUserMedia();

    loadConvaiScript(() => {
      if (!cfg.elevenlabsAgentId || cfg.elevenlabsAgentId.startsWith('dev_')) {
        body.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;"><div style="font-size:40px;margin-bottom:12px;">🎙️</div><div style="font-size:14px;font-weight:500;">Voice assistant is being set up</div><div style="font-size:12px;margin-top:4px;">Please try again later</div></div>';
        return;
      }

      body.innerHTML = '';
      const convai = document.createElement('elevenlabs-convai');
      convai.setAttribute('agent-id', cfg.elevenlabsAgentId);

      const makeToolHandler = (toolName) => async (params) => {
        try {
          const resp = await fetch(API_URL + '/widget/' + encodeURIComponent(AGENT_ID) + '/tool-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_name: toolName, parameters: params || {} })
          });
          const data = await resp.json();
          return typeof data === 'string' ? data : JSON.stringify(data);
        } catch(e) {
          console.error('[VoiceForge] Tool call failed:', toolName, e);
          return JSON.stringify({ error: true, message: 'Tool call failed' });
        }
      };
      convai.clientTools = {
        check_availability: makeToolHandler('check_availability'),
        book_appointment: makeToolHandler('book_appointment'),
        get_current_datetime: makeToolHandler('get_current_datetime'),
        get_caller_history: makeToolHandler('get_caller_history'),
        get_business_hours: makeToolHandler('get_business_hours')
      };

      body.appendChild(convai);

      const muteWrap = document.createElement('div');
      muteWrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;z-index:10;';
      const muteBtn = document.createElement('button');
      muteBtn.id = 'vf-mute-btn';
      muteBtn.setAttribute('aria-label', 'Mute microphone');
      muteBtn.onclick = toggleMute;
      muteBtn.style.cssText = 'pointer-events:auto;width:64px;height:64px;border-radius:50%;border:2px solid #e5e7eb;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#6b7280;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
      muteBtn.innerHTML = micIconSvg;
      const muteLabel = document.createElement('div');
      muteLabel.id = 'vf-mute-label';
      muteLabel.style.cssText = 'font-size:13px;color:#6b7280;font-weight:500;pointer-events:none;';
      muteLabel.textContent = 'Tap to mute';
      muteWrap.appendChild(muteBtn);
      muteWrap.appendChild(muteLabel);
      body.appendChild(muteWrap);
    });
  };

  const closeWidget = (openIcon) => {
    isOpen = false;
    if (window.__VF_ACTIVE === AGENT_ID) { window.__VF_ACTIVE = null; }
    restoreGetUserMedia();
    const fab = document.getElementById('vf-fab-' + AGENT_ID);
    const iconEl = document.getElementById('vf-icon-' + AGENT_ID);
    const labelEl = document.getElementById('vf-label-' + AGENT_ID);
    if (iconEl) iconEl.innerHTML = openIcon;
    if (overlay) { overlay.remove(); overlay = null; }

    if (hasWrapper && fab && labelEl) {
      fab.style.padding = '12px 20px';
      fab.style.borderRadius = '50px';
      fab.style.width = '';
      fab.style.height = '';
      labelEl.style.maxWidth = '150px';
      labelEl.style.opacity = '1';
      labelEl.style.overflow = 'hidden';
      labelEl.style.marginLeft = '8px';
      setTimeout(() => { setupMarquee(labelEl); }, 100);
    }

    recordConversation(0);
  };

  const recordConversation = (attempt) => {
    if (attempt > 2) return;
    const delay = attempt === 0 ? 5000 : 8000;
    setTimeout(() => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_URL + '/widget/' + encodeURIComponent(AGENT_ID) + '/record');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.status === 'no_conversation' && attempt < 2) {
              recordConversation(attempt + 1);
            }
          } catch(e) { /* ignore */ }
        }
      };
      xhr.onerror = () => {
        if (attempt < 2) recordConversation(attempt + 1);
      };
      xhr.send('{}');
    }, delay);
  };

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  const init = () => {
    fetchConfig((err, cfg) => {
      if (err) { console.warn('[VoiceForge] Widget unavailable:', err); return; }
      createButton(cfg);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;
}
