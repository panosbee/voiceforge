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

import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, customers, webhookEvents, appointments } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { parseDateTimeInTimezone } from '../services/timezone.js';
import { extractAppointmentFromTranscript } from '../services/transcript-parser.js';
import { notifyCallCompleted } from '../services/email.js';

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
  customer: { id: string; timezone: string; email: string; ownerName: string };
}): Promise<{ recorded: number; skipped: number }> {
  if (!agent.elevenlabsAgentId) return { recorded: 0, skipped: 0 };

  // Fetch recent conversations from ElevenLabs
  const conversations = await elevenlabsService.getConversations(agent.elevenlabsAgentId);
  if (!conversations || conversations.length === 0) {
    return { recorded: 0, skipped: 0 };
  }

  let recorded = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const conversationId = ((conv as Record<string, any>).conversationId ?? (conv as Record<string, any>).conversation_id) as string | undefined;
    if (!conversationId) continue;

    // Check dedup — already recorded?
    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, conversationId),
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Also check if there's already a call with this conversation ID
    const existingCall = await db.query.calls.findFirst({
      where: eq(calls.telnyxConversationId, conversationId),
    });

    if (existingCall) {
      // Record dedup entry to avoid checking again
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
    const convStartTime = (conv as Record<string, any>).startTimeUnixSecs ??
      (conv as Record<string, any>).start_time_unix_secs;
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
    customer: { id: string; timezone: string; email: string; ownerName: string };
  },
): Promise<{ callId: string } | null> {
  const full = await elevenlabsService.getConversation(conversationId) as Record<string, any>;
  const transcript: Array<{ role: string; message?: string; time_in_call_secs?: number; timeInCallSecs?: number }> =
    full.transcript ?? [];
  const analysis = full.analysis as Record<string, any> | undefined;
  const metadata = full.metadata as Record<string, any> | undefined;

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
    // Empty conversation — mark as processed so we don't retry
    await db.insert(webhookEvents).values({
      eventId: conversationId,
      eventType: 'conversation_sync.empty',
      source: 'conversation-sync',
      payload: { conversationId, reason: 'no_transcript' },
    });
    return null;
  }

  // Duration
  const durationSeconds = Math.ceil(
    metadata?.call_duration_secs ??
    metadata?.callDurationSecs ??
    (transcript.length > 0
      ? (transcript[transcript.length - 1]?.time_in_call_secs ?? transcript[transcript.length - 1]?.timeInCallSecs ?? 0)
      : 0)
  );

  // AI analysis
  const summary = analysis?.transcriptSummary ?? analysis?.transcript_summary ?? null;
  const callSuccessful = analysis?.callSuccessful ?? analysis?.call_successful;

  // AI data collection
  const dataCollectionResults = analysis?.dataCollectionResults ?? analysis?.data_collection_results ?? {};
  const extractedData: Record<string, string> = {};
  if (dataCollectionResults && typeof dataCollectionResults === 'object') {
    for (const [key, val] of Object.entries(dataCollectionResults)) {
      const v = val as Record<string, any>;
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

  // Evaluation criteria
  const evalResults = analysis?.evaluationCriteriaResults ?? analysis?.evaluation_criteria_results ?? {};
  const appointmentEval = evalResults?.appointment_booked as Record<string, any> | undefined;
  const appointmentBookedByAi = appointmentEval?.result === 'success';

  // Appointment data
  const appointmentBooked = appointmentBookedByAi || !!(extractedData.appointment_date || extractedData.appointment_time);
  const appointmentDate = extractedData.appointment_date || null;
  const appointmentTime = extractedData.appointment_time || '09:00';
  const appointmentCallerName = extractedData.caller_name || null;
  const appointmentCallerPhone = extractedData.caller_phone || 'unknown';
  const appointmentReason = extractedData.appointment_reason || null;
  const callerIntent = extractedData.caller_intent || (appointmentBooked ? 'appointment_booking' : 'inquiry');

  // Sentiment
  const sentimentScore = callSuccessful === 'success' || callSuccessful === 'true' ? 5 :
                         callSuccessful === 'failure' || callSuccessful === 'false' ? 2 : 4;

  // Start time
  const startTimeUnix = metadata?.start_time_unix_secs ?? metadata?.startTimeUnixSecs;
  const startedAt = startTimeUnix ? new Date(startTimeUnix * 1000) : new Date(Date.now() - durationSeconds * 1000);
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  // Insert call record
  const [callRecord] = await db.insert(calls).values({
    customerId: agent.customerId,
    agentId: agent.id,
    telnyxConversationId: conversationId,
    callerNumber: appointmentCallerPhone !== 'unknown' ? appointmentCallerPhone : 'synced',
    agentNumber: agent.phoneNumber || 'widget',
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
    metadata: { syncedByWorker: true, isWidgetTest: true },
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
  });

  // Create appointment if detected — with slot conflict resolution
  if (appointmentBooked) {
    try {
      const customerTz = agent.customer.timezone || 'Europe/Athens';
      let scheduledAt = appointmentDate
        ? parseDateTimeInTimezone(appointmentDate, appointmentTime, customerTz)
        : new Date();

      // Slot conflict check ±30 minutes
      const slotStart = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
      const slotEnd = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
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

      await db.insert(appointments).values({
        customerId: agent.customerId,
        agentId: agent.id,
        callId: callRecord.id,
        callerName: appointmentCallerName ?? 'Synced caller',
        callerPhone: appointmentCallerPhone,
        scheduledAt,
        notes: appointmentReason ?? summary ?? null,
        status: 'pending',
      });
      log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment created from synced conversation');
    } catch (aptErr) {
      log.error({ error: aptErr, callId: callRecord.id }, 'Failed to create appointment from synced conversation');
    }
  }

  return { callId: callRecord.id };
}
