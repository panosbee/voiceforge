// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Customer / Onboarding Routes
// Registration, profile, onboarding wizard steps
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, count, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, agents, icalCachedEvents } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { sendWelcomeEmail, isEmailConfigured } from '../services/email.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('customers');

export const customerRoutes = new Hono<{ Variables: { user: AuthUser } }>();

// All customer routes require authentication
customerRoutes.use('*', authMiddleware);

// ── Validation ───────────────────────────────────────────────────

const registerCustomerSchema = z.object({
  businessName: z.string().min(2).max(200),
  industry: z.enum([
    'law_office',
    'medical_practice',
    'dental_clinic',
    'real_estate',
    'beauty_salon',
    'accounting',
    'veterinary',
    'general',
  ]),
  ownerName: z.string().min(2).max(100),
  email: z.string().email().optional(), // fallback to JWT email
  phone: z.string().min(10).max(20),
  plan: z.enum(['basic', 'pro', 'enterprise']).optional().default('basic'),
  userRole: z.enum(['naive', 'expert']).optional().default('naive'),
  timezone: z.string().optional().default('Europe/Athens'),
  locale: z.string().optional().default('el-GR'),
  // GDPR consent fields (Art. 6/7)
  consentToProcessing: z.boolean().refine((v) => v === true, {
    message: 'Απαιτείται η συναίνεση επεξεργασίας δεδομένων',
  }),
  consentToRecording: z.boolean().refine((v) => v === true, {
    message: 'Απαιτείται η συναίνεση εγγραφής συνομιλιών',
  }),
  consentToMarketing: z.boolean().optional().default(false),
});

const updateCustomerSchema = z.object({
  businessName: z.string().min(2).max(200).optional(),
  ownerName: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(20).optional(),
  timezone: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════
// GET /customers/me — Get authenticated customer's profile
// ═══════════════════════════════════════════════════════════════════

customerRoutes.get('/me', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Count agents and check if any have ElevenLabs IDs
  const customerAgents = await db.query.agents.findMany({
    where: eq(agents.customerId, customer.id),
    columns: { id: true, elevenlabsAgentId: true },
  });

  const agentCount = customerAgents.length;
  const hasElevenLabsAgents = customerAgents.some((a) => !!a.elevenlabsAgentId);

  // Return sanitized profile (no encrypted fields)
  return c.json<ApiResponse>({
    success: true,
    data: {
      id: customer.id,
      businessName: customer.businessName,
      industry: customer.industry,
      ownerName: customer.ownerName,
      email: customer.email,
      phone: customer.phone,
      plan: customer.plan,
      userRole: customer.userRole,
      hasTelnyxAccount: !!customer.telnyxAccountId,
      hasElevenLabsAgents,
      hasStripeSubscription: !!customer.stripeSubscriptionId,
      googleCalendarConnected: customer.googleCalendarConnected,
      hasIcalFeed: !!customer.icalFeedUrl,
      icalLastSyncedAt: customer.icalLastSyncedAt?.toISOString() ?? null,
      agentCount,
      timezone: customer.timezone,
      locale: customer.locale,
      onboardingCompleted: customer.onboardingCompleted,
      isActive: customer.isActive,
      createdAt: customer.createdAt.toISOString(),
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /customers/register — Register new customer + create Telnyx account
// Called during onboarding Step 1
// ═══════════════════════════════════════════════════════════════════

customerRoutes.post('/register', zValidator('json', registerCustomerSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  // Check if already registered
  const existing = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (existing) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer already registered' } },
      409,
    );
  }

  log.info({ userId: user.sub, businessName: body.businessName }, 'Registering new customer');

  try {
    // Create customer record directly — no Telnyx managed account needed.
    // ElevenLabs is our primary AI platform; Telnyx is only used for phone numbers
    // and will be configured separately when the user purchases a number.
    const [newCustomer] = await db
      .insert(customers)
      .values({
        userId: user.sub,
        businessName: body.businessName,
        industry: body.industry,
        ownerName: body.ownerName,
        email: body.email ?? user.email,
        phone: body.phone,
        plan: body.plan,
        userRole: body.userRole,
        timezone: body.timezone,
        locale: body.locale,
        // GDPR consent recording
        consentToProcessing: body.consentToProcessing,
        consentToRecording: body.consentToRecording,
        consentToMarketing: body.consentToMarketing ?? false,
        consentAcceptedAt: new Date(),
        consentIpAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      })
      .returning();

    log.info(
      { customerId: newCustomer?.id, plan: body.plan, userRole: body.userRole },
      'Customer registered successfully',
    );

    return c.json<ApiResponse>(
      {
        success: true,
        data: {
          id: newCustomer?.id,
          businessName: body.businessName,
          industry: body.industry,
          plan: body.plan,
          onboardingCompleted: false,
          isActive: true,
        },
      },
      201,
    );
  } catch (error) {
    log.error({ error, userId: user.sub }, 'Customer registration failed');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer account' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /customers/me — Update customer profile
// ═══════════════════════════════════════════════════════════════════

customerRoutes.patch('/me', zValidator('json', updateCustomerSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const [updated] = await db
    .update(customers)
    .set({
      ...(body.businessName ? { businessName: body.businessName } : {}),
      ...(body.ownerName ? { ownerName: body.ownerName } : {}),
      ...(body.phone ? { phone: body.phone } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customers.userId, user.sub))
    .returning();

  if (!updated) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  return c.json<ApiResponse>({ success: true, data: { id: updated.id, businessName: updated.businessName } });
});

// ═══════════════════════════════════════════════════════════════════
// POST /customers/complete-onboarding — Mark onboarding as done
// Called at the end of the wizard (Step 5)
// ═══════════════════════════════════════════════════════════════════

customerRoutes.post('/complete-onboarding', async (c) => {
  const user = c.get('user');

  const [updated] = await db
    .update(customers)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(customers.userId, user.sub))
    .returning();

  if (!updated) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  log.info({ customerId: updated.id }, 'Onboarding completed');

  if (isEmailConfigured()) {
    try {
      const firstAgent = await db.query.agents.findFirst({
        where: eq(agents.customerId, updated.id),
        columns: { name: true, phoneNumber: true },
      });
      await sendWelcomeEmail({
        to: updated.email,
        ownerName: updated.ownerName,
        businessName: updated.businessName,
        agentName: firstAgent?.name ?? 'AI Assistant',
        phoneNumber: firstAgent?.phoneNumber ?? undefined,
      });
      log.info({ customerId: updated.id, to: updated.email }, 'Welcome email sent');
    } catch (emailErr) {
      log.error({ error: emailErr, customerId: updated.id }, 'Failed to send welcome email');
    }
  }

  return c.json<ApiResponse>({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// iCal Calendar Integration Routes
// ═══════════════════════════════════════════════════════════════════

const icalSettingsSchema = z.object({
  icalFeedUrl: z.string().url().max(2000).nullable(),
});

// ── PUT /customers/ical-settings — Save iCal feed URL ────────────

customerRoutes.put('/ical-settings', zValidator('json', icalSettingsSchema), async (c) => {
  const user = c.get('user');
  const { icalFeedUrl } = c.req.valid('json');

  // Validate URL if provided
  if (icalFeedUrl) {
    const { validateIcalUrl } = await import('../services/ical.js');
    const validation = validateIcalUrl(icalFeedUrl);
    if (!validation.valid) {
      return c.json<ApiResponse>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error || 'Invalid iCal URL' } },
        400,
      );
    }
  }

  const [updated] = await db
    .update(customers)
    .set({
      icalFeedUrl: icalFeedUrl,
      // Clear sync timestamp when URL changes
      icalLastSyncedAt: icalFeedUrl ? undefined : null,
      updatedAt: new Date(),
    })
    .where(eq(customers.userId, user.sub))
    .returning();

  if (!updated) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // If URL was cleared, also delete cached events
  if (!icalFeedUrl) {
    await db.delete(icalCachedEvents).where(eq(icalCachedEvents.customerId, updated.id));
  }

  log.info({ customerId: updated.id, hasUrl: !!icalFeedUrl }, 'iCal settings updated');
  return c.json<ApiResponse>({ success: true, data: { icalFeedUrl: updated.icalFeedUrl } });
});

// ── GET /customers/ical-settings — Get iCal settings ─────────────

customerRoutes.get('/ical-settings', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
    columns: { id: true, icalFeedUrl: true, icalLastSyncedAt: true },
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Count cached events
  const [eventCount] = await db
    .select({ count: count() })
    .from(icalCachedEvents)
    .where(eq(icalCachedEvents.customerId, customer.id));

  return c.json<ApiResponse>({
    success: true,
    data: {
      icalFeedUrl: customer.icalFeedUrl,
      lastSyncedAt: customer.icalLastSyncedAt?.toISOString() ?? null,
      cachedEventCount: eventCount?.count ?? 0,
    },
  });
});

// ── POST /customers/ical-sync — Trigger iCal feed sync ───────────

customerRoutes.post('/ical-sync', async (c) => {
  const user = c.get('user');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
    columns: { id: true, icalFeedUrl: true },
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  if (!customer.icalFeedUrl) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No iCal feed URL configured' } },
      400,
    );
  }

  try {
    const { syncIcalEvents } = await import('../services/ical.js');
    const result = await syncIcalEvents(customer.id, customer.icalFeedUrl);
    log.info({ customerId: customer.id, ...result }, 'iCal sync triggered');

    return c.json<ApiResponse>({
      success: true,
      data: {
        total: result.total,
        synced: result.synced,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'iCal sync failed';
    log.error({ customerId: customer.id, error: message }, 'iCal sync failed');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ICAL_SYNC_ERROR', message } },
      502,
    );
  }
});

// ── GET /customers/ical-events — Get cached iCal events ──────────

customerRoutes.get('/ical-events', async (c) => {
  const user = c.get('user');
  const from = c.req.query('from'); // YYYY-MM-DD
  const to = c.req.query('to');     // YYYY-MM-DD

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
    columns: { id: true },
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Build query conditions
  const conditions = [eq(icalCachedEvents.customerId, customer.id)];
  if (from) conditions.push(gte(icalCachedEvents.startAt, new Date(from + 'T00:00:00Z')));
  if (to) conditions.push(lte(icalCachedEvents.startAt, new Date(to + 'T23:59:59Z')));

  const events = await db.query.icalCachedEvents.findMany({
    where: and(...conditions),
    orderBy: (t, { asc }) => [asc(t.startAt)],
    limit: 500,
  });

  return c.json<ApiResponse>({
    success: true,
    data: events.map((e) => ({
      id: e.id,
      uid: e.uid,
      summary: e.summary,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
    })),
  });
});
