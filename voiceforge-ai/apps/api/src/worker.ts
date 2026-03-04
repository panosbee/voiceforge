// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Background Worker Entry Point
// Runs scheduled tasks: data retention cleanup, email queue, etc.
// Separate process from the API server for isolation.
// ═══════════════════════════════════════════════════════════════════

import { logger } from './config/index.js';
import { disconnectDb } from './db/connection.js';
import { db } from './db/connection.js';
import { calls, webhookEvents, auditLogs } from './db/schema/index.js';
import { lte, sql } from 'drizzle-orm';
import { env } from './config/env.js';

const log = logger.child({ module: 'worker' });

// ── Inline Worker Tasks (avoids module resolution issues) ────────

async function runDataRetentionCleanup(): Promise<void> {
  const retentionDays = env.DATA_RETENTION_CALLS_DAYS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  log.info({ retentionDays, cutoffDate: cutoffDate.toISOString() }, 'Starting call data retention cleanup');

  await db
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

  log.info({ retentionDays }, 'Call data retention cleanup completed');
}

async function runWebhookCleanup(): Promise<void> {
  const retentionDays = env.DATA_RETENTION_WEBHOOKS_DAYS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  log.info({ retentionDays, cutoffDate: cutoffDate.toISOString() }, 'Starting webhook log cleanup');

  await db.delete(webhookEvents).where(lte(webhookEvents.processedAt, cutoffDate));

  log.info({ retentionDays }, 'Webhook log cleanup completed');
}

// ── Worker Configuration ─────────────────────────────────────────

interface ScheduledTask {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun?: number;
}

const tasks: ScheduledTask[] = [
  {
    name: 'data-retention-cleanup',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    handler: runDataRetentionCleanup,
  },
  {
    name: 'webhook-log-cleanup',
    intervalMs: 24 * 60 * 60 * 1000, // Every 24 hours
    handler: runWebhookCleanup,
  },
];

// ── Task Runner ──────────────────────────────────────────────────

async function runTask(task: ScheduledTask): Promise<void> {
  const start = Date.now();
  log.info({ task: task.name }, `Starting scheduled task: ${task.name}`);

  try {
    await task.handler();
    const duration = Date.now() - start;
    log.info({ task: task.name, durationMs: duration }, `Task completed: ${task.name}`);
  } catch (error) {
    log.error({ task: task.name, error }, `Task failed: ${task.name}`);
  }

  task.lastRun = Date.now();
}

// ── Scheduler ────────────────────────────────────────────────────

const intervalIds: NodeJS.Timeout[] = [];

async function startWorker(): Promise<void> {
  log.info('═══════════════════════════════════════════');
  log.info('  VoiceForge AI — Background Worker');
  log.info(`  Tasks: ${tasks.map((t) => t.name).join(', ')}`);
  log.info('═══════════════════════════════════════════');

  // Run all tasks once on startup
  for (const task of tasks) {
    await runTask(task);
  }

  // Schedule recurring execution
  for (const task of tasks) {
    const id = setInterval(() => {
      runTask(task).catch((err) => {
        log.error({ task: task.name, error: err }, 'Unhandled task error');
      });
    }, task.intervalMs);

    intervalIds.push(id);
    log.info(
      { task: task.name, intervalHours: task.intervalMs / (60 * 60 * 1000) },
      `Scheduled: ${task.name}`,
    );
  }
}

// ── Graceful Shutdown ────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Worker shutdown signal received');

  // Clear all intervals
  for (const id of intervalIds) {
    clearInterval(id);
  }

  await disconnectDb();
  log.info('Worker shut down gracefully');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  log.fatal({ error }, 'Uncaught exception in worker');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'Unhandled rejection in worker');
  process.exit(1);
});

// Start the worker
startWorker().catch((err) => {
  log.fatal({ error: err }, 'Worker failed to start');
  process.exit(1);
});
