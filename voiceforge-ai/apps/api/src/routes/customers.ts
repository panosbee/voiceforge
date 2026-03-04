// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Customer / Onboarding Routes
// Registration, profile, onboarding wizard steps
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, agents } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
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
  plan: z.enum(['starter', 'pro', 'business']).optional().default('starter'),
  userRole: z.enum(['naive', 'expert']).optional().default('naive'),
  timezone: z.string().optional().default('Europe/Athens'),
  locale: z.string().optional().default('el-GR'),
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
  return c.json<ApiResponse>({ success: true });
});
