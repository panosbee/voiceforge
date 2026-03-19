// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Task Email Recipients Schema
// Each agent can have multiple notification emails with roles.
// Post-call AI routes tasks to the matching role's email.
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { agents } from './agents';

// ── Table ────────────────────────────────────────────────────────

export const agentTaskEmails = pgTable('agent_task_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),

  email: text('email').notNull(),
  roleLabel: text('role_label').notNull(),           // e.g. "Κρατήσεις αυτοκινήτων"
  roleDescription: text('role_description'),         // Optional longer description for AI matching
  sortOrder: integer('sort_order').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const agentTaskEmailsRelations = relations(agentTaskEmails, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTaskEmails.agentId],
    references: [agents.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type AgentTaskEmailSelect = typeof agentTaskEmails.$inferSelect;
export type AgentTaskEmailInsert = typeof agentTaskEmails.$inferInsert;
