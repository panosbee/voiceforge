// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dev Auth Routes
// ⚠️  Development only — provides auth without Supabase.
// Disabled entirely in production.
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import { createDevToken, generateDevUserId, isDevAuthMode } from '../services/dev-auth.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('dev-auth');

export const devAuthRoutes = new Hono();

// ── Guard: Only available in development ─────────────────────────

devAuthRoutes.use('*', async (c, next) => {
  if (!isDevAuthMode()) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Dev auth not available' } }, 403);
  }
  return next();
});

// ── Validation ───────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  businessName: z.string().min(2).optional(),
  ownerName: z.string().min(2).optional(),
  userRole: z.enum(['naive', 'expert']).optional().default('naive'),
});

// ═══════════════════════════════════════════════════════════════════
// POST /auth/dev/login — Dev login (email + password)
// In dev mode, any email with any password works.
// Creates the user "on the fly" if they don't exist.
// ═══════════════════════════════════════════════════════════════════

devAuthRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const userId = generateDevUserId(email);

  log.info({ email, userId }, '🔓 Dev login');

  // Create JWT
  const token = createDevToken({
    sub: userId,
    email,
    role: 'authenticated',
    aud: 'authenticated',
  });

  // Check if customer record exists
  const existingCustomer = await db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400 * 30,
      user: {
        id: userId,
        email,
        role: 'authenticated',
      },
      hasProfile: !!existingCustomer,
      onboardingCompleted: existingCustomer?.onboardingCompleted ?? false,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /auth/dev/register — Dev register (creates customer)
// ═══════════════════════════════════════════════════════════════════

devAuthRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, businessName, ownerName, userRole } = c.req.valid('json');

  const userId = generateDevUserId(email);

  log.info({ email, userId }, '📝 Dev register');

  // Check if already registered
  const existing = await db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });

  if (existing) {
    // Just return a token — user already exists
    const token = createDevToken({
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
    });

    return c.json<ApiResponse>({
      success: true,
      data: {
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400 * 30,
        user: { id: userId, email, role: 'authenticated' },
        hasProfile: true,
        message: 'User already exists — logged in',
      },
    });
  }

  // Create customer record
  const [newCustomer] = await db
    .insert(customers)
    .values({
      userId,
      businessName: businessName ?? `Business-${email.split('@')[0]}`,
      industry: 'general',
      ownerName: ownerName ?? email.split('@')[0]!,
      email,
      phone: '+306900000000',
      timezone: 'Europe/Athens',
      locale: 'el-GR',
      plan: userRole === 'expert' ? 'business' : 'starter',
      userRole: userRole,
    })
    .returning();

  log.info({ customerId: newCustomer?.id, userId }, '✅ Dev customer created');

  const token = createDevToken({
    sub: userId,
    email,
    role: 'authenticated',
    aud: 'authenticated',
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400 * 30,
      user: { id: userId, email, role: 'authenticated' },
      hasProfile: true,
      customerId: newCustomer?.id,
    },
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════
// GET /auth/dev/me — Get current dev user info
// ═══════════════════════════════════════════════════════════════════

devAuthRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json<ApiResponse>({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }

  const { verifyDevToken } = await import('../services/dev-auth.js');
  const payload = verifyDevToken(authHeader.slice(7));

  if (!payload) {
    return c.json<ApiResponse>({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, payload.sub),
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      },
      hasProfile: !!customer,
      profile: customer ? {
        id: customer.id,
        businessName: customer.businessName,
        industry: customer.industry,
        ownerName: customer.ownerName,
        email: customer.email,
        phone: customer.phone,
        plan: customer.plan,
        userRole: customer.userRole,
        onboardingCompleted: customer.onboardingCompleted,
        isActive: customer.isActive,
      } : null,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /auth/dev/status — Quick check if dev auth is enabled
// ═══════════════════════════════════════════════════════════════════

devAuthRoutes.get('/status', async (c) => {
  return c.json({
    devAuth: true,
    message: 'Dev auth mode is active. Supabase is bypassed.',
  });
});
