// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls / Dashboard Routes
// Call history, analytics, individual call details
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gte, lte, desc, sql, count, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, calls, agents, appointments, webhookEvents } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { getMonthRangeInTimezone, parseDateTimeInTimezone } from '../services/timezone.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { extractAppointmentFromTranscript } from '../services/transcript-parser.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('calls');

/** Format seconds as M:SS */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
    // Fetch recent conversations for this agent from ElevenLabs
    const conversations = await elevenlabsService.getConversations(elevenlabsAgentId);
    if (!conversations || conversations.length === 0) {
      return c.json<ApiResponse>({ success: true, data: null });
    }

    // Pick the most recent conversation
    // SDK returns camelCase (conversationId) but REST API uses snake_case (conversation_id)
    const latest = conversations[0] as Record<string, any>;
    const conversationId = (latest.conversationId ?? latest.conversation_id) as string;
    if (!conversationId) {
      log.warn({ latestKeys: Object.keys(latest) }, 'No conversationId found in latest conversation');
      return c.json<ApiResponse>({ success: true, data: null });
    }

    // Dedup: skip if already recorded
    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, conversationId),
    });
    if (existing) {
      log.info({ conversationId }, 'Conversation already recorded — skipping');
      return c.json<ApiResponse>({ success: true, data: { alreadyRecorded: true } });
    }

    // Fetch full conversation details from ElevenLabs
    const full = await elevenlabsService.getConversation(conversationId) as Record<string, any>;
    const transcript: Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }> =
      full.transcript ?? [];
    const analysis = full.analysis as Record<string, any> | undefined;
    const metadata = full.metadata as Record<string, any> | undefined;

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
      log.info({ conversationId }, 'Conversation has no transcript — skipping');
      return c.json<ApiResponse>({ success: true, data: null });
    }

    // Calculate duration
    const durationSeconds = Math.ceil(
      metadata?.call_duration_secs ??
      metadata?.callDurationSecs ??
      (transcript.length > 0
        ? (transcript[transcript.length - 1]?.time_in_call_secs ?? transcript[transcript.length - 1]?.timeInCallSecs ?? 0)
        : 0)
    );

    // Extract analysis data — ElevenLabs AI provides structured extraction
    const summary = analysis?.transcriptSummary ?? analysis?.transcript_summary ?? null;
    const callSuccessful = analysis?.callSuccessful ?? analysis?.call_successful;

    // Extract AI-collected data from dataCollectionResults
    const dataCollectionResults = analysis?.dataCollectionResults ?? analysis?.data_collection_results ?? {};
    const extractedData: Record<string, string> = {};
    if (dataCollectionResults && typeof dataCollectionResults === 'object') {
      for (const [key, val] of Object.entries(dataCollectionResults)) {
        const v = val as Record<string, any>;
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
    const evalResults = analysis?.evaluationCriteriaResults ?? analysis?.evaluation_criteria_results ?? {};
    const appointmentEval = evalResults?.appointment_booked as Record<string, any> | undefined;
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
    const startedAt = startTimeUnix ? new Date(startTimeUnix * 1000) : new Date(Date.now() - durationSeconds * 1000);
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

    // Create appointment if AI detected one — with slot conflict resolution
    if (appointmentBooked) {
      try {
        const customerTz = customer.timezone || 'Europe/Athens';
        let scheduledAt = appointmentDate
          ? parseDateTimeInTimezone(appointmentDate, appointmentTime, customerTz)
          : new Date();

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

        await db.insert(appointments).values({
          customerId: customer.id,
          agentId: agent.id,
          callId: callRecord.id,
          callerName: appointmentCallerName ?? 'Widget caller',
          callerPhone: appointmentCallerPhone,
          scheduledAt,
          notes: appointmentReason ?? summary ?? null,
          status: 'pending',
        });
        log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment created from widget conversation');
      } catch (aptErr) {
        log.error({ error: aptErr, callId: callRecord.id }, 'Failed to create appointment from widget conversation');
      }
    }

    log.info(
      { callId: callRecord.id, conversationId, agentId: agent.id, duration: durationSeconds, hasAppointment: appointmentBooked },
      '📞 Widget conversation recorded',
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: callRecord.id,
        conversationId,
        durationSeconds,
        summary,
        appointmentBooked,
        startedAt: startedAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    log.error({ error, elevenlabsAgentId }, 'Failed to record widget conversation');
    return c.json<ApiResponse>({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch conversation from ElevenLabs' } }, 500);
  }
});
