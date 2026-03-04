// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Assign Phone Number Modal
// Search Greek +30 numbers from Telnyx, purchase + SIP wire to agent
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { Button, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { X, Phone, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';

interface AvailableNumber {
  phoneNumber: string;
  monthlyCost: string;
  upfrontCost: string;
  currency: string;
  features: string[];
  region: string;
}

interface AssignNumberModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignNumberModal({ agentId, agentName, onClose, onAssigned }: AssignNumberModalProps) {
  const { t } = useI18n();
  const [locality, setLocality] = useState('');
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{
    phoneNumber: string;
    elevenlabsConfigured: boolean;
    sipConfigured: boolean;
  } | null>(null);

  const handleSearch = async () => {
    setIsSearching(true);
    setNumbers([]);
    setSelectedNumber(null);

    try {
      const params = new URLSearchParams({ limit: '10' });
      if (locality.trim()) {
        params.set('locality', locality.trim());
      }

      const result = await api.get<ApiResponse<AvailableNumber[]>>(
        `/api/numbers/available?${params.toString()}`,
      );

      if (result.success && result.data) {
        setNumbers(result.data);
        if (result.data.length === 0) {
          toast.info(t.assignNumber.noResults);
        }
      }
    } catch {
      toast.error(t.assignNumber.searchError);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedNumber) return;

    setIsPurchasing(true);
    try {
      const result = await api.post<ApiResponse<{
        phoneNumber: string;
        elevenlabsConfigured: boolean;
        sipConfigured: boolean;
        note: string;
      }>>('/api/numbers/purchase', {
        phoneNumber: selectedNumber,
        agentId,
      });

      if (result.success && result.data) {
        setPurchaseResult({
          phoneNumber: result.data.phoneNumber,
          elevenlabsConfigured: result.data.elevenlabsConfigured,
          sipConfigured: result.data.sipConfigured,
        });
        toast.success(t.assignNumber.purchaseSuccess);
      }
    } catch {
      toast.error(t.assignNumber.purchaseError);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Success screen
  if (purchaseResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
        <div className="bg-surface rounded-2xl shadow-modal w-full max-w-md overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              {t.assignNumber.connected}
            </h2>
            <p className="text-2xl font-mono font-semibold text-brand-600 mb-4">
              {formatPhoneNumber(purchaseResult.phoneNumber)}
            </p>
            <div className="space-y-2 text-sm text-text-secondary mb-6">
              <div className="flex items-center justify-center gap-2">
                {purchaseResult.sipConfigured ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>SIP Trunk (Telnyx → ElevenLabs)</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {purchaseResult.elevenlabsConfigured ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>ElevenLabs Agent Assignment</span>
              </div>
            </div>
            {purchaseResult.elevenlabsConfigured && purchaseResult.sipConfigured && (
              <p className="text-sm text-green-600 font-medium mb-4">
                {t.assignNumber.callNowNote}
              </p>
            )}
            <Button
              onClick={() => {
                onAssigned();
                onClose();
              }}
            >
              {t.assignNumber.done}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t.assignNumber.title}
            </h2>
            <p className="text-xs text-text-tertiary">
              {t.assignNumber.description} «{agentName}»
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-tertiary text-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={t.assignNumber.searchPlaceholder}
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              isLoading={isSearching}
              leftIcon={<Search className="w-4 h-4" />}
            >
              {t.common.search}
            </Button>
          </div>
          <p className="text-xs text-text-tertiary mt-1.5">
            {t.assignNumber.searchHint}
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : numbers.length > 0 ? (
            <div className="space-y-2">
              {numbers.map((num) => (
                <button
                  key={num.phoneNumber}
                  onClick={() => setSelectedNumber(num.phoneNumber)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    selectedNumber === num.phoneNumber
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-border hover:border-brand-300 hover:bg-surface-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedNumber === num.phoneNumber ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-text-tertiary'
                    }`}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="font-mono font-medium text-text-primary">
                      {formatPhoneNumber(num.phoneNumber)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-text-primary">
                      ${num.monthlyCost}{t.common.perMonth}
                    </span>
                    {num.upfrontCost !== '0' && (
                      <span className="text-xs text-text-tertiary block">
                        + ${num.upfrontCost} {t.common.oneTime}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : !isSearching && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="w-10 h-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">
                {t.assignNumber.searchPrompt}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedNumber && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">
                {t.assignNumber.selected} <span className="font-mono font-semibold">{formatPhoneNumber(selectedNumber)}</span>
              </div>
              <Button
                onClick={handlePurchase}
                isLoading={isPurchasing}
                leftIcon={<CheckCircle className="w-4 h-4" />}
              >
                {isPurchasing ? t.assignNumber.connecting : t.assignNumber.purchaseAndConnect}
              </Button>
            </div>
            <p className="text-xs text-text-tertiary mt-1.5">
              {t.assignNumber.purchaseNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
