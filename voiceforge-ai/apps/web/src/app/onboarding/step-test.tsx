// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 4 — Test Your AI Agent
// Browser-based conversation test via ElevenLabs widget
// User can test unlimited times before choosing a phone number
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api-client';
import { MessageCircle, RefreshCw, Mic, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';
import type { OnboardingData } from './page';

interface StepTestProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const WIDGET_SCRIPT_URL = 'https://elevenlabs.io/convai-widget/index.js';

export function StepTest({ data, updateData, onNext, onBack }: StepTestProps) {
  const { t } = useI18n();
  const [isCreating, setIsCreating] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [hasTestedOnce, setHasTestedOnce] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Load the ElevenLabs widget script on mount
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
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => setScriptError(true);
    document.head.appendChild(script);
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

  // Mount/remount the widget when testAgentId changes
  useEffect(() => {
    if (!data.testAgentId || !isScriptLoaded || !widgetContainerRef.current) return;
    if (data.testAgentId.startsWith('dev_')) return;

    const container = widgetContainerRef.current;
    container.innerHTML = '';

    const el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', data.testAgentId);
    container.appendChild(el);

    setHasTestedOnce(true);

    return () => {
      container.innerHTML = '';
    };
  }, [data.testAgentId, isScriptLoaded]);

  /** Create or update the preview agent on ElevenLabs */
  const handleCreatePreview = useCallback(async () => {
    if (!data.agentName || !data.instructions || !data.greeting) {
      toast.error(t.onboarding.fillAgentFirst);
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.post<ApiResponse<{ elevenlabsAgentId: string }>>(
        '/api/agents/test-preview',
        {
          name: data.agentName,
          instructions: data.instructions,
          greeting: data.greeting,
          voiceId: data.voiceId,
          language: 'el',
          existingAgentId: data.testAgentId || undefined,
        },
      );

      if (result.success && result.data?.elevenlabsAgentId) {
        updateData({ testAgentId: result.data.elevenlabsAgentId });
        toast.success(data.testAgentId ? t.onboarding.agentUpdated : t.onboarding.testAgentCreated);
      } else {
        toast.error(t.onboarding.testAgentError);
      }
    } catch {
      toast.error(t.onboarding.testConnectionError);
    } finally {
      setIsCreating(false);
    }
  }, [data, updateData]);

  // Auto-create preview on first mount if agent data is complete and no preview exists
  useEffect(() => {
    if (!data.testAgentId && data.agentName && data.instructions && data.greeting) {
      handleCreatePreview();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">{t.onboarding.testTitle}</h2>
      <p className="text-sm text-text-secondary mb-6">
        {t.onboarding.testSubtitle1} {t.onboarding.testSubtitle2}
      </p>

      {/* Mic Warning */}
      {micPermission === 'denied' && (
        <div className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-warning-50 border border-warning-200">
          <AlertCircle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning-700">{t.onboarding.testMicUnavailable}</p>
            <p className="text-xs text-warning-600 mt-1">
              {t.onboarding.testMicEnable}
            </p>
          </div>
        </div>
      )}

      {/* Widget Area */}
      <div className="border border-border rounded-xl p-6 bg-surface-secondary min-h-[200px]">
        {/* Loading / Creating state */}
        {isCreating && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-text-tertiary">
              {data.testAgentId ? t.onboarding.testUpdating : t.onboarding.testCreating}
            </p>
          </div>
        )}

        {/* Script error */}
        {scriptError && !isCreating && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-danger-400" />
            <p className="text-sm text-danger-600 font-medium">{t.onboarding.testWidgetFailed}</p>
            <p className="text-xs text-text-tertiary max-w-xs">
              {t.onboarding.testCheckConnection}
            </p>
          </div>
        )}

        {/* No preview yet — prompt to create */}
        {!data.testAgentId && !isCreating && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <MessageCircle className="w-12 h-12 text-text-tertiary" />
            <p className="text-sm text-text-secondary text-center max-w-sm">
              {t.onboarding.testPressButton}
            </p>
            <Button
              onClick={handleCreatePreview}
              leftIcon={<Mic className="w-4 h-4" />}
            >
              {t.onboarding.testCreateBtn}
            </Button>
          </div>
        )}

        {/* Widget Active */}
        {data.testAgentId && !isCreating && isScriptLoaded && !scriptError && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
              <Mic className="w-3.5 h-3.5" />
              <span>{t.onboarding.testWidgetActive}</span>
            </div>

            {/* ElevenLabs widget (mounted imperatively) */}
            <div ref={widgetContainerRef} className="w-full min-h-[120px] flex items-center justify-center" />

            <p className="text-xs text-text-tertiary text-center max-w-sm">
              {t.onboarding.testSpeakGreek.replace('{agentName}', data.agentName)}
            </p>

            {/* Re-create / refresh button (if user went back and changed settings) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreatePreview}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {t.onboarding.testRefresh}
            </Button>
          </div>
        )}

        {/* Dev bypass message */}
        {data.testAgentId?.startsWith('dev_') && !isCreating && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-brand-400" />
            <p className="text-sm text-text-secondary font-medium">{t.onboarding.testDevMode}</p>
            <p className="text-xs text-text-tertiary max-w-xs">
              {t.onboarding.testDevModeHint}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6">
        <Button variant="outline" onClick={onBack} type="button">
          {t.common.back}
        </Button>
        <div className="flex items-center gap-3">
          {!hasTestedOnce && data.testAgentId && !data.testAgentId.startsWith('dev_') && (
            <p className="text-xs text-text-tertiary">{t.onboarding.testFirst}</p>
          )}
          <Button onClick={onNext} leftIcon={<ArrowRight className="w-4 h-4" />}>
            {t.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
