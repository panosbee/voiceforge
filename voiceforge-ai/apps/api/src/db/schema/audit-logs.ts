// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Audit Logs Schema
// GDPR Article 30: Records of processing activities
// Tracks all data access, modification, deletion events
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';

export const auditActionEnum = pgEnum('audit_action', [
  'data_export',
  'data_deletion',
  'login',
  'password_change',
  'settings_update',
  'agent_create',
  'agent_update',
  'agent_delete',
  'call_access',
  'recording_access',
  'transcript_access',
  'admin_action',
]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id'), // nullable — for deleted users
    userId: uuid('user_id').notNull(), // Supabase auth.users ID
    action: auditActionEnum('action').notNull(),
    resource: text('resource'), // e.g. 'call:uuid', 'agent:uuid'
    details: jsonb('details').notNull().default('{}'), // Action-specific metadata
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_customer').on(table.customerId),
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created').on(table.createdAt),
  ],
);

export type AuditLogSelect = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
