// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Flows Routes (Expert Mode)
// Card-based multi-agent flows with routing rules + ElevenLabs handoff
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../db/connection.js';
import { agentFlows, agents, knowledgeBaseDocuments } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { env } from '../config/env.js';

import type { FlowRoutingRules, RoutingRule, FlowAgentCard, FlowWithAgents, AgentFlow } from '@voiceforge/shared';

const log = createLogger('flows');

type ApiResponse<T = unknown> = { success: boolean; data?: T; error?: { code: string; message: string } };

function isDevBypass(): boolean {
  return !elevenlabsService.isConfigured();
}

async function getCustomerByUserId(userId: string) {
  const { customers } = await import('../db/schema/index.js');
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

  // Create agent on ElevenLabs
  let elevenlabsAgentId: string | null = null;
  if (!isDevBypass()) {
    const result = await elevenlabsService.createAgent({
      name: `${body.name} - ${customer.businessName}`,
      instructions: body.instructions,
      greeting: body.greeting,
      voiceId: body.voiceId,
      language: body.language,
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
  // 1. Add transfer_to_agent tool targets
  // 2. Inject routing prompt into instructions
  const deployResults: Array<{ agentId: string; name: string; status: string }> = [];

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

    // Update ElevenLabs agent — instructions get routing suffix appended
    try {
      await elevenlabsService.updateAgent(agent.elevenlabsAgentId, {
        instructions: agent.instructions + routingPrompt,
        transferTargets,
      });
      deployResults.push({ agentId, name: agent.name, status: 'deployed' });
      log.info({ agentId, name: agent.name, rulesCount: rules.length }, 'Agent route rules deployed');
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
