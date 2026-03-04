// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Caller Memories Schema
// Episodic memory: stores per-caller conversation summaries
// so the AI agent can remember past interactions
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { agents } from './agents';

// ── Table ────────────────────────────────────────────────────────

export const callerMemories = pgTable(
  'caller_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Which business this memory belongs to
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    // Which agent handled the calls (nullable — memory spans all agents)
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'set null' }),

    // Caller identification
    callerPhone: text('caller_phone').notNull(),
    callerName: text('caller_name'), // Learned from conversations

    // Memory content
    summary: text('summary').notNull(), // Condensed memory of interactions
    keyFacts: jsonb('key_facts').notNull().default('[]'),
    // e.g., ["Ο πελάτης ενδιαφέρεται για αισθητική", "Είναι αλλεργικός στην πενικιλλίνη"]

    // Extracted structured data
    preferences: jsonb('preferences').notNull().default('{}'),
    // e.g., { "preferred_time": "πρωινά", "language": "el", "service_interest": "λεύκανση" }

    // Sentiment tracking
    overallSentiment: integer('overall_sentiment'), // 1-5 average
    lastSentiment: integer('last_sentiment'),       // Most recent call sentiment

    // Interaction stats
    callCount: integer('call_count').notNull().default(1),
    totalDurationSeconds: integer('total_duration_seconds').notNull().default(0),
    appointmentsBooked: integer('appointments_booked').notNull().default(0),

    // Last interaction tracking
    lastCallId: uuid('last_call_id'), // Reference to most recent call
    lastCallAt: timestamp('last_call_at', { withTimezone: true }).notNull().defaultNow(),
    firstCallAt: timestamp('first_call_at', { withTimezone: true }).notNull().defaultNow(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Primary lookup: find memory by caller phone + customer
    index('idx_memories_customer_phone').on(table.customerId, table.callerPhone),
    // Find all memories for a caller across all businesses
    index('idx_memories_caller_phone').on(table.callerPhone),
    // Recent memories first
    index('idx_memories_last_call').on(table.lastCallAt),
  ],
);

// ── Relations ────────────────────────────────────────────────────

export const callerMemoriesRelations = relations(callerMemories, ({ one }) => ({
  customer: one(customers, {
    fields: [callerMemories.customerId],
    references: [customers.id],
  }),
  agent: one(agents, {
    fields: [callerMemories.agentId],
    references: [agents.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type CallerMemorySelect = typeof callerMemories.$inferSelect;
export type CallerMemoryInsert = typeof callerMemories.$inferInsert;
