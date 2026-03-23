// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — ElevenLabs Webhook Routes
// Handles: post-conversation data from ElevenLabs Conversational AI
// Stores call records, sends email notifications, handles server tools
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, webhookEvents, appointments, callerMemories, agentTaskEmails, tasks } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { notifyCallCompleted, sendTaskNotificationEmail, isEmailConfigured } from '../services/email.js';
import { getTelephonyProvider } from '../services/telephony/index.js';
import { extractTasksFromTranscript } from '../services/task-extraction.js';
import { generateConfirmToken } from './tasks.js';
import { env } from '../config/env.js';
import { parseDateTimeInTimezone } from '../services/timezone.js';
import { extractAppointmentFromTranscript } from '../services/transcript-parser.js';
import { parseBusinessHours, generateSlots, isWorkingDay, formatBusinessHoursForDisplay, getBusinessHoursSummary } from '../services/business-hours.js';

const log = createLogger('elevenlabs-webhooks');

export const elevenlabsWebhookRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// ElevenLabs Post-Conversation Webhook Payload Types
// ═══════════════════════════════════════════════════════════════════

interface ElevenLabsTranscriptEntry {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs?: number;
}

interface ElevenLabsAnalysis {
  call_successful?: string;
  data_collection?: Record<string, string>;
  transcript_summary?: string;
}

interface ElevenLabsPostConversationPayload {
  conversation_id: string;
  agent_id: string;
  status?: string;
  transcript?: ElevenLabsTranscriptEntry[];
  metadata?: Record<string, string>;
  analysis?: ElevenLabsAnalysis;
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
}

// ═══════════════════════════════════════════════════════════════════
// POST /elevenlabs/post-conversation — Conversation Ended
// ElevenLabs sends this when a conversation ends.
// Contains: transcript, metadata, analysis results
// ═══════════════════════════════════════════════════════════════════

elevenlabsWebhookRoutes.post('/post-conversation', async (c) => {
  try {
    const payload = await c.req.json<ElevenLabsPostConversationPayload>();
    const conversationId = payload.conversation_id;
    const agentId = payload.agent_id;

    log.info(
      { conversationId, agentId, status: payload.status },
      'ElevenLabs post-conversation webhook received',
    );

    // Idempotency: skip if we already processed this conversation
    if (conversationId) {
      const existing = await db.query.webhookEvents.findFirst({
        where: eq(webhookEvents.eventId, conversationId),
      });

      if (existing) {
        log.info({ conversationId }, 'Duplicate webhook — skipping');
        return c.json({ received: true });
      }
    }

    // Find the agent in our DB by ElevenLabs agent ID
    const agent = await db.query.agents.findFirst({
      where: eq(agents.elevenlabsAgentId, agentId),
      with: { customer: true },
    });

    if (!agent) {
      log.warn({ agentId }, 'No agent found for ElevenLabs agent ID');
      await db.insert(webhookEvents).values({
        eventId: conversationId ?? `el_${Date.now()}`,
        eventType: 'elevenlabs.post_conversation',
        source: 'elevenlabs',
        payload: payload as unknown as Record<string, unknown>,
        error: 'Agent not found',
      });
      return c.json({ received: true });
    }

    const customer = agent.customer;

    // Build formatted transcript from message array
    const callerLabel = agent.language === 'en' ? 'Caller' : 'Πελάτης';
    let transcriptText = '';
    if (payload.transcript && Array.isArray(payload.transcript)) {
      transcriptText = payload.transcript
        .map((msg) => {
          const role = msg.role === 'agent' ? agent.name : callerLabel;
          return `[${role}]: ${msg.message}`;
        })
        .join('\n');
    }

    // Extract phone numbers from metadata or dynamic variables
    const meta = payload.metadata ?? {};
    const dynVars = payload.conversation_initiation_client_data?.dynamic_variables ?? {};
    const callerNumber = meta.caller_phone ?? dynVars.caller_phone ?? 'unknown';
    const agentNumber = agent.phoneNumber ?? meta.agent_phone ?? 'unknown';

    // Calculate duration from transcript timestamps
    let durationSeconds = 0;
    if (payload.transcript && payload.transcript.length > 0) {
      const lastMsg = payload.transcript[payload.transcript.length - 1];
      durationSeconds = Math.ceil(lastMsg?.time_in_call_secs ?? 0);
    }

    // Try to fetch full conversation details for more data
    try {
      if (conversationId && elevenlabsService.isConfigured()) {
        const full = await elevenlabsService.getConversation(conversationId);
        const fullMeta = (full as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined;
        if (typeof fullMeta?.call_duration_secs === 'number') {
          durationSeconds = fullMeta.call_duration_secs;
        }
      }
    } catch {
      log.debug({ conversationId }, 'Could not fetch full conversation — using webhook data');
    }

    // Determine call status
    const callStatus = payload.status === 'done' ? 'completed' :
                       payload.status === 'error' ? 'failed' :
                       payload.status === 'timeout' ? 'missed' : 'completed';

    // Extract AI analysis data — with dataCollection configured, ElevenLabs AI
    // provides structured extraction (caller name, appointment date/time, intent, etc.)
    const summary = payload.analysis?.transcript_summary ?? null;
    const rawDataCollection = payload.analysis?.data_collection ?? {};
    const callSuccessful = payload.analysis?.call_successful;

    // Normalize data collection values (may come as { value: "..." } objects or direct strings)
    const extractedData: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawDataCollection)) {
      if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
        const v = (val as Record<string, unknown>).value;
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          extractedData[key] = String(v);
        }
      } else if (typeof val === 'string' && val.trim()) {
        extractedData[key] = val;
      }
    }

    // Fallback: if AI data collection returned nothing (agent missing platformSettings),
    // parse the transcript text for date/time/name/phone patterns
    const aiDataAvailable = Object.keys(extractedData).length > 0;
    if (!aiDataAvailable && transcriptText) {
      const fallback = extractAppointmentFromTranscript(transcriptText);
      log.info({ conversationId, fallback }, 'AI data collection empty — using transcript fallback extraction');
      for (const [key, val] of Object.entries(fallback)) {
        if (val) extractedData[key] = val;
      }

      // Background: update the agent's platformSettings for future conversations
      try {
        if (agentId && elevenlabsService.isConfigured()) {
          elevenlabsService.updateAgent(agentId, { name: agent.name }).catch((err) => {
            log.warn({ error: err, agentId }, 'Background agent platformSettings update failed');
          });
        }
      } catch { /* non-critical */ }
    }

    // Use AI-extracted data (works for both Greek and English)
    // appointmentBooked requires BOTH date AND time, plus strong intent signal
    // This prevents false positives when caller just mentions a date/time in passing
    const appointmentDate = extractedData.appointment_date ?? null;
    const appointmentTime = extractedData.appointment_time ?? null;
    const hasDateAndTime = !!(appointmentDate && appointmentTime);
    const hasBookingIntent = extractedData.caller_intent === 'appointment_booking';
    // Only mark as booked if: (date+time present AND intent is booking) OR (AI explicitly confirmed via data collection)
    const appointmentBooked = hasDateAndTime && (hasBookingIntent || aiDataAvailable);
    const appointmentCallerName = extractedData.caller_name ?? null;
    const appointmentCallerPhone = extractedData.caller_phone ?? callerNumber;
    const appointmentReason = extractedData.appointment_reason ?? null;
    const callerIntent = extractedData.caller_intent ?? (appointmentBooked ? 'appointment_booking' : null);

    log.info(
      { conversationId, extractedData, appointmentBooked },
      'AI-extracted data from webhook',
    );

    // Compute sentiment (1-5 scale)
    const sentimentScore = callSuccessful === 'true' || callSuccessful === 'success' ? 5 :
                           callSuccessful === 'false' || callSuccessful === 'failure' ? 2 : null;

    // ── Dedup: Check if Telnyx already created a call record ────
    // When both Telnyx and ElevenLabs webhooks fire for the same
    // conversation, we UPDATE the existing record instead of INSERT.
    // Match by callerNumber + agentId + time window to avoid merging
    // two concurrent calls from different callers into one record (#16).
    let existingCall = null as Awaited<ReturnType<typeof db.query.calls.findFirst>> | null;

    // Try precise match: same agent + same caller within 2-minute window
    if (callerNumber && callerNumber !== 'unknown') {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      existingCall = await db.query.calls.findFirst({
        where: and(
          eq(calls.agentId, agent.id),
          eq(calls.callerNumber, callerNumber),
          gte(calls.startedAt, twoMinutesAgo),
          lte(calls.startedAt, new Date()),
        ),
        orderBy: [desc(calls.startedAt)],
      }) ?? null;
    }

    let callRecord;

    if (existingCall) {
      // UPDATE existing record with richer ElevenLabs data
      const [updated] = await db.update(calls)
        .set({
          transcript: transcriptText || existingCall.transcript,
          summary: summary ?? existingCall.summary,
          sentiment: sentimentScore ?? existingCall.sentiment,
          intentCategory: callerIntent ?? existingCall.intentCategory,
          appointmentBooked,
          durationSeconds: durationSeconds || existingCall.durationSeconds,
          status: callStatus as typeof calls.$inferInsert.status,
          insightsRaw: {
            analysis: payload.analysis,
            metadata: payload.metadata,
            extractedData,
            conversationStatus: payload.status,
          },
        })
        .where(eq(calls.id, existingCall.id))
        .returning();
      callRecord = updated;
      log.info({ callId: existingCall.id, conversationId }, 'Merged ElevenLabs data into existing call record (dedup)');
    } else {
      // INSERT new record (no Telnyx record found — e.g., browser widget test)
      const [inserted] = await db.insert(calls).values({
        customerId: agent.customerId,
        agentId: agent.id,
        telnyxConversationId: conversationId,
        callerNumber,
        agentNumber,
        direction: 'inbound',
        status: callStatus as typeof calls.$inferInsert.status,
        durationSeconds,
        transcript: transcriptText || null,
        telnyxEventId: conversationId,
        summary,
        sentiment: sentimentScore,
        intentCategory: callerIntent,
        appointmentBooked,
        insightsRaw: {
          analysis: payload.analysis,
          metadata: payload.metadata,
          extractedData,
          conversationStatus: payload.status,
        },
        metadata: meta as Record<string, unknown>,
      }).returning();
      callRecord = inserted;
    }

    // Log the webhook event for deduplication
    await db.insert(webhookEvents).values({
      eventId: conversationId ?? `el_${Date.now()}`,
      eventType: 'elevenlabs.post_conversation',
      source: 'elevenlabs',
      payload: payload as unknown as Record<string, unknown>,
    });

    log.info(
      { conversationId, agentId: agent.id, callId: callRecord?.id, duration: durationSeconds },
      'Call record stored from ElevenLabs',
    );

    if (customer && callRecord) {
      await notifyCallCompleted({
        callId: callRecord.id,
        customerEmail: customer.email,
        ownerName: customer.ownerName,
        callerPhone: callerNumber,
        agentName: agent.name,
        durationSeconds,
        summary,
        sentiment: sentimentScore,
        appointmentBooked,
        locale: customer?.locale,
      });
    }

    // ── SMS Notification ────────────────────────────────────────
    const smsProvider = getTelephonyProvider();
    if (smsProvider.isSmsConfigured() && customer?.phone && callRecord) {
      try {
        await smsProvider.sendCallSummarySms({
          to: customer.phone,
          callerPhone: callerNumber,
          agentName: agent.name,
          durationSeconds,
          summary: summary ?? 'Δεν υπάρχει διαθέσιμη περίληψη.',
          appointmentBooked,
        });
        log.info({ callId: callRecord.id, to: customer.phone }, 'Call summary SMS sent');
      } catch (smsErr) {
        log.error({ error: smsErr, callId: callRecord.id }, 'Failed to send call summary SMS');
      }
    }

    // ── Store Appointment if Booked — deduplicate with server tool ──
    // ── Post-Call Task Extraction ───────────────────────────────
    // Task extraction runs always (even without email config) — email sending is optional
    if (callRecord && transcriptText) {
      try {
        // Check if this agent has task email recipients configured
        const taskEmailRecipients = await db.query.agentTaskEmails.findMany({
          where: eq(agentTaskEmails.agentId, agent.id),
          orderBy: [agentTaskEmails.sortOrder],
        });

        if (taskEmailRecipients.length > 0) {
          log.info({ agentId: agent.id, recipientCount: taskEmailRecipients.length }, '📋 Starting post-call task extraction');

          const extraction = await extractTasksFromTranscript({
            transcript: transcriptText,
            agentName: agent.name,
            roles: taskEmailRecipients.map((r) => ({
              roleLabel: r.roleLabel,
              roleDescription: r.roleDescription,
            })),
            callerPhone: callerNumber !== 'unknown' ? callerNumber : undefined,
            language: agent.language,
          });

          log.info({ hasTasks: extraction.hasTasks, taskCount: extraction.tasks.length }, '🤖 Task extraction complete');

          if (extraction.hasTasks) {
            for (const extractedTask of extraction.tasks) {
              // Find the matching email recipient
              const matchedRecipient = taskEmailRecipients.find(
                (r) => r.roleLabel === extractedTask.matchedRole,
              ) ?? taskEmailRecipients[0]!;

              // Create task record
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

              log.info(
                { taskId, callId: callRecord.id, role: matchedRecipient.roleLabel, email: matchedRecipient.email, title: extractedTask.title },
                '✅ Task record created in DB',
              );

              // Send task notification email (only if email service is configured)
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
                  locale: customer?.locale,
                });

                log.info(
                  { taskId, email: matchedRecipient.email },
                  '📧 Task notification email sent',
                );
              } else {
                log.warn(
                  { taskId, email: matchedRecipient.email },
                  '📧 Email not configured — task saved but notification skipped',
                );
              }
            }
          } else {
            log.info({ callId: callRecord.id }, '📋 No tasks extracted from this call');
          }
        }
      } catch (taskErr) {
        log.error({ error: taskErr, callId: callRecord?.id }, 'Post-call task extraction failed — non-blocking');
      }
    }

    // ── Store Appointment if Booked ──
    if (appointmentBooked && callRecord) {
      try {
        const aptDate = appointmentDate;
        const aptTime = appointmentTime || '09:00';

        // Use customer timezone for proper UTC conversion
        const customerTz = customer?.timezone || 'Europe/Athens';
        const scheduledAt = aptDate
          ? parseDateTimeInTimezone(aptDate, aptTime, customerTz)
          : new Date();

        // Check if the book_appointment server tool already created this appointment
        // during the call. If so, just link it to the call record — don't duplicate.
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
          // Appointment already exists (created by book_appointment tool) — link to call
          const existing = existingAppointments[0]!;
          if (!existing.callId) {
            await db.update(appointments)
              .set({ callId: callRecord.id })
              .where(eq(appointments.id, existing.id));
          }
          log.info(
            { callId: callRecord.id, appointmentId: existing.id, scheduledAt: existing.scheduledAt.toISOString() },
            'Existing appointment linked to call record (no duplicate created)',
          );
        } else {
          const [created] = await db.insert(appointments).values({
            customerId: agent.customerId,
            agentId: agent.id,
            callId: callRecord.id,
            callerName: appointmentCallerName ?? callerNumber,
            callerPhone: appointmentCallerPhone,
            scheduledAt,
            notes: appointmentReason ?? summary ?? null,
            status: 'pending',
          })
            .onConflictDoNothing({ target: [appointments.customerId, appointments.scheduledAt] })
            .returning();
          if (created) {
            log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment record created from post-call data');
          } else {
            log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Post-call appointment skipped — slot already booked (unique constraint)');
          }
        }
      } catch (aptErr) {
        log.error({ error: aptErr }, 'Failed to create/link appointment record');
      }
    }

    // ── Episodic Memory — Update Caller Memory ──────────────────
    // After every call, create or update the caller's memory entry
    // so the AI agent can remember past interactions on next call
    if (callRecord && callerNumber && callerNumber !== 'unknown') {
      try {
        // Build a memory summary from this call
        const memorySummary = summary || transcriptText?.slice(0, 500) || 'Κλήση χωρίς περίληψη.';

        // Extract key facts from the call's extracted data
        const newFacts: string[] = [];
        if (extractedData.caller_name) newFacts.push(`Όνομα: ${extractedData.caller_name}`);
        if (extractedData.appointment_reason) newFacts.push(`Ενδιαφέρον: ${extractedData.appointment_reason}`);
        if (extractedData.caller_intent) newFacts.push(`Πρόθεση: ${extractedData.caller_intent}`);
        if (appointmentBooked) newFacts.push(`Κλείστηκε ραντεβού`);
        if (appointmentDate) newFacts.push(`Ραντεβού: ${appointmentDate} ${appointmentTime}`);

        // Check if a memory already exists for this caller
        const existingMemory = await db.query.callerMemories.findFirst({
          where: and(
            eq(callerMemories.customerId, agent.customerId),
            eq(callerMemories.callerPhone, callerNumber),
          ),
        });

        if (existingMemory) {
          // Update existing memory — append new info
          const previousFacts = (existingMemory.keyFacts as string[]) || [];
          const mergedFacts = [...new Set([...previousFacts, ...newFacts])].slice(0, 20); // Keep max 20 facts

          // Build updated summary: combine old + new
          const updatedSummary = existingMemory.callCount <= 5
            ? `${existingMemory.summary}\n---\n[Κλήση #${existingMemory.callCount + 1}]: ${memorySummary}`
            : compactMemorySummary(existingMemory.summary, memorySummary, existingMemory.callCount + 1);

          // Merge preferences
          const existingPrefs = (existingMemory.preferences as Record<string, unknown>) || {};
          const newPrefs = {
            ...existingPrefs,
            ...(extractedData.appointment_reason ? { last_service_interest: extractedData.appointment_reason } : {}),
            ...(extractedData.appointment_time ? { preferred_time: extractedData.appointment_time } : {}),
            ...(extractedData.caller_intent ? { last_intent: extractedData.caller_intent } : {}),
          };

          // Compute rolling average sentiment
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

          log.info(
            { callerPhone: callerNumber, memoryId: existingMemory.id, callCount: existingMemory.callCount + 1 },
            'Caller memory updated (episodic)',
          );
        } else {
          // Create new memory for first-time caller
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

          log.info(
            { callerPhone: callerNumber, memoryId: newMemory?.id },
            'New caller memory created (first call)',
          );
        }
      } catch (memoryErr) {
        // Memory is non-critical — don't fail the webhook
        log.error({ error: memoryErr, callerNumber }, 'Failed to update caller memory');
      }
    }

    return c.json({ received: true });
  } catch (error) {
    log.error({ error }, 'ElevenLabs post-conversation webhook error');
    return c.json({ received: true, error: 'Processing error' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /elevenlabs/tool/:toolName — Webhook Tool Endpoint
// ElevenLabs calls this directly for webhook-type tools (server-to-server).
// The tool parameters are the request body. Agent ID is in the URL path.
// This bypasses the client entirely — works with any connection method
// (browser SDK, convai widget, phone calls).
// ═══════════════════════════════════════════════════════════════════

elevenlabsWebhookRoutes.post('/tool/:elAgentId/:toolName', async (c) => {
  const elAgentId = c.req.param('elAgentId');
  const toolName = c.req.param('toolName');
  let body: Record<string, unknown> = {};

  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    // Body may be empty for parameter-less tools like get_current_datetime
  }

  log.info({ toolName, elAgentId }, 'ElevenLabs webhook tool call');

  // Forward to the existing server-tool handler via internal loopback
  try {
    const internalResponse = await fetch(`http://127.0.0.1:${env.PORT || 3001}/webhooks/elevenlabs/server-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        agent_id: elAgentId,
        parameters: body,
      }),
    });
    const result = await internalResponse.json();
    return c.json(result);
  } catch (error) {
    log.error({ error, toolName, elAgentId }, 'Webhook tool call internal forward failed');
    return c.json({ error: true, message: 'Tool call failed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /elevenlabs/server-tool — Server Tool Callback
// ElevenLabs calls this when an agent invokes a server tool.
// We route to the appropriate handler based on tool name.
// ═══════════════════════════════════════════════════════════════════

elevenlabsWebhookRoutes.post('/server-tool', async (c) => {
  try {
    const payload = await c.req.json<Record<string, unknown>>();
    const toolName = payload.tool_name as string;
    const conversationId = payload.conversation_id as string;
    const parameters = payload.parameters as Record<string, unknown>;
    const elAgentId = payload.agent_id as string;

    log.info({ toolName, conversationId, agentId: elAgentId }, 'ElevenLabs server tool callback');

    // Resolve agent and customer for timezone-aware operations
    const agentRecord = elAgentId
      ? await db.query.agents.findFirst({
          where: eq(agents.elevenlabsAgentId, elAgentId),
          with: { customer: true },
        })
      : null;
    const customerTz = (agentRecord?.customer as Record<string, unknown> | undefined)?.timezone as string || 'Europe/Athens';

    switch (toolName) {
      case 'check_availability': {
        const requestedDate = parameters?.requested_date as string;

        if (!agentRecord) {
          return c.json({
            error: true,
            message: 'Δεν βρέθηκε ο βοηθός. Δεν μπορώ να ελέγξω διαθεσιμότητα.',
          });
        }

        const bhConfig = parseBusinessHours(agentRecord.businessHours);
        const { getDayRangeInTimezone, formatTimeInTimezone } = await import('../services/timezone.js');
        const { getIcalBusySlots } = await import('../services/ical.js');

        // Helper: get available slots for a single date using agent's business hours config
        const getAvailableForDate = async (dateStr: string) => {
          const allSlots = generateSlots(bhConfig, dateStr);
          const isClosed = !isWorkingDay(bhConfig, dateStr);

          if (isClosed || allSlots.length === 0) {
            return { date: dateStr, available: [] as string[], booked: [] as string[], isClosed: true };
          }

          const { startDate: dayStart, endDate: dayEnd } = getDayRangeInTimezone(dateStr, customerTz);
          const existingApts = await db.query.appointments.findMany({
            where: and(
              eq(appointments.customerId, agentRecord.customerId),
              gte(appointments.scheduledAt, dayStart),
              lte(appointments.scheduledAt, dayEnd),
            ),
          });
          const busyTimes = existingApts
            .filter((a) => a.status !== 'cancelled')
            .map((a) => formatTimeInTimezone(new Date(a.scheduledAt), customerTz));

          // Also check iCal external calendar busy slots
          const icalBusyTimes = await getIcalBusySlots(
            agentRecord.customerId,
            dateStr,
            customerTz,
            bhConfig.slotDurationMinutes,
          );

          // Merge both sources of busy times
          const allBusyTimes = [...new Set([...busyTimes, ...icalBusyTimes])];
          const available = allSlots.filter((t) => !allBusyTimes.includes(t));
          return { date: dateStr, available, booked: allBusyTimes, isClosed: false };
        };

        // Check the requested date
        const result = await getAvailableForDate(requestedDate);
        const allSlotsForDate = generateSlots(bhConfig, requestedDate);

        // If the requested date has NO available slots, also check next 3 working days
        const nextDaysAvailability: Array<{ date: string; available_count: number; sample_slots: string[] }> = [];
        if (result.available.length === 0) {
          const baseDate = new Date(requestedDate + 'T12:00:00');
          let checked = 0;
          let offset = 1;
          while (checked < 3 && offset <= 14) {
            const nextDate = new Date(baseDate);
            nextDate.setDate(nextDate.getDate() + offset);
            const nextDateStr = nextDate.toISOString().split('T')[0]!;
            const nextResult = await getAvailableForDate(nextDateStr);
            if (!nextResult.isClosed && nextResult.available.length > 0) {
              nextDaysAvailability.push({
                date: nextDateStr,
                available_count: nextResult.available.length,
                sample_slots: nextResult.available.slice(0, 5),
              });
              checked++;
            }
            offset++;
          }
        }

        const bhSummary = getBusinessHoursSummary(bhConfig);

        return c.json({
          date: requestedDate,
          business_hours: bhSummary,
          total_slots: allSlotsForDate.length,
          booked_count: result.booked.length,
          available_count: result.available.length,
          is_closed: result.isClosed,
          available_slots: result.available.map((time) => ({
            date: requestedDate, time, available: true,
          })),
          booked_slots: result.booked,
          ...(result.available.length === 0 && !result.isClosed
            ? { message: `Η ${requestedDate} είναι πλήρης. Δες τις εναλλακτικές ημερομηνίες παρακάτω.` }
            : result.isClosed
            ? { message: `Η ${requestedDate} είναι κλειστά. Δεν δεχόμαστε ραντεβού. Δες τις εναλλακτικές ημερομηνίες παρακάτω.` }
            : {}),
          ...(nextDaysAvailability.length > 0
            ? { next_available_days: nextDaysAvailability }
            : {}),
        });
      }

      case 'book_appointment': {
        const date = parameters?.date as string;
        const time = parameters?.time as string;
        const callerName = parameters?.caller_name as string;
        const callerPhone = parameters?.caller_phone as string;
        const serviceType = parameters?.service_type as string | undefined;
        const notes = parameters?.notes as string | undefined;

        log.info({ date, time, callerName, callerPhone }, 'Booking appointment via ElevenLabs tool');

        if (agentRecord && date && time) {
          const bhConfig = parseBusinessHours(agentRecord.businessHours);
          const { parseDateTimeInTimezone: parseDT, getDayRangeInTimezone, formatTimeInTimezone } = await import('../services/timezone.js');

          // ── Closed day check ─────────────────────────────────────
          if (!isWorkingDay(bhConfig, date)) {
            return c.json({
              success: false,
              message: `Η ${date} είναι κλειστά. Δεν δεχόμαστε ραντεβού. Ρώτα τον πελάτη για εργάσιμη ημέρα.`,
            });
          }

          // ── Business hours check ─────────────────────────────────
          const validSlots = generateSlots(bhConfig, date);
          if (!validSlots.includes(time)) {
            const toMinutes = (t: string) => {
              const [h, m] = t.split(':');
              return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
            };
            const reqMin = toMinutes(time);
            // Find nearest valid business slot
            const nearest = validSlots.length > 0
              ? validSlots.reduce((closest, slot) =>
                  Math.abs(toMinutes(slot) - reqMin) < Math.abs(toMinutes(closest) - reqMin) ? slot : closest
                )
              : null;

            const bhSummary = getBusinessHoursSummary(bhConfig);
            return c.json({
              success: false,
              outside_business_hours: true,
              requested_time: time,
              message: nearest
                ? `Η ώρα ${time} είναι εκτός ωραρίου (${bhSummary}). Η πιο κοντινή διαθέσιμη ώρα είναι ${nearest}.`
                : `Η ώρα ${time} είναι εκτός ωραρίου (${bhSummary}). Δεν υπάρχουν διαθέσιμα slots.`,
              nearest_valid_time: nearest,
              business_hours: bhSummary,
            });
          }

          const scheduledAt = parseDT(date, time, customerTz);

          if (isNaN(scheduledAt.getTime())) {
            return c.json({
              success: false,
              message: 'Η ημερομηνία ή η ώρα δεν είναι έγκυρη. Χρησιμοποίησε μορφή YYYY-MM-DD και HH:MM.',
            });
          }

          // ── Slot conflict check + atomic booking ────────────────
          const { getIcalBusySlots } = await import('../services/ical.js');
          const icalBusyTimes = await getIcalBusySlots(
            agentRecord.customerId,
            date,
            customerTz,
            bhConfig.slotDurationMinutes,
          );

          const { startDate: dayStart, endDate: dayEnd } = getDayRangeInTimezone(date, customerTz);

          const toMinutes = (t: string) => {
            const [h, m] = t.split(':');
            return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
          };

          const bookingResult = await db.transaction(async (tx) => {
            const existingApts = await tx.query.appointments.findMany({
              where: and(
                eq(appointments.customerId, agentRecord.customerId),
                gte(appointments.scheduledAt, dayStart),
                lte(appointments.scheduledAt, dayEnd),
              ),
            });

            const busyTimes = existingApts
              .filter(a => a.status !== 'cancelled')
              .map(a => formatTimeInTimezone(new Date(a.scheduledAt), customerTz));

            const allBusyTimes = [...new Set([...busyTimes, ...icalBusyTimes])];

            if (allBusyTimes.includes(time)) {
              const freeSlots = validSlots.filter(t => !allBusyTimes.includes(t));
              let nearestSlot: string | null = null;
              if (freeSlots.length > 0) {
                const reqMinutes = toMinutes(time);
                nearestSlot = freeSlots.reduce((closest, slot) =>
                  Math.abs(toMinutes(slot) - reqMinutes) < Math.abs(toMinutes(closest) - reqMinutes) ? slot : closest
                );
              }
              return { conflict: true as const, nearestSlot, freeSlots };
            }

            const [apt] = await tx.insert(appointments).values({
              customerId: agentRecord.customerId,
              agentId: agentRecord.id,
              callerName: callerName ?? 'Άγνωστος',
              callerPhone: callerPhone ?? 'unknown',
              serviceType: serviceType ?? null,
              scheduledAt,
              durationMinutes: bhConfig.slotDurationMinutes,
              notes: notes ?? `Κλείστηκε μέσω AI. Καλών: ${callerName ?? 'N/A'}`,
              status: 'pending',
            })
              .onConflictDoNothing({ target: [appointments.customerId, appointments.scheduledAt] })
              .returning();

            if (!apt) {
              const freeSlots = validSlots.filter(t => !allBusyTimes.includes(t));
              let nearestSlot: string | null = null;
              if (freeSlots.length > 0) {
                const reqMinutes = toMinutes(time);
                nearestSlot = freeSlots.reduce((closest, slot) =>
                  Math.abs(toMinutes(slot) - reqMinutes) < Math.abs(toMinutes(closest) - reqMinutes) ? slot : closest
                );
              }
              return { conflict: true as const, nearestSlot, freeSlots };
            }

            return { conflict: false as const, apt };
          });

          if (bookingResult.conflict) {
            return c.json({
              success: false,
              slot_taken: true,
              requested_time: time,
              message: bookingResult.nearestSlot
                ? `Η ώρα ${time} είναι ήδη κρατημένη. Η πιο κοντινή διαθέσιμη ώρα είναι ${bookingResult.nearestSlot}. Θέλει ο πελάτης να κλείσει στις ${bookingResult.nearestSlot};`
                : `Η ώρα ${time} είναι ήδη κρατημένη και δεν υπάρχουν άλλα διαθέσιμα slots για ${date}. Ρώτα τον πελάτη αν θέλει άλλη ημέρα.`,
              nearest_available: bookingResult.nearestSlot,
              available_slots: bookingResult.freeSlots,
            });
          }

          const apt = bookingResult.apt;
          log.info({ appointmentId: apt?.id, date, time }, 'Appointment booked successfully');

          // ── Send .ics email invite (fire-and-forget) ────────────
          try {
            const customerRecord = agentRecord.customer as { email?: string; locale?: string; businessName?: string };
            if (customerRecord?.email) {
              const { generateIcsInvite } = await import('../services/ics-generator.js');
              const { sendAppointmentInviteEmail } = await import('../services/email.js');

              // Use agent task email if configured, fall back to customer email
              const taskEmails = await db.query.agentTaskEmails.findMany({
                where: eq(agentTaskEmails.agentId, agentRecord.id),
                orderBy: [agentTaskEmails.sortOrder],
              });
              const inviteRecipient = taskEmails.length > 0 ? taskEmails[0]!.email : customerRecord.email;

              const isEn = customerRecord.locale?.startsWith('en');
              const clientLabel = isEn ? 'Client' : 'Πελάτης';
              const aptLabel = isEn ? 'Appointment' : 'Ραντεβού';
              const svcLabel = isEn ? 'Service' : 'Υπηρεσία';
              const phoneLabel = isEn ? 'Phone' : 'Τηλέφωνο';

              const endAt = new Date(scheduledAt.getTime() + (bhConfig.slotDurationMinutes || 30) * 60 * 1000);
              const icsContent = generateIcsInvite({
                summary: `${aptLabel}: ${callerName ?? clientLabel} — ${customerRecord.businessName ?? 'VoiceForge'}`,
                description: `${serviceType ? `${svcLabel}: ${serviceType}\n` : ''}${phoneLabel}: ${callerPhone ?? 'N/A'}\n${notes ?? ''}`.trim(),
                startAt: scheduledAt,
                endAt,
                organizerName: customerRecord.businessName ?? 'VoiceForge AI',
                organizerEmail: customerRecord.email,
                attendeeName: callerName ?? undefined,
              });

              // Send to agent task email (or customer email as fallback)
              sendAppointmentInviteEmail({
                to: inviteRecipient,
                businessName: customerRecord.businessName ?? 'VoiceForge AI',
                callerName: callerName ?? (customerRecord.locale?.startsWith('en') ? 'Client' : 'Πελάτης'),
                date,
                time,
                serviceType: serviceType ?? undefined,
                notes: notes ?? undefined,
                icsContent,
                locale: customerRecord.locale,
              }).catch((err) => log.error({ err }, 'Failed to send appointment invite email'));

              log.info({ to: inviteRecipient, agentId: agentRecord.id }, 'Appointment invite email queued');
            }
          } catch (emailErr) {
            log.error({ emailErr }, 'Error preparing appointment invite email');
          }

          return c.json({
            success: true,
            message: `Ραντεβού κλείστηκε για ${callerName ?? 'τον πελάτη'} στις ${date} ${time}`,
            appointment: { id: apt?.id, date, time, name: callerName, phone: callerPhone },
          });
        }

        return c.json({
          success: false,
          message: 'Δεν ήταν δυνατή η κράτηση. Λείπουν στοιχεία (ημερομηνία ή ώρα).',
        });
      }

      case 'get_business_hours': {
        const bhConfig = parseBusinessHours(agentRecord?.businessHours);
        const hoursDisplay = formatBusinessHoursForDisplay(bhConfig);
        const summary = getBusinessHoursSummary(bhConfig);
        return c.json({
          hours: hoursDisplay,
          slot_duration_minutes: bhConfig.slotDurationMinutes,
          closed_dates: bhConfig.closedDates,
          summary,
          timezone: customerTz,
        });
      }

      case 'get_current_datetime': {
        // AI agent asks "what time/day is it?" — return timezone-aware answer
        const { getCurrentDateTime } = await import('../services/timezone.js');
        const dt = getCurrentDateTime(customerTz);
        return c.json({
          current_date: dt.date,
          current_time: dt.time,
          day_name: dt.dayName_el,
          formatted: dt.formatted_el,
          timezone: dt.timezone,
          utc_offset: dt.utcOffset,
        });
      }

      case 'get_caller_history': {
        // AI agent checks if the caller has called before — episodic memory
        const callerPhone = parameters?.caller_phone as string;
        if (!callerPhone || !agentRecord) {
          return c.json({ has_history: false, memories: [], message: 'Δεν βρέθηκε ιστορικό.' });
        }

        try {
          const { callerMemories } = await import('../db/schema/index.js');
          const memories = await db.query.callerMemories.findMany({
            where: and(
              eq(callerMemories.customerId, agentRecord.customerId),
              eq(callerMemories.callerPhone, callerPhone),
            ),
            orderBy: (m, { desc }) => [desc(m.lastCallAt)],
            limit: 5,
          });

          if (memories.length === 0) {
            return c.json({
              has_history: false,
              memories: [],
              message: 'Αυτός ο πελάτης καλεί για πρώτη φορά.',
            });
          }

          // Build context from past memories
          const contextLines = memories.map((m) => {
            const date = new Intl.DateTimeFormat('el-GR', {
              timeZone: customerTz,
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date(m.lastCallAt));

            return `[${date}] ${m.summary}`;
          });

          return c.json({
            has_history: true,
            caller_name: memories[0]?.callerName ?? null,
            total_calls: memories.reduce((sum, m) => sum + m.callCount, 0),
            memories: contextLines,
            message: `Ο πελάτης ${memories[0]?.callerName || callerPhone} έχει καλέσει ξανά. Ιστορικό: ${contextLines.join(' | ')}`,
          });
        } catch (memErr) {
          log.error({ error: memErr }, 'Failed to fetch caller history');
          return c.json({ has_history: false, memories: [], message: 'Δεν ήταν δυνατή η ανάκτηση ιστορικού.' });
        }
      }

      default:
        log.warn({ toolName }, 'Unknown server tool');
        return c.json({ error: `Unknown tool: ${toolName}` }, 400);
    }
  } catch (error) {
    log.error({ error }, 'ElevenLabs server tool error');
    return c.json({ error: 'Processing error' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// HELPERS — Memory Compaction
// When call count exceeds threshold, compact the summary to avoid
// it growing infinitely. Keeps the most important info.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compact a memory summary when it gets too long.
 * Keeps a condensed version of the older calls + adds the new one.
 * This is a simple local compaction — no LLM needed.
 */
function compactMemorySummary(existingSummary: string, newCallSummary: string, callNumber: number): string {
  // Split existing summary by call separators
  const callEntries = existingSummary.split('\n---\n');

  // Keep most recent 3 entries + new one
  const recentEntries = callEntries.slice(-3);

  // Summarize older entries into a condensed header
  const olderCount = callEntries.length - 3;
  const compactHeader = olderCount > 0
    ? `[Σύνοψη ${olderCount} παλαιότερων κλήσεων]: Ο πελάτης έχει καλέσει ${olderCount} φορές πριν.`
    : '';

  const parts = [
    compactHeader,
    ...recentEntries,
    `[Κλήση #${callNumber}]: ${newCallSummary}`,
  ].filter(Boolean);

  // Trim to max 2000 chars to stay within reasonable limits
  let result = parts.join('\n---\n');
  if (result.length > 2000) {
    result = result.slice(-2000);
    // Find the first clean separator to avoid cutting mid-sentence
    const firstSep = result.indexOf('\n---\n');
    if (firstSep > 0) {
      result = result.slice(firstSep + 5);
    }
  }

  return result;
}
