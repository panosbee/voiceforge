// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telnyx Webhook Routes
// Handles: pre-call (dynamic variables), post-call, insights
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, calls, webhookEvents } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import type {
  DynamicVariablesWebhookPayload,
  DynamicVariablesResponse,
  ConversationEndedPayload,
  InsightsWebhookPayload,
} from '@voiceforge/shared';

const log = createLogger('webhooks');

export const webhookRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// PRE-CALL WEBHOOK — Dynamic Variables
// Called by Telnyx at the start of every conversation.
// Must respond within 1 second!
// ═══════════════════════════════════════════════════════════════════

webhookRoutes.post('/telnyx/pre-call', async (c) => {
  const startTime = Date.now();

  try {
    const payload = await c.req.json<DynamicVariablesWebhookPayload>();
    const { telnyx_agent_target, telnyx_end_user_target, assistant_id } = payload.data.payload;

    log.info(
      { agentTarget: telnyx_agent_target, caller: telnyx_end_user_target, assistantId: assistant_id },
      'Pre-call webhook received',
    );

    // Look up the agent by phone number to find the customer's data
    const agent = await db.query.agents.findFirst({
      where: eq(agents.phoneNumber, telnyx_agent_target),
      with: { customer: true },
    });

    if (!agent) {
      log.warn({ phoneNumber: telnyx_agent_target }, 'No agent found for phone number');
      // Return empty — defaults will be used
      return c.json({ dynamic_variables: {} });
    }

    const customer = agent.customer;

    // Build dynamic variables response
    const response: DynamicVariablesResponse = {
      dynamic_variables: {
        var_office_name: customer.businessName,
        var_industry: customer.industry,
        var_timezone: customer.timezone,
        var_customer_id: customer.id,
        var_agent_id: agent.id,
        // Merge agent-specific dynamic variables
        ...(agent.dynamicVariables as Record<string, string>),
      },
      memory: {
        // Load last 5 conversations with this caller
        conversation_query: `metadata->telnyx_end_user_target=eq.${telnyx_end_user_target}&limit=5&order=last_message_at.desc`,
      },
      conversation: {
        metadata: {
          customer_id: customer.id,
          agent_id: agent.id,
          business_name: customer.businessName,
          industry: customer.industry,
        },
      },
    };

    const elapsed = Date.now() - startTime;
    log.info({ elapsed, customerId: customer.id }, 'Pre-call webhook response sent');

    return c.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    log.error({ error, elapsed }, 'Pre-call webhook error');
    // Return empty to not block the call
    return c.json({ dynamic_variables: {} });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST-CALL WEBHOOK — Conversation Ended
// Called when a conversation ends. Stores call record.
// ═══════════════════════════════════════════════════════════════════

webhookRoutes.post('/telnyx/post-call', async (c) => {
  try {
    const payload = await c.req.json<ConversationEndedPayload>();
    const eventId = payload.data.id;
    const eventType = payload.data.event_type;

    // Idempotency check — skip if already processed
    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, eventId),
    });

    if (existing) {
      log.info({ eventId }, 'Duplicate webhook event — skipping');
      return c.json({ received: true });
    }

    const {
      conversation_id,
      assistant_id,
      call_control_id,
      duration_seconds,
      transcript,
      telnyx_agent_target,
      telnyx_end_user_target,
    } = payload.data.payload;

    log.info(
      { conversationId: conversation_id, duration: duration_seconds },
      'Post-call webhook received',
    );

    // Find the agent by Telnyx assistant ID
    const agent = await db.query.agents.findFirst({
      where: eq(agents.telnyxAssistantId, assistant_id),
    });

    if (!agent) {
      log.warn({ assistantId: assistant_id }, 'No agent found for Telnyx assistant ID');
      // Still log the event
      await db.insert(webhookEvents).values({
        eventId,
        eventType,
        source: 'telnyx',
        payload: payload as unknown as Record<string, unknown>,
        error: 'Agent not found',
      });
      return c.json({ received: true });
    }

    // Store the call record
    await db.insert(calls).values({
      customerId: agent.customerId,
      agentId: agent.id,
      telnyxConversationId: conversation_id,
      telnyxCallControlId: call_control_id,
      callerNumber: telnyx_end_user_target,
      agentNumber: telnyx_agent_target,
      direction: 'inbound',
      status: 'completed',
      durationSeconds: duration_seconds,
      transcript: transcript ?? null,
      telnyxEventId: eventId,
    });

    // Log the webhook event
    await db.insert(webhookEvents).values({
      eventId,
      eventType,
      source: 'telnyx',
      payload: payload as unknown as Record<string, unknown>,
    });

    log.info(
      { conversationId: conversation_id, agentId: agent.id },
      'Call record stored successfully',
    );

    // TODO: Send push notification to customer
    // TODO: Send email summary if enabled

    return c.json({ received: true });
  } catch (error) {
    log.error({ error }, 'Post-call webhook error');
    // Return 200 to prevent Telnyx retries for transient errors
    return c.json({ received: true, error: 'Processing error' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// INSIGHTS WEBHOOK — Post-Call Analytics
// Called after insights are generated (sentiment, summary, etc.)
// ═══════════════════════════════════════════════════════════════════

webhookRoutes.post('/telnyx/insights', async (c) => {
  try {
    const payload = await c.req.json<InsightsWebhookPayload>();
    const eventId = payload.data.id;

    // Idempotency check
    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, eventId),
    });

    if (existing) {
      log.info({ eventId }, 'Duplicate insights event — skipping');
      return c.json({ received: true });
    }

    const { conversation_id, insights } = payload.data.payload;

    log.info({ conversationId: conversation_id }, 'Insights webhook received');

    // Find the call record by conversation ID
    const callRecord = await db.query.calls.findFirst({
      where: eq(calls.telnyxConversationId, conversation_id),
    });

    if (callRecord) {
      // Update the call with insights data
      const insightData = insights as Record<string, unknown>;
      await db
        .update(calls)
        .set({
          insightsRaw: insightData,
          summary: (insightData.summary as string) ?? null,
          sentiment: (insightData.sentiment as number) ?? null,
          intentCategory: (insightData.intent_category as string) ?? null,
          appointmentBooked: (insightData.appointment_booked as boolean) ?? false,
        })
        .where(eq(calls.id, callRecord.id));

      log.info({ callId: callRecord.id }, 'Call record updated with insights');
    } else {
      log.warn({ conversationId: conversation_id }, 'No call record found for insights');
    }

    // Log the webhook event
    await db.insert(webhookEvents).values({
      eventId,
      eventType: payload.data.event_type,
      source: 'telnyx',
      payload: payload as unknown as Record<string, unknown>,
    });

    return c.json({ received: true });
  } catch (error) {
    log.error({ error }, 'Insights webhook error');
    return c.json({ received: true, error: 'Processing error' });
  }
});
