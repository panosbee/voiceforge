// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Data Retention Worker
// GDPR-compliant automatic data cleanup based on retention policies.
// Anonymizes/deletes old call data and webhook events.
// ═══════════════════════════════════════════════════════════════════

import { db } from '../db/connection.js';
import { calls, webhookEvents, auditLogs } from '../db/schema/index.js';
import { lte, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('data-retention');

/**
 * Anonymizes call records older than DATA_RETENTION_CALLS_DAYS.
 *
 * Strategy: Keep metadata (date, duration, status, sentiment) for analytics,
 * but remove PII (transcript, recording URL, caller number, summary).
 * This satisfies GDPR Article 17 while preserving aggregate analytics.
 */
export async function runDataRetentionCleanup(): Promise<void> {
  const retentionDays = env.DATA_RETENTION_CALLS_DAYS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  log.info({ retentionDays, cutoffDate: cutoffDate.toISOString() }, 'Starting call data retention cleanup');

  try {
    // Anonymize old calls — keep structure for analytics, remove PII
    const result = await db
      .update(calls)
      .set({
        transcript: null,
        summary: null,
        recordingUrl: null,
        callerNumber: 'EXPIRED',
        insightsRaw: null,
        metadata: {},
      })
      .where(
        sql`${calls.startedAt} < ${cutoffDate} AND ${calls.callerNumber} != 'EXPIRED' AND ${calls.callerNumber} != 'REDACTED'`,
      );

    log.info(
      { cutoffDate: cutoffDate.toISOString(), retentionDays },
      'Call data retention cleanup completed',
    );
  } catch (error) {
    log.error({ error }, 'Call data retention cleanup failed');
    throw error;
  }
}

/**
 * Deletes webhook event logs older than DATA_RETENTION_WEBHOOKS_DAYS.
 * These are diagnostic logs and can be safely purged.
 */
export async function runWebhookCleanup(): Promise<void> {
  const retentionDays = env.DATA_RETENTION_WEBHOOKS_DAYS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  log.info({ retentionDays, cutoffDate: cutoffDate.toISOString() }, 'Starting webhook log cleanup');

  try {
    await db.delete(webhookEvents).where(lte(webhookEvents.processedAt, cutoffDate));

    log.info(
      { cutoffDate: cutoffDate.toISOString(), retentionDays },
      'Webhook log cleanup completed',
    );
  } catch (error) {
    log.error({ error }, 'Webhook log cleanup failed');
    throw error;
  }
}

/**
 * Prunes audit logs older than 2 years (GDPR record keeping minimum).
 * Only removes entries where the customer has been deleted.
 */
export async function runAuditLogPrune(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

  log.info({ cutoffDate: cutoffDate.toISOString() }, 'Starting audit log prune');

  try {
    await db.delete(auditLogs).where(
      sql`${auditLogs.createdAt} < ${cutoffDate} AND ${auditLogs.customerId} IS NULL`,
    );

    log.info('Audit log prune completed');
  } catch (error) {
    log.error({ error }, 'Audit log prune failed');
    throw error;
  }
}
