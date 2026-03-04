// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Pending Registrations Schema
// Stores registration requests before payment verification.
// Admin reviews these and generates license keys.
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

// ── Table ────────────────────────────────────────────────────────

export const pendingRegistrations = pgTable('pending_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Auth credentials (password stored as hash)
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),

  // Business details
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  companyName: text('company_name').notNull(),
  afm: text('afm').notNull(),           // ΑΦΜ — Tax ID number
  doy: text('doy').notNull(),           // ΔΟΥ — Tax Office
  phone: text('phone').notNull(),
  businessAddress: text('business_address').notNull(),

  // Plan selection
  plan: text('plan').notNull(),          // 'starter' | 'pro' | 'business'
  durationMonths: integer('duration_months').notNull(),

  // User role
  userRole: text('user_role').notNull().default('naive'),

  // Status: pending → approved (key sent) or rejected
  status: text('status').notNull().default('pending'),

  // Admin notes
  adminNotes: text('admin_notes'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Types ────────────────────────────────────────────────────────

export type PendingRegistrationSelect = typeof pendingRegistrations.$inferSelect;
export type PendingRegistrationInsert = typeof pendingRegistrations.$inferInsert;
