// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Flows Schema
// Multi-agent flows with card-based UI (simplified Expert Mode).
// Each flow has multiple agents with routing rules (handoff).
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers.js';

// ── Table ────────────────────────────────────────────────────────

export const agentFlows = pgTable('agent_flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),

  // Flow identity
  name: text('name').notNull(), // e.g. "Κύριο Flow Γραφείου"
  description: text('description'), // Optional description

  // The entry agent — the first agent that receives calls
  entryAgentId: uuid('entry_agent_id'),

  // Flow state
  isActive: boolean('is_active').notNull().default(false),

  // Agent ordering (array of agent IDs in display order)
  agentOrder: jsonb('agent_order').notNull().default('[]'), // string[]

  // Routing rules — stored per source agent
  // Format: { [sourceAgentId]: [{ targetAgentId, condition, transferMessage }] }
  routingRules: jsonb('routing_rules').notNull().default('{}'),

  // Limits (based on plan)
  maxAgents: integer('max_agents').notNull().default(3),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const agentFlowsRelations = relations(agentFlows, ({ one }) => ({
  customer: one(customers, {
    fields: [agentFlows.customerId],
    references: [customers.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type AgentFlowSelect = typeof agentFlows.$inferSelect;
export type AgentFlowInsert = typeof agentFlows.$inferInsert;
