// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 4 — Phone Number Selection
// Search and select a Greek +30 phone number
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { Button, Input } from '@/components/ui';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Phone, Search, MapPin } from 'lucide-react';
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

interface AvailableNumber {
  phoneNumber: string;
  monthlyCost: string;
  upfrontCost: string;
  currency: string;
  features: string[];
  region: string;
}

export function StepNumber({ data, updateData, onNext, onBack }: StepNumberProps) {
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [locality, setLocality] = useState('');

  const searchNumbers = useCallback(async () => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const result = await api.get<ApiResponse<AvailableNumber[]>>('/api/numbers/available', {
        params: {
          ...(locality ? { locality } : {}),
          limit: 10,
        },
      });

      if (result.success && result.data) {
        setNumbers(result.data);
        if (result.data.length === 0) {
          toast.info('Δεν βρέθηκαν διαθέσιμοι αριθμοί. Δοκιμάστε διαφορετική περιοχή.');
        }
      }
    } catch {
      toast.error('Σφάλμα αναζήτησης αριθμών');
    } finally {
      setIsSearching(false);
    }
  }, [locality]);

  const formatPhone = (phone: string) => {
    if (phone.startsWith('+30')) {
      const digits = phone.slice(3);
      return `+30 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Επιλέξτε Τηλεφωνικό Αριθμό</h2>
      <p className="text-sm text-text-secondary mb-6">
        Αναζητήστε διαθέσιμους ελληνικούς αριθμούς (+30) για τον AI βοηθό σας.
      </p>

      {/* Search Controls */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Περιοχή (π.χ. Αθήνα, Θεσσαλονίκη)"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className="h-11"
          />
        </div>
        <Button onClick={searchNumbers} isLoading={isSearching} leftIcon={<Search className="w-4 h-4" />}>
          Αναζήτηση
        </Button>
      </div>

      {/* Number Results */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-text-secondary">Αναζήτηση αριθμών...</span>
        </div>
      )}

      {!isSearching && hasSearched && numbers.length === 0 && (
        <div className="text-center py-12">
          <Phone className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">Δεν βρέθηκαν διαθέσιμοι αριθμοί</p>
          <p className="text-sm text-text-tertiary mt-1">Δοκιμάστε διαφορετική περιοχή</p>
        </div>
      )}

      {!isSearching && numbers.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {numbers.map((num) => (
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
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center text-xs text-text-tertiary">
                    <MapPin className="w-3 h-3 mr-1" /> {num.region}
                  </span>
                  {num.features.length > 0 && (
                    <span className="text-xs text-text-tertiary">{num.features.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-text-primary">{num.monthlyCost} {num.currency}/μήνα</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Skip option */}
      {!data.selectedNumber && (
        <p className="text-xs text-text-tertiary text-center mt-4">
          Μπορείτε να παραλείψετε αυτό το βήμα και να προσθέσετε αριθμό αργότερα.
        </p>
      )}

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Πίσω
        </Button>
        <Button onClick={onNext}>
          {data.selectedNumber ? 'Επόμενο' : 'Παράλειψη'}
        </Button>
      </div>
    </div>
  );
}
