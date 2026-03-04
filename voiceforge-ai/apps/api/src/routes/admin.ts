// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Admin Routes
// Protected admin panel: manage pending registrations, generate
// license keys, view customers, and control access.
// Access: /admin/* routes protected by ADMIN_SECRET env var.
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  pendingRegistrations,
  licenseKeys,
  customers,
} from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import { generateLicenseKey } from '../services/license.js';
import { sendLicenseKeyEmail, sendRegistrationNotificationEmail } from '../services/email.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('admin');

export const adminRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// Admin Authentication Middleware
// Uses a simple ADMIN_SECRET header for now (no JWT needed)
// In production, this should be replaced with proper admin auth.
// ═══════════════════════════════════════════════════════════════════

adminRoutes.use('*', async (c, next) => {
  // Allow the admin login endpoint without auth
  if (c.req.path.endsWith('/login')) {
    return next();
  }

  const adminToken = c.req.header('X-Admin-Token') || c.req.query('token');
  const expectedSecret = env.ADMIN_SECRET || 'voiceforge-admin-2026';

  if (!adminToken || adminToken !== expectedSecret) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin credentials' } },
      401,
    );
  }
  return next();
});

// ═══════════════════════════════════════════════════════════════════
// POST /admin/login — Admin login (returns token if secret matches)
// ═══════════════════════════════════════════════════════════════════

const adminLoginSchema = z.object({
  secret: z.string().min(1),
});

adminRoutes.post('/login', zValidator('json', adminLoginSchema), async (c) => {
  const { secret } = c.req.valid('json');
  const expectedSecret = env.ADMIN_SECRET || 'voiceforge-admin-2026';

  if (secret !== expectedSecret) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin secret' } },
      401,
    );
  }

  return c.json<ApiResponse>({
    success: true,
    data: { token: expectedSecret, message: 'Admin authenticated' },
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /admin/registrations — List all pending registrations
// ═══════════════════════════════════════════════════════════════════

adminRoutes.get('/registrations', async (c) => {
  const status = c.req.query('status') || 'pending';

  const registrations = await db.query.pendingRegistrations.findMany({
    where: eq(pendingRegistrations.status, status),
    orderBy: [desc(pendingRegistrations.createdAt)],
  });

  return c.json<ApiResponse>({
    success: true,
    data: registrations.map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      companyName: r.companyName,
      afm: r.afm,
      doy: r.doy,
      phone: r.phone,
      businessAddress: r.businessAddress,
      plan: r.plan,
      durationMonths: r.durationMonths,
      userRole: r.userRole,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /admin/registrations/:id — Get single registration details
// ═══════════════════════════════════════════════════════════════════

adminRoutes.get('/registrations/:id', async (c) => {
  const id = c.req.param('id');

  const registration = await db.query.pendingRegistrations.findFirst({
    where: eq(pendingRegistrations.id, id),
  });

  if (!registration) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } },
      404,
    );
  }

  return c.json<ApiResponse>({ success: true, data: registration });
});

// ═══════════════════════════════════════════════════════════════════
// POST /admin/license-keys/generate — Generate a license key
// Called by admin after verifying bank payment.
// ═══════════════════════════════════════════════════════════════════

const generateKeySchema = z.object({
  registrationId: z.string().uuid(),
  plan: z.enum(['starter', 'professional', 'business', 'enterprise']),
  durationMonths: z.number().int().min(1).max(12),
  pricePaid: z.number().int().min(0).optional(), // cents
  notes: z.string().optional(),
});

adminRoutes.post('/license-keys/generate', zValidator('json', generateKeySchema), async (c) => {
  const body = c.req.valid('json');

  // Find the registration
  const registration = await db.query.pendingRegistrations.findFirst({
    where: eq(pendingRegistrations.id, body.registrationId),
  });

  if (!registration) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } },
      404,
    );
  }

  // Generate unique license key
  const key = generateLicenseKey();

  // Create license key record
  const [newKey] = await db
    .insert(licenseKeys)
    .values({
      licenseKey: key,
      plan: body.plan,
      durationMonths: body.durationMonths,
      pricePaid: body.pricePaid ?? null,
      customerEmail: registration.email,
      customerName: `${registration.firstName} ${registration.lastName}`,
      companyName: registration.companyName,
      status: 'pending',
      generatedBy: 'admin',
      notes: body.notes ?? null,
    })
    .returning();

  // Update registration status to approved
  await db
    .update(pendingRegistrations)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(pendingRegistrations.id, body.registrationId));

  // Send license key email to customer
  try {
    await sendLicenseKeyEmail({
      to: registration.email,
      firstName: registration.firstName,
      companyName: registration.companyName,
      licenseKey: key,
      plan: body.plan,
      durationMonths: body.durationMonths,
      expiresAt: new Date(Date.now() + body.durationMonths * 30 * 24 * 60 * 60 * 1000),
    });
    log.info({ email: registration.email, keyId: newKey?.id }, 'License key email sent');
  } catch (emailErr) {
    log.error({ error: emailErr }, 'Failed to send license key email — key still generated');
  }

  log.info(
    { keyId: newKey?.id, plan: body.plan, months: body.durationMonths, email: registration.email },
    'License key generated',
  );

  return c.json<ApiResponse>({
    success: true,
    data: {
      id: newKey?.id,
      licenseKey: key,
      plan: body.plan,
      durationMonths: body.durationMonths,
      customerEmail: registration.email,
      status: 'pending',
    },
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════
// GET /admin/license-keys — List all license keys
// ═══════════════════════════════════════════════════════════════════

adminRoutes.get('/license-keys', async (c) => {
  const keys = await db.query.licenseKeys.findMany({
    orderBy: [desc(licenseKeys.createdAt)],
  });

  return c.json<ApiResponse>({ success: true, data: keys });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /admin/license-keys/:id/revoke — Revoke a license key
// ═══════════════════════════════════════════════════════════════════

adminRoutes.patch('/license-keys/:id/revoke', async (c) => {
  const id = c.req.param('id');

  const key = await db.query.licenseKeys.findFirst({
    where: eq(licenseKeys.id, id),
  });

  if (!key) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'License key not found' } },
      404,
    );
  }

  await db
    .update(licenseKeys)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(licenseKeys.id, id));

  // Also deactivate the customer if linked
  if (key.customerId) {
    await db
      .update(customers)
      .set({ isActive: false, registrationStatus: 'suspended', updatedAt: new Date() })
      .where(eq(customers.id, key.customerId));
  }

  log.info({ keyId: id }, 'License key revoked');
  return c.json<ApiResponse>({ success: true, data: { message: 'Key revoked' } });
});

// ═══════════════════════════════════════════════════════════════════
// GET /admin/customers — List all customers (for admin overview)
// ═══════════════════════════════════════════════════════════════════

adminRoutes.get('/customers', async (c) => {
  const allCustomers = await db.query.customers.findMany({
    orderBy: [desc(customers.createdAt)],
    columns: {
      id: true,
      email: true,
      ownerName: true,
      businessName: true,
      companyName: true,
      firstName: true,
      lastName: true,
      phone: true,
      plan: true,
      isActive: true,
      registrationStatus: true,
      licenseKey: true,
      licenseExpiresAt: true,
      onboardingCompleted: true,
      createdAt: true,
    },
  });

  return c.json<ApiResponse>({ success: true, data: allCustomers });
});

// ═══════════════════════════════════════════════════════════════════
// GET /admin/stats — Dashboard statistics
// ═══════════════════════════════════════════════════════════════════

adminRoutes.get('/stats', async (c) => {
  const allRegistrations = await db.query.pendingRegistrations.findMany();
  const allKeys = await db.query.licenseKeys.findMany();
  const allCustomers = await db.query.customers.findMany({
    columns: { id: true, isActive: true, registrationStatus: true, plan: true },
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      pendingRegistrations: allRegistrations.filter((r) => r.status === 'pending').length,
      approvedRegistrations: allRegistrations.filter((r) => r.status === 'approved').length,
      totalRegistrations: allRegistrations.length,
      activeKeys: allKeys.filter((k) => k.status === 'active').length,
      pendingKeys: allKeys.filter((k) => k.status === 'pending').length,
      expiredKeys: allKeys.filter((k) => k.status === 'expired').length,
      totalKeys: allKeys.length,
      activeCustomers: allCustomers.filter((c) => c.isActive && c.registrationStatus === 'active').length,
      totalCustomers: allCustomers.length,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /admin/registrations/:id — Reject a registration
// ═══════════════════════════════════════════════════════════════════

adminRoutes.delete('/registrations/:id', async (c) => {
  const id = c.req.param('id');

  await db
    .update(pendingRegistrations)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(pendingRegistrations.id, id));

  log.info({ registrationId: id }, 'Registration rejected');
  return c.json<ApiResponse>({ success: true, data: { message: 'Registration rejected' } });
});
