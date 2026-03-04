// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Webhook Events Log
// Tracks all processed webhook events for idempotency & debugging
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull().unique(), // Telnyx event ID = idempotency key
    eventType: text('event_type').notNull(),
    source: text('source').notNull(), // 'telnyx' | 'stripe'
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    error: text('error'), // If processing failed
  },
  (table) => [
    index('idx_webhook_events_event_id').on(table.eventId),
    index('idx_webhook_events_processed_at').on(table.processedAt),
  ],
);

export type WebhookEventSelect = typeof webhookEvents.$inferSelect;
export type WebhookEventInsert = typeof webhookEvents.$inferInsert;
