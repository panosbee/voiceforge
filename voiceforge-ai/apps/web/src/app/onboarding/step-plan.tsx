// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 2 — Plan Selection
// ═══════════════════════════════════════════════════════════════════

'use client';

import { Button } from '@/components/ui';
import { PLAN_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Plan } from '@voiceforge/shared';
import type { OnboardingData } from './page';

interface StepPlanProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPlan({ data, updateData, onNext, onBack }: StepPlanProps) {
  const { t } = useI18n();

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-2">{t.onboarding.planTitle}</h2>
        <p className="text-sm text-text-secondary">
          {t.onboarding.planSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(Object.keys(PLAN_LABELS) as Plan[]).map((planKey) => {
          const plan = PLAN_LABELS[planKey]!;
          const features = ((t.landing.plans as any)[planKey]?.features ?? []) as string[];
          const isSelected = data.plan === planKey;
          const isPopular = planKey === 'pro';

          return (
            <button
              key={planKey}
              type="button"
              onClick={() => updateData({ plan: planKey })}
              className={cn(
                'relative text-left p-6 rounded-xl border-2 transition-all duration-200',
                isSelected
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/30'
                  : 'border-border bg-surface hover:border-brand-300',
              )}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-600 text-white text-xs font-medium rounded-full">
                  {t.common.popular}
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
                  <span className="text-sm text-text-secondary">{t.common.perMonth}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-success-500 shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t.common.back}
        </Button>
        <Button onClick={onNext}>{t.common.next}</Button>
      </div>
    </div>
  );
}
