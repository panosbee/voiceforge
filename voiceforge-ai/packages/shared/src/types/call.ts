import type { CallStatus } from '../constants';

/** Call record — one per inbound/outbound call */
export interface Call {
  id: string;
  customerId: string;
  agentId: string;
  telnyxConversationId: string | null;
  telnyxCallControlId: string | null;
  callerNumber: string; // Who called
  agentNumber: string; // Which +30 number received the call
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  transcript: string | null; // Full conversation text
  summary: string | null; // AI-generated 2-3 sentence summary
  sentiment: number | null; // 1-5 scale
  intentCategory: string | null; // e.g. "appointment_booking", "inquiry"
  appointmentBooked: boolean;
  insightsRaw: Record<string, unknown> | null; // Raw Telnyx insights JSON
  recordingUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** Call detail for single call view */
export interface CallDetail extends Call {
  agentName: string;
  customerBusinessName: string;
}

/** Call summary for list/dashboard */
export interface CallSummary {
  id: string;
  callerNumber: string;
  agentNumber: string;
  agentName: string;
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  durationSeconds: number | null;
  summary: string | null;
  sentiment: number | null;
  appointmentBooked: boolean;
  recordingUrl: string | null;
  startedAt: string;
}

/** Dashboard KPIs */
export interface CallAnalytics {
  totalCalls: number;
  totalMinutes: number;
  missedCalls: number;
  appointmentsBooked: number;
  averageSentiment: number;
  averageDuration: number;
  callsByDay: Array<{ date: string; count: number }>;
  callsByHour: Array<{ hour: number; count: number }>;
  topIntents: Array<{ intent: string; count: number }>;
}
