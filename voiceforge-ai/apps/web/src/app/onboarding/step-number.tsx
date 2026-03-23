// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 4 — Phone Number Selection
// Shows owned/active numbers from the platform's Telnyx account
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Spinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Phone, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';
import type { OnboardingData } from './page';

interface StepNumberProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface OwnedNumber {
  phoneNumber: string;
  status: string;
  connectionId: string | null;
  monthlyCost: string;
  currency: string;
  assigned: boolean;
}

export function StepNumber({ data, updateData, onNext, onBack }: StepNumberProps) {
  const { t } = useI18n();
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOwnedNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOwnedNumbers = async () => {
    setIsLoading(true);
    try {
      const result = await api.get<ApiResponse<OwnedNumber[]>>('/api/numbers/owned');
      if (result.success && result.data) {
        setNumbers(result.data);
      }
    } catch {
      toast.error(t.onboarding.numberSearchError);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.startsWith('+30')) {
      const digits = phone.slice(3);
      return `+30 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return phone;
  };

  const availableNumbers = numbers.filter((n) => !n.assigned);

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">{t.onboarding.numberTitle}</h2>
      <p className="text-sm text-text-secondary mb-6">
        {t.onboarding.numberSubtitle}
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-text-secondary">{t.onboarding.numberSearching}</span>
        </div>
      )}

      {/* No available numbers */}
      {!isLoading && availableNumbers.length === 0 && (
        <div className="text-center py-12">
          <Phone className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">{t.onboarding.numberNoResults}</p>
        </div>
      )}

      {/* Number list */}
      {!isLoading && availableNumbers.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {availableNumbers.map((num) => (
            <button
              key={num.phoneNumber}
              type="button"
              onClick={() =>
                updateData({
                  selectedNumber: num.phoneNumber,
                  numberMonthlyCost: num.monthlyCost,
                })
              }
              className={cn(
                'w-full flex items-center gap-4 px-4 py-3 rounded-lg border text-left transition-all',
                data.selectedNumber === num.phoneNumber
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/30'
                  : 'border-border hover:border-brand-300 hover:bg-surface-secondary',
              )}
            >
              <Phone className={cn('w-5 h-5 shrink-0', data.selectedNumber === num.phoneNumber ? 'text-brand-600' : 'text-text-tertiary')} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-base font-medium text-text-primary">{formatPhone(num.phoneNumber)}</p>
                <span className="flex items-center text-xs text-green-600 mt-0.5">
                  <CheckCircle className="w-3 h-3 mr-1" /> {t.onboarding.numberActive}
                </span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-text-primary">{num.monthlyCost} {num.currency}{t.onboarding.numberPerMonth}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Skip option */}
      {!data.selectedNumber && (
        <p className="text-xs text-text-tertiary text-center mt-4">
          {t.onboarding.numberSkipNote}
        </p>
      )}

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          {t.common.back}
        </Button>
        <Button onClick={onNext}>
          {data.selectedNumber ? t.common.next : t.common.skip}
        </Button>
      </div>
    </div>
  );
}
