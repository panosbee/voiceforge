// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Post-Call Tasks Schema
// Tasks extracted from call transcripts by AI analysis.
// Routed to department emails, tracked with confirmation flow.
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { agents } from './agents';
import { calls } from './calls';
import { customers } from './customers';
import { agentTaskEmails } from './task-emails';

// ── Enums ────────────────────────────────────────────────────────

export const taskStatusEnum = pgEnum('task_status', ['pending', 'confirmed', 'expired']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'normal', 'high', 'urgent']);

// ── Table ────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  callId: uuid('call_id')
    .references(() => calls.id, { onDelete: 'set null' }),
  taskEmailId: uuid('task_email_id')
    .references(() => agentTaskEmails.id, { onDelete: 'set null' }),

  // Task content (AI-extracted)
  title: text('title').notNull(),
  description: text('description'),
  actionRequired: text('action_required'),

  // Routing
  assignedEmail: text('assigned_email').notNull(),
  assignedRole: text('assigned_role').notNull(),

  // Status tracking
  status: taskStatusEnum('status').notNull().default('pending'),
  priority: taskPriorityEnum('priority').notNull().default('normal'),

  // Confirmation
  confirmToken: text('confirm_token').notNull(),    // HMAC token for email confirm link
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),

  // Reminders
  reminderCount: integer('reminder_count').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),

  // Caller info (from transcript)
  callerName: text('caller_name'),
  callerPhone: text('caller_phone'),
  callerEmail: text('caller_email'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const tasksRelations = relations(tasks, ({ one }) => ({
  customer: one(customers, {
    fields: [tasks.customerId],
    references: [customers.id],
  }),
  agent: one(agents, {
    fields: [tasks.agentId],
    references: [agents.id],
  }),
  call: one(calls, {
    fields: [tasks.callId],
    references: [calls.id],
  }),
  taskEmail: one(agentTaskEmails, {
    fields: [tasks.taskEmailId],
    references: [agentTaskEmails.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type TaskSelect = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
