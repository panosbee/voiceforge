// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls / Dashboard Routes
// Call history, analytics, individual call details
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gte, lte, desc, sql, count, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, calls, agents, appointments } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { getMonthRangeInTimezone } from '../services/timezone.js';
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
// GET /calls/:id — Get full call detail with transcript
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
// POST /calls/e2e-test — Create a simulated test call
// Inserts a realistic call record without needing Telnyx/ElevenLabs
// Marked with metadata.isE2ETest = true for easy cleanup
// ═══════════════════════════════════════════════════════════════════

const e2eTestSchema = z.object({
  agentId: z.string().uuid(),
  durationSeconds: z.number().int().min(5).max(600).optional().default(45),
  status: z.enum(['completed', 'missed', 'voicemail', 'failed']).optional().default('completed'),
  appointmentBooked: z.boolean().optional().default(false),
  sentiment: z.number().int().min(1).max(5).optional().default(4),
  callerNumber: z.string().optional().default('+306945123179'),
  locale: z.enum(['el', 'en']).optional().default('el'),
});

callRoutes.post('/e2e-test', zValidator('json', e2eTestSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Verify the agent belongs to this customer
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, body.agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  // Build realistic call data
  const now = new Date();
  const startedAt = new Date(now.getTime() - body.durationSeconds * 1000);
  const endedAt = now;
  const isEn = body.locale === 'en';

  const agentDisplayName = agent.name || 'AI Assistant';

  // Tomorrow at 18:00 for appointment scenario
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  const tomorrowStr = `${tomorrow.getDate()}/${tomorrow.getMonth() + 1}/${tomorrow.getFullYear()}`;

  // ── Build transcript ────────────────────────────────────────
  const transcript = body.status === 'completed'
    ? body.appointmentBooked
      ? isEn
        ? [
            `[Agent]: Hello! My name is ${agentDisplayName}. How can I help you today?`,
            `[Customer]: Hi, I'd like to get some information about your services.`,
            `[Agent]: Of course! I'd be happy to help. What would you like to know?`,
            `[Customer]: What services do you offer and what are the prices?`,
            `[Agent]: We offer a wide range of services. I can walk you through our options in detail. Would you like to schedule a callback with the owner to discuss your specific needs?`,
            `[Customer]: Yes, that would be great. Could the owner call me tomorrow afternoon at 6 PM?`,
            `[Agent]: Absolutely! I've scheduled a callback for tomorrow ${tomorrowStr} at 18:00. The owner will call you at your number ${body.callerNumber}. Is there anything else I can help with?`,
            `[Customer]: No, that's perfect. Thank you very much!`,
            `[Agent]: You're welcome! Have a great day. The owner will contact you tomorrow at 18:00.`,
          ].join('\n')
        : [
            `[Agent]: Γεια σας! Με λένε ${agentDisplayName}. Πώς μπορώ να σας βοηθήσω σήμερα;`,
            `[Customer]: Γεια σας, θα ήθελα κάποιες πληροφορίες για τις υπηρεσίες σας.`,
            `[Agent]: Φυσικά! Θα χαρώ να σας βοηθήσω. Τι θα θέλατε να μάθετε;`,
            `[Customer]: Τι υπηρεσίες προσφέρετε και ποιες είναι οι τιμές;`,
            `[Agent]: Προσφέρουμε μεγάλη γκάμα υπηρεσιών. Μπορώ να σας εξηγήσω αναλυτικά. Θα θέλατε να κανονίσω μια επανάκληση με τον ιδιοκτήτη για να συζητήσετε τις ανάγκες σας;`,
            `[Customer]: Ναι, αυτό θα ήταν τέλειο. Μπορεί ο ιδιοκτήτης να με καλέσει αύριο απόγευμα στις 18:00;`,
            `[Agent]: Βεβαίως! Έκλεισα επανάκληση για αύριο ${tomorrowStr} στις 18:00. Ο ιδιοκτήτης θα σας καλέσει στο ${body.callerNumber}. Υπάρχει κάτι άλλο που μπορώ να κάνω;`,
            `[Customer]: Όχι, αυτό είναι τέλειο. Ευχαριστώ πολύ!`,
            `[Agent]: Παρακαλώ! Καλή σας μέρα. Ο ιδιοκτήτης θα επικοινωνήσει μαζί σας αύριο στις 18:00.`,
          ].join('\n')
      : isEn
        ? [
            `[Agent]: Hello! My name is ${agentDisplayName}. How can I help you today?`,
            `[Customer]: Hi, I'd like some information about your services.`,
            `[Agent]: Of course! I'd be happy to help. What would you like to know?`,
            `[Customer]: What are your opening hours?`,
            `[Agent]: We're open Monday through Friday from 9 AM to 6 PM, and Saturday from 10 AM to 2 PM. We're closed on Sundays.`,
            `[Customer]: Great, and do you have availability this week?`,
            `[Agent]: Yes, we have several openings this week. Would you like to schedule something specific?`,
            `[Customer]: Not right now, I'll think about it and call back. Thanks!`,
            `[Agent]: No problem at all! Feel free to call us anytime. Have a wonderful day!`,
          ].join('\n')
        : [
            `[Agent]: Γεια σας! Με λένε ${agentDisplayName}. Πώς μπορώ να σας βοηθήσω σήμερα;`,
            `[Customer]: Γεια σας, θα ήθελα κάποιες πληροφορίες για τις υπηρεσίες σας.`,
            `[Agent]: Φυσικά! Θα χαρώ να σας βοηθήσω. Τι θα θέλατε να μάθετε;`,
            `[Customer]: Ποιο είναι το ωράριο λειτουργίας σας;`,
            `[Agent]: Είμαστε ανοιχτά Δευτέρα με Παρασκευή 09:00-18:00 και Σάββατο 10:00-14:00. Κυριακές είμαστε κλειστά.`,
            `[Customer]: Ωραία, και υπάρχει διαθεσιμότητα αυτή την εβδομάδα;`,
            `[Agent]: Ναι, έχουμε αρκετά κενά αυτή την εβδομάδα. Θα θέλατε να κλείσετε κάτι συγκεκριμένο;`,
            `[Customer]: Όχι προς το παρόν, θα το σκεφτώ και θα σας πάρω. Ευχαριστώ!`,
            `[Agent]: Κανένα πρόβλημα! Μη διστάσετε να μας καλέσετε οποτεδήποτε. Καλή σας μέρα!`,
          ].join('\n')
    : null;

  // ── Build detailed summary ──────────────────────────────────
  const summary = body.status === 'completed'
    ? body.appointmentBooked
      ? isEn
        ? `Customer called ${agentDisplayName} requesting information about services and pricing. After reviewing service options, customer asked for a callback with the business owner. Appointment scheduled for ${tomorrowStr} at 18:00 — owner to call customer at ${body.callerNumber}. Customer was satisfied with the arrangement. Call duration: ${formatDuration(body.durationSeconds)}. Sentiment: positive.`
        : `Ο πελάτης κάλεσε τον ${agentDisplayName} ζητώντας πληροφορίες για τις υπηρεσίες και τις τιμές. Μετά την παρουσίαση των υπηρεσιών, ο πελάτης ζήτησε επανάκληση από τον ιδιοκτήτη. Κλείστηκε ραντεβού για ${tomorrowStr} στις 18:00 — ο ιδιοκτήτης να καλέσει τον πελάτη στο ${body.callerNumber}. Ο πελάτης ήταν ικανοποιημένος με τη διευθέτηση. Διάρκεια κλήσης: ${formatDuration(body.durationSeconds)}. Διάθεση: θετική.`
      : isEn
        ? `Customer called ${agentDisplayName} requesting general information about services and availability. Agent provided opening hours (Mon-Fri 9-6, Sat 10-2) and confirmed availability this week. Customer indicated they would think about it and call back. No appointment was booked. Call duration: ${formatDuration(body.durationSeconds)}. Sentiment: ${body.sentiment >= 4 ? 'positive' : body.sentiment >= 3 ? 'neutral' : 'negative'}.`
        : `Ο πελάτης κάλεσε τον ${agentDisplayName} ζητώντας γενικές πληροφορίες για τις υπηρεσίες και τη διαθεσιμότητα. Ο agent ενημέρωσε για το ωράριο (Δευ-Παρ 09:00-18:00, Σαβ 10:00-14:00) και επιβεβαίωσε ότι υπάρχει διαθεσιμότητα αυτή την εβδομάδα. Ο πελάτης δήλωσε ότι θα το σκεφτεί και θα επανέλθει. Δεν κλείστηκε ραντεβού. Διάρκεια κλήσης: ${formatDuration(body.durationSeconds)}. Διάθεση: ${body.sentiment >= 4 ? 'θετική' : body.sentiment >= 3 ? 'ουδέτερη' : 'αρνητική'}.`
    : body.status === 'missed'
      ? isEn ? 'Missed call — customer did not answer.' : 'Αναπάντητη κλήση — ο πελάτης δεν απάντησε.'
      : isEn ? 'The call was not completed.' : 'Η κλήση δεν ολοκληρώθηκε.';

  const intentCategory = body.appointmentBooked ? 'appointment_booking' : 'inquiry';

  const [testCall] = await db
    .insert(calls)
    .values({
      customerId: customer.id,
      agentId: agent.id,
      telnyxConversationId: `e2e_test_${crypto.randomUUID()}`,
      callerNumber: body.callerNumber,
      agentNumber: agent.phoneNumber || '+302100000000',
      direction: 'inbound',
      status: body.status,
      startedAt,
      endedAt: body.status === 'completed' ? endedAt : null,
      durationSeconds: body.status === 'completed' ? body.durationSeconds : null,
      transcript: body.status === 'completed' ? transcript : null,
      summary,
      sentiment: body.status === 'completed' ? body.sentiment : null,
      intentCategory,
      appointmentBooked: body.appointmentBooked,
      metadata: { isE2ETest: true, createdBy: 'e2e-test-button', locale: body.locale },
    })
    .returning();

  if (!testCall) {
    return c.json<ApiResponse>({ success: false, error: { code: 'INSERT_FAILED', message: 'Failed to create test call' } }, 500);
  }

  // ── Create appointment record if booked ─────────────────────
  if (body.appointmentBooked && body.status === 'completed') {
    try {
      await db.insert(appointments).values({
        customerId: customer.id,
        agentId: agent.id,
        callId: testCall.id,
        callerName: isEn ? 'Test Customer' : 'Δοκιμαστικός Πελάτης',
        callerPhone: body.callerNumber,
        serviceType: isEn ? 'Callback — owner to call customer' : 'Επανάκληση — ο ιδιοκτήτης να καλέσει τον πελάτη',
        scheduledAt: tomorrow,
        durationMinutes: 15,
        status: 'pending',
        notes: isEn
          ? `Owner to call customer at ${body.callerNumber} at 18:00. Customer requested information about services and pricing.`
          : `Ο ιδιοκτήτης να καλέσει τον πελάτη στο ${body.callerNumber} στις 18:00. Ο πελάτης ζήτησε πληροφορίες για υπηρεσίες και τιμές.`,
      });
      log.info({ callId: testCall.id, scheduledAt: tomorrow.toISOString() }, '🧪 E2E appointment created');
    } catch (aptErr) {
      log.error({ error: aptErr, callId: testCall.id }, 'Failed to create E2E test appointment');
    }
  }

  log.info({ callId: testCall.id, agentId: agent.id, locale: body.locale }, '🧪 E2E test call created');

  return c.json<ApiResponse>({
    success: true,
    data: {
      id: testCall.id,
      callerNumber: testCall.callerNumber,
      agentNumber: testCall.agentNumber,
      agentName: agent.name,
      direction: testCall.direction,
      status: testCall.status,
      durationSeconds: testCall.durationSeconds,
      summary: testCall.summary,
      sentiment: testCall.sentiment,
      appointmentBooked: testCall.appointmentBooked,
      startedAt: testCall.startedAt.toISOString(),
      endedAt: testCall.endedAt?.toISOString() ?? null,
      isE2ETest: true,
    },
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /calls/e2e-test/:id — Delete a test call
// Only allows deletion of calls with metadata.isE2ETest = true
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

  // Safety: only delete test calls
  const meta = callRecord.metadata as Record<string, unknown> | null;
  if (!meta || meta.isE2ETest !== true) {
    return c.json<ApiResponse>({ success: false, error: { code: 'FORBIDDEN', message: 'Only test calls can be deleted' } }, 403);
  }

  // Delete appointments linked to this test call first
  await db.delete(appointments).where(eq(appointments.callId, callId));
  await db.delete(calls).where(eq(calls.id, callId));

  log.info({ callId }, '🗑️ E2E test call + appointments deleted');

  return c.json<ApiResponse>({ success: true, data: { deleted: true } });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /calls/e2e-test — Delete ALL test calls for current customer
// Bulk cleanup of all E2E test data
// ═══════════════════════════════════════════════════════════════════

callRoutes.delete('/e2e-test', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Find all E2E test call IDs first
  const testCalls = await db
    .select({ id: calls.id })
    .from(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`${calls.metadata}->>'isE2ETest' = 'true'`,
      ),
    );

  const testCallIds = testCalls.map(c => c.id);

  // Delete appointments linked to test calls
  if (testCallIds.length > 0) {
    await db.delete(appointments).where(inArray(appointments.callId, testCallIds));
  }

  // Delete the test calls
  const result = await db
    .delete(calls)
    .where(
      and(
        eq(calls.customerId, customer.id),
        sql`${calls.metadata}->>'isE2ETest' = 'true'`,
      ),
    )
    .returning({ id: calls.id });

  log.info({ count: result.length, customerId: customer.id }, '🗑️ All E2E test calls + appointments deleted');

  return c.json<ApiResponse>({ success: true, data: { deletedCount: result.length } });
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
