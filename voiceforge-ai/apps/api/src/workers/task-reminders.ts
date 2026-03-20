// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Task Reminder Worker
// Sends reminder emails for pending tasks that haven't been confirmed.
// Runs every hour via the background worker scheduler.
// ═══════════════════════════════════════════════════════════════════

import { db } from '../db/connection.js';
import { tasks, agents } from '../db/schema/index.js';
import { eq, and, lte, isNull, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { sendTaskReminderEmail, isEmailConfigured } from '../services/email.js';
import { generateConfirmToken } from '../routes/tasks.js';

const log = createLogger('task-reminders');

// Reminder schedule: send at 4h, 12h, 24h, 48h
const REMINDER_THRESHOLDS_HOURS = [4, 12, 24, 48];
const MAX_REMINDERS = REMINDER_THRESHOLDS_HOURS.length;

/**
 * Check for pending tasks that need reminders and send them.
 * Called by the worker scheduler at regular intervals.
 */
export async function runTaskReminders(): Promise<void> {
  if (!isEmailConfigured()) {
    log.debug('Email not configured — skipping task reminders');
    return;
  }

  log.info('Starting task reminder check');

  try {
    // Find all pending, non-expired tasks that might need reminders
    const pendingTasks = await db.query.tasks.findMany({
      where: and(
        eq(tasks.status, 'pending'),
        isNull(tasks.confirmedAt),
      ),
      with: {
        agent: {
          columns: { name: true },
          with: { customer: { columns: { locale: true } } },
        },
      },
    });

    let remindersSent = 0;

    for (const task of pendingTasks) {
      if (task.reminderCount >= MAX_REMINDERS) continue;

      const hoursElapsed = (Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60);
      const nextThreshold = REMINDER_THRESHOLDS_HOURS[task.reminderCount];

      if (nextThreshold === undefined || hoursElapsed < nextThreshold) continue;

      // Check if we sent a reminder recently (within 3 hours — debounce)
      if (task.lastReminderAt) {
        const hoursSinceReminder = (Date.now() - task.lastReminderAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReminder < 3) continue;
      }

      // Auto-expire very old tasks (>72h with max reminders)
      if (hoursElapsed > 72 && task.reminderCount >= MAX_REMINDERS) {
        await db.update(tasks)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(tasks.id, task.id));
        log.info({ taskId: task.id, hoursElapsed }, 'Task auto-expired after 72h');
        continue;
      }

      try {
        const confirmToken = generateConfirmToken(task.id);
        const confirmUrl = `${env.API_BASE_URL}/api/tasks/confirm/${task.id}?token=${confirmToken}`;

        await sendTaskReminderEmail({
          to: task.assignedEmail,
          taskTitle: task.title,
          hoursElapsed,
          reminderNumber: task.reminderCount + 1,
          confirmUrl,
          agentName: task.agent?.name ?? 'AI Agent',
          locale: (task.agent as any)?.customer?.locale,
        });

        await db.update(tasks)
          .set({
            reminderCount: task.reminderCount + 1,
            lastReminderAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, task.id));

        remindersSent++;
      } catch (err) {
        log.error({ error: err, taskId: task.id }, 'Failed to send task reminder');
      }
    }

    log.info({ pendingCount: pendingTasks.length, remindersSent }, 'Task reminder check completed');
  } catch (error) {
    log.error({ error }, 'Task reminder worker failed');
    throw error;
  }
}
