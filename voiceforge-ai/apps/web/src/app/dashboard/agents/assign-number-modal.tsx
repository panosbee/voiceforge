// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Assign Phone Number Modal
// Shows owned/active numbers and assigns to agent via SIP + ElevenLabs
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Button, Spinner } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatPhoneNumber } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { X, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';

interface OwnedNumber {
  phoneNumber: string;
  status: string;
  connectionId: string | null;
  monthlyCost: string;
  currency: string;
  assigned: boolean;
}

interface AssignNumberModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignNumberModal({ agentId, agentName, onClose, onAssigned }: AssignNumberModalProps) {
  const { t } = useI18n();
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{
    phoneNumber: string;
    elevenlabsConfigured: boolean;
    sipConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    loadOwnedNumbers();
  }, []);

  const loadOwnedNumbers = async () => {
    setIsLoading(true);
    try {
      const result = await api.get<ApiResponse<OwnedNumber[]>>('/api/numbers/owned');
      if (result.success && result.data) {
        setNumbers(result.data);
      }
    } catch {
      toast.error(t.assignNumber.searchError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedNumber) return;

    setIsAssigning(true);
    try {
      const result = await api.post<ApiResponse<{
        phoneNumber: string;
        elevenlabsConfigured: boolean;
        sipConfigured: boolean;
        note: string;
      }>>('/api/numbers/assign', {
        phoneNumber: selectedNumber,
        agentId,
      });

      if (result.success && result.data) {
        setAssignResult({
          phoneNumber: result.data.phoneNumber,
          elevenlabsConfigured: result.data.elevenlabsConfigured,
          sipConfigured: result.data.sipConfigured,
        });
        toast.success(t.assignNumber.purchaseSuccess);
      }
    } catch {
      toast.error(t.assignNumber.purchaseError);
    } finally {
      setIsAssigning(false);
    }
  };

  const availableNumbers = numbers.filter((n) => !n.assigned);

  // Success screen
  if (assignResult) {
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
              {formatPhoneNumber(assignResult.phoneNumber)}
            </p>
            <div className="space-y-2 text-sm text-text-secondary mb-6">
              <div className="flex items-center justify-center gap-2">
                {assignResult.sipConfigured ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>SIP Trunk (Telnyx → ElevenLabs)</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {assignResult.elevenlabsConfigured ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>ElevenLabs Agent Assignment</span>
              </div>
            </div>
            {assignResult.elevenlabsConfigured && assignResult.sipConfigured && (
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

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : availableNumbers.length > 0 ? (
            <div className="space-y-2">
              {availableNumbers.map((num) => (
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
                    <div>
                      <span className="font-mono font-medium text-text-primary">
                        {formatPhoneNumber(num.phoneNumber)}
                      </span>
                      <span className="flex items-center text-xs text-green-600 mt-0.5">
                        <CheckCircle className="w-3 h-3 mr-1" /> {t.assignNumber.activeLabel}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-text-primary">
                      ${num.monthlyCost}{t.common.perMonth}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="w-10 h-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">
                {t.assignNumber.noResults}
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
                onClick={handleAssign}
                isLoading={isAssigning}
                leftIcon={<CheckCircle className="w-4 h-4" />}
              >
                {isAssigning ? t.assignNumber.connecting : t.assignNumber.assignAndConnect}
              </Button>
            </div>
            <p className="text-xs text-text-tertiary mt-1.5">
              {t.assignNumber.assignNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
