// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls / Dashboard Routes
// Call history, analytics, individual call details
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gte, lte, desc, sql, count, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, calls, agents, appointments, webhookEvents, agentTaskEmails, tasks, callerMemories } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { getMonthRangeInTimezone, parseDateTimeInTimezone } from '../services/timezone.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { extractAppointmentFromTranscript } from '../services/transcript-parser.js';
import { notifyCallCompleted, sendTaskNotificationEmail, sendAppointmentInviteEmail, isEmailConfigured } from '../services/email.js';
import { generateIcsInvite } from '../services/ics-generator.js';
import { extractTasksFromTranscript } from '../services/task-extraction.js';
import { generateConfirmToken } from './tasks.js';
import { getTelephonyProvider } from '../services/telephony/index.js';
import { env } from '../config/env.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('calls');

export const callRoutes = new Hono<{ Variables: { user: AuthUser } }>();

callRoutes.use('*', authMiddleware);

// ── Validation ───────────────────────────────────────────────────

const listCallsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  agentId: z.string().uuid().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(), // ISO date
});

// ═══════════════════════════════════════════════════════════════════
// GET /calls — List calls with filtering & pagination
// ═══════════════════════════════════════════════════════════════════

callRoutes.get('/', zValidator('query', listCallsSchema), async (c) => {
  const user = c.get('user');
  const query = c.req.valid('query');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Build conditions
  const conditions = [eq(calls.customerId, customer.id)];
  if (query.agentId) conditions.push(eq(calls.agentId, query.agentId));
  if (query.from) conditions.push(gte(calls.startedAt, new Date(query.from)));
  if (query.to) conditions.push(lte(calls.startedAt, new Date(query.to)));

  const offset = (query.page - 1) * query.pageSize;

  const [callRecords, totalResult] = await Promise.all([
    db.query.calls.findMany({
      where: and(...conditions),
      orderBy: [desc(calls.startedAt)],
      limit: query.pageSize,
      offset,
      with: { agent: { columns: { name: true } } },
    }),
    db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return c.json<ApiResponse>({
    success: true,
    data: callRecords.map((call) => ({
      id: call.id,
      callerNumber: call.callerNumber,
      agentNumber: call.agentNumber,
      agentName: call.agent.name,
      direction: call.direction,
      status: call.status,
      durationSeconds: call.durationSeconds,
      summary: call.summary,
      sentiment: call.sentiment,
      appointmentBooked: call.appointmentBooked,
      recordingUrl: call.recordingUrl,
      startedAt: call.startedAt.toISOString(),
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /calls/analytics — Dashboard KPIs
// ═══════════════════════════════════════════════════════════════════

callRoutes.get('/analytics/summary', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Aggregate stats for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const statsResult = await db
    .select({
      totalCalls: count(),
      totalMinutes: sql<number>`COALESCE(SUM(${calls.durationSeconds}) / 60, 0)`.as('totalMinutes'),
      avgDuration: sql<number>`COALESCE(AVG(${calls.durationSeconds}), 0)`.as('avgDuration'),
      avgSentiment: sql<number>`COALESCE(AVG(${calls.sentiment}), 0)`.as('avgSentiment'),
      appointmentsBooked: sql<number>`COUNT(*) FILTER (WHERE ${calls.appointmentBooked} = true)`.as(
        'appointmentsBooked',
      ),
      missedCalls: sql<number>`COUNT(*) FILTER (WHERE ${calls.status} = 'missed')`.as('missedCalls'),
    })
    .from(calls)
    .where(and(eq(calls.customerId, customer.id), gte(calls.startedAt, thirtyDaysAgo)));

  const stats = statsResult[0];

  return c.json<ApiResponse>({
    success: true,
    data: {
      totalCalls: stats?.totalCalls ?? 0,
      totalMinutes: Math.round(Number(stats?.totalMinutes ?? 0)),
      missedCalls: Number(stats?.missedCalls ?? 0),
      appointmentsBooked: Number(stats?.appointmentsBooked ?? 0),
      averageSentiment: Number(Number(stats?.avgSentiment ?? 0).toFixed(1)),
      averageDuration: Math.round(Number(stats?.avgDuration ?? 0)),
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /calls/calendar — Get all calls for a month (calendar view)
// Returns calls with time, status, duration, recording, agent info
// ═══════════════════════════════════════════════════════════════════

const calendarSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

callRoutes.get('/calendar/month', zValidator('query', calendarSchema), async (c) => {
  const user = c.get('user');
  const { year, month } = c.req.valid('query');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Build timezone-aware date range for the month
  // Uses customer's timezone so midnight boundaries are correct
  const customerTz = customer.timezone || 'Europe/Athens';
  const { startDate, endDate } = getMonthRangeInTimezone(year, month, customerTz);

  log.debug({ year, month, timezone: customerTz, startDate: startDate.toISOString(), endDate: endDate.toISOString() }, 'Calendar query range');

  const callRecords = await db.query.calls.findMany({
    where: and(
      eq(calls.customerId, customer.id),
      gte(calls.startedAt, startDate),
      lte(calls.startedAt, endDate),
    ),
    orderBy: [desc(calls.startedAt)],
    with: { agent: { columns: { name: true } } },
  });

  // Return full call data for calendar rendering
  return c.json<ApiResponse>({
    success: true,
    data: callRecords.map((call) => ({
      id: call.id,
      callerNumber: call.callerNumber,
      agentNumber: call.agentNumber,
      agentName: call.agent.name,
      direction: call.direction,
      status: call.status,
      durationSeconds: call.durationSeconds,
      summary: call.summary,
      sentiment: call.sentiment,
      appointmentBooked: call.appointmentBooked,
      recordingUrl: call.recordingUrl,
      transcript: call.transcript,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
    })),
    meta: { year, month, total: callRecords.length },
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /calls/calendar/appointments — Appointments for a month
// Returns appointments on their SCHEDULED date (not call date)
// ═══════════════════════════════════════════════════════════════════

const appointmentsCalendarSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

callRoutes.get('/calendar/appointments', zValidator('query', appointmentsCalendarSchema), async (c) => {
  const user = c.get('user');
  const { year, month } = c.req.valid('query');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const customerTz = customer.timezone || 'Europe/Athens';
  const { startDate, endDate } = getMonthRangeInTimezone(year, month, customerTz);

  const appointmentRecords = await db.query.appointments.findMany({
    where: and(
      eq(appointments.customerId, customer.id),
      gte(appointments.scheduledAt, startDate),
      lte(appointments.scheduledAt, endDate),
    ),
    orderBy: [desc(appointments.scheduledAt)],
    with: {
      agent: { columns: { name: true } },
      call: { columns: { id: true, callerNumber: true, summary: true, transcript: true } },
    },
  });

  return c.json<ApiResponse>({
    success: true,
    data: appointmentRecords.map((apt) => ({
      id: apt.id,
      callerName: apt.callerName,
      callerPhone: apt.callerPhone,
      agentName: apt.agent.name,
      serviceType: apt.serviceType,
      scheduledAt: apt.scheduledAt.toISOString(),
      durationMinutes: apt.durationMinutes,
      status: apt.status,
      notes: apt.notes,
      callId: apt.callId,
      callSummary: apt.call?.summary ?? null,
    })),
    meta: { year, month, total: appointmentRecords.length },
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /calls/calendar/appointments/:appointmentId — Delete an appointment
// ═══════════════════════════════════════════════════════════════════

callRoutes.delete('/calendar/appointments/:appointmentId', async (c) => {
  const user = c.get('user');
  const appointmentId = c.req.param('appointmentId');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Verify appointment belongs to this customer
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.customerId, customer.id)),
  });

  if (!appointment) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } }, 404);
  }

  await db.delete(appointments).where(eq(appointments.id, appointmentId));

  log.info({ appointmentId, customerId: customer.id }, 'Appointment deleted');

  return c.json<ApiResponse>({ success: true, data: { deletedId: appointmentId } });
});

// ═══════════════════════════════════════════════════════════════════
// GET /calls/:id — Get full call detail with transcript
// MUST be after all static GET routes to avoid /:id catching "stats" etc.
// ═══════════════════════════════════════════════════════════════════

callRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const callId = c.req.param('id');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const callRecord = await db.query.calls.findFirst({
    where: and(eq(calls.id, callId), eq(calls.customerId, customer.id)),
    with: {
      agent: { columns: { name: true } },
      appointments: true,
    },
  });

  if (!callRecord) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } }, 404);
  }

  return c.json<ApiResponse>({ success: true, data: callRecord });
});

// ═══════════════════════════════════════════════════════════════════
// POST /calls/e2e-test — REMOVED (was mock data)
// Real testing now uses AgentTestWidget → /calls/record-conversation
// which opens a real ElevenLabs conversation, records the actual
// transcript, extracts data via AI pipeline, and creates real
// appointments with slot conflict checking.
// DELETE endpoints below are kept for cleanup of legacy test data.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// DELETE /calls/e2e-test/:id — Delete a test call
// Allows deletion of calls with metadata.isE2ETest or isWidgetTest
// ═══════════════════════════════════════════════════════════════════

callRoutes.delete('/e2e-test/:id', async (c) => {
  const user = c.get('user');
  const callId = c.req.param('id');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const callRecord = await db.query.calls.findFirst({
    where: and(eq(calls.id, callId), eq(calls.customerId, customer.id)),
  });

  if (!callRecord) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } }, 404);
  }

  // Safety: only delete test calls (legacy E2E or widget recordings)
  const meta = callRecord.metadata as Record<string, unknown> | null;
  if (!meta || (meta.isE2ETest !== true && meta.isWidgetTest !== true)) {
    return c.json<ApiResponse>({ success: false, error: { code: 'FORBIDDEN', message: 'Only test calls can be deleted' } }, 403);
  }

  // Delete appointments linked to this test call
  await db.delete(appointments).where(eq(appointments.callId, callId));

  // Delete orphaned appointments (created by server-tool, callId=NULL) for same agent
  if (callRecord.agentId) {
    await db.delete(appointments).where(
      and(
        eq(appointments.customerId, customer.id),
        eq(appointments.agentId, callRecord.agentId),
        isNull(appointments.callId),
      ),
    );
  }

  // Delete dedup entry so this conversation can be re-recorded if needed
  if (callRecord.telnyxConversationId) {
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, callRecord.telnyxConversationId));
  }

  await db.delete(calls).where(eq(calls.id, callId));

  log.info({ callId }, '🗑️ Test call + appointments + dedup deleted');

  return c.json<ApiResponse>({ success: true, data: { deleted: true } });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /calls/e2e-test — Delete ALL test calls for current customer
// Bulk cleanup of all E2E + widget test data
// ═══════════════════════════════════════════════════════════════════

callRoutes.delete('/e2e-test', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Find all test call IDs (legacy E2E + widget recordings)
  const testCalls = await db
    .select({ id: calls.id })
    .from(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`(${calls.metadata}->>'isE2ETest' = 'true' OR ${calls.metadata}->>'isWidgetTest' = 'true')`,
      ),
    );

  const testCallIds = testCalls.map(c => c.id);

  // Also find which agents had test calls (for orphaned appointment cleanup)
  const testCallsWithAgents = await db
    .select({ id: calls.id, agentId: calls.agentId })
    .from(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`(${calls.metadata}->>'isE2ETest' = 'true' OR ${calls.metadata}->>'isWidgetTest' = 'true')`,
      ),
    );
  const testAgentIds = [...new Set(testCallsWithAgents.map(c => c.agentId).filter(Boolean))] as string[];

  // Delete appointments linked to test calls (by callId)
  if (testCallIds.length > 0) {
    await db.delete(appointments).where(inArray(appointments.callId, testCallIds));
  }

  // Delete orphaned appointments created by server-tool (callId=NULL) for test agents
  if (testAgentIds.length > 0) {
    await db.delete(appointments).where(
      and(
        eq(appointments.customerId, customer.id),
        inArray(appointments.agentId, testAgentIds),
        isNull(appointments.callId),
      ),
    );
  }

  // Delete dedup entries for widget-recorded conversations so they can be re-recorded
  const testCallConvIds = await db
    .select({ convId: calls.telnyxConversationId })
    .from(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`(${calls.metadata}->>'isE2ETest' = 'true' OR ${calls.metadata}->>'isWidgetTest' = 'true')`,
      ),
    );
  const convIds = testCallConvIds.map(c => c.convId).filter(Boolean) as string[];
  if (convIds.length > 0) {
    await db.delete(webhookEvents).where(inArray(webhookEvents.eventId, convIds));
  }

  // Delete the test calls
  const result = await db
    .delete(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`(${calls.metadata}->>'isE2ETest' = 'true' OR ${calls.metadata}->>'isWidgetTest' = 'true')`,
      ),
    )
    .returning({ id: calls.id });

  log.info({ count: result.length, customerId: customer.id }, '🗑️ All test calls + appointments + dedup deleted');

  return c.json<ApiResponse>({ success: true, data: { deletedCount: result.length } });
});

// ═══════════════════════════════════════════════════════════════════
// POST /calls/record-conversation — Record a REAL widget conversation
// After a live chat via the ElevenLabs widget, the frontend calls this
// with the ElevenLabs agent ID. We fetch the latest conversation from
// the ElevenLabs API and store it as a real call record with transcript,
// summary, sentiment and appointment (if detected).
// ═══════════════════════════════════════════════════════════════════

const recordConversationSchema = z.object({
  elevenlabsAgentId: z.string().min(1),
});

callRoutes.post('/record-conversation', zValidator('json', recordConversationSchema), async (c) => {
  const user = c.get('user');
  const { elevenlabsAgentId } = c.req.valid('json');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Find the agent in our DB by ElevenLabs agent ID
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.elevenlabsAgentId, elevenlabsAgentId), eq(agents.customerId, customer.id)),
  });
  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  if (!elevenlabsService.isConfigured()) {
    return c.json<ApiResponse>({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'ElevenLabs not configured' } }, 503);
  }

  try {
    // ── Step 1: Find the newest unrecorded conversation ────────────
    // Retry up to 6 times with 5s delays (~30s total) — ElevenLabs can
    // take 10-20s to register a conversation after call end.
    let conversationId: string | null = null;
    const MAX_FIND_ATTEMPTS = 6;

    for (let findAttempt = 0; findAttempt < MAX_FIND_ATTEMPTS; findAttempt++) {
      try {
        const conversations = await elevenlabsService.getConversations(elevenlabsAgentId);

        if (conversations && conversations.length > 0) {
          for (const conv of conversations) {
            const cid = ((conv as Record<string, unknown>).conversationId ?? (conv as Record<string, unknown>).conversation_id) as string | undefined;
            if (!cid) continue;

            const existing = await db.query.webhookEvents.findFirst({
              where: eq(webhookEvents.eventId, cid),
            });
            if (!existing) {
              conversationId = cid;
              break;
            }
          }
        }
      } catch (findErr) {
        log.warn({ error: findErr, attempt: findAttempt + 1 }, 'Error listing conversations — retrying');
      }

      if (conversationId) break;

      if (findAttempt < MAX_FIND_ATTEMPTS - 1) {
        log.info({ attempt: findAttempt + 1, elevenlabsAgentId }, 'No unrecorded conversation found yet — retrying...');
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!conversationId) {
      log.info({ elevenlabsAgentId }, 'No unrecorded conversation found after retries');
      return c.json<ApiResponse>({ success: true, data: { status: 'no_new_conversation' } });
    }

    // ── Step 2: Fetch full conversation — poll until AI analysis is ready ──
    // ElevenLabs processes conversations asynchronously: the transcript
    // appears first, but the summary, data collection, and evaluation
    // criteria take several more seconds. We poll up to 5 times (total ~15s).
    let full: Record<string, unknown> = {};
    let transcript: Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }> = [];
    let analysis: Record<string, unknown> | undefined;
    let metadata: Record<string, unknown> | undefined;

    // Poll up to 15 times with progressive backoff (total ~2 minutes)
    // Long calls (>10min) can take 60-90s for AI analysis to complete.
    const MAX_ANALYSIS_ATTEMPTS = 15;
    for (let analysisAttempt = 0; analysisAttempt < MAX_ANALYSIS_ATTEMPTS; analysisAttempt++) {
      try {
        full = await elevenlabsService.getConversation(conversationId);
      } catch (fetchErr) {
        log.warn({ error: fetchErr, conversationId, attempt: analysisAttempt + 1 }, '⚠️ Failed to fetch conversation — retrying');
        if (analysisAttempt < MAX_ANALYSIS_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        break;
      }
      transcript = (full.transcript ?? []) as Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }>;
      analysis = full.analysis as Record<string, unknown> | undefined;
      metadata = full.metadata as Record<string, unknown> | undefined;

      const hasTranscript = transcript.length > 0 && transcript.some((m) => m.message);
      const hasSummary = !!(analysis?.transcriptSummary ?? analysis?.transcript_summary);
      const hasDataCollection = Object.keys((analysis?.dataCollectionResults ?? analysis?.data_collection_results ?? {}) as Record<string, unknown>).length > 0;

      if (hasTranscript && (hasSummary || hasDataCollection)) {
        log.info({ conversationId, attempt: analysisAttempt + 1, hasSummary, hasDataCollection }, '✅ Conversation analysis ready');
        break;
      }

      if (analysisAttempt < MAX_ANALYSIS_ATTEMPTS - 1) {
        // Progressive backoff: 3s, 4s, 5s, 6s, 7s, 8s, 8s, 8s, 10s, 10s...
        const delay = Math.min(3000 + analysisAttempt * 1000, 10000);
        log.info({ conversationId, attempt: analysisAttempt + 1, hasTranscript, hasSummary, hasDataCollection, nextDelayMs: delay }, '⏳ Waiting for AI analysis...');
        await new Promise(r => setTimeout(r, delay));
      } else {
        log.warn({ conversationId, hasTranscript, hasSummary, hasDataCollection }, `⚠️ AI analysis not available after ${MAX_ANALYSIS_ATTEMPTS} attempts — recording with available data`);
      }
    }

    // Build formatted transcript text
    const agentDisplayName = agent.name || 'AI Assistant';
    const callerLabel = agent.language === 'en' ? 'Caller' : 'Πελάτης';
    let transcriptText = '';
    if (transcript.length > 0) {
      transcriptText = transcript
        .filter((msg) => msg.message)
        .map((msg) => {
          const role = msg.role === 'agent' ? agentDisplayName : callerLabel;
          return `[${role}]: ${msg.message}`;
        })
        .join('\n');
    }

    if (!transcriptText) {
      log.warn({ conversationId }, 'Conversation has no transcript — saving call record without transcript');
      // Still save the call so it appears in the dashboard (ElevenLabs may not have processed it yet)
      transcriptText = '';
    }

    // Calculate duration
    const durationSeconds = Math.ceil(
      (metadata?.call_duration_secs ??
      metadata?.callDurationSecs ??
      (transcript.length > 0
        ? (transcript[transcript.length - 1]?.time_in_call_secs ?? transcript[transcript.length - 1]?.timeInCallSecs ?? 0)
        : 0)) as number
    );

    // Extract analysis data — ElevenLabs AI provides structured extraction
    const summary = (analysis?.transcriptSummary ?? analysis?.transcript_summary ?? null) as string | null;
    const callSuccessful = analysis?.callSuccessful ?? analysis?.call_successful;

    // Extract AI-collected data from dataCollectionResults
    const dataCollectionResults = (analysis?.dataCollectionResults ?? analysis?.data_collection_results ?? {}) as Record<string, unknown>;
    const extractedData: Record<string, string> = {};
    if (dataCollectionResults && typeof dataCollectionResults === 'object') {
      for (const [key, val] of Object.entries(dataCollectionResults)) {
        const v = val as Record<string, unknown>;
        if (v?.value !== undefined && v.value !== null && String(v.value).trim() !== '') {
          extractedData[key] = String(v.value);
        }
      }
    }

    // Fallback: if AI data collection returned nothing (agent missing platformSettings),
    // parse the transcript text for date/time/name/phone patterns
    const aiDataAvailable = Object.keys(extractedData).length > 0;
    if (!aiDataAvailable && transcriptText) {
      const fallback = extractAppointmentFromTranscript(transcriptText);
      log.info({ conversationId, fallback }, 'AI data collection empty — using transcript fallback extraction');
      for (const [key, val] of Object.entries(fallback)) {
        if (val) extractedData[key] = val;
      }

      // Background: update the agent's platformSettings for future conversations
      try {
        if (agent.elevenlabsAgentId) {
          elevenlabsService.updateAgent(agent.elevenlabsAgentId, { name: agent.name }).catch((err) => {
            log.warn({ error: err, agentId: agent.elevenlabsAgentId }, 'Background agent platformSettings update failed');
          });
        }
      } catch { /* non-critical */ }
    }

    // Check evaluation criteria results (AI-determined)
    const evalResults = (analysis?.evaluationCriteriaResults ?? analysis?.evaluation_criteria_results ?? {}) as Record<string, unknown>;
    const appointmentEval = evalResults?.appointment_booked as Record<string, unknown> | undefined;
    const appointmentBookedByAi = appointmentEval?.result === 'success';

    // Sentiment
    const sentimentScore = callSuccessful === 'success' || callSuccessful === 'true' ? 5 :
                           callSuccessful === 'failure' || callSuccessful === 'false' ? 2 : 4;

    // Appointment detection: trust AI data collection first
    const appointmentBooked = appointmentBookedByAi || !!(extractedData.appointment_date || extractedData.appointment_time);
    const appointmentDate = extractedData.appointment_date || null;
    const appointmentTime = extractedData.appointment_time || '09:00';
    const appointmentCallerName = extractedData.caller_name || null;
    const appointmentCallerPhone = extractedData.caller_phone || 'widget';
    const appointmentReason = extractedData.appointment_reason || null;
    const callerIntent = extractedData.caller_intent || (appointmentBooked ? 'appointment_booking' : 'inquiry');

    log.info(
      { conversationId, extractedData, appointmentBookedByAi, appointmentBooked },
      'AI-extracted data from conversation',
    );

    // Compute start time from conversation metadata
    const startTimeUnix = metadata?.start_time_unix_secs ?? metadata?.startTimeUnixSecs;
    const startedAt = startTimeUnix ? new Date(Number(startTimeUnix) * 1000) : new Date(Date.now() - durationSeconds * 1000);
    const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const intentCategory = callerIntent;

    // Insert call record
    const [callRecord] = await db.insert(calls).values({
      customerId: customer.id,
      agentId: agent.id,
      telnyxConversationId: conversationId,
      callerNumber: appointmentCallerPhone !== 'widget' ? appointmentCallerPhone : 'widget',
      agentNumber: agent.phoneNumber || 'widget',
      direction: 'inbound',
      status: 'completed',
      startedAt,
      endedAt,
      durationSeconds,
      transcript: transcriptText,
      summary,
      sentiment: sentimentScore,
      intentCategory,
      appointmentBooked,
      insightsRaw: { analysis, metadata: metadata as Record<string, unknown>, extractedData, source: 'widget-recording' },
      metadata: { isWidgetTest: true, recordedBy: 'record-conversation' },
    }).returning();

    if (!callRecord) {
      return c.json<ApiResponse>({ success: false, error: { code: 'INSERT_FAILED', message: 'Failed to create call record' } }, 500);
    }

    // Log webhook event for dedup
    await db.insert(webhookEvents).values({
      eventId: conversationId,
      eventType: 'widget.record_conversation',
      source: 'widget',
      payload: { conversationId, agentId: elevenlabsAgentId, source: 'record-conversation' },
    });

    if (customer && callRecord) {
      await notifyCallCompleted({
        callId: callRecord.id,
        customerEmail: customer.email,
        ownerName: customer.ownerName,
        callerPhone: callRecord.callerNumber,
        agentName: agent.name,
        durationSeconds,
        summary,
        sentiment: sentimentScore,
        appointmentBooked,
        locale: customer.locale,
      });
    }

    // Create appointment if AI detected one — with slot conflict resolution
    if (appointmentBooked && appointmentDate) {
      try {
        const customerTz = customer.timezone || 'Europe/Athens';
        let scheduledAt = parseDateTimeInTimezone(appointmentDate, appointmentTime, customerTz);

        // Check for slot conflicts: find existing appointments within ±30 minutes
        const slotStart = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
        const slotEnd = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
        const conflicting = await db.query.appointments.findMany({
          where: and(
            eq(appointments.customerId, customer.id),
            gte(appointments.scheduledAt, slotStart),
            lte(appointments.scheduledAt, slotEnd),
          ),
          orderBy: [desc(appointments.scheduledAt)],
        });

        if (conflicting.length > 0) {
          // Slot taken — move appointment 30 min after the last conflict
          const lastConflict = conflicting[0]!;
          const conflictEnd = new Date(lastConflict.scheduledAt.getTime() + (lastConflict.durationMinutes || 30) * 60 * 1000);
          scheduledAt = conflictEnd;
          log.info(
            { originalTime: appointmentDate + ' ' + appointmentTime, movedTo: scheduledAt.toISOString(), conflicts: conflicting.length },
            'Appointment slot conflict — moved to next available slot',
          );
        }

        const [apt] = await db.insert(appointments).values({
          customerId: customer.id,
          agentId: agent.id,
          callId: callRecord.id,
          callerName: appointmentCallerName ?? 'Widget caller',
          callerPhone: appointmentCallerPhone,
          scheduledAt,
          notes: appointmentReason ?? summary ?? null,
          status: 'pending',
        }).onConflictDoNothing({ target: [appointments.customerId, appointments.scheduledAt] }).returning();

        if (apt) {
          log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment created from widget conversation');

          // Send .ics calendar invite email
          if (isEmailConfigured() && customer.email) {
            try {
              const isEn = customer.locale?.startsWith('en');
              const aptLabel = isEn ? 'Appointment' : 'Ραντεβού';
              const clientLabel = isEn ? 'Client' : 'Πελάτης';
              const svcLabel = isEn ? 'Service' : 'Υπηρεσία';
              const phoneLabel = isEn ? 'Phone' : 'Τηλέφωνο';

              const endAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
              const icsContent = generateIcsInvite({
                summary: `${aptLabel}: ${appointmentCallerName ?? clientLabel} — ${customer.businessName ?? 'VoiceForge'}`,
                description: `${appointmentReason ? `${svcLabel}: ${appointmentReason}\n` : ''}${phoneLabel}: ${appointmentCallerPhone}`.trim(),
                startAt: scheduledAt,
                endAt,
                organizerName: customer.businessName ?? 'VoiceForge AI',
                organizerEmail: customer.email,
                attendeeName: appointmentCallerName ?? undefined,
              });

              sendAppointmentInviteEmail({
                to: customer.email,
                businessName: customer.businessName ?? 'VoiceForge AI',
                callerName: appointmentCallerName ?? clientLabel,
                date: appointmentDate,
                time: appointmentTime,
                serviceType: appointmentReason ?? undefined,
                notes: summary ?? undefined,
                icsContent,
                locale: customer.locale,
              }).catch((err) => log.error({ err, callId: callRecord.id }, 'Failed to send appointment invite email (widget)'));
            } catch (emailErr) {
              log.error({ emailErr, callId: callRecord.id }, 'Error preparing appointment invite email (widget)');
            }
          }
        } else {
          log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment already exists at this slot (dedup — widget)');
        }
      } catch (aptErr) {
        log.error({ error: aptErr, callId: callRecord.id }, 'Failed to create appointment from widget conversation');
      }
    } else if (appointmentBooked && !appointmentDate) {
      log.warn({ callId: callRecord.id }, 'Appointment detected but no date extracted — skipping creation');
    }

    // ── SMS Notification ────────────────────────────────────────
    const smsProvider = getTelephonyProvider();
    if (smsProvider.isSmsConfigured() && customer?.phone && callRecord) {
      try {
        await smsProvider.sendCallSummarySms({
          to: customer.phone,
          callerPhone: callRecord.callerNumber,
          agentName: agent.name,
          durationSeconds,
          summary: summary ?? 'Δεν υπάρχει διαθέσιμη περίληψη.',
          appointmentBooked,
        });
        log.info({ callId: callRecord.id, to: customer.phone }, 'Call summary SMS sent');
      } catch (smsErr) {
        log.error({ error: smsErr, callId: callRecord.id }, 'Failed to send call summary SMS');
      }
    }

    // ── Post-Call Task Extraction ───────────────────────────────
    // Task extraction runs always (even without email config) — email sending is optional
    if (callRecord && transcriptText) {
      try {
        const taskEmailRecipients = await db.query.agentTaskEmails.findMany({
          where: eq(agentTaskEmails.agentId, agent.id),
          orderBy: [agentTaskEmails.sortOrder],
        });

        if (taskEmailRecipients.length > 0) {
          log.info({ agentId: agent.id, recipientCount: taskEmailRecipients.length }, '📋 Starting post-call task extraction (widget)');

          const extraction = await extractTasksFromTranscript({
            transcript: transcriptText,
            agentName: agent.name,
            roles: taskEmailRecipients.map((r) => ({
              roleLabel: r.roleLabel,
              roleDescription: r.roleDescription,
            })),
            callerPhone: callRecord.callerNumber !== 'widget' ? callRecord.callerNumber : undefined,
            language: agent.language,
          });

          log.info({ hasTasks: extraction.hasTasks, taskCount: extraction.tasks.length }, '🤖 Task extraction complete (widget)');

          if (extraction.hasTasks) {
            for (const extractedTask of extraction.tasks) {
              const matchedRecipient = taskEmailRecipients.find(
                (r) => r.roleLabel === extractedTask.matchedRole,
              ) ?? taskEmailRecipients[0]!;

              const taskId = crypto.randomUUID();
              const confirmToken = generateConfirmToken(taskId);

              await db.insert(tasks).values({
                id: taskId,
                customerId: customer.id,
                agentId: agent.id,
                callId: callRecord.id,
                taskEmailId: matchedRecipient.id,
                title: extractedTask.title,
                description: extractedTask.description,
                actionRequired: extractedTask.actionRequired,
                assignedEmail: matchedRecipient.email,
                assignedRole: matchedRecipient.roleLabel,
                status: 'pending',
                priority: extractedTask.priority as 'low' | 'normal' | 'high' | 'urgent',
                confirmToken,
                callerName: extractedTask.callerName,
                callerPhone: extractedTask.callerPhone,
                callerEmail: extractedTask.callerEmail,
              });

              log.info(
                { taskId, callId: callRecord.id, role: matchedRecipient.roleLabel, email: matchedRecipient.email, title: extractedTask.title },
                '✅ Task record created in DB (widget)',
              );

              if (isEmailConfigured()) {
                const confirmUrl = `${env.API_BASE_URL}/api/tasks/confirm/${taskId}?token=${confirmToken}`;
                await sendTaskNotificationEmail({
                  to: matchedRecipient.email,
                  taskTitle: extractedTask.title,
                  taskDescription: extractedTask.description,
                  actionRequired: extractedTask.actionRequired,
                  priority: extractedTask.priority,
                  callerName: extractedTask.callerName,
                  callerPhone: extractedTask.callerPhone,
                  callerEmail: extractedTask.callerEmail,
                  agentName: agent.name,
                  confirmUrl,
                  transcript: transcriptText,
                  locale: customer.locale,
                });

                log.info(
                  { taskId, email: matchedRecipient.email },
                  '📧 Task notification email sent (widget)',
                );
              } else {
                log.warn(
                  { taskId, email: matchedRecipient.email },
                  '📧 Email not configured — task saved but notification skipped (widget)',
                );
              }
            }
          } else {
            log.info({ callId: callRecord.id }, '📋 No tasks extracted from this call (widget)');
          }
        }
      } catch (taskErr) {
        log.error({ error: taskErr, callId: callRecord?.id }, 'Post-call task extraction failed — non-blocking (widget)');
      }
    }

    // ── Episodic Memory — Update Caller Memory ──────────────────
    const callerPhone = callRecord.callerNumber;
    if (callRecord && callerPhone && callerPhone !== 'widget' && callerPhone !== 'unknown') {
      try {
        const memorySummary = summary || transcriptText?.slice(0, 500) || 'Κλήση χωρίς περίληψη.';

        const newFacts: string[] = [];
        if (extractedData.caller_name) newFacts.push(`Όνομα: ${extractedData.caller_name}`);
        if (extractedData.appointment_reason) newFacts.push(`Ενδιαφέρον: ${extractedData.appointment_reason}`);
        if (extractedData.caller_intent) newFacts.push(`Πρόθεση: ${extractedData.caller_intent}`);
        if (appointmentBooked) newFacts.push(`Κλείστηκε ραντεβού`);
        if (appointmentDate) newFacts.push(`Ραντεβού: ${appointmentDate} ${appointmentTime}`);

        const existingMemory = await db.query.callerMemories.findFirst({
          where: and(
            eq(callerMemories.customerId, customer.id),
            eq(callerMemories.callerPhone, callerPhone),
          ),
        });

        if (existingMemory) {
          const previousFacts = (existingMemory.keyFacts as string[]) || [];
          const mergedFacts = [...new Set([...previousFacts, ...newFacts])].slice(0, 20);

          const updatedSummary = existingMemory.callCount <= 5
            ? `${existingMemory.summary}\n---\n[Κλήση #${existingMemory.callCount + 1}]: ${memorySummary}`
            : compactMemorySummary(existingMemory.summary, memorySummary, existingMemory.callCount + 1);

          const existingPrefs = (existingMemory.preferences as Record<string, unknown>) || {};
          const newPrefs = {
            ...existingPrefs,
            ...(extractedData.appointment_reason ? { last_service_interest: extractedData.appointment_reason } : {}),
            ...(extractedData.appointment_time ? { preferred_time: extractedData.appointment_time } : {}),
            ...(extractedData.caller_intent ? { last_intent: extractedData.caller_intent } : {}),
          };

          const prevAvg = existingMemory.overallSentiment ?? 3;
          const newAvg = sentimentScore
            ? Math.round((prevAvg * existingMemory.callCount + sentimentScore) / (existingMemory.callCount + 1))
            : prevAvg;

          await db.update(callerMemories)
            .set({
              summary: updatedSummary,
              keyFacts: mergedFacts,
              preferences: newPrefs,
              callerName: extractedData.caller_name || existingMemory.callerName,
              overallSentiment: newAvg,
              lastSentiment: sentimentScore ?? existingMemory.lastSentiment,
              callCount: existingMemory.callCount + 1,
              totalDurationSeconds: existingMemory.totalDurationSeconds + durationSeconds,
              appointmentsBooked: existingMemory.appointmentsBooked + (appointmentBooked ? 1 : 0),
              lastCallId: callRecord.id,
              lastCallAt: new Date(),
              agentId: agent.id,
              updatedAt: new Date(),
            })
            .where(eq(callerMemories.id, existingMemory.id));

          log.info(
            { callerPhone, memoryId: existingMemory.id, callCount: existingMemory.callCount + 1 },
            'Caller memory updated (episodic — widget)',
          );
        } else {
          const [newMemory] = await db.insert(callerMemories).values({
            customerId: customer.id,
            agentId: agent.id,
            callerPhone,
            callerName: extractedData.caller_name ?? null,
            summary: `[Κλήση #1]: ${memorySummary}`,
            keyFacts: newFacts,
            preferences: {
              ...(extractedData.appointment_reason ? { last_service_interest: extractedData.appointment_reason } : {}),
              ...(extractedData.caller_intent ? { last_intent: extractedData.caller_intent } : {}),
            },
            overallSentiment: sentimentScore,
            lastSentiment: sentimentScore,
            callCount: 1,
            totalDurationSeconds: durationSeconds,
            appointmentsBooked: appointmentBooked ? 1 : 0,
            lastCallId: callRecord.id,
            lastCallAt: new Date(),
            firstCallAt: new Date(),
          }).returning();

          log.info(
            { callerPhone, memoryId: newMemory?.id },
            'New caller memory created (first call — widget)',
          );
        }
      } catch (memoryErr) {
        log.error({ error: memoryErr, callerPhone }, 'Failed to update caller memory (widget)');
      }
    }

    log.info(
      { callId: callRecord.id, conversationId, agentId: agent.id, duration: durationSeconds, hasAppointment: appointmentBooked },
      '📞 Widget conversation recorded',
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        status: 'recorded',
        id: callRecord.id,
        conversationId,
        durationSeconds,
        summary,
        appointmentBooked,
        startedAt: startedAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ error, elevenlabsAgentId, errorMessage: errMsg }, 'Failed to record widget conversation');
    return c.json<ApiResponse>({ success: false, error: { code: 'RECORDING_FAILED', message: `Failed to record conversation: ${errMsg}` } }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Helper: Compact Memory Summary
// ═══════════════════════════════════════════════════════════════════

function compactMemorySummary(existingSummary: string, newCallSummary: string, callNumber: number): string {
  const callEntries = existingSummary.split('\n---\n');
  const recentEntries = callEntries.slice(-3);
  const olderCount = callEntries.length - 3;
  const compactHeader = olderCount > 0
    ? `[Σύνοψη ${olderCount} παλαιότερων κλήσεων]: Ο πελάτης έχει καλέσει ${olderCount} φορές πριν.`
    : '';

  const parts = [
    compactHeader,
    ...recentEntries,
    `[Κλήση #${callNumber}]: ${newCallSummary}`,
  ].filter(Boolean);

  let result = parts.join('\n---\n');
  if (result.length > 2000) {
    result = result.slice(-2000);
    const firstSep = result.indexOf('\n---\n');
    if (firstSep > 0) {
      result = result.slice(firstSep + 5);
    }
  }

  return result;
}
