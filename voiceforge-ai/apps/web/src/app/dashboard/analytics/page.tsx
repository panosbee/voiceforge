// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Analytics Page
// Charts and KPIs for call data
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Card, Spinner, PageHeader } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatDuration } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Phone, PhoneIncoming, PhoneMissed, Clock, TrendingUp, Calendar } from 'lucide-react';
import type { ApiResponse } from '@voiceforge/shared';

interface AnalyticsSummary {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  completedCalls: number;
  missedCalls: number;
  appointmentsBooked: number;
}

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.get<ApiResponse<AnalyticsSummary>>('/api/calls/analytics/summary');
        if (result.success && result.data) {
          setData(result.data);
        }
      } catch {
        // Empty state handled below
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const stats = data ?? {
    totalCalls: 0,
    totalDuration: 0,
    avgDuration: 0,
    completedCalls: 0,
    missedCalls: 0,
    appointmentsBooked: 0,
  };

  const completionRate = stats.totalCalls > 0
    ? Math.round((stats.completedCalls / stats.totalCalls) * 100)
    : 0;

  const kpiCards = [
    {
      label: t.analytics.totalCalls,
      value: stats.totalCalls.toString(),
      subtext: t.analytics.last30Days,
      icon: Phone,
      color: 'text-brand-500',
      bgColor: 'bg-brand-50',
    },
    {
      label: t.analytics.completed,
      value: stats.completedCalls.toString(),
      subtext: `${completionRate}% ${t.analytics.rate}`,
      icon: PhoneIncoming,
      color: 'text-success-500',
      bgColor: 'bg-success-50',
    },
    {
      label: t.analytics.missed,
      value: stats.missedCalls.toString(),
      subtext: stats.totalCalls > 0 ? `${Math.round((stats.missedCalls / stats.totalCalls) * 100)}%` : '0%',
      icon: PhoneMissed,
      color: 'text-danger-500',
      bgColor: 'bg-danger-50',
    },
    {
      label: t.analytics.avgCallTime,
      value: formatDuration(stats.avgDuration),
      subtext: `${t.analytics.total}: ${formatDuration(stats.totalDuration)}`,
      icon: Clock,
      color: 'text-warning-500',
      bgColor: 'bg-warning-50',
    },
    {
      label: t.analytics.appointments,
      value: stats.appointmentsBooked.toString(),
      subtext: t.analytics.bookedViaAI,
      icon: Calendar,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
    {
      label: t.analytics.conversionRate,
      value: stats.totalCalls > 0
        ? `${Math.round((stats.appointmentsBooked / stats.totalCalls) * 100)}%`
        : '0%',
      subtext: t.analytics.callsToAppointments,
      icon: TrendingUp,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t.analytics.title}
        description={t.analytics.description}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} padding="md">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{kpi.label}</p>
                <p className="text-3xl font-bold text-text-primary mt-1">{kpi.value}</p>
                <p className="text-xs text-text-tertiary mt-1">{kpi.subtext}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Completion Rate Bar */}
      <Card padding="md" className="mb-6">
        <h3 className="font-semibold text-text-primary mb-4">{t.analytics.completionRate}</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="text-lg font-bold text-text-primary min-w-[60px] text-right">{completionRate}%</span>
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-tertiary">
          <span>{stats.completedCalls} {t.analytics.completedLabel}</span>
          <span>{stats.missedCalls} {t.analytics.missedLabel}</span>
        </div>
      </Card>

      {/* Placeholder for future charts */}
      <Card padding="lg" className="text-center">
        <TrendingUp className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-text-primary">{t.analytics.detailedCharts}</h3>
        <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
          {t.analytics.chartsDescription}
        </p>
      </Card>
    </div>
  );
}
