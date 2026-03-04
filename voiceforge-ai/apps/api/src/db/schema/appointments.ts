// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Appointments Schema
// Booked appointments created during AI agent calls
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { agents } from './agents';
import { calls } from './calls';

// ── Enums ────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]);

// ── Table ────────────────────────────────────────────────────────

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),

    // Appointment details
    callerName: text('caller_name').notNull(),
    callerPhone: text('caller_phone').notNull(),
    serviceType: text('service_type'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    status: appointmentStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),

    // Google Calendar sync
    googleEventId: text('google_event_id'),
    reminderSent: boolean('reminder_sent').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_appointments_customer').on(table.customerId),
    index('idx_appointments_scheduled').on(table.scheduledAt),
    index('idx_appointments_caller_phone').on(table.callerPhone),
  ],
);

// ── Relations ────────────────────────────────────────────────────

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  customer: one(customers, {
    fields: [appointments.customerId],
    references: [customers.id],
  }),
  agent: one(agents, {
    fields: [appointments.agentId],
    references: [agents.id],
  }),
  call: one(calls, {
    fields: [appointments.callId],
    references: [calls.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type AppointmentSelect = typeof appointments.$inferSelect;
export type AppointmentInsert = typeof appointments.$inferInsert;
