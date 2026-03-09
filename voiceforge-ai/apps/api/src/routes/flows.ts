// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Flows Routes (Expert Mode)
// Card-based multi-agent flows with routing rules + ElevenLabs handoff
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../db/connection.js';
import { agentFlows, agents, knowledgeBaseDocuments, customers } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { env } from '../config/env.js';
import { buildEnhancedInstructions } from '../services/prompt-builder.js';

import type { FlowRoutingRules, RoutingRule, FlowAgentCard, FlowWithAgents, AgentFlow } from '@voiceforge/shared';

const log = createLogger('flows');

type ApiResponse<T = unknown> = { success: boolean; data?: T; error?: { code: string; message: string } };

function isDevBypass(): boolean {
  return !elevenlabsService.isConfigured();
}

/** Build the standard webhook tools for server-tool callbacks (calendar, memory, etc.) */
function buildWebhookTools() {
  const serverToolUrl = `${env.API_BASE_URL}/elevenlabs-webhooks/server-tool`;
  return [
    {
      name: 'check_availability',
      description: 'Ελέγχει τα διαθέσιμα ραντεβού στο ημερολόγιο. ΠΑΝΤΑ κάλεσε αυτό το εργαλείο ΠΡΙΝ κλείσεις ραντεβού ώστε να δεις ποια slots είναι ελεύθερα. Επιστρέφει λίστα διαθέσιμων ωρών και κατειλημμένων slots για τη ζητούμενη ημερομηνία.',
      url: serverToolUrl,
      method: 'POST',
      parameters: {
        type: 'object',
        properties: {
          requested_date: { type: 'string', description: 'Ημερομηνία σε μορφή YYYY-MM-DD' },
          service_type: { type: 'string', description: 'Τύπος ραντεβού' },
        },
        required: ['requested_date'],
      },
    },
    {
      name: 'book_appointment',
      description: 'Κλείνει ραντεβού στο ημερολόγιο. Πρώτα ΠΑΝΤΑ κάλεσε check_availability. Αν η ώρα είναι πιασμένη, θα λάβεις slot_taken=true και την πιο κοντινή διαθέσιμη ώρα — πρότεινέ τη στον πελάτη.',
      url: serverToolUrl,
      method: 'POST',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Ημερομηνία YYYY-MM-DD' },
          time: { type: 'string', description: 'Ώρα HH:MM' },
          caller_name: { type: 'string', description: 'Όνομα καλούντα' },
          caller_phone: { type: 'string', description: 'Τηλέφωνο καλούντα' },
          service_type: { type: 'string', description: 'Τύπος ραντεβού' },
          notes: { type: 'string', description: 'Σημειώσεις' },
        },
        required: ['date', 'time', 'caller_name', 'caller_phone'],
      },
    },
    {
      name: 'get_current_datetime',
      description: 'Επιστρέφει την τρέχουσα ημερομηνία και ώρα. Κάλεσε αυτό το εργαλείο αν ο πελάτης ρωτήσει τι μέρα ή ώρα είναι, ή αν χρειάζεσαι να ξέρεις τη σημερινή ημερομηνία για να κλείσεις ραντεβού.',
      url: serverToolUrl,
      method: 'POST',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'get_caller_history',
      description: 'Ελέγχει αν ο καλών έχει καλέσει ξανά και ανακτά το ιστορικό προηγούμενων κλήσεων. Κάλεσε αυτό το εργαλείο στην αρχή κάθε κλήσης με το τηλέφωνο του καλούντα για να θυμηθείς τι ειπώθηκε σε προηγούμενες κλήσεις.',
      url: serverToolUrl,
      method: 'POST',
      parameters: {
        type: 'object',
        properties: {
          caller_phone: { type: 'string', description: 'Τηλέφωνο του καλούντα σε μορφή +30...' },
        },
        required: ['caller_phone'],
      },
    },
    {
      name: 'get_business_hours',
      description: 'Επιστρέφει το ωράριο λειτουργίας του γραφείου. Κάλεσε αυτό αν ο πελάτης ρωτήσει πότε είναι ανοιχτά.',
      url: serverToolUrl,
      method: 'POST',
      parameters: { type: 'object', properties: {} },
    },
  ];
}

async function getCustomerByUserId(userId: string) {
  return db.query.customers.findFirst({ where: eq(customers.userId, userId) });
}

export const flowRoutes = new Hono<{ Variables: { user: AuthUser } }>();
flowRoutes.use('*', authMiddleware);

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT GENERATOR
// Converts routing rules into natural language for the AI agent
// ═══════════════════════════════════════════════════════════════════

function generateRoutingPrompt(
  rules: RoutingRule[],
  agentNames: Record<string, string>,
): string {
  if (!rules.length) return '';

  const lines = rules.map((rule, i) => {
    const targetName = agentNames[rule.targetAgentId] ?? 'Άλλο τμήμα';
    return `${i + 1}. Αν ${rule.condition} → χρησιμοποίησε το εργαλείο μεταφοράς και μετάφερε στον/στην "${targetName}"`;
  });

  return `\n\nΚΑΝΟΝΕΣ ΔΡΟΜΟΛΟΓΗΣΗΣ:
${lines.join('\n')}
${lines.length + 1}. Για οτιδήποτε άλλο, εξυπηρέτησε τον πελάτη εσύ

ΣΗΜΑΝΤΙΚΟ: Αν δεν είσαι σίγουρος/ή σε ποια κατηγορία ανήκει το αίτημα, ρώτησε τον πελάτη για διευκρίνηση.`;
}

// ═══════════════════════════════════════════════════════════════════
// POST /flows — Create a new flow
// ═══════════════════════════════════════════════════════════════════

const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

flowRoutes.post('/', zValidator('json', createFlowSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Check flow limit (one flow per customer for now)
  const existingFlows = await db.query.agentFlows.findMany({
    where: eq(agentFlows.customerId, customer.id),
  });
  if (existingFlows.length >= 5) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'LIMIT_REACHED', message: 'Μέγιστος αριθμός flow (5) - επεξεργαστείτε ένα υπάρχον' },
    }, 400);
  }

  const rows = await db.insert(agentFlows).values({
    customerId: customer.id,
    name: body.name,
    description: body.description ?? null,
  }).returning();
  const flow = rows[0]!;

  log.info({ flowId: flow.id }, 'Flow created');

  return c.json<ApiResponse>({ success: true, data: formatFlow(flow) }, 201);
});

// ═══════════════════════════════════════════════════════════════════
// GET /flows — List flows for customer
// ═══════════════════════════════════════════════════════════════════

flowRoutes.get('/', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flows = await db.query.agentFlows.findMany({
    where: eq(agentFlows.customerId, customer.id),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  });

  return c.json<ApiResponse>({ success: true, data: flows.map(formatFlow) });
});

// ═══════════════════════════════════════════════════════════════════
// GET /flows/:id — Get flow with agents (full data for builder UI)
// ═══════════════════════════════════════════════════════════════════

flowRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  // Get all agents that belong to this flow (by IDs in agentOrder)
  const agentOrder = (flow.agentOrder as string[]) || [];
  const routingRules = (flow.routingRules as FlowRoutingRules) || {};

  let flowAgents: FlowAgentCard[] = [];
  if (agentOrder.length > 0) {
    const agentRecords = await db.query.agents.findMany({
      where: and(
        inArray(agents.id, agentOrder),
        eq(agents.customerId, customer.id),
      ),
    });

    // Get KB doc counts per agent
    const kbDocs = await db.query.knowledgeBaseDocuments.findMany({
      where: and(
        inArray(knowledgeBaseDocuments.agentId, agentOrder),
        eq(knowledgeBaseDocuments.customerId, customer.id),
      ),
    });
    const kbCountMap: Record<string, number> = {};
    for (const doc of kbDocs) {
      if (doc.agentId) {
        kbCountMap[doc.agentId] = (kbCountMap[doc.agentId] || 0) + 1;
      }
    }

    // Map agents in order
    flowAgents = agentOrder
      .map((agentId) => {
        const agent = agentRecords.find((a) => a.id === agentId);
        if (!agent) return null;
        return {
          id: agent.id,
          name: agent.name,
          industry: agent.industry,
          voiceId: agent.voiceId,
          greeting: agent.greeting,
          instructions: agent.instructions,
          status: agent.status,
          elevenlabsAgentId: agent.elevenlabsAgentId,
          isEntryAgent: flow.entryAgentId === agent.id,
          routingRules: routingRules[agent.id] || [],
          kbDocCount: kbCountMap[agent.id] || 0,
        } satisfies FlowAgentCard;
      })
      .filter(Boolean) as FlowAgentCard[];
  }

  const result: FlowWithAgents = {
    flow: formatFlow(flow),
    agents: flowAgents,
  };

  return c.json<ApiResponse>({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /flows/:id — Update flow metadata/rules
// ═══════════════════════════════════════════════════════════════════

const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  entryAgentId: z.string().uuid().nullable().optional(),
  agentOrder: z.array(z.string().uuid()).optional(),
  routingRules: z.record(
    z.string(),
    z.array(z.object({
      targetAgentId: z.string().uuid(),
      condition: z.string().min(1).max(500),
      transferMessage: z.string().min(1).max(500),
    })),
  ).optional(),
  isActive: z.boolean().optional(),
});

flowRoutes.patch('/:id', zValidator('json', updateFlowSchema), async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');
  const updates = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.entryAgentId !== undefined) setValues.entryAgentId = updates.entryAgentId;
  if (updates.agentOrder !== undefined) setValues.agentOrder = updates.agentOrder;
  if (updates.routingRules !== undefined) setValues.routingRules = updates.routingRules;
  if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

  const updated = await db.update(agentFlows)
    .set(setValues)
    .where(eq(agentFlows.id, flowId))
    .returning();

  log.info({ flowId }, 'Flow updated');

  return c.json<ApiResponse>({ success: true, data: formatFlow(updated[0]!) });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /flows/:id — Delete flow (agents are NOT deleted, just unlinked)
// ═══════════════════════════════════════════════════════════════════

flowRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  await db.delete(agentFlows).where(eq(agentFlows.id, flowId));
  log.info({ flowId }, 'Flow deleted');

  return c.json<ApiResponse>({ success: true, data: { id: flowId } });
});

// ═══════════════════════════════════════════════════════════════════
// POST /flows/:id/add-agent — Create a new agent inside a flow
// ═══════════════════════════════════════════════════════════════════

const addAgentSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1),
  voiceId: z.string().min(1),
  greeting: z.string().min(1),
  instructions: z.string().min(1),
  language: z.string().default('el'),
});

flowRoutes.post('/:id/add-agent', zValidator('json', addAgentSchema), async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');
  const body = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  const agentOrder = (flow.agentOrder as string[]) || [];
  if (agentOrder.length >= flow.maxAgents) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'LIMIT_REACHED', message: `Μέγιστος αριθμός agents (${flow.maxAgents}) σε αυτό το flow` },
    }, 400);
  }

  // Create agent on ElevenLabs with enhanced instructions (same as naive mode)
  let elevenlabsAgentId: string | null = null;
  if (!isDevBypass()) {
    const supportedLangs = [body.language || 'el'];
    const customerTz = customer.timezone || 'Europe/Athens';
    const customerLocale = customer.locale?.startsWith('en') ? 'en' : 'el';

    const enhancedInstructions = buildEnhancedInstructions({
      rawInstructions: body.instructions,
      language: body.language || 'el',
      supportedLanguages: supportedLangs,
      customerTimezone: customerTz,
      customerLocale,
    });

    const result = await elevenlabsService.createAgent({
      name: `${body.name} - ${customer.businessName}`,
      instructions: enhancedInstructions,
      greeting: body.greeting,
      voiceId: body.voiceId,
      language: body.language,
      webhookTools: buildWebhookTools(),
    });
    elevenlabsAgentId = result.agentId;
  } else {
    elevenlabsAgentId = `dev_agent_${crypto.randomUUID().slice(0, 8)}`;
  }

  // Store in DB
  const isFirst = agentOrder.length === 0;
  const [newAgent] = await db.insert(agents).values({
    customerId: customer.id,
    elevenlabsAgentId,
    aiProvider: 'elevenlabs',
    name: body.name,
    industry: body.industry,
    status: isDevBypass() ? 'draft' : 'active',
    instructions: body.instructions,
    greeting: body.greeting,
    voiceId: body.voiceId,
    language: body.language,
    isDefault: isFirst,
  }).returning();

  // Add to flow's agent order
  const newOrder = [...agentOrder, newAgent!.id];
  await db.update(agentFlows).set({
    agentOrder: newOrder,
    entryAgentId: isFirst ? newAgent!.id : flow.entryAgentId,
    updatedAt: new Date(),
  }).where(eq(agentFlows.id, flowId));

  log.info({ flowId, agentId: newAgent!.id, isFirst }, 'Agent added to flow');

  return c.json<ApiResponse>({
    success: true,
    data: {
      id: newAgent!.id,
      name: newAgent!.name,
      elevenlabsAgentId: newAgent!.elevenlabsAgentId,
      isEntryAgent: isFirst,
    },
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /flows/:id/agents/:agentId — Remove agent from flow
// ═══════════════════════════════════════════════════════════════════

flowRoutes.delete('/:id/agents/:agentId', async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');
  const agentId = c.req.param('agentId');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  // Remove from order
  const agentOrder = (flow.agentOrder as string[]) || [];
  const newOrder = agentOrder.filter((id) => id !== agentId);

  // Remove routing rules referencing this agent
  const routingRules = (flow.routingRules as FlowRoutingRules) || {};
  const newRules: FlowRoutingRules = {};
  for (const [sourceId, rules] of Object.entries(routingRules)) {
    if (sourceId === agentId) continue; // Remove rules FROM this agent
    newRules[sourceId] = rules.filter((r) => r.targetAgentId !== agentId); // Remove rules TO this agent
  }

  // If this was the entry agent, reassign to the first remaining
  const newEntryId = flow.entryAgentId === agentId
    ? (newOrder[0] ?? null)
    : flow.entryAgentId;

  await db.update(agentFlows).set({
    agentOrder: newOrder,
    routingRules: newRules,
    entryAgentId: newEntryId,
    updatedAt: new Date(),
  }).where(eq(agentFlows.id, flowId));

  // Delete the agent from ElevenLabs + DB
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });
  if (agent) {
    if (agent.elevenlabsAgentId && !isDevBypass()) {
      try {
        await elevenlabsService.deleteAgent(agent.elevenlabsAgentId);
      } catch (error) {
        log.warn({ error, agentId }, 'Failed to delete agent from ElevenLabs');
      }
    }
    await db.delete(agents).where(eq(agents.id, agentId));
  }

  log.info({ flowId, agentId }, 'Agent removed from flow');

  return c.json<ApiResponse>({ success: true, data: { id: agentId } });
});

// ═══════════════════════════════════════════════════════════════════
// POST /flows/:id/deploy — Deploy flow: sync routing rules to ElevenLabs
// Creates transfer_to_agent tools based on routing rules
// Injects routing prompt into each agent's instructions
// ═══════════════════════════════════════════════════════════════════

flowRoutes.post('/:id/deploy', async (c) => {
  const user = c.get('user');
  const flowId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const flow = await db.query.agentFlows.findFirst({
    where: and(eq(agentFlows.id, flowId), eq(agentFlows.customerId, customer.id)),
  });
  if (!flow) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Flow not found' } }, 404);
  }

  const agentOrder = (flow.agentOrder as string[]) || [];
  const routingRules = (flow.routingRules as FlowRoutingRules) || {};

  if (agentOrder.length < 2) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Χρειάζονται τουλάχιστον 2 agents για deploy flow' },
    }, 400);
  }

  if (!flow.entryAgentId) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Δεν έχει οριστεί entry agent' },
    }, 400);
  }

  // Load all agents
  const agentRecords = await db.query.agents.findMany({
    where: and(
      inArray(agents.id, agentOrder),
      eq(agents.customerId, customer.id),
    ),
  });
  const agentMap = new Map(agentRecords.map((a) => [a.id, a]));
  const agentNames: Record<string, string> = {};
  for (const a of agentRecords) {
    agentNames[a.id] = a.name;
  }

  if (isDevBypass()) {
    // In dev mode, just mark as active
    await db.update(agentFlows).set({ isActive: true, updatedAt: new Date() }).where(eq(agentFlows.id, flowId));
    log.info({ flowId }, 'Flow deployed (dev bypass)');
    return c.json<ApiResponse>({ success: true, data: { deployed: true, agentCount: agentOrder.length } });
  }

  // For each agent with routing rules, update ElevenLabs:
  // 1. Build enhanced instructions (language, safety, timezone, memory)
  // 2. Append routing prompt for agent transfers
  // 3. Attach KB docs
  // 4. Add transfer_to_agent tool targets
  const deployResults: Array<{ agentId: string; name: string; status: string }> = [];

  const customerTz = customer.timezone || 'Europe/Athens';
  const customerLocale = customer.locale?.startsWith('en') ? 'en' : 'el';

  // Fetch KB docs for all agents in this flow
  const allKbDocs = agentOrder.length > 0
    ? await db.query.knowledgeBaseDocuments.findMany({
        where: and(
          inArray(knowledgeBaseDocuments.agentId, agentOrder),
          eq(knowledgeBaseDocuments.status, 'ready'),
        ),
      })
    : [];
  const kbDocsByAgent: Record<string, Array<{ id: string; name: string }>> = {};
  for (const doc of allKbDocs) {
    if (doc.agentId && doc.elevenlabsDocId) {
      const arr = kbDocsByAgent[doc.agentId] ?? [];
      arr.push({ id: doc.elevenlabsDocId, name: doc.name || doc.elevenlabsDocId });
      kbDocsByAgent[doc.agentId] = arr;
    }
  }

  for (const agentId of agentOrder) {
    const agent = agentMap.get(agentId);
    if (!agent?.elevenlabsAgentId) continue;

    const rules = routingRules[agentId] || [];

    // Build transfer targets
    const transferTargets = rules
      .map((rule) => {
        const targetAgent = agentMap.get(rule.targetAgentId);
        if (!targetAgent?.elevenlabsAgentId) return null;
        return {
          agentId: targetAgent.elevenlabsAgentId,
          condition: rule.condition,
          transferMessage: rule.transferMessage,
        };
      })
      .filter(Boolean) as Array<{ agentId: string; condition: string; transferMessage: string }>;

    // Generate routing prompt suffix
    const routingPrompt = generateRoutingPrompt(rules, agentNames);

    // Build enhanced instructions (same enrichments as naive mode + routing)
    const supportedLangs: string[] = (agent.supportedLanguages as string[]) ?? [agent.language as string || 'el'];
    const enhancedInstructions = buildEnhancedInstructions({
      rawInstructions: agent.instructions + routingPrompt,
      language: (agent.language as string) || supportedLangs[0] || 'el',
      supportedLanguages: supportedLangs,
      customerTimezone: customerTz,
      customerLocale,
    });

    const agentKbDocs = kbDocsByAgent[agentId] || [];

    // Update ElevenLabs agent with full enhanced instructions + KB docs + webhook tools
    try {
      await elevenlabsService.updateAgent(agent.elevenlabsAgentId, {
        instructions: enhancedInstructions,
        transferTargets,
        webhookTools: buildWebhookTools(),
        ...(agentKbDocs.length > 0 ? { knowledgeBaseDocs: agentKbDocs } : {}),
      });
      deployResults.push({ agentId, name: agent.name, status: 'deployed' });
      log.info({ agentId, name: agent.name, rulesCount: rules.length, kbDocs: agentKbDocs.length }, 'Agent route rules deployed');
    } catch (error) {
      log.error({ error, agentId }, 'Failed to deploy routing rules');
      deployResults.push({ agentId, name: agent.name, status: 'error' });
    }
  }

  // Mark flow as active
  await db.update(agentFlows).set({ isActive: true, updatedAt: new Date() }).where(eq(agentFlows.id, flowId));

  log.info({ flowId, agentCount: agentOrder.length }, 'Flow deployed successfully');

  return c.json<ApiResponse>({
    success: true,
    data: { deployed: true, agentCount: agentOrder.length, results: deployResults },
  });
});

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function formatFlow(flow: typeof agentFlows.$inferSelect): AgentFlow {
  return {
    id: flow.id,
    customerId: flow.customerId,
    name: flow.name,
    description: flow.description,
    entryAgentId: flow.entryAgentId,
    isActive: flow.isActive,
    agentOrder: (flow.agentOrder as string[]) || [],
    routingRules: (flow.routingRules as FlowRoutingRules) || {},
    maxAgents: flow.maxAgents,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString(),
  };
}
