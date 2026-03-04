// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dashboard Overview Page
// KPI cards + recent calls + quick actions
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Spinner, PageHeader } from '@/components/ui';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useI18n } from '@/lib/i18n';
import { api, ApiError } from '@/lib/api-client';
import { formatDuration, formatRelativeTime, getCallStatusLabels } from '@/lib/utils';
import { Phone, PhoneIncoming, Clock, TrendingUp, Bot, ArrowRight } from 'lucide-react';
import type { ApiResponse, CallSummary } from '@voiceforge/shared';

interface AnalyticsSummary {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  completedCalls: number;
  missedCalls: number;
  appointmentsBooked: number;
}

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const callStatusLabels = getCallStatusLabels(t);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsRes, callsRes] = await Promise.all([
          api.get<ApiResponse<AnalyticsSummary>>('/api/calls/analytics/summary').catch(() => null),
          api
            .get<ApiResponse<CallSummary[]> & { meta?: { total: number } }>('/api/calls', {
              params: { limit: 5, page: 1 },
            })
            .catch(() => null),
        ]);

        if (analyticsRes?.success && analyticsRes.data) {
          setAnalytics(analyticsRes.data);
        }
        if (callsRes?.success) {
          // API returns { data: CallSummary[], meta: { ... } }
          const calls = Array.isArray(callsRes.data) ? callsRes.data : [];
          setRecentCalls(calls);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Not authenticated — handled by auth provider
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const kpis = [
    {
      label: t.dashboard.quickStats.totalCalls,
      value: analytics?.totalCalls ?? 0,
      icon: Phone,
      color: 'text-brand-500',
      bgColor: 'bg-brand-50',
    },
    {
      label: t.dashboard.quickStats.completed,
      value: analytics?.completedCalls ?? 0,
      icon: PhoneIncoming,
      color: 'text-success-500',
      bgColor: 'bg-success-50',
    },
    {
      label: t.dashboard.quickStats.avgTime,
      value: formatDuration(analytics?.avgDuration ?? 0),
      icon: Clock,
      color: 'text-warning-500',
      bgColor: 'bg-warning-50',
    },
    {
      label: t.dashboard.quickStats.appointments,
      value: analytics?.appointmentsBooked ?? 0,
      icon: TrendingUp,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
  ];

  return (
    <div>
      <PageHeader
        title={`${t.dashboard.goodMorning}${profile?.ownerName ? `, ${profile.ownerName.split(' ')[0]}` : ''}!`}
        description={t.dashboard.overview}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <Card key={kpi.label} padding="md">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{kpi.label}</p>
                <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls */}
        <Card className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-text-primary">{t.dashboard.recentCalls}</h3>
            <Link
              href="/dashboard/calls"
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {t.dashboard.allCalls} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentCalls.length === 0 ? (
              <div className="py-12 text-center">
                <Phone className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">{t.dashboard.noCallsYet}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {t.dashboard.callsWillAppear}
                </p>
              </div>
            ) : (
              recentCalls.map((call) => {
                const statusInfo = callStatusLabels[call.status] ?? {
                  label: call.status,
                  color: 'text-text-secondary',
                };
                return (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.id}`}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-surface-secondary transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {call.callerNumber}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {formatRelativeTime(call.startedAt, t.shared)} · {formatDuration(call.durationSeconds ?? 0)}
                      </p>
                    </div>
                    <Badge variant={call.status === 'completed' ? 'success' : call.status === 'missed' ? 'danger' : 'default'}>
                      {statusInfo.label}
                    </Badge>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card padding="md">
          <h3 className="font-semibold text-text-primary mb-4">{t.dashboard.quickActions}</h3>
          <div className="space-y-3">
            <Link href="/dashboard/agents">
              <Button variant="secondary" className="w-full justify-start" leftIcon={<Bot className="w-4 h-4" />}>
                {t.dashboard.manageAgents}
              </Button>
            </Link>
            <Link href="/dashboard/calls">
              <Button variant="secondary" className="w-full justify-start" leftIcon={<Phone className="w-4 h-4" />}>
                {t.dashboard.callHistory}
              </Button>
            </Link>
            <Link href="/dashboard/analytics">
              <Button variant="secondary" className="w-full justify-start" leftIcon={<TrendingUp className="w-4 h-4" />}>
                Analytics
              </Button>
            </Link>
          </div>

          {/* Plan info */}
          {profile && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-text-tertiary mb-1">{t.dashboard.plan}</p>
              <Badge variant="brand">{profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}</Badge>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
