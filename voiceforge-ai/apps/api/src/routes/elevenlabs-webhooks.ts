// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — ElevenLabs Webhook Routes
// Handles: post-conversation data from ElevenLabs Conversational AI
// Stores call records, sends email notifications, handles server tools
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, webhookEvents, appointments, customers, callerMemories } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { sendCallSummaryEmail, isEmailConfigured } from '../services/email.js';
import { sendCallSummarySms, isSmsConfigured } from '../services/telnyx.js';
import { parseDateTimeInTimezone } from '../services/timezone.js';

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
    let transcriptText = '';
    if (payload.transcript && Array.isArray(payload.transcript)) {
      transcriptText = payload.transcript
        .map((msg) => {
          const role = msg.role === 'agent' ? agent.name : 'Πελάτης';
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
        const fullMeta = (full as Record<string, any>)?.metadata;
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

    // Extract analysis data
    const summary = payload.analysis?.transcript_summary ?? null;
    const extractedData = payload.analysis?.data_collection ?? {};
    const callSuccessful = payload.analysis?.call_successful;

    // Check if an appointment was booked (from analysis OR transcript patterns)
    let appointmentBooked = !!(extractedData.appointment_date || extractedData.appointment_time);
    let appointmentDate = extractedData.appointment_date ?? null;
    let appointmentTime = extractedData.appointment_time ?? '09:00';
    let appointmentCallerName = extractedData.caller_name ?? null;
    let appointmentCallerPhone = extractedData.caller_phone ?? callerNumber;
    let appointmentNotes = extractedData.appointment_notes ?? null;

    // ── Smart Extraction from Transcript ───────────────────────
    // If ElevenLabs analysis didn't provide appointment data,
    // parse the transcript for common patterns
    if (!appointmentBooked && transcriptText) {
      const lowerTranscript = transcriptText.toLowerCase();

      // Detect appointment intent from keywords
      const appointmentKeywords = [
        'ραντεβού', 'ραντεβου', 'appointment',
        'θα σας καλέσ', 'θα σε καλέσ', 'θα καλέσ',
        'θα επικοινωνήσ', 'θα σας πάρ', 'will call',
        'callback', 'call back', 'call you back',
      ];
      const hasAppointmentIntent = appointmentKeywords.some((kw) => lowerTranscript.includes(kw));

      if (hasAppointmentIntent) {
        appointmentBooked = true;

        // Try to extract date from transcript
        const datePatterns = [
          /αύριο|αυριο|tomorrow/i,
          /μεθαύριο|μεθαυριο|day after tomorrow/i,
          /(?:στις?\s+)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/,
          /(\d{1,2})\s+(?:ιανουαρίου|φεβρουαρίου|μαρτίου|απριλίου|μαΐου|ιουνίου|ιουλίου|αυγούστου|σεπτεμβρίου|οκτωβρίου|νοεμβρίου|δεκεμβρίου|january|february|march|april|may|june|july|august|september|october|november|december)/i,
        ];

        for (const pattern of datePatterns) {
          const match = transcriptText.match(pattern);
          if (match) {
            if (/αύριο|αυριο|tomorrow/i.test(match[0])) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              appointmentDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
            } else if (/μεθαύριο|μεθαυριο|day after tomorrow/i.test(match[0])) {
              const dayAfter = new Date();
              dayAfter.setDate(dayAfter.getDate() + 2);
              appointmentDate = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;
            }
            break;
          }
        }

        // Try to extract time from transcript
        const timeMatch = transcriptText.match(/(?:στις?\s+)?(\d{1,2})[:\.](\d{2})(?:\s*(?:μμ|μ\.μ\.|pm))?/i);
        if (timeMatch?.[1] && timeMatch[2]) {
          appointmentTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }

        // Try to extract phone number
        const phoneMatch = transcriptText.match(/(69\d{8}|2\d{9}|\+30\d{10})/);
        if (phoneMatch?.[1]) {
          appointmentCallerPhone = phoneMatch[1];
        }

        // Try to extract caller name from transcript lines
        const nameMatch = transcriptText.match(/(?:ονομάζομαι|λέγομαι|με λένε|my name is|i'm|i am)\s+([Α-Ωα-ωA-Za-z]+)/i);
        if (nameMatch?.[1]) {
          appointmentCallerName = nameMatch[1];
        }

        // Build appointment notes from relevant transcript context
        if (!appointmentNotes) {
          appointmentNotes = summary ?? transcriptText.slice(0, 300);
        }
      }
    }

    // Compute sentiment (1-5 scale)
    const sentimentScore = callSuccessful === 'true' ? 5 :
                           callSuccessful === 'false' ? 2 : null;

    // ── Dedup: Check if Telnyx already created a call record ────
    // When both Telnyx and ElevenLabs webhooks fire for the same
    // conversation, we UPDATE the existing record instead of INSERT
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingCall = await db.query.calls.findFirst({
      where: and(
        eq(calls.agentId, agent.id),
        gte(calls.startedAt, twoMinutesAgo),
        lte(calls.startedAt, new Date()),
      ),
      orderBy: [desc(calls.startedAt)],
    });

    let callRecord;

    if (existingCall) {
      // UPDATE existing record with richer ElevenLabs data
      const [updated] = await db.update(calls)
        .set({
          transcript: transcriptText || existingCall.transcript,
          summary: summary ?? existingCall.summary,
          sentiment: sentimentScore ?? existingCall.sentiment,
          intentCategory: extractedData.intent ?? extractedData.reason ?? existingCall.intentCategory,
          appointmentBooked,
          durationSeconds: durationSeconds || existingCall.durationSeconds,
          status: callStatus as any,
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
        status: callStatus as any,
        durationSeconds,
        transcript: transcriptText || null,
        telnyxEventId: conversationId,
        summary,
        sentiment: sentimentScore,
        intentCategory: extractedData.intent ?? extractedData.reason ?? null,
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

    // ── Email Notification ──────────────────────────────────────
    if (isEmailConfigured() && customer && callRecord) {
      try {
        await sendCallSummaryEmail({
          to: customer.email,
          ownerName: customer.ownerName,
          callerPhone: callerNumber,
          agentName: agent.name,
          durationSeconds,
          summary: summary ?? 'Δεν υπάρχει διαθέσιμη περίληψη.',
          sentiment: sentimentScore ?? undefined,
          appointmentBooked,
          callId: callRecord.id,
        });
        log.info({ callId: callRecord.id, to: customer.email }, 'Call summary email sent');
      } catch (emailErr) {
        log.error({ error: emailErr, callId: callRecord.id }, 'Failed to send call summary email');
      }
    }

    // ── SMS Notification ────────────────────────────────────────
    if (isSmsConfigured() && customer?.phone && callRecord) {
      try {
        await sendCallSummarySms({
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

    // ── Store Appointment if Booked ─────────────────────────────
    if (appointmentBooked && callRecord) {
      try {
        const aptDate = appointmentDate;
        const aptTime = appointmentTime;

        // Use customer timezone for proper UTC conversion
        const customerTz = customer?.timezone || 'Europe/Athens';
        const scheduledAt = aptDate
          ? parseDateTimeInTimezone(aptDate, aptTime, customerTz)
          : new Date();

        await db.insert(appointments).values({
          customerId: agent.customerId,
          agentId: agent.id,
          callId: callRecord.id,
          callerName: appointmentCallerName ?? callerNumber,
          callerPhone: appointmentCallerPhone,
          scheduledAt,
          notes: appointmentNotes ?? summary ?? null,
          status: 'pending',
        });
        log.info({ callId: callRecord.id, scheduledAt: scheduledAt.toISOString() }, 'Appointment record created from post-call data');
      } catch (aptErr) {
        log.error({ error: aptErr }, 'Failed to create appointment record');
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
        if (extractedData.service_type) newFacts.push(`Ενδιαφέρον: ${extractedData.service_type}`);
        if (extractedData.reason) newFacts.push(`Λόγος κλήσης: ${extractedData.reason}`);
        if (extractedData.intent) newFacts.push(`Πρόθεση: ${extractedData.intent}`);
        if (appointmentBooked) newFacts.push(`Κλείστηκε ραντεβού`);

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
            ...(extractedData.service_type ? { last_service_interest: extractedData.service_type } : {}),
            ...(extractedData.preferred_time ? { preferred_time: extractedData.preferred_time } : {}),
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
              ...(extractedData.service_type ? { last_service_interest: extractedData.service_type } : {}),
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
    const customerTz = (agentRecord?.customer as any)?.timezone || 'Europe/Athens';

    switch (toolName) {
      case 'check_availability': {
        const requestedDate = parameters?.requested_date as string;

        if (agentRecord) {
          // Compare dates in customer's timezone
          const { getDayRangeInTimezone, formatTimeInTimezone } = await import('../services/timezone.js');
          const { startDate: dayStart, endDate: dayEnd } = getDayRangeInTimezone(requestedDate, customerTz);

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

          const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
          const available = allSlots.filter((t) => !busyTimes.includes(t));

          return c.json({
            date: requestedDate,
            total_slots: allSlots.length,
            booked_count: busyTimes.length,
            available_count: available.length,
            available_slots: available.map((time) => ({
              date: requestedDate, time, available: true,
            })),
            booked_slots: busyTimes,
          });
        }

        return c.json({
          available_slots: [
            { date: requestedDate, time: '10:00', available: true },
            { date: requestedDate, time: '11:00', available: true },
            { date: requestedDate, time: '14:00', available: true },
            { date: requestedDate, time: '16:00', available: true },
          ],
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
          const { parseDateTimeInTimezone: parseDT, getDayRangeInTimezone, formatTimeInTimezone } = await import('../services/timezone.js');
          const scheduledAt = parseDT(date, time, customerTz);

          if (isNaN(scheduledAt.getTime())) {
            return c.json({
              success: false,
              message: 'Η ημερομηνία ή η ώρα δεν είναι έγκυρη. Χρησιμοποίησε μορφή YYYY-MM-DD και HH:MM.',
            });
          }

          // ── Slot conflict check ─────────────────────────────────
          const { startDate: dayStart, endDate: dayEnd } = getDayRangeInTimezone(date, customerTz);
          const existingApts = await db.query.appointments.findMany({
            where: and(
              eq(appointments.customerId, agentRecord.customerId),
              gte(appointments.scheduledAt, dayStart),
              lte(appointments.scheduledAt, dayEnd),
            ),
          });

          // Check if requested slot is taken (same hour:minute)
          const busyTimes = existingApts
            .filter(a => a.status !== 'cancelled')
            .map(a => formatTimeInTimezone(new Date(a.scheduledAt), customerTz));

          if (busyTimes.includes(time)) {
            // Find nearest available slot
            const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
            const freeSlots = allSlots.filter(t => !busyTimes.includes(t));

            // Find closest free slot to the requested time
            let nearestSlot: string | null = null;
            if (freeSlots.length > 0) {
              const toMinutes = (t: string) => {
                const [h, m] = t.split(':');
                return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
              };
              const reqMinutes = toMinutes(time);
              nearestSlot = freeSlots.reduce((closest, slot) =>
                Math.abs(toMinutes(slot) - reqMinutes) < Math.abs(toMinutes(closest) - reqMinutes) ? slot : closest
              );
            }

            return c.json({
              success: false,
              slot_taken: true,
              requested_time: time,
              message: nearestSlot
                ? `Η ώρα ${time} είναι ήδη κρατημένη. Η πιο κοντινή διαθέσιμη ώρα είναι ${nearestSlot}. Θέλει ο πελάτης να κλείσει στις ${nearestSlot};`
                : `Η ώρα ${time} είναι ήδη κρατημένη και δεν υπάρχουν άλλα διαθέσιμα slots για ${date}.`,
              nearest_available: nearestSlot,
              available_slots: freeSlots,
            });
          }

          // ── Slot is free — book it ──────────────────────────────
          const [apt] = await db.insert(appointments).values({
            customerId: agentRecord.customerId,
            agentId: agentRecord.id,
            callerName: callerName ?? 'Άγνωστος',
            callerPhone: callerPhone ?? 'unknown',
            serviceType: serviceType ?? null,
            scheduledAt,
            durationMinutes: 30,
            notes: notes ?? `Κλείστηκε μέσω AI. Καλών: ${callerName ?? 'N/A'}`,
            status: 'pending',
          }).returning();

          log.info({ appointmentId: apt?.id, date, time }, 'Appointment booked successfully');

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
        return c.json({
          hours: {
            monday: '09:00-17:00', tuesday: '09:00-17:00',
            wednesday: '09:00-17:00', thursday: '09:00-17:00',
            friday: '09:00-17:00', saturday: 'Κλειστά', sunday: 'Κλειστά',
          },
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
            orderBy: (m: any, { desc }: any) => [desc(m.lastCallAt)],
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
