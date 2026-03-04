// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Test Widget (ElevenLabs Conversational AI)
// Embeds the ElevenLabs widget to test agents via browser microphone
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Mic, Phone, AlertCircle } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

interface AgentTestWidgetProps {
  agentId: string; // ElevenLabs agent ID
  agentName: string;
  onClose: () => void;
}

const WIDGET_SCRIPT_URL = 'https://elevenlabs.io/convai-widget/index.js';

export function AgentTestWidget({ agentId, agentName, onClose }: AgentTestWidgetProps) {
  const { t } = useI18n();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Load the ElevenLabs widget script
  useEffect(() => {
    const existingScript = document.querySelector(`script[src="${WIDGET_SCRIPT_URL}"]`);

    if (existingScript) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.type = 'text/javascript';

    script.onload = () => {
      setIsScriptLoaded(true);
    };

    script.onerror = () => {
      setScriptError(true);
    };

    document.head.appendChild(script);
  }, []);

  // Mount the custom element imperatively when script is loaded
  useEffect(() => {
    if (!isScriptLoaded || scriptError || !widgetContainerRef.current) return;

    const el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', agentId);
    widgetContainerRef.current.innerHTML = '';
    widgetContainerRef.current.appendChild(el);

    return () => {
      if (widgetContainerRef.current) {
        widgetContainerRef.current.innerHTML = '';
      }
    };
  }, [isScriptLoaded, scriptError, agentId]);

  // Check microphone permission
  useEffect(() => {
    const checkMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop tracks — we just wanted permission
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission('granted');
      } catch {
        setMicPermission('denied');
      }
    };

    checkMic();
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
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary text-text-tertiary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6" ref={containerRef}>
          {/* Microphone denied warning */}
          {micPermission === 'denied' && (
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

          {/* Script loading */}
          {!isScriptLoaded && !scriptError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-text-tertiary">{t.testWidget.loadingWidget}</p>
            </div>
          )}

          {/* Script error */}
          {scriptError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-danger-400" />
              <p className="text-sm text-danger-600 font-medium">
                {t.testWidget.widgetLoadError}
              </p>
              <p className="text-xs text-text-tertiary max-w-xs">
                {t.testWidget.widgetLoadErrorDescription}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                {t.common.refresh}
              </Button>
            </div>
          )}

          {/* ElevenLabs widget */}
          {isScriptLoaded && !scriptError && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                <Mic className="w-3.5 h-3.5" />
                <span>{t.testWidget.widgetActive}</span>
              </div>

              {/* The actual ElevenLabs widget (mounted imperatively) */}
              <div
                ref={widgetContainerRef}
                className="w-full min-h-[120px] flex items-center justify-center"
              />

              <p className="text-xs text-text-tertiary text-center max-w-sm">
                {t.testWidget.pressButton}
                {' '}{t.testWidget.voiceResponse}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
