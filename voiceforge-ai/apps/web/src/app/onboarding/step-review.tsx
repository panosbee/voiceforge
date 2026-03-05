// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 5 — Review & Confirm
// Final summary before creating everything
// ═══════════════════════════════════════════════════════════════════

'use client';

import { Button } from '@/components/ui';
import { INDUSTRY_LABELS, PLAN_LABELS, formatPhoneNumber } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { GREEK_VOICES } from '@voiceforge/shared';
import { CheckCircle, Building2, CreditCard, Bot, Phone, Pencil } from 'lucide-react';
import type { OnboardingData } from './page';

interface StepReviewProps {
  data: OnboardingData;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  goToStep: (step: number) => void;
}

function SectionCard({
  title,
  icon,
  stepIndex,
  goToStep,
  editLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  stepIndex: number;
  goToStep: (step: number) => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-text-primary">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => goToStep(stepIndex)}
          className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          <Pencil className="w-3.5 h-3.5" />
          {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export function StepReview({ data, onBack, onSubmit, isSubmitting, goToStep }: StepReviewProps) {
  const { t } = useI18n();
  const voiceName = GREEK_VOICES.find((v) => v.id === data.voiceId)?.name ?? data.voiceId;
  const planInfo = PLAN_LABELS[data.plan]!;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-50 mb-3">
          <CheckCircle className="w-6 h-6 text-success-500" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">{t.onboarding.reviewTitle}</h2>
        <p className="text-sm text-text-secondary mt-1">
          {t.onboarding.reviewSubtitle}
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Business */}
        <SectionCard title={t.onboarding.reviewBusiness} icon={<Building2 className="w-5 h-5 text-brand-500" />} stepIndex={0} goToStep={goToStep} editLabel={t.onboarding.editBtn}>
          <InfoRow label={t.onboarding.reviewCompanyName} value={data.businessName} />
          <InfoRow label={t.onboarding.reviewIndustry} value={INDUSTRY_LABELS[data.industry] ?? data.industry} />
          <InfoRow label={t.onboarding.reviewOwner} value={data.ownerName} />
          <InfoRow label="Email" value={data.email} />
          <InfoRow label={t.onboarding.reviewPhone} value={data.phone} />
          <InfoRow label={t.onboarding.reviewTimezone} value={data.timezone} />
        </SectionCard>

        {/* Plan */}
        <SectionCard title={t.onboarding.reviewPlan} icon={<CreditCard className="w-5 h-5 text-brand-500" />} stepIndex={1} goToStep={goToStep} editLabel={t.onboarding.editBtn}>
          <InfoRow label={t.onboarding.reviewPlan} value={planInfo.name} />
          <InfoRow label={t.onboarding.reviewPrice} value={`${planInfo.price}${t.onboarding.numberPerMonth}`} />
          <InfoRow label={t.onboarding.reviewIncludes} value={planInfo.description} />
        </SectionCard>

        {/* Agent */}
        <SectionCard title={t.onboarding.reviewAgent} icon={<Bot className="w-5 h-5 text-brand-500" />} stepIndex={2} goToStep={goToStep} editLabel={t.onboarding.editBtn}>
          <InfoRow label={t.onboarding.reviewAgentName} value={data.agentName} />
          <InfoRow label={t.onboarding.reviewVoice} value={voiceName} />
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-text-tertiary mb-1">{t.onboarding.reviewGreeting}:</p>
            <p className="text-sm text-text-secondary italic">&ldquo;{data.greeting.slice(0, 120)}{data.greeting.length > 120 ? '...' : ''}&rdquo;</p>
          </div>
        </SectionCard>

        {/* Phone Number */}
        <SectionCard title={t.onboarding.reviewNumber} icon={<Phone className="w-5 h-5 text-brand-500" />} stepIndex={4} goToStep={goToStep} editLabel={t.onboarding.editBtn}>
          {data.selectedNumber ? (
            <>
              <InfoRow label={t.onboarding.reviewNumberLabel} value={formatPhoneNumber(data.selectedNumber)} />
              {data.numberMonthlyCost && <InfoRow label={t.onboarding.reviewCost} value={`${data.numberMonthlyCost}${t.onboarding.numberPerMonth}`} />}
            </>
          ) : (
            <p className="text-sm text-text-tertiary italic">{t.onboarding.reviewNoNumber}</p>
          )}
        </SectionCard>
      </div>

      {/* What happens next */}
      <div className="bg-brand-50/50 border border-brand-200 rounded-xl p-5 mb-8">
        <h4 className="text-sm font-semibold text-brand-800 mb-2">{t.onboarding.reviewNextSteps}</h4>
        <ol className="text-sm text-brand-700 space-y-1 list-decimal list-inside">
          <li>{t.onboarding.reviewStep1}</li>
          <li>{t.onboarding.reviewStep2}</li>
          {data.kbDocumentIds.length > 0 && <li>{t.onboarding.reviewStep3} ({data.kbDocumentIds.length})</li>}
          {data.selectedNumber && <li>{t.onboarding.reviewStep4}</li>}
          <li>{t.onboarding.reviewStep5}</li>
        </ol>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          {t.common.back}
        </Button>
        <Button onClick={onSubmit} isLoading={isSubmitting} size="lg">
          {t.onboarding.reviewStartBtn}
        </Button>
      </div>
    </div>
  );
}
