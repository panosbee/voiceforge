// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls History Page
// Paginated list of all calls with filters
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, Badge, Spinner, EmptyState, PageHeader, Button, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatDuration, formatRelativeTime, formatPhoneNumber, getCallStatusLabels } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Phone, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { CallSummary, ApiResponse } from '@voiceforge/shared';

export default function CallsPage() {
  const { t } = useI18n();
  const callStatusLabels = getCallStatusLabels(t);

  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const limit = 20;

  const loadCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.get<ApiResponse<CallSummary[]> & { meta?: { total: number; page: number; pageSize: number } }>('/api/calls', {
        params: {
          page,
          limit,
          ...(status ? { status } : {}),
        },
      });

      if (result.success) {
        // API returns { data: CallSummary[], meta: { total, page, pageSize } }
        const callsData = Array.isArray(result.data) ? result.data : [];
        setCalls(callsData);
        setTotal((result as any).meta?.total ?? callsData.length);
      }
    } catch {
      // Silently handle — empty state will show
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <PageHeader title={t.calls.title} description={`${total} ${t.calls.totalCount}`} />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-text-tertiary" />
        <Select
          options={[
            { value: '', label: t.calls.allCalls },
            { value: 'completed', label: t.calls.completed },
            { value: 'missed', label: t.calls.missed },
            { value: 'voicemail', label: t.calls.voicemail },
            { value: 'failed', label: t.calls.failed },
          ]}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-48"
        />
      </div>

      {/* Calls List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : calls.length === 0 ? (
        <EmptyState
          icon={<Phone className="w-12 h-12" />}
          title={t.calls.noCallsFound}
          description={status ? t.calls.tryDifferentFilter : t.calls.callsWillAppear}
        />
      ) : (
        <>
          <Card padding="none">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs font-medium text-text-tertiary uppercase tracking-wider">
              <div className="col-span-3">{t.calls.caller}</div>
              <div className="col-span-2">{t.calls.agent}</div>
              <div className="col-span-2">{t.calls.status}</div>
              <div className="col-span-2">{t.calls.duration}</div>
              <div className="col-span-3">{t.calls.date}</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {calls.map((call) => {
                const statusInfo = callStatusLabels[call.status] ?? { label: call.status, color: '' };
                return (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.id}`}
                    className="grid grid-cols-12 gap-4 px-6 py-3.5 hover:bg-surface-secondary transition-colors items-center"
                  >
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-text-primary font-mono">
                        {formatPhoneNumber(call.callerNumber)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-text-secondary truncate">{call.agentName ?? '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <Badge
                        variant={
                          call.status === 'completed' ? 'success' :
                          call.status === 'missed' ? 'danger' :
                          call.status === 'voicemail' ? 'warning' : 'default'
                        }
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-text-secondary">{formatDuration(call.durationSeconds ?? 0)}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-text-secondary">{formatRelativeTime(call.startedAt, t.shared)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                {t.calls.page} {page} {t.calls.of} {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  {t.calls.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {t.calls.next}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
