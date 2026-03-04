// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — License Keys Schema
// B2B licensing: admin generates time-bound keys for customers.
// Each key is unique, tied to a plan + duration, and auto-expires.
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers.js';

// ── Enums ────────────────────────────────────────────────────────

export const licenseStatusEnum = pgEnum('license_status', [
  'pending',    // Generated, not yet activated
  'active',     // Activated by customer
  'expired',    // Duration elapsed
  'revoked',    // Manually revoked by admin
]);

// ── Table ────────────────────────────────────────────────────────

export const licenseKeys = pgTable('license_keys', {
  id: uuid('id').primaryKey().defaultRandom(),

  // The unique license key string (e.g., "VF-2026-XXXX-XXXX-XXXX")
  licenseKey: text('license_key').notNull().unique(),

  // Plan this key grants access to
  plan: text('plan').notNull(), // 'starter' | 'pro' | 'business'

  // Duration in months (1-12)
  durationMonths: integer('duration_months').notNull(),

  // Price paid (in EUR, for admin reference)
  pricePaid: integer('price_paid'), // cents

  // Customer this key is assigned to (nullable until activated)
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),

  // Customer business details (stored at key generation for reference)
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  companyName: text('company_name').notNull(),

  // Status lifecycle
  status: licenseStatusEnum('status').notNull().default('pending'),

  // Activation dates
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  // Admin who generated the key
  generatedBy: text('generated_by').notNull().default('admin'),

  // Notes (admin can add notes)
  notes: text('notes'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const licenseKeysRelations = relations(licenseKeys, ({ one }) => ({
  customer: one(customers, {
    fields: [licenseKeys.customerId],
    references: [customers.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type LicenseKeySelect = typeof licenseKeys.$inferSelect;
export type LicenseKeyInsert = typeof licenseKeys.$inferInsert;
