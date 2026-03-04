// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Customers Schema
// Maps to the 'customers' table in Supabase PostgreSQL
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { agents } from './agents';
import { calls } from './calls';
import { appointments } from './appointments';

// ── Enums ────────────────────────────────────────────────────────

export const industryEnum = pgEnum('industry', [
  'law_office',
  'medical_practice',
  'dental_clinic',
  'real_estate',
  'beauty_salon',
  'accounting',
  'veterinary',
  'general',
]);

export const planEnum = pgEnum('plan', ['starter', 'pro', 'business']);
export const userRoleEnum = pgEnum('user_role', ['naive', 'expert']);

// ── Table ────────────────────────────────────────────────────────

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(), // FK to Supabase auth.users
  businessName: text('business_name').notNull(),
  industry: industryEnum('industry').notNull().default('general'),
  ownerName: text('owner_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  plan: planEnum('plan').notNull().default('starter'),
  userRole: userRoleEnum('user_role').notNull().default('naive'),

  // Telnyx integration (encrypted secrets)
  telnyxAccountId: text('telnyx_account_id'), // Managed account UUID
  telnyxApiKeyEncrypted: text('telnyx_api_key_encrypted'), // AES-256-GCM
  telnyxApiToken: text('telnyx_api_token'), // Alternative auth token (encrypted)
  telnyxConnectionId: text('telnyx_connection_id'), // SIP connection ID → ElevenLabs

  // Stripe billing
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),

  // Google Calendar OAuth
  googleCalendarConnected: boolean('google_calendar_connected').notNull().default(false),
  googleOauthTokenEncrypted: text('google_oauth_token_encrypted'), // AES-256-GCM
  googleCalendarId: text('google_calendar_id'), // Primary calendar ID

  // Settings
  timezone: text('timezone').notNull().default('Europe/Athens'),
  locale: text('locale').notNull().default('el-GR'),
  webhookUrl: text('webhook_url'), // Customer's own webhook (optional)

  // Status
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),

  // B2B Business registration fields
  afm: text('afm'),                          // ΑΦΜ (Tax ID)
  doy: text('doy'),                          // ΔΟΥ (Tax Office)
  businessAddress: text('business_address'),  // Επαγγελματική διεύθυνση
  companyName: text('company_name'),          // Επωνυμία εταιρίας
  firstName: text('first_name'),             // Όνομα
  lastName: text('last_name'),               // Επώνυμο

  // License / subscription management
  licenseKey: text('license_key'),                                          // Active license key
  licenseExpiresAt: timestamp('license_expires_at', { withTimezone: true }), // When license expires
  registrationStatus: text('registration_status').notNull().default('pending'), // pending | active | suspended

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const customersRelations = relations(customers, ({ many }) => ({
  agents: many(agents),
  calls: many(calls),
  appointments: many(appointments),
}));

// ── Types ────────────────────────────────────────────────────────

export type CustomerSelect = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
