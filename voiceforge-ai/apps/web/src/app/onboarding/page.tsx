// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Onboarding Wizard (Container)
// 5-step wizard: Business → Plan → Agent → Number → Review
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import type { Industry, Plan, ApiResponse, CustomerProfile } from '@voiceforge/shared';
import { useI18n } from '@/lib/i18n';

import { StepBusiness } from './step-business';
import { StepPlan } from './step-plan';
import { StepAgent } from './step-agent';
import { StepTest } from './step-test';
import { StepNumber } from './step-number';
import { StepReview } from './step-review';

// Step IDs for wizard navigation
const STEP_IDS = ['business', 'plan', 'agent', 'test', 'number', 'review'] as const;

/** Full onboarding data collected across all steps */
export interface OnboardingData {
  // Step 1 — Business
  businessName: string;
  industry: Industry | '';
  ownerName: string;
  email: string;
  phone: string;
  timezone: string;

  // Step 2 — Plan
  plan: Plan;

  // Step 3 — Agent
  agentName: string;
  greeting: string;
  instructions: string;
  voiceId: string;
  /** ElevenLabs KB document IDs uploaded during onboarding */
  kbDocumentIds: string[];

  // Step 4 — Test
  /** ElevenLabs agent ID created for testing (preview). Reused at final submit. */
  testAgentId: string;

  // Step 5 — Number
  selectedNumber: string;
  numberMonthlyCost: string;
}

const initialData: OnboardingData = {
  businessName: '',
  industry: '',
  ownerName: '',
  email: '',
  phone: '',
  timezone: 'Europe/Athens',
  plan: 'basic',
  agentName: '',
  greeting: '',
  instructions: '',
  voiceId: 'aTP4J5SJLQl74WTSRXKW', // ElevenLabs Σοφία (primary)
  kbDocumentIds: [],
  testAgentId: '',
  selectedNumber: '',
  numberMonthlyCost: '',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { setProfile } = useAuthStore();
  const { t } = useI18n();

  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Update a subset of the onboarding data */
  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  /** Move to next step */
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, STEP_IDS.length - 1));
  }, []);

  /** Move to previous step */
  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  /** Final submission — calls all backend APIs in sequence */
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // 1. Register customer (creates DB record — no external API needed)
      const registerResult = await api.post<ApiResponse<CustomerProfile>>('/api/customers/register', {
        businessName: data.businessName,
        industry: data.industry,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        plan: data.plan,
        timezone: data.timezone,
      });

      if (!registerResult.success) {
        toast.error(t.onboarding.accountCreateError);
        return;
      }

      toast.success(t.onboarding.accountCreated);

      // 2. Create the AI agent (reuse preview ElevenLabs agent if exists)
      const agentResult = await api.post<ApiResponse<{ id: string }>>('/api/agents', {
        name: data.agentName,
        industry: data.industry,
        greeting: data.greeting,
        instructions: data.instructions,
        voiceId: data.voiceId,
        language: 'el',
        knowledgeBaseDocIds: data.kbDocumentIds.length > 0 ? data.kbDocumentIds : undefined,
        existingElevenlabsAgentId: data.testAgentId || undefined,
      });

      if (!agentResult.success) {
        toast.error(t.onboarding.agentCreateError);
        return;
      }

      const agentId = agentResult.data!.id;
      toast.success(t.onboarding.agentCreated);

      // 3. Purchase phone number & assign to agent
      if (data.selectedNumber) {
        const numberResult = await api.post<ApiResponse<{ phoneNumber: string }>>('/api/numbers/purchase', {
          phoneNumber: data.selectedNumber,
          agentId,
        });

        if (numberResult.success) {
          toast.success(`${data.selectedNumber} ${t.onboarding.numberAcquired}`);
        } else {
          toast.warning(t.onboarding.numberAcquireError);
        }
      }

      // 4. Complete onboarding
      await api.post<ApiResponse<void>>('/api/customers/complete-onboarding');

      // 5. Refresh profile and redirect
      const profileResult = await api.get<ApiResponse<CustomerProfile>>('/api/customers/me');
      if (profileResult.success && profileResult.data) {
        setProfile(profileResult.data);
      }

      toast.success(t.onboarding.setupComplete);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : t.onboarding.unknownError;
      toast.error(`${t.admin.errorPrefix}: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [data, router, setProfile]);

  /** Render the current step component */
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepBusiness data={data} updateData={updateData} onNext={nextStep} />;
      case 1:
        return <StepPlan data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 2:
        return <StepAgent data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <StepTest data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 4:
        return <StepNumber data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 5:
        return (
          <StepReview
            data={data}
            onBack={prevStep}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            goToStep={setCurrentStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Top Bar */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <span className="text-lg font-bold text-text-primary">VoiceForge AI</span>
            <span className="text-sm text-text-secondary ml-auto">{t.onboarding.stepOf.replace('{current}', String(currentStep + 1)).replace('{total}', String(STEP_IDS.length))}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            {STEP_IDS.map((stepId, index) => {
              const stepLabels = t.onboarding.steps;
              const label = stepLabels[stepId as keyof typeof stepLabels] || stepId;
              return (
              <div key={stepId} className="flex items-center flex-1">
                {/* Step Circle */}
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0 transition-colors ${
                    index < currentStep
                      ? 'bg-brand-600 text-white'
                      : index === currentStep
                        ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                        : 'bg-surface-tertiary text-text-tertiary'
                  }`}
                >
                  {index < currentStep ? (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {/* Step Label */}
                <span
                  className={`ml-2 text-sm hidden sm:inline ${
                    index <= currentStep ? 'text-text-primary font-medium' : 'text-text-tertiary'
                  }`}
                >
                  {label}
                </span>
                {/* Connector Line */}
                {index < STEP_IDS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 rounded ${
                      index < currentStep ? 'bg-brand-500' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-fadeIn">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
