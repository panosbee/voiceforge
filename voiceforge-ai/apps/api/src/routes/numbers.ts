// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Phone Numbers Routes
// Search available Greek numbers + purchase via telephony provider
// Numbers connect to ElevenLabs agents via SIP trunk or native
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, agents } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { getTelephonyProvider } from '../services/telephony/index.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('numbers');

export const numberRoutes = new Hono<{ Variables: { user: AuthUser } }>();

numberRoutes.use('*', authMiddleware);

// ── Validation ───────────────────────────────────────────────────

const searchNumbersSchema = z.object({
  locality: z.string().optional(),
  areaCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const purchaseNumberSchema = z.object({
  phoneNumber: z.string().regex(/^\+30\d+$/, 'Must be a Greek +30 number'),
  agentId: z.string().uuid(),
});

const assignNumberSchema = z.object({
  phoneNumber: z.string().regex(/^\+\d+$/, 'Must be a valid phone number'),
  agentId: z.string().uuid(),
});

// ═══════════════════════════════════════════════════════════════════
// GET /numbers/available — Search available Greek +30 numbers
// Uses master Telnyx API key (no managed accounts needed)
// ═══════════════════════════════════════════════════════════════════

numberRoutes.get('/available', zValidator('query', searchNumbersSchema), async (c) => {
  const query = c.req.valid('query');
  const provider = getTelephonyProvider();

  if (!provider.isConfigured()) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Τηλεφωνία δεν είναι ρυθμισμένη. Επικοινωνήστε με τον διαχειριστή.' } },
      400,
    );
  }

  try {
    const numbers = await provider.searchAvailableNumbers({
      locality: query.locality,
      areaCode: query.areaCode,
      limit: query.limit,
    });

    return c.json<ApiResponse>({ success: true, data: numbers });
  } catch (error) {
    log.error({ error, provider: provider.name }, 'Failed to search available numbers');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'TELEPHONY_ERROR', message: 'Failed to search phone numbers' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /numbers/owned — List purchased/active numbers on master account
// Filters out numbers already assigned to other agents
// ═══════════════════════════════════════════════════════════════════

numberRoutes.get('/owned', async (c) => {
  const provider = getTelephonyProvider();

  if (!provider.isConfigured()) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Τηλεφωνία δεν είναι ρυθμισμένη. Επικοινωνήστε με τον διαχειριστή.' } },
      400,
    );
  }

  try {
    // Get all active numbers from Telnyx account
    const ownedNumbers = await provider.listOwnedNumbers();

    // Get all numbers already assigned to agents in our DB
    const assignedAgents = await db.query.agents.findMany({
      where: isNotNull(agents.phoneNumber),
      columns: { phoneNumber: true },
    });
    const assignedSet = new Set(assignedAgents.map((a) => a.phoneNumber));

    // Mark each number as available or already assigned
    const numbersWithStatus = ownedNumbers.map((num) => ({
      ...num,
      assigned: assignedSet.has(num.phoneNumber),
    }));

    return c.json<ApiResponse>({ success: true, data: numbersWithStatus });
  } catch (error) {
    log.error({ error, provider: provider.name }, 'Failed to list owned numbers');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'TELEPHONY_ERROR', message: 'Failed to list owned phone numbers' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /numbers/assign — Assign an already-owned number to an agent
// Wires SIP connection + ElevenLabs import (no purchasing needed)
// ═══════════════════════════════════════════════════════════════════

numberRoutes.post('/assign', zValidator('json', assignNumberSchema), async (c) => {
  const user = c.get('user');
  const { phoneNumber, agentId } = c.req.valid('json');
  const provider = getTelephonyProvider();

  if (!provider.isConfigured()) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Τηλεφωνία δεν είναι ρυθμισμένη' } },
      400,
    );
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Verify the agent belongs to this customer
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  // Check the number isn't already assigned to another agent
  const existingAgent = await db.query.agents.findFirst({
    where: eq(agents.phoneNumber, phoneNumber),
  });

  if (existingAgent && existingAgent.id !== agentId) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ο αριθμός είναι ήδη αντιστοιχισμένος σε άλλον βοηθό' } },
      409,
    );
  }

  try {
    log.info({ phoneNumber, agentId, customerId: customer.id, provider: provider.name }, 'Assigning owned number to agent');

    // ── Step 1: SIP wiring (Telnyx) or skip (Twilio) ─────────
    let connectionId: string | null = null;

    if (provider.requiresSipWiring()) {
      connectionId = customer.telnyxConnectionId as string | null;
      if (!connectionId) {
        const sip = await provider.createSipConnection(
          `VoiceForge-${customer.businessName || customer.id}`,
        );
        connectionId = sip.connectionId;

        await db
          .update(customers)
          .set({ telnyxConnectionId: connectionId })
          .where(eq(customers.id, customer.id));

        log.info({ connectionId }, 'New SIP connection created');
      }

      await new Promise((r) => setTimeout(r, 2000));

      try {
        await provider.assignNumberToSipConnection(phoneNumber, connectionId);
        log.info({ phoneNumber, connectionId }, 'Number assigned to SIP connection');
      } catch (sipErr) {
        log.warn({ error: sipErr, phoneNumber }, 'SIP assignment failed — number may still be provisioning');
      }
    }

    // ── Step 2: Import number into ElevenLabs ────────────────
    let elevenlabsPhoneNumberId: string | null = null;
    if (agent.elevenlabsAgentId) {
      try {
        const terminationUri = provider.getTerminationUri();
        const elResult = await elevenlabsService.importPhoneNumber({
          phoneNumber,
          agentId: agent.elevenlabsAgentId,
          label: `${agent.name} — ${phoneNumber}`,
          ...(terminationUri ? { terminationUri } : {}),
        });
        elevenlabsPhoneNumberId = elResult.phoneNumberId;
        log.info({ elevenlabsPhoneNumberId, agentId: agent.elevenlabsAgentId }, 'Phone number imported to ElevenLabs');
      } catch (elErr: unknown) {
        // If number already exists in ElevenLabs, find it and reassign to this agent
        const errMsg = elErr instanceof Error ? elErr.message : String(elErr);
        if (errMsg.includes('already exists')) {
          log.info({ phoneNumber }, 'Phone number already in ElevenLabs — finding and reassigning');
          try {
            const allNumbers = await elevenlabsService.listPhoneNumbers();
            const existing = allNumbers.find((n) => n.phoneNumber === phoneNumber);
            if (existing) {
              await elevenlabsService.updatePhoneNumberAgent(existing.phoneNumberId, agent.elevenlabsAgentId);
              elevenlabsPhoneNumberId = existing.phoneNumberId;
              log.info({ elevenlabsPhoneNumberId, agentId: agent.elevenlabsAgentId }, 'Existing phone number reassigned to agent');
            }
          } catch (reassignErr) {
            log.warn({ error: reassignErr, phoneNumber }, 'Failed to reassign existing ElevenLabs phone number');
          }
        } else {
          log.warn({ error: elErr, phoneNumber }, 'ElevenLabs phone import failed — can be retried from dashboard');
        }
      }
    }

    // ── Step 3: Update agent record ──────────────────────────
    await db
      .update(agents)
      .set({
        phoneNumber,
        ...(connectionId ? { telnyxConnectionId: connectionId } : {}),
        ...(elevenlabsPhoneNumberId ? { elevenlabsPhoneNumberId } : {}),
        status: elevenlabsPhoneNumberId ? 'active' : 'draft',
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    log.info({ phoneNumber, agentId, elevenlabsPhoneNumberId, provider: provider.name }, 'Number assignment complete');

    return c.json<ApiResponse>({
      success: true,
      data: {
        phoneNumber,
        agentId,
        connectionId,
        elevenlabsPhoneNumberId,
        sipConfigured: !!connectionId,
        elevenlabsConfigured: !!elevenlabsPhoneNumberId,
        provider: provider.name,
        note: elevenlabsPhoneNumberId
          ? 'Ο αριθμός συνδέθηκε με τον AI βοηθό! Δοκιμάστε να τον καλέσετε.'
          : 'Ο αριθμός αντιστοιχίστηκε. Η σύνδεση θα ολοκληρωθεί σύντομα.',
      },
    }, 200);
  } catch (error) {
    log.error({ error, phoneNumber, provider: provider.name }, 'Failed to assign number');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'TELEPHONY_ERROR', message: 'Failed to assign phone number' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /numbers/purchase — Buy a number and assign to agent
// Uses master Telnyx API key, assigns to ElevenLabs agent
// ═══════════════════════════════════════════════════════════════════

numberRoutes.post('/purchase', zValidator('json', purchaseNumberSchema), async (c) => {
  const user = c.get('user');
  const { phoneNumber, agentId } = c.req.valid('json');
  const provider = getTelephonyProvider();

  if (!provider.isConfigured()) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Τηλεφωνία δεν είναι ρυθμισμένη' } },
      400,
    );
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Verify the agent belongs to this customer
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  try {
    log.info({ phoneNumber, agentId, customerId: customer.id, provider: provider.name }, 'Purchasing phone number + setup');

    // ── Step 1: Purchase the phone number ────────────────────
    const order = await provider.purchasePhoneNumber(phoneNumber);
    log.info({ orderId: order.orderId, status: order.status, provider: provider.name }, 'Number purchased');

    // ── Step 2 & 3: SIP wiring (Telnyx) or skip (Twilio) ────
    let connectionId: string | null = null;

    if (provider.requiresSipWiring()) {
      // Telnyx path: Create or reuse SIP connection → ElevenLabs
      connectionId = customer.telnyxConnectionId as string | null;
      if (!connectionId) {
        const sip = await provider.createSipConnection(
          `VoiceForge-${customer.businessName || customer.id}`,
        );
        connectionId = sip.connectionId;

        // Save connection ID on customer for reuse
        await db
          .update(customers)
          .set({ telnyxConnectionId: connectionId })
          .where(eq(customers.id, customer.id));

        log.info({ connectionId }, 'New SIP connection created');
      }

      // Small delay — carrier may need a moment to provision
      await new Promise((r) => setTimeout(r, 2000));

      try {
        await provider.assignNumberToSipConnection(phoneNumber, connectionId);
        log.info({ phoneNumber, connectionId }, 'Number assigned to SIP connection');
      } catch (sipErr) {
        log.warn({ error: sipErr, phoneNumber }, 'SIP assignment failed — number may still be provisioning. Will retry.');
      }
    }

    // ── Step 4: Import number into ElevenLabs ────────────────
    let elevenlabsPhoneNumberId: string | null = null;
    if (agent.elevenlabsAgentId) {
      try {
        const terminationUri = provider.getTerminationUri();
        const elResult = await elevenlabsService.importPhoneNumber({
          phoneNumber,
          agentId: agent.elevenlabsAgentId,
          label: `${agent.name} — ${phoneNumber}`,
          ...(terminationUri ? { terminationUri } : {}),
        });
        elevenlabsPhoneNumberId = elResult.phoneNumberId;
        log.info({ elevenlabsPhoneNumberId, agentId: agent.elevenlabsAgentId }, 'Phone number imported to ElevenLabs');
      } catch (elErr: unknown) {
        const errMsg = elErr instanceof Error ? elErr.message : String(elErr);
        if (errMsg.includes('already exists')) {
          log.info({ phoneNumber }, 'Phone number already in ElevenLabs — finding and reassigning');
          try {
            const allNumbers = await elevenlabsService.listPhoneNumbers();
            const existing = allNumbers.find((n) => n.phoneNumber === phoneNumber);
            if (existing) {
              await elevenlabsService.updatePhoneNumberAgent(existing.phoneNumberId, agent.elevenlabsAgentId);
              elevenlabsPhoneNumberId = existing.phoneNumberId;
              log.info({ elevenlabsPhoneNumberId }, 'Existing phone number reassigned');
            }
          } catch (reassignErr) {
            log.warn({ error: reassignErr, phoneNumber }, 'Failed to reassign existing ElevenLabs phone number');
          }
        } else {
          log.warn({ error: elErr, phoneNumber }, 'ElevenLabs phone import failed — can be retried from dashboard');
        }
      }
    }

    // ── Step 5: Update agent record ──────────────────────────
    await db
      .update(agents)
      .set({
        phoneNumber,
        telnyxNumberOrderId: order.orderId,
        ...(connectionId ? { telnyxConnectionId: connectionId } : {}),
        ...(elevenlabsPhoneNumberId ? { elevenlabsPhoneNumberId } : {}),
        status: elevenlabsPhoneNumberId ? 'active' : 'draft',
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    log.info({ phoneNumber, agentId, orderId: order.orderId, elevenlabsPhoneNumberId, provider: provider.name }, 'Full phone setup complete');

    return c.json<ApiResponse>({
      success: true,
      data: {
        phoneNumber,
        orderId: order.orderId,
        status: order.status,
        agentId,
        connectionId,
        elevenlabsPhoneNumberId,
        sipConfigured: !!connectionId,
        elevenlabsConfigured: !!elevenlabsPhoneNumberId,
        provider: provider.name,
        note: elevenlabsPhoneNumberId
          ? 'Ο αριθμός συνδέθηκε με τον AI βοηθό! Δοκιμάστε να τον καλέσετε.'
          : 'Ο αριθμός αγοράστηκε. Η σύνδεση θα ολοκληρωθεί σύντομα.',
      },
    }, 201);
  } catch (error) {
    log.error({ error, phoneNumber, provider: provider.name }, 'Failed to purchase number');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'TELEPHONY_ERROR', message: 'Failed to purchase phone number' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /numbers/unassign — Remove phone number from agent
// Clears agent DB record + optionally unassigns from ElevenLabs
// The number stays purchased on Telnyx and can be reassigned later
// ═══════════════════════════════════════════════════════════════════

const unassignNumberSchema = z.object({
  agentId: z.string().uuid(),
});

numberRoutes.post('/unassign', zValidator('json', unassignNumberSchema), async (c) => {
  const user = c.get('user');
  const { agentId } = c.req.valid('json');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });

  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  if (!agent.phoneNumber) {
    return c.json<ApiResponse>({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Agent has no phone number assigned' } }, 400);
  }

  try {
    log.info({ agentId, phoneNumber: agent.phoneNumber }, 'Unassigning phone number from agent');

    // Clear agent DB fields (keep the number on Telnyx for future use)
    await db
      .update(agents)
      .set({
        phoneNumber: null,
        elevenlabsPhoneNumberId: null,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    log.info({ agentId, phoneNumber: agent.phoneNumber }, 'Phone number unassigned from agent');

    return c.json<ApiResponse>({ success: true, data: { agentId, phoneNumber: agent.phoneNumber } });
  } catch (error) {
    log.error({ error, agentId }, 'Failed to unassign number');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'TELEPHONY_ERROR', message: 'Failed to unassign phone number' } },
      500,
    );
  }
});
