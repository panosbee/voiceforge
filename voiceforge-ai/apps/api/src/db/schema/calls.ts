// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Calls Schema
// One row per inbound/outbound call handled by Telnyx AI Assistant
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { agents } from './agents';
import { appointments } from './appointments';

// ── Enums ────────────────────────────────────────────────────────

export const callStatusEnum = pgEnum('call_status', [
  'ringing',
  'in_progress',
  'completed',
  'missed',
  'voicemail',
  'failed',
]);

export const callDirectionEnum = pgEnum('call_direction', ['inbound', 'outbound']);

// ── Table ────────────────────────────────────────────────────────

export const calls = pgTable(
  'calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),

    // Telnyx IDs
    telnyxConversationId: text('telnyx_conversation_id').unique(),
    telnyxCallControlId: text('telnyx_call_control_id'),

    // Call details
    callerNumber: text('caller_number').notNull(),
    agentNumber: text('agent_number').notNull(),
    direction: callDirectionEnum('direction').notNull().default('inbound'),
    status: callStatusEnum('status').notNull().default('ringing'),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),

    // Content
    transcript: text('transcript'), // Full conversation text
    summary: text('summary'), // AI-generated 2-3 sentence summary
    sentiment: integer('sentiment'), // 1-5 scale
    intentCategory: text('intent_category'), // e.g. "appointment_booking"
    appointmentBooked: boolean('appointment_booked').notNull().default(false),

    // Raw data
    insightsRaw: jsonb('insights_raw'), // Full Telnyx insights JSON
    recordingUrl: text('recording_url'),
    metadata: jsonb('metadata').notNull().default('{}'),

    // Idempotency
    telnyxEventId: text('telnyx_event_id').unique(), // Prevent duplicate processing

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Performance indexes
    index('idx_calls_customer').on(table.customerId),
    index('idx_calls_agent').on(table.agentId),
    index('idx_calls_started_at').on(table.startedAt),
    index('idx_calls_caller_number').on(table.callerNumber),
    index('idx_calls_conversation_id').on(table.telnyxConversationId),
  ],
);

// ── Relations ────────────────────────────────────────────────────

export const callsRelations = relations(calls, ({ one, many }) => ({
  customer: one(customers, {
    fields: [calls.customerId],
    references: [customers.id],
  }),
  agent: one(agents, {
    fields: [calls.agentId],
    references: [agents.id],
  }),
  appointments: many(appointments),
}));

// ── Types ────────────────────────────────────────────────────────

export type CallSelect = typeof calls.$inferSelect;
export type CallInsert = typeof calls.$inferInsert;
