// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Test Widget (ElevenLabs Conversational AI)
// Uses @elevenlabs/client SDK with clientTools for calendar/tools
// Records the real conversation transcript on close
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Mic, MicOff, Phone, PhoneOff, AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api-client';
import { API_URL } from '@/lib/env';
import { toast } from 'sonner';
import { Conversation } from '@elevenlabs/client';
import type { ApiResponse } from '@voiceforge/shared';

interface AgentTestWidgetProps {
  agentId: string; // ElevenLabs agent ID
  agentName: string;
  onClose: () => void;
}

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
type AgentMode = 'listening' | 'speaking';

/**
 * Call the server-tool endpoint from the browser.
 * This replaces the old webhook approach — works with localhost.
 */
async function callServerTool(
  toolName: string,
  agentId: string,
  parameters: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${API_URL}/webhooks/elevenlabs/server-tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_name: toolName,
      agent_id: agentId,
      parameters,
    }),
  });
  const data = await res.json();
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export function AgentTestWidget({ agentId, agentName, onClose }: AgentTestWidgetProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [agentMode, setAgentMode] = useState<AgentMode>('listening');
  const [isMuted, setIsMuted] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const originalGUMRef = useRef<typeof navigator.mediaDevices.getUserMedia | null>(null);

  // Enhance browser audio constraints BEFORE the SDK captures the mic.
  // Forces noise suppression, echo cancellation, and auto gain control.
  useEffect(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    originalGUMRef.current = original;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints && typeof constraints === 'object' && constraints.audio) {
        const audioConstraints = typeof constraints.audio === 'boolean'
          ? { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
          : { ...constraints.audio, noiseSuppression: true, echoCancellation: true, autoGainControl: true };
        return original({ ...constraints, audio: audioConstraints });
      }
      return original(constraints);
    };
    return () => {
      if (originalGUMRef.current) {
        navigator.mediaDevices.getUserMedia = originalGUMRef.current;
      }
    };
  }, []);

  // Check microphone permission
  useEffect(() => {
    const checkMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission('granted');
      } catch {
        setMicPermission('denied');
      }
    };
    checkMic();
  }, []);

  // Start conversation session
  const startConversation = useCallback(async () => {
    if (conversationRef.current) return;

    setStatus('connecting');
    setError(null);

    try {
      const conversation = await Conversation.startSession({
        agentId,
        connectionType: 'websocket',
        clientTools: {
          check_availability: async (parameters: any) => {
            return callServerTool('check_availability', agentId, parameters);
          },
          book_appointment: async (parameters: any) => {
            return callServerTool('book_appointment', agentId, parameters);
          },
          get_current_datetime: async (parameters: any) => {
            return callServerTool('get_current_datetime', agentId, parameters);
          },
          get_caller_history: async (parameters: any) => {
            return callServerTool('get_caller_history', agentId, parameters);
          },
          get_business_hours: async (parameters: any) => {
            return callServerTool('get_business_hours', agentId, parameters);
          },
        },
        onConnect: ({ conversationId }) => {
          console.info('[AgentTestWidget] Connected, conversationId:', conversationId);
          setStatus('connected');
        },
        onDisconnect: () => {
          console.info('[AgentTestWidget] Disconnected');
          setStatus('disconnected');
          conversationRef.current = null;
        },
        onError: (message: string) => {
          console.error('[AgentTestWidget] Error:', message);
          setError(message);
        },
        onModeChange: ({ mode }) => {
          setAgentMode(mode === 'speaking' ? 'speaking' : 'listening');
        },
      });

      conversationRef.current = conversation;
    } catch (err) {
      console.error('[AgentTestWidget] Failed to start session:', err);
      setError(String(err));
      setStatus('idle');
    }
  }, [agentId]);

  // Auto-start conversation when mic permission is granted
  useEffect(() => {
    if (micPermission === 'granted' && status === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startConversation();
    }
  }, [micPermission, status, startConversation]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (conversationRef.current) {
      const newMuted = !isMuted;
      conversationRef.current.setMicMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // End conversation
  const endConversation = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch (err) {
        console.warn('[AgentTestWidget] Error ending session:', err);
      }
      conversationRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Record conversation & close
  const handleClose = useCallback(async () => {
    // End the conversation first
    await endConversation();

    setIsRecording(true);

    // Wait for ElevenLabs to register the conversation
    await new Promise((r) => setTimeout(r, 8000));

    let recorded = false;
    let noConversation = false;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        console.info(`[AgentTestWidget] Recording attempt ${attempt + 1}/4...`);
        const result = await api.post<ApiResponse<{ status?: string; id?: string; summary?: string; appointmentBooked?: boolean } | null>>(
          '/api/calls/record-conversation',
          { elevenlabsAgentId: agentId },
        );

        console.info('[AgentTestWidget] Result:', JSON.stringify(result.data));

        if (result.success && result.data) {
          if (result.data.status === 'recorded') {
            toast.success(t.testWidget.conversationRecorded);
            if (result.data.appointmentBooked) {
              toast.success(t.testWidget.appointmentDetected);
            }
            recorded = true;
            break;
          }
          if (result.data.status === 'no_new_conversation') {
            noConversation = true;
            if (attempt < 3) {
              console.info(`[AgentTestWidget] No conversation found yet, retrying in 10s...`);
              await new Promise((r) => setTimeout(r, 10000));
              continue;
            }
          }
        }
        break;
      } catch (err) {
        console.warn(`[AgentTestWidget] Record attempt ${attempt + 1} failed:`, err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
      }
    }

    if (!recorded) {
      if (noConversation) {
        toast.error(t.testWidget.noConversationDetected);
      } else {
        toast.error(t.testWidget.recordingFailed);
      }
    }

    setIsRecording(false);
    onClose();
  }, [agentId, endConversation, onClose, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession().catch(() => {});
        conversationRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {t.testWidget.title}: {agentName}
              </h2>
              <p className="text-xs text-text-tertiary">
                {t.testWidget.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isRecording}
            className="p-1 rounded-lg hover:bg-surface-tertiary text-text-tertiary disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Recording in progress */}
          {isRecording && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              <p className="text-sm text-text-secondary font-medium">{t.testWidget.savingConversation}</p>
            </div>
          )}

          {/* Microphone denied warning */}
          {!isRecording && micPermission === 'denied' && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-warning-50 border border-warning-200">
              <AlertCircle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-700">
                  {t.testWidget.micUnavailable}
                </p>
                <p className="text-xs text-warning-600 mt-1">
                  {t.testWidget.micUnavailableDescription}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {!isRecording && error && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-danger-400" />
              <p className="text-sm text-danger-600 font-medium">
                {t.testWidget.widgetLoadError}
              </p>
              <p className="text-xs text-text-tertiary max-w-xs">{error}</p>
              <Button variant="outline" size="sm" onClick={startConversation}>
                {t.common.refresh}
              </Button>
            </div>
          )}

          {/* Connecting */}
          {!isRecording && !error && status === 'connecting' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-text-tertiary">{t.testWidget.loadingWidget}</p>
            </div>
          )}

          {/* Mic permission pending */}
          {!isRecording && !error && status === 'idle' && micPermission === 'pending' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-text-tertiary">{t.testWidget.loadingWidget}</p>
            </div>
          )}

          {/* Connected — active conversation */}
          {!isRecording && !error && status === 'connected' && (
            <div className="flex flex-col items-center gap-6 py-4">
              {/* Status indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>{t.testWidget.widgetActive}</span>
              </div>

              {/* Agent mode visualization */}
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                  agentMode === 'speaking'
                    ? 'bg-brand-100 scale-110 animate-pulse'
                    : 'bg-surface-secondary scale-100'
                }`} />
                <div className="relative z-10">
                  {agentMode === 'speaking' ? (
                    <Volume2 className="w-10 h-10 text-brand-600" />
                  ) : (
                    <Mic className="w-10 h-10 text-green-600" />
                  )}
                </div>
              </div>

              <button
                onClick={toggleMute}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium ${
                  isMuted
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-quaternary'
                }`}
                title={isMuted ? t.testWidget.unmuteMic : t.testWidget.muteMic}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? t.testWidget.unmuteMic : t.testWidget.muteMic}</span>
              </button>

              <p className="text-sm text-text-secondary font-medium">
                {agentMode === 'speaking' ? t.testWidget.voiceResponse : t.testWidget.pressButton}
              </p>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClose}
                >
                  <PhoneOff className="w-4 h-4 mr-1.5" />
                  {t.common.close}
                </Button>
              </div>
            </div>
          )}

          {/* Disconnected */}
          {!isRecording && !error && status === 'disconnected' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <PhoneOff className="w-10 h-10 text-text-tertiary" />
              <p className="text-sm text-text-secondary">{t.testWidget.savingConversation}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <Button variant="outline" onClick={handleClose} disabled={isRecording}>
            {isRecording ? t.testWidget.savingConversation : t.common.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
