// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Customer Records Schema (Enterprise Feature)
// Allows businesses to store customer records with a unique customer
// number for identification during phone calls. The AI agent can
// look up customer records to access/request sensitive documents.
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';

// ── Table ────────────────────────────────────────────────────────

export const customerRecords = pgTable('customer_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),

  // Customer identification
  customerNumber: text('customer_number').notNull(), // Unique per business, e.g. "K-001234"
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'), // Primary phone — used for automatic recognition
  alternatePhone: text('alternate_phone'),

  // Business-specific data
  category: text('category'), // e.g. "Ιδιώτης", "Εταιρεία", "VIP"
  notes: text('notes'), // Internal notes about this customer
  metadata: jsonb('metadata').notNull().default('{}'), // Flexible key-value data

  // Document access
  documentAccessLevel: text('document_access_level').notNull().default('basic'), // basic, extended, full
  pendingDocumentRequests: jsonb('pending_document_requests').notNull().default('[]'), // [{type, requestedAt, status}]

  // Status
  isActive: boolean('is_active').notNull().default(true),
  totalInteractions: integer('total_interactions').notNull().default(0),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const customerRecordsRelations = relations(customerRecords, ({ one }) => ({
  customer: one(customers, {
    fields: [customerRecords.customerId],
    references: [customers.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type CustomerRecordSelect = typeof customerRecords.$inferSelect;
export type CustomerRecordInsert = typeof customerRecords.$inferInsert;
