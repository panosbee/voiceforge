// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls / Dashboard Routes
// Call history, analytics, individual call details
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, calls } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { getMonthRangeInTimezone } from '../services/timezone.js';
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
