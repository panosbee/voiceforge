// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Call Detail Page
// Full call details: transcript, insights, metadata
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Badge, Spinner, Button } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatDuration, formatDate, formatPhoneNumber, getCallStatusLabels } from '@/lib/utils';
import { ArrowLeft, Phone, Clock, Calendar, MessageSquare, BarChart3, Bot } from 'lucide-react';
import type { CallDetail, ApiResponse } from '@voiceforge/shared';
import { useI18n } from '@/lib/i18n';

export default function CallDetailPage() {
  const { t, locale } = useI18n();
  const callStatusLabels = getCallStatusLabels(t);
  const params = useParams();
  const router = useRouter();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCall = async () => {
      try {
        const result = await api.get<ApiResponse<CallDetail>>(`/api/calls/${params.id}`);
        if (result.success && result.data) {
          setCall(result.data);
        }
      } catch {
        // Error handled below
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) loadCall();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary">{t.callDetail.notFound}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/calls')}>
          {t.callDetail.backToCalls}
        </Button>
      </div>
    );
  }

  const statusInfo = callStatusLabels[call.status] ?? { label: call.status, color: '' };

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> {t.callDetail.back}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-mono">
            {formatPhoneNumber(call.callerNumber)}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {formatDate(call.startedAt, locale, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Badge
          variant={call.status === 'completed' ? 'success' : call.status === 'missed' ? 'danger' : 'default'}
        >
          {statusInfo.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transcript */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-text-primary">{t.callDetail.transcript}</h3>
            </div>
            {call.transcript ? (
              <div className="bg-surface-secondary rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
                  {call.transcript}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary italic">{t.callDetail.noTranscript}</p>
            )}
          </Card>

          {/* AI Summary */}
          {call.summary && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-brand-500" />
                <h3 className="font-semibold text-text-primary">{t.callDetail.aiSummary}</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{call.summary}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Call Metadata */}
          <Card padding="md">
            <h3 className="font-semibold text-text-primary mb-4">{t.callDetail.details}</h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-text-tertiary" />
                <div>
                  <dt className="text-xs text-text-tertiary">{t.callDetail.agentNumber}</dt>
                  <dd className="text-sm text-text-primary font-mono">
                    {formatPhoneNumber(call.agentNumber)}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <div>
                  <dt className="text-xs text-text-tertiary">{t.callDetail.duration}</dt>
                  <dd className="text-sm text-text-primary">{formatDuration(call.durationSeconds ?? 0)}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-text-tertiary" />
                <div>
                  <dt className="text-xs text-text-tertiary">{t.callDetail.date}</dt>
                  <dd className="text-sm text-text-primary">
                    {formatDate(call.startedAt, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </dd>
                </div>
              </div>
              {call.direction && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-text-tertiary" />
                  <div>
                    <dt className="text-xs text-text-tertiary">{t.callDetail.direction}</dt>
                    <dd className="text-sm text-text-primary">
                      {call.direction === 'inbound' ? t.callDetail.inbound : t.callDetail.outbound}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </Card>

          {/* Insights */}
          {(call.sentiment !== null || call.intentCategory) && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-brand-500" />
                <h3 className="font-semibold text-text-primary">Insights</h3>
              </div>
              <dl className="space-y-3">
                {call.sentiment !== null && call.sentiment !== undefined && (
                  <div>
                    <dt className="text-xs text-text-tertiary">Sentiment</dt>
                    <dd className="text-sm text-text-primary">
                      {call.sentiment >= 4 ? `😊 ${t.callDetail.positive}` : call.sentiment <= 2 ? `😞 ${t.callDetail.negative}` : `😐 ${t.callDetail.neutral}`}
                      <span className="text-text-tertiary ml-1">({call.sentiment}/5)</span>
                    </dd>
                  </div>
                )}
                {call.intentCategory && (
                  <div>
                    <dt className="text-xs text-text-tertiary">{t.callDetail.category}</dt>
                    <dd className="text-sm text-text-primary">{call.intentCategory}</dd>
                  </div>
                )}
                {call.appointmentBooked && (
                  <div>
                    <Badge variant="success">✅ {t.callDetail.appointmentBooked}</Badge>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
