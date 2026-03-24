// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Conversation Sync Worker (Safety Net)
// Periodically polls ElevenLabs for ALL recent conversations
// and records any that were missed by the real-time flow.
//
// Covers these failure scenarios:
//  - User closed browser before record-conversation completed
//  - ElevenLabs API was temporarily unavailable
//  - Server restarted during recording
//  - Widget failed to trigger record-conversation
//  - Any other transient failure
//
// Runs every 2 minutes. Each run checks ALL active agents.
// ═══════════════════════════════════════════════════════════════════

import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, webhookEvents, appointments, callerMemories, agentTaskEmails, tasks } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { parseDateTimeInTimezone } from '../services/timezone.js';
import { extractAppointmentFromTranscript } from '../services/transcript-parser.js';
import { notifyCallCompleted, sendTaskNotificationEmail, sendAppointmentInviteEmail, isEmailConfigured } from '../services/email.js';
import { generateIcsInvite } from '../services/ics-generator.js';
import { getTelephonyProvider } from '../services/telephony/index.js';
import { extractTasksFromTranscript } from '../services/task-extraction.js';
import { generateConfirmToken } from '../routes/tasks.js';
import { env } from '../config/env.js';

const log = createLogger('conversation-sync');

/**
 * Sync missed conversations from ElevenLabs into our database.
 * This is the safety net — any conversation that wasn't recorded
 * by the real-time flow will be caught here.
 */
export async function runConversationSync(): Promise<void> {
  if (!elevenlabsService.isConfigured()) {
    log.debug('ElevenLabs not configured — skipping conversation sync');
    return;
  }

  // Find all active agents that have an ElevenLabs agent ID
  const activeAgents = await db.query.agents.findMany({
    where: eq(agents.status, 'active'),
    with: { customer: true },
    columns: {
      id: true,
      elevenlabsAgentId: true,
      customerId: true,
      name: true,
      language: true,
      phoneNumber: true,
    },
  });

  const agentsWithEL = activeAgents.filter(
    (a) => a.elevenlabsAgentId && !a.elevenlabsAgentId.startsWith('dev_'),
  );

  if (agentsWithEL.length === 0) {
    log.debug('No active agents with ElevenLabs — skipping');
    return;
  }

  let totalSynced = 0;
  let totalSkipped = 0;

  for (const agent of agentsWithEL) {
    try {
      const synced = await syncAgentConversations(agent);
      totalSynced += synced.recorded;
      totalSkipped += synced.skipped;
    } catch (err) {
      log.error({ error: err, agentId: agent.id, elevenlabsAgentId: agent.elevenlabsAgentId }, 'Failed to sync conversations for agent');
    }
  }

  if (totalSynced > 0) {
    log.info({ totalSynced, totalSkipped, agentCount: agentsWithEL.length }, '🔄 Conversation sync completed — new records saved');
  } else {
    log.debug({ totalSkipped, agentCount: agentsWithEL.length }, 'Conversation sync completed — nothing new');
  }
}

/**
 * Sync conversations for a single agent.
 */
async function syncAgentConversations(agent: {
  id: string;
  elevenlabsAgentId: string | null;
  customerId: string;
  name: string;
  language: string;
  phoneNumber: string | null;
  customer: { id: string; timezone: string; email: string; ownerName: string; locale: string; phone: string | null };
}): Promise<{ recorded: number; skipped: number }> {
  if (!agent.elevenlabsAgentId) return { recorded: 0, skipped: 0 };

  // Fetch recent conversations from ElevenLabs
  const conversations = await elevenlabsService.getConversations(agent.elevenlabsAgentId);
  if (!conversations || conversations.length === 0) {
    return { recorded: 0, skipped: 0 };
  }

  let recorded = 0;
  let skipped = 0;

  // Batch dedup: collect all conversation IDs and check in one query
  const allConvIds: string[] = [];
  const convMap = new Map<string, typeof conversations[0]>();
  for (const conv of conversations) {
    const conversationId = ((conv as Record<string, unknown>).conversationId ?? (conv as Record<string, unknown>).conversation_id) as string | undefined;
    if (conversationId) {
      allConvIds.push(conversationId);
      convMap.set(conversationId, conv);
    }
  }

  if (allConvIds.length === 0) return { recorded: 0, skipped: 0 };

  // Single batch query: check which conversation IDs already exist in webhook_events
  const existingEvents = await db
    .select({ eventId: webhookEvents.eventId })
    .from(webhookEvents)
    .where(inArray(webhookEvents.eventId, allConvIds));
  const existingEventIds = new Set(existingEvents.map((e) => e.eventId));

  // Also batch check calls table for existing conversation IDs
  const unrecordedIds = allConvIds.filter((id) => !existingEventIds.has(id));
  let existingCallIds = new Set<string>();
  if (unrecordedIds.length > 0) {
    const existingCalls = await db
      .select({ convId: calls.telnyxConversationId })
      .from(calls)
      .where(inArray(calls.telnyxConversationId, unrecordedIds));
    existingCallIds = new Set(existingCalls.map((c) => c.convId).filter(Boolean) as string[]);
  }

  for (const conversationId of allConvIds) {
    const conv = convMap.get(conversationId)!;

    // Skip if already in webhook_events
    if (existingEventIds.has(conversationId)) {
      skipped++;
      continue;
    }

    // Skip if already has a call record — mark dedup entry
    if (existingCallIds.has(conversationId)) {
      await db.insert(webhookEvents).values({
        eventId: conversationId,
        eventType: 'conversation_sync.already_exists',
        source: 'conversation-sync',
        payload: { conversationId, agentId: agent.elevenlabsAgentId },
      });
      skipped++;
      continue;
    }

    // Filter by age — only sync conversations from the last 60 minutes
    // Older ones were either already handled or are too old to matter
    const convStartTime = (conv as Record<string, unknown>).startTimeUnixSecs ??
      (conv as Record<string, unknown>).start_time_unix_secs;
    if (convStartTime) {
      const ageMs = Date.now() - (convStartTime as number) * 1000;
      if (ageMs > 60 * 60 * 1000) {
        // Older than 60 min — mark as skipped so we don't check again
        await db.insert(webhookEvents).values({
          eventId: conversationId,
          eventType: 'conversation_sync.too_old',
          source: 'conversation-sync',
          payload: { conversationId, agentId: agent.elevenlabsAgentId, ageMinutes: Math.round(ageMs / 60000) },
        });
        skipped++;
        continue;
      }
    }

    // New conversation found — fetch full details and record it
    try {
      const result = await recordMissedConversation(conversationId, agent);
      if (result) {
        recorded++;
        log.info({ conversationId, callId: result.callId, agentName: agent.name }, '🔄 Missed conversation synced');
      } else {
        skipped++;
      }
    } catch (err) {
      log.error({ error: err, conversationId, agentId: agent.id }, 'Failed to record missed conversation');
    }
  }

  return { recorded, skipped };
}

/**
 * Record a single missed conversation from ElevenLabs.
 * This is essentially the same logic as record-conversation endpoint
 * but runs without a user request.
 */
async function recordMissedConversation(
  conversationId: string,
  agent: {
    id: string;
    elevenlabsAgentId: string | null;
    customerId: string;
    name: string;
    language: string;
    phoneNumber: string | null;
    customer: { id: string; timezone: string; email: string; ownerName: string; locale: string; phone: string | null };
  },
): Promise<{ callId: string } | null> {
  const full = await elevenlabsService.getConversation(conversationId);
  const transcript: Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }> =
    (full.transcript ?? []) as Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }>;
  const analysis = full.analysis as Record<string, unknown> | undefined;
  const metadata = full.metadata as Record<string, unknown> | undefined;

  // Build formatted transcript text
  const callerLabel = agent.language === 'en' ? 'Caller' : 'Πελάτης';
  let transcriptText = '';
  if (transcript.length > 0) {
    transcriptText = transcript
      .filter((msg) => msg.message)
      .map((msg) => {
        const role = msg.role === 'agent' ? agent.name : callerLabel;
        return `[${role}]: ${msg.message}`;
      })
      .join('\n');
  }

  if (!transcriptText) {
    // Check conversation status/age before marking as empty
    // If the conversation is still in progress or very recent, skip it — don't mark as processed.
    // The record-conversation endpoint or next sync cycle will handle it.
    const convStatus = (full.status ?? (full as Record<string, unknown>).conversation_status) as string | undefined;
    const startTimeSecs = (metadata?.start_time_unix_secs ?? metadata?.startTimeUnixSecs) as number | undefined;
    const ageMs = startTimeSecs ? Date.now() - startTimeSecs * 1000 : 0;
    const isRecentConversation = ageMs > 0 && ageMs < 5 * 60 * 1000; // Less than 5 minutes old
    const isStillActive = convStatus && !['done', 'error', 'timeout', 'completed'].includes(convStatus);

    if (isRecentConversation || isStillActive) {
      log.debug({ conversationId, convStatus, ageMs: Math.round(ageMs / 1000) }, 'Skipping in-progress/recent conversation — no transcript yet');
      return null;
    }

    // Conversation is old and finished but has no transcript — mark as processed
    await db.insert(webhookEvents).values({
      eventId: conversationId,
      eventType: 'conversation_sync.empty',
      source: 'conversation-sync',
      payload: { conversationId, reason: 'no_transcript', convStatus, ageMinutes: Math.round(ageMs / 60000) },
    });
    return null;
  }

  // Duration
  const durationSeconds = Math.ceil(
    (metadata?.call_duration_secs ??
    metadata?.callDurationSecs ??
    (transcript.length > 0
      ? (transcript[transcript.length - 1]?.time_in_call_secs ?? transcript[transcript.length - 1]?.timeInCallSecs ?? 0)
      : 0)) as number
  );

  // AI analysis
  const summary = (analysis?.transcriptSummary ?? analysis?.transcript_summary ?? null) as string | null;
  const callSuccessful = analysis?.callSuccessful ?? analysis?.call_successful;

  // AI data collection
  const dataCollectionResults = (analysis?.dataCollectionResults ?? analysis?.data_collection_results ?? {}) as Record<string, unknown>;
  const extractedData: Record<string, string> = {};
  if (dataCollectionResults && typeof dataCollectionResults === 'object') {
    for (const [key, val] of Object.entries(dataCollectionResults)) {
      const v = val as Record<string, unknown>;
      if (v?.value !== undefined && v.value !== null && String(v.value).trim() !== '') {
        extractedData[key] = String(v.value);
      }
    }
  }

  // Fallback extraction if no AI data
  if (Object.keys(extractedData).length === 0 && transcriptText) {
    const fallback = extractAppointmentFromTranscript(transcriptText);
    for (const [key, val] of Object.entries(fallback)) {
      if (val) extractedData[key] = val;
    }
  }

  // ── Extract real caller phone from SIP/phone metadata ─────
  // For phone calls via SIP trunk, the actual caller number is in metadata.phoneCall.externalNumber
  // AI extraction may fail if caller doesn't verbally mention their number
  const phoneCallMeta = metadata?.phoneCall as Record<string, any> | undefined;
  const isPhoneCall = !!phoneCallMeta;
  const sipCallerPhone = phoneCallMeta?.externalNumber ?? null;
  const sipAgentNumber = phoneCallMeta?.agentNumber
    ? `+${String(phoneCallMeta.agentNumber).replace(/^\+/, '')}`
    : null;

  // Evaluation criteria
  const evalResults = (analysis?.evaluationCriteriaResults ?? analysis?.evaluation_criteria_results ?? {}) as Record<string, unknown>;
  const appointmentEval = evalResults?.appointment_booked as Record<string, unknown> | undefined;
  const appointmentBookedByAi = appointmentEval?.result === 'success';

  // Appointment data
  const appointmentBooked = appointmentBookedByAi || !!(extractedData.appointment_date || extractedData.appointment_time);
  const appointmentDate = extractedData.appointment_date || null;
  const appointmentTime = extractedData.appointment_time || '09:00';
  const appointmentCallerName = extractedData.caller_name || null;
  // Use SIP metadata phone first, then AI extraction, then fallback
  const appointmentCallerPhone = extractedData.caller_phone || sipCallerPhone || 'unknown';
  const appointmentReason = extractedData.appointment_reason || null;
  const callerIntent = extractedData.caller_intent || (appointmentBooked ? 'appointment_booking' : 'inquiry');

  // Sentiment
  const sentimentScore = callSuccessful === 'success' || callSuccessful === 'true' ? 5 :
                         callSuccessful === 'failure' || callSuccessful === 'false' ? 2 : 4;

  // Start time
  const startTimeUnix = metadata?.start_time_unix_secs ?? metadata?.startTimeUnixSecs;
  const startedAt = startTimeUnix ? new Date(Number(startTimeUnix) * 1000) : new Date(Date.now() - durationSeconds * 1000);
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  // Determine caller and agent numbers
  // Priority: AI-extracted > SIP metadata > agent config > fallback
  const resolvedCallerNumber = appointmentCallerPhone !== 'unknown'
    ? appointmentCallerPhone
    : sipCallerPhone || 'unknown';
  const resolvedAgentNumber = sipAgentNumber || agent.phoneNumber || 'widget';

  // Insert call record
  const [callRecord] = await db.insert(calls).values({
    customerId: agent.customerId,
    agentId: agent.id,
    telnyxConversationId: conversationId,
    callerNumber: resolvedCallerNumber,
    agentNumber: resolvedAgentNumber,
    direction: 'inbound',
    status: 'completed',
    startedAt,
    endedAt,
    durationSeconds,
    transcript: transcriptText,
    summary,
    sentiment: sentimentScore,
    intentCategory: callerIntent,
    appointmentBooked,
    insightsRaw: { analysis, metadata: metadata as Record<string, unknown>, extractedData, source: 'conversation-sync' },
    metadata: { syncedByWorker: true, isPhoneCall, ...(isPhoneCall ? { sipCallerPhone, sipAgentNumber } : {}) },
  }).returning();

  if (!callRecord) return null;

  // Log dedup entry
  await db.insert(webhookEvents).values({
    eventId: conversationId,
    eventType: 'conversation_sync.recorded',
    source: 'conversation-sync',
    payload: { conversationId, callId: callRecord.id, agentId: agent.elevenlabsAgentId },
  });

  await notifyCallCompleted({
    callId: callRecord.id,
    customerEmail: agent.customer.email,
    ownerName: agent.customer.ownerName,
    callerPhone: callRecord.callerNumber,
    agentName: agent.name,
    durationSeconds,
    summary,
    sentiment: sentimentScore,
    appointmentBooked,
    locale: agent.customer.locale,
  });

  // ── SMS Notification ────────────────────────────────────────
  const smsProvider = getTelephonyProvider();
  if (smsProvider.isSmsConfigured() && agent.customer.phone) {
    try {
      await smsProvider.sendCallSummarySms({
        to: agent.customer.phone,
        callerPhone: callRecord.callerNumber,
        agentName: agent.name,
        durationSeconds,
        summary: summary ?? 'Δεν υπάρχει διαθέσιμη περίληψη.',
        appointmentBooked,
      });
      log.info({ callId: callRecord.id, to: agent.customer.phone }, 'Call summary SMS sent');
    } catch (smsErr) {
      log.error({ error: smsErr, callId: callRecord.id }, 'Failed to send call summary SMS');
    }
  }

  // ── Post-Call Task Extraction ───────────────────────────────
  if (transcriptText) {
    try {
      const taskEmailRecipients = await db.query.agentTaskEmails.findMany({
        where: eq(agentTaskEmails.agentId, agent.id),
        orderBy: [agentTaskEmails.sortOrder],
      });

      if (taskEmailRecipients.length > 0) {
        log.info({ agentId: agent.id, recipientCount: taskEmailRecipients.length }, '📋 Starting post-call task extraction (sync worker)');

        const extraction = await extractTasksFromTranscript({
          transcript: transcriptText,
          agentName: agent.name,
          roles: taskEmailRecipients.map((r) => ({
            roleLabel: r.roleLabel,
            roleDescription: r.roleDescription,
          })),
          callerPhone: callRecord.callerNumber !== 'unknown' ? callRecord.callerNumber : undefined,
          language: agent.language,
        });

        log.info({ hasTasks: extraction.hasTasks, taskCount: extraction.tasks.length }, '🤖 Task extraction complete (sync worker)');

        if (extraction.hasTasks) {
          for (const extractedTask of extraction.tasks) {
            const matchedRecipient = taskEmailRecipients.find(
              (r) => r.roleLabel === extractedTask.matchedRole,
            ) ?? taskEmailRecipients[0]!;

            const taskId = crypto.randomUUID();
            const confirmToken = generateConfirmToken(taskId);

            await db.insert(tasks).values({
              id: taskId,
              customerId: agent.customerId,
              agentId: agent.id,
              callId: callRecord.id,
              taskEmailId: matchedRecipient.id,
              title: extractedTask.title,
              description: extractedTask.description,
              actionRequired: extractedTask.actionRequired,
              assignedEmail: matchedRecipient.email,
              assignedRole: matchedRecipient.roleLabel,
              status: 'pending',
              priority: extractedTask.priority as 'low' | 'normal' | 'high' | 'urgent',
              confirmToken,
              callerName: extractedTask.callerName,
              callerPhone: extractedTask.callerPhone,
              callerEmail: extractedTask.callerEmail,
            });

            log.info({ taskId, callId: callRecord.id, role: matchedRecipient.roleLabel, title: extractedTask.title }, '✅ Task created (sync worker)');

            if (isEmailConfigured()) {
              const confirmUrl = `${env.API_BASE_URL}/api/tasks/confirm/${taskId}?token=${confirmToken}`;
              await sendTaskNotificationEmail({
                to: matchedRecipient.email,
                taskTitle: extractedTask.title,
                taskDescription: extractedTask.description,
                actionRequired: extractedTask.actionRequired,
                priority: extractedTask.priority,
                callerName: extractedTask.callerName,
                callerPhone: extractedTask.callerPhone,
                callerEmail: extractedTask.callerEmail,
                agentName: agent.name,
                confirmUrl,
                transcript: transcriptText,
                locale: agent.customer.locale,
              });
              log.info({ taskId, email: matchedRecipient.email }, '📧 Task email sent (sync worker)');
            }
          }
        }
      }
    } catch (taskErr) {
      log.error({ error: taskErr, callId: callRecord.id }, 'Post-call task extraction failed (sync worker) — non-blocking');
    }
  }

  // ── Store Appointment if Booked — with dedup against server tool ──
  if (appointmentBooked && appointmentDate) {
    try {
      const customerTz = agent.customer.timezone || 'Europe/Athens';
      let scheduledAt = parseDateTimeInTimezone(appointmentDate, appointmentTime, customerTz);

      // Check if book_appointment server tool already created this appointment
      const slotStart = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
      const slotEnd = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
      const existingAppointments = await db.query.appointments.findMany({
        where: and(
          eq(appointments.customerId, agent.customerId),
          eq(appointments.agentId, agent.id),
          gte(appointments.scheduledAt, slotStart),
          lte(appointments.scheduledAt, slotEnd),
        ),
        orderBy: [desc(appointments.scheduledAt)],
      });

      if (existingAppointments.length > 0) {
        // Appointment already exists — just link to call
        const existing = existingAppointments[0]!;
        if (!existing.callId) {
          await db.update(appointments)
            .set({ callId: callRecord.id })
            .where(eq(appointments.id, existing.id));
        }
        log.info({ callId: callRecord.id, appointmentId: existing.id }, 'Existing appointment linked to call (sync worker)');
      } else {
        // Slot conflict check for new appointment
        const conflicting = await db.query.appointments.findMany({
          where: and(
            eq(appointments.customerId, agent.customerId),
            gte(appointments.scheduledAt, slotStart),
            lte(appointments.scheduledAt, slotEnd),
          ),
          orderBy: [desc(appointments.scheduledAt)],
        });

        if (conflicting.length > 0) {
          const lastConflict = conflicting[0]!;
          const conflictEnd = new Date(lastConflict.scheduledAt.getTime() + (lastConflict.durationMinutes || 30) * 60 * 1000);
          scheduledAt = conflictEnd;
          log.info(
            { originalSlot: `${appointmentDate} ${appointmentTime}`, movedTo: scheduledAt.toISOString(), conflicts: conflicting.length },
            'Slot conflict — moved to next available slot',
          );
        }

        const [apt] = await db.insert(appointments).values({
          customerId: agent.customerId,
          agentId: agent.id,
          callId: callRecord.id,
          callerName: appointmentCallerName ?? 'Synced caller',
          callerPhone: appointmentCallerPhone,
          scheduledAt,
          notes: appointmentReason ?? summary ?? null,
          status: 'pending',
        }).onConflictDoNothing({ target: [appointments.customerId, appointments.scheduledAt] }).returning();

        if (apt) {
          log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment created from synced conversation');

          // Send .ics calendar invite email
          if (isEmailConfigured() && agent.customer.email) {
            try {
              // Use agent task email if configured, fall back to customer email
              const taskEmails = await db.query.agentTaskEmails.findMany({
                where: eq(agentTaskEmails.agentId, agent.id),
                orderBy: [agentTaskEmails.sortOrder],
              });
              const inviteRecipient = taskEmails.length > 0 ? taskEmails[0]!.email : agent.customer.email;

              const customerRecord = agent.customer as typeof agent.customer & { businessName?: string };
              const businessName = customerRecord.businessName ?? agent.customer.ownerName ?? 'VoiceForge';
              const isEn = agent.customer.locale?.startsWith('en');
              const aptLabel = isEn ? 'Appointment' : 'Ραντεβού';
              const clientLabel = isEn ? 'Client' : 'Πελάτης';
              const svcLabel = isEn ? 'Service' : 'Υπηρεσία';
              const phoneLabel = isEn ? 'Phone' : 'Τηλέφωνο';

              const endAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
              const icsContent = generateIcsInvite({
                summary: `${aptLabel}: ${appointmentCallerName ?? clientLabel} — ${businessName}`,
                description: `${appointmentReason ? `${svcLabel}: ${appointmentReason}\n` : ''}${phoneLabel}: ${appointmentCallerPhone}`.trim(),
                startAt: scheduledAt,
                endAt,
                organizerName: businessName,
                organizerEmail: agent.customer.email,
                attendeeName: appointmentCallerName ?? undefined,
              });

              sendAppointmentInviteEmail({
                to: inviteRecipient,
                businessName,
                callerName: appointmentCallerName ?? clientLabel,
                date: appointmentDate,
                time: appointmentTime,
                serviceType: appointmentReason ?? undefined,
                notes: summary ?? undefined,
                icsContent,
                locale: agent.customer.locale,
              }).catch((err) => log.error({ err, callId: callRecord.id }, 'Failed to send appointment invite email (sync worker)'));

              log.info({ to: inviteRecipient, agentId: agent.id }, 'Appointment invite email queued (sync worker)');
            } catch (emailErr) {
              log.error({ emailErr, callId: callRecord.id }, 'Error preparing appointment invite email (sync worker)');
            }
          }
        } else {
          log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment already exists at this slot (dedup — sync worker)');
        }
      }
    } catch (aptErr) {
      log.error({ error: aptErr, callId: callRecord.id }, 'Failed to create appointment from synced conversation');
    }
  } else if (appointmentBooked && !appointmentDate) {
    log.warn({ callId: callRecord.id }, 'Appointment detected but no date extracted — skipping creation (sync worker)');
  }

  // ── Create Task for Appointment (pending → confirmed via email) ──
  if (appointmentBooked && appointmentDate && callRecord) {
    try {
      const existingTaskForCall = await db.query.tasks.findFirst({
        where: eq(tasks.callId, callRecord.id),
      });

      if (!existingTaskForCall) {
        const aptRecipients = await db.query.agentTaskEmails.findMany({
          where: eq(agentTaskEmails.agentId, agent.id),
          orderBy: [agentTaskEmails.sortOrder],
        });

        if (aptRecipients.length > 0) {
          const recipient = aptRecipients[0]!;
          const taskId = crypto.randomUUID();
          const confirmToken = generateConfirmToken(taskId);
          const isEn = agent.customer.locale?.startsWith('en');
          const callerLabel = appointmentCallerName ?? callRecord.callerNumber ?? (isEn ? 'Client' : 'Πελάτης');

          const taskTitle = isEn
            ? `Appointment: ${callerLabel} — ${appointmentDate} ${appointmentTime}`.trim()
            : `Ραντεβού: ${callerLabel} — ${appointmentDate} ${appointmentTime}`.trim();
          const taskAction = isEn
            ? 'Confirm the appointment has been completed'
            : 'Επιβεβαιώστε ότι το ραντεβού ολοκληρώθηκε';

          await db.insert(tasks).values({
            id: taskId,
            customerId: agent.customerId,
            agentId: agent.id,
            callId: callRecord.id,
            taskEmailId: recipient.id,
            title: taskTitle,
            description: appointmentReason ?? summary ?? null,
            actionRequired: taskAction,
            assignedEmail: recipient.email,
            assignedRole: recipient.roleLabel,
            status: 'pending',
            priority: 'normal',
            confirmToken,
            callerName: appointmentCallerName ?? null,
            callerPhone: appointmentCallerPhone ?? callRecord.callerNumber ?? null,
            callerEmail: null,
          });

          log.info({ taskId, callId: callRecord.id, title: taskTitle }, '✅ Appointment task created (sync worker)');

          if (isEmailConfigured()) {
            const confirmUrl = `${env.API_BASE_URL}/api/tasks/confirm/${taskId}?token=${confirmToken}`;
            await sendTaskNotificationEmail({
              to: recipient.email,
              taskTitle,
              taskDescription: appointmentReason ?? summary ?? '',
              actionRequired: taskAction,
              priority: 'normal',
              callerName: appointmentCallerName ?? null,
              callerPhone: appointmentCallerPhone ?? callRecord.callerNumber ?? null,
              callerEmail: null,
              agentName: agent.name,
              confirmUrl,
              transcript: transcriptText ?? null,
              locale: agent.customer.locale,
            });
            log.info({ taskId, email: recipient.email }, '📧 Appointment task email sent (sync worker)');
          }
        }
      } else {
        log.info({ callId: callRecord.id, existingTaskId: existingTaskForCall.id }, 'Task already exists — skipping appointment task (sync worker)');
      }
    } catch (aptTaskErr) {
      log.error({ error: aptTaskErr, callId: callRecord.id }, 'Failed to create appointment task (sync worker) — non-blocking');
    }
  }

  // ── Episodic Memory — Update Caller Memory ──────────────────
  const callerNumber = callRecord.callerNumber;
  if (callerNumber && callerNumber !== 'unknown') {
    try {
      const memorySummary = summary || transcriptText?.slice(0, 500) || 'Κλήση χωρίς περίληψη.';

      const newFacts: string[] = [];
      if (extractedData.caller_name) newFacts.push(`Όνομα: ${extractedData.caller_name}`);
      if (extractedData.appointment_reason) newFacts.push(`Ενδιαφέρον: ${extractedData.appointment_reason}`);
      if (extractedData.caller_intent) newFacts.push(`Πρόθεση: ${extractedData.caller_intent}`);
      if (appointmentBooked) newFacts.push(`Κλείστηκε ραντεβού`);
      if (appointmentDate) newFacts.push(`Ραντεβού: ${appointmentDate} ${appointmentTime}`);

      const existingMemory = await db.query.callerMemories.findFirst({
        where: and(
          eq(callerMemories.customerId, agent.customerId),
          eq(callerMemories.callerPhone, callerNumber),
        ),
      });

      if (existingMemory) {
        const previousFacts = (existingMemory.keyFacts as string[]) || [];
        const mergedFacts = [...new Set([...previousFacts, ...newFacts])].slice(0, 20);

        const updatedSummary = existingMemory.callCount <= 5
          ? `${existingMemory.summary}\n---\n[Κλήση #${existingMemory.callCount + 1}]: ${memorySummary}`
          : compactMemorySummary(existingMemory.summary, memorySummary, existingMemory.callCount + 1);

        const existingPrefs = (existingMemory.preferences as Record<string, unknown>) || {};
        const newPrefs = {
          ...existingPrefs,
          ...(extractedData.appointment_reason ? { last_service_interest: extractedData.appointment_reason } : {}),
          ...(extractedData.appointment_time ? { preferred_time: extractedData.appointment_time } : {}),
          ...(extractedData.caller_intent ? { last_intent: extractedData.caller_intent } : {}),
        };

        const prevAvg = existingMemory.overallSentiment ?? 3;
        const newAvg = sentimentScore
          ? Math.round((prevAvg * existingMemory.callCount + sentimentScore) / (existingMemory.callCount + 1))
          : prevAvg;

        await db.update(callerMemories)
          .set({
            summary: updatedSummary,
            keyFacts: mergedFacts,
            preferences: newPrefs,
            callerName: extractedData.caller_name || existingMemory.callerName,
            overallSentiment: newAvg,
            lastSentiment: sentimentScore ?? existingMemory.lastSentiment,
            callCount: existingMemory.callCount + 1,
            totalDurationSeconds: existingMemory.totalDurationSeconds + durationSeconds,
            appointmentsBooked: existingMemory.appointmentsBooked + (appointmentBooked ? 1 : 0),
            lastCallId: callRecord.id,
            lastCallAt: new Date(),
            agentId: agent.id,
            updatedAt: new Date(),
          })
          .where(eq(callerMemories.id, existingMemory.id));

        log.info({ callerPhone: callerNumber, memoryId: existingMemory.id, callCount: existingMemory.callCount + 1 }, 'Caller memory updated (sync worker)');
      } else {
        const [newMemory] = await db.insert(callerMemories).values({
          customerId: agent.customerId,
          agentId: agent.id,
          callerPhone: callerNumber,
          callerName: extractedData.caller_name ?? null,
          summary: `[Κλήση #1]: ${memorySummary}`,
          keyFacts: newFacts,
          preferences: {
            ...(extractedData.appointment_reason ? { last_service_interest: extractedData.appointment_reason } : {}),
            ...(extractedData.caller_intent ? { last_intent: extractedData.caller_intent } : {}),
          },
          overallSentiment: sentimentScore,
          lastSentiment: sentimentScore,
          callCount: 1,
          totalDurationSeconds: durationSeconds,
          appointmentsBooked: appointmentBooked ? 1 : 0,
          lastCallId: callRecord.id,
          lastCallAt: new Date(),
          firstCallAt: new Date(),
        }).returning();

        log.info({ callerPhone: callerNumber, memoryId: newMemory?.id }, 'New caller memory created (sync worker)');
      }
    } catch (memoryErr) {
      log.error({ error: memoryErr, callerNumber }, 'Failed to update caller memory (sync worker)');
    }
  }

  return { callId: callRecord.id };
}

// ── Helper: Compact Memory Summary ────────────────────────────
function compactMemorySummary(existingSummary: string, newCallSummary: string, callNumber: number): string {
  const callEntries = existingSummary.split('\n---\n');
  const recentEntries = callEntries.slice(-3);
  const olderCount = callEntries.length - 3;
  const compactHeader = olderCount > 0
    ? `[Σύνοψη ${olderCount} παλαιότερων κλήσεων]: Ο πελάτης έχει καλέσει ${olderCount} φορές πριν.`
    : '';
  const parts = [compactHeader, ...recentEntries, `[Κλήση #${callNumber}]: ${newCallSummary}`].filter(Boolean);
  let result = parts.join('\n---\n');
  if (result.length > 2000) {
    result = result.slice(-2000);
    const firstSep = result.indexOf('\n---\n');
    if (firstSep > 0) result = result.slice(firstSep + 5);
  }
  return result;
}
