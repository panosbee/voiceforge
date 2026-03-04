// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Call Calendar Page
// Monthly calendar with daily intra-day timeline, audio playback,
// call details panel with transcript & AI summary.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Card, Badge, Spinner, PageHeader, EmptyState } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { formatDuration, formatPhoneNumber, getCallStatusLabels, cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar as CalendarIcon,
  Play,
  Pause,
  X,
  Clock,
  Bot,
  MessageSquare,
  Volume2,
  ExternalLink,
  CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';

// ── Types ────────────────────────────────────────────────────────

interface CalendarCall {
  id: string;
  callerNumber: string;
  agentNumber: string;
  agentName: string;
  direction: 'inbound' | 'outbound';
  status: string;
  durationSeconds: number | null;
  summary: string | null;
  sentiment: number | null;
  appointmentBooked: boolean;
  recordingUrl: string | null;
  transcript: string | null;
  startedAt: string;
  endedAt: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const statusLabels = getCallStatusLabels(t);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [calls, setCalls] = useState<CalendarCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Audio player state
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Load calls for the month ─────────────────────────────────

  const loadCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.get<ApiResponse<CalendarCall[]>>('/api/calls/calendar/month', {
        params: { year, month },
      });
      if (result.success && Array.isArray(result.data)) {
        setCalls(result.data);
      }
    } catch {
      toast.error(t.calendar.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [year, month, t.calendar.loadError]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // ── Navigation ───────────────────────────────────────────────

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
    setExpandedCallId(null);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
    setExpandedCallId(null);
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
    setExpandedCallId(null);
  };

  // ── Calendar grid computation ────────────────────────────────

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  // Start week on Monday: shift so Mon=0, Sun=6
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
  };

  // ── Group calls by day ───────────────────────────────────────

  const callsByDay = useMemo(() => {
    const map = new Map<number, CalendarCall[]>();
    for (const call of calls) {
      const d = new Date(call.startedAt);
      const day = d.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(call);
    }
    // Sort each day's calls by time
    for (const [, dayCalls] of map) {
      dayCalls.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    }
    return map;
  }, [calls]);

  const selectedDayCalls = selectedDay ? callsByDay.get(selectedDay) ?? [] : [];

  // ── Audio player ─────────────────────────────────────────────

  const handlePlay = (callId: string, url: string) => {
    if (playingCallId === callId) {
      // Toggle pause/play
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
      return;
    }

    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audio.onended = () => setPlayingCallId(null);
    audio.onerror = () => {
      setPlayingCallId(null);
      toast.error(t.calendar.noRecording);
    };
    audio.play();
    audioRef.current = audio;
    setPlayingCallId(callId);
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingCallId(null);
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Day names (Mon-first) ────────────────────────────────────
  // Reorder: Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const dayHeaders = [
    t.calendar.dayNamesShort[1], // Mon
    t.calendar.dayNamesShort[2], // Tue
    t.calendar.dayNamesShort[3], // Wed
    t.calendar.dayNamesShort[4], // Thu
    t.calendar.dayNamesShort[5], // Fri
    t.calendar.dayNamesShort[6], // Sat
    t.calendar.dayNamesShort[0], // Sun
  ];

  // ── Status color helper ──────────────────────────────────────

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success-500';
      case 'missed': return 'bg-danger-500';
      case 'voicemail': return 'bg-warning-500';
      case 'failed': return 'bg-danger-500';
      case 'in_progress': return 'bg-brand-500';
      default: return 'bg-text-tertiary';
    }
  };

  // ── Format time from ISO string ──────────────────────────────

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'el' ? 'el-GR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div>
      <PageHeader
        title={t.calendar.title}
        description={t.calendar.description}
        action={
          <Button variant="outline" leftIcon={<CalendarIcon className="w-4 h-4" />} onClick={goToToday}>
            {t.calendar.today}
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Calendar Grid ─────────────────────────────────────── */}
        <div className="xl:col-span-2">
          <Card padding="none">
            {/* Month header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-text-primary">
                {t.calendar.monthNames[month - 1]} {year}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {dayHeaders.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-center text-xs font-medium text-text-tertiary py-3',
                    i >= 5 && 'text-text-tertiary/60', // Weekend
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            {isLoading ? (
              <div className="flex items-center justify-center h-80">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-24 border-b border-r border-border bg-surface-secondary/30" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayCalls = callsByDay.get(day) ?? [];
                  const isSelected = selectedDay === day;
                  const completedCount = dayCalls.filter((c) => c.status === 'completed').length;
                  const missedCount = dayCalls.filter((c) => c.status === 'missed').length;
                  const hasAppointment = dayCalls.some((c) => c.appointmentBooked);

                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setExpandedCallId(null);
                      }}
                      className={cn(
                        'min-h-24 p-2 border-b border-r border-border text-left transition-colors relative',
                        'hover:bg-brand-50/50',
                        isSelected && 'bg-brand-50 ring-2 ring-brand-300 ring-inset',
                        isToday(day) && !isSelected && 'bg-brand-50/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isToday(day) ? 'text-white bg-brand-600 w-7 h-7 flex items-center justify-center rounded-full' : 'text-text-primary',
                            isSelected && !isToday(day) && 'text-brand-700',
                          )}
                        >
                          {day}
                        </span>
                        {hasAppointment && (
                          <CalendarCheck className="w-3.5 h-3.5 text-success-500" />
                        )}
                      </div>

                      {/* Call indicators */}
                      {dayCalls.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {dayCalls.length <= 3 ? (
                            dayCalls.map((call) => (
                              <div
                                key={call.id}
                                className="flex items-center gap-1 text-[10px] text-text-secondary truncate"
                              >
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getStatusDotColor(call.status))} />
                                <span>{formatTime(call.startedAt)}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              {dayCalls.slice(0, 2).map((call) => (
                                <div
                                  key={call.id}
                                  className="flex items-center gap-1 text-[10px] text-text-secondary truncate"
                                >
                                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getStatusDotColor(call.status))} />
                                  <span>{formatTime(call.startedAt)}</span>
                                </div>
                              ))}
                              <span className="text-[10px] text-brand-600 font-medium">
                                +{dayCalls.length - 2}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Summary badges */}
                      {dayCalls.length > 0 && (
                        <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
                          {completedCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-success-500/60" title={`${completedCount}`} />
                          )}
                          {missedCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-danger-500/60" title={`${missedCount}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Fill remaining cells to complete grid */}
                {Array.from({
                  length: (7 - ((startOffset + daysInMonth) % 7)) % 7,
                }).map((_, i) => (
                  <div key={`end-${i}`} className="min-h-24 border-b border-r border-border bg-surface-secondary/30" />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Day Detail Panel ──────────────────────────────────── */}
        <div className="xl:col-span-1">
          <Card padding="none" className="sticky top-6">
            {/* Day header */}
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">
                {selectedDay ? (
                  <>
                    {t.calendar.dayNames[new Date(year, month - 1, selectedDay).getDay()]}{' '}
                    {selectedDay} {t.calendar.monthNames[month - 1]}
                  </>
                ) : (
                  t.calendar.title
                )}
              </h3>
              {selectedDay && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  {selectedDayCalls.length} {t.calendar.callsCount}
                </p>
              )}
            </div>

            {/* Calls timeline */}
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {!selectedDay ? (
                <EmptyState
                  icon={<CalendarIcon className="w-10 h-10" />}
                  title={t.calendar.title}
                  description={t.calendar.description}
                />
              ) : selectedDayCalls.length === 0 ? (
                <div className="py-12 text-center">
                  <Phone className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary">{t.calendar.noCalls}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedDayCalls.map((call) => {
                    const isExpanded = expandedCallId === call.id;
                    const isPlaying = playingCallId === call.id;
                    const statusInfo = statusLabels[call.status] ?? { label: call.status, color: '' };

                    return (
                      <div key={call.id} className="animate-fadeIn">
                        {/* Call row */}
                        <button
                          onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                          className={cn(
                            'w-full text-left px-5 py-3 hover:bg-surface-secondary/50 transition-colors',
                            isExpanded && 'bg-surface-secondary/50',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Time */}
                            <div className="text-right shrink-0 w-14">
                              <span className="text-sm font-mono font-semibold text-text-primary">
                                {formatTime(call.startedAt)}
                              </span>
                            </div>

                            {/* Status dot + direction icon */}
                            <div className="relative">
                              {call.direction === 'inbound' ? (
                                <PhoneIncoming className="w-4 h-4 text-brand-500" />
                              ) : (
                                <PhoneOutgoing className="w-4 h-4 text-text-tertiary" />
                              )}
                              <span className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface',
                                getStatusDotColor(call.status),
                              )} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {formatPhoneNumber(call.callerNumber)}
                                </span>
                                {call.appointmentBooked && (
                                  <CalendarCheck className="w-3 h-3 text-success-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-text-tertiary">
                                  {call.agentName}
                                </span>
                                {call.durationSeconds != null && (
                                  <>
                                    <span className="text-text-tertiary text-[11px]">•</span>
                                    <span className="text-[11px] text-text-tertiary">
                                      {formatDuration(call.durationSeconds)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Recording badge */}
                            {call.recordingUrl && (
                              <Volume2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                            )}
                          </div>

                          {/* Summary preview */}
                          {call.summary && !isExpanded && (
                            <p className="text-[11px] text-text-tertiary mt-1.5 ml-[72px] line-clamp-1">
                              {call.summary}
                            </p>
                          )}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-3 animate-fadeIn border-l-2 border-brand-300 ml-5">
                            {/* Status & details */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-text-tertiary">{t.calendar.status}</span>
                                <div className="mt-0.5">
                                  <Badge
                                    variant={call.status === 'completed' ? 'success' : call.status === 'missed' ? 'danger' : 'default'}
                                  >
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <span className="text-text-tertiary">{t.calendar.duration}</span>
                                <p className="text-text-primary font-medium mt-0.5">
                                  {call.durationSeconds != null ? formatDuration(call.durationSeconds) : '—'}
                                </p>
                              </div>
                              <div>
                                <span className="text-text-tertiary">{t.calendar.agent}</span>
                                <p className="text-text-primary mt-0.5">{call.agentName}</p>
                              </div>
                              <div>
                                <span className="text-text-tertiary">
                                  {call.direction === 'inbound' ? t.calendar.incoming : t.calendar.outgoing}
                                </span>
                                <p className="text-text-primary font-mono text-[11px] mt-0.5">
                                  {formatPhoneNumber(call.callerNumber)}
                                </p>
                              </div>
                            </div>

                            {/* Audio player */}
                            {call.recordingUrl && (
                              <div className={cn(
                                'flex items-center gap-2 p-2.5 rounded-lg border transition-colors',
                                isPlaying
                                  ? 'bg-brand-50 border-brand-200'
                                  : 'bg-surface-secondary border-border',
                              )}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlay(call.id, call.recordingUrl!);
                                  }}
                                  className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0',
                                    isPlaying
                                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                                      : 'bg-brand-100 text-brand-600 hover:bg-brand-200',
                                  )}
                                >
                                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-text-primary">
                                    {isPlaying ? t.calendar.playing : t.calendar.listenRecording}
                                  </span>
                                  {call.durationSeconds != null && (
                                    <span className="text-[10px] text-text-tertiary ml-2">
                                      {formatDuration(call.durationSeconds)}
                                    </span>
                                  )}
                                </div>
                                {isPlaying && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      stopPlaying();
                                    }}
                                    className="p-1 rounded hover:bg-brand-100 text-text-tertiary"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            {!call.recordingUrl && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-secondary border border-border text-text-tertiary">
                                <Volume2 className="w-4 h-4 opacity-40" />
                                <span className="text-xs">{t.calendar.noRecording}</span>
                              </div>
                            )}

                            {/* AI Summary */}
                            {call.summary && (
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Bot className="w-3 h-3 text-brand-500" />
                                  <span className="text-[11px] font-medium text-text-tertiary">{t.calendar.summary}</span>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">{call.summary}</p>
                              </div>
                            )}

                            {/* Transcript preview */}
                            {call.transcript && (
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <MessageSquare className="w-3 h-3 text-brand-500" />
                                  <span className="text-[11px] font-medium text-text-tertiary">{t.calendar.transcript}</span>
                                </div>
                                <div className="bg-surface-tertiary rounded-lg p-2.5 max-h-32 overflow-y-auto">
                                  <pre className="text-[11px] text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
                                    {call.transcript.length > 500
                                      ? `${call.transcript.slice(0, 500)}...`
                                      : call.transcript
                                    }
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Sentiment */}
                            {call.sentiment != null && (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">
                                  {call.sentiment >= 4 ? '😊' : call.sentiment <= 2 ? '😞' : '😐'}
                                </span>
                                <span className="text-xs text-text-tertiary">{call.sentiment}/5</span>
                              </div>
                            )}

                            {/* Appointment badge */}
                            {call.appointmentBooked && (
                              <Badge variant="success">
                                <CalendarCheck className="w-3 h-3 mr-1" />
                                {t.calendar.appointmentIcon}
                              </Badge>
                            )}

                            {/* Link to full detail */}
                            <Link
                              href={`/dashboard/calls/${call.id}`}
                              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {t.calendar.viewDetails}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly summary footer */}
            {calls.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-surface-secondary/50">
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>
                    {calls.length} {t.calendar.callsCount}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-success-500" />
                      {calls.filter((c) => c.status === 'completed').length}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-danger-500" />
                      {calls.filter((c) => c.status === 'missed').length}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3 text-success-500" />
                      {calls.filter((c) => c.appointmentBooked).length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
