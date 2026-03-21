// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent CRUD Routes
// Create, read, update, delete AI agents
// Primary: ElevenLabs | Phone numbers: Telnyx | Dev: Bypass mode
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, customers, knowledgeBaseDocuments } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { buildEnhancedInstructions } from '../services/prompt-builder.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('agents');

/**
 * Build client tool definitions for an agent.
 * Client tools are executed by the browser via @elevenlabs/client SDK —
 * the browser calls our API directly (works with localhost, no public URL needed).
 */
export function buildClientToolDefs(language: string) {
  const isEn = language === 'en';
  return [
    {
      name: 'check_availability',
      description: isEn
        ? 'Checks available appointment slots in the calendar. ALWAYS call this tool BEFORE booking an appointment so you can see which slots are free. Returns a list of available times and occupied slots for the requested date.'
        : 'Ελέγχει τα διαθέσιμα ραντεβού στο ημερολόγιο. ΠΑΝΤΑ κάλεσε αυτό το εργαλείο ΠΡΙΝ κλείσεις ραντεβού ώστε να δεις ποια slots είναι ελεύθερα. Επιστρέφει λίστα διαθέσιμων ωρών και κατειλημμένων slots για τη ζητούμενη ημερομηνία.',
      parameters: {
        type: 'object' as const,
        properties: {
          requested_date: { type: 'string', description: isEn ? 'Date in YYYY-MM-DD format' : 'Ημερομηνία σε μορφή YYYY-MM-DD' },
          service_type: { type: 'string', description: isEn ? 'Appointment type' : 'Τύπος ραντεβού' },
        },
        required: ['requested_date'],
      },
    },
    {
      name: 'book_appointment',
      description: isEn
        ? 'Books an appointment in the calendar. ALWAYS call check_availability first. If the time slot is taken, you will receive slot_taken=true and the nearest available time — suggest it to the caller.'
        : 'Κλείνει ραντεβού στο ημερολόγιο. Πρώτα ΠΑΝΤΑ κάλεσε check_availability. Αν η ώρα είναι πιασμένη, θα λάβεις slot_taken=true και την πιο κοντινή διαθέσιμη ώρα — πρότεινέ τη στον πελάτη.',
      parameters: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: isEn ? 'Date YYYY-MM-DD' : 'Ημερομηνία YYYY-MM-DD' },
          time: { type: 'string', description: isEn ? 'Time HH:MM' : 'Ώρα HH:MM' },
          caller_name: { type: 'string', description: isEn ? 'Caller name' : 'Όνομα καλούντα' },
          caller_phone: { type: 'string', description: isEn ? 'Caller phone' : 'Τηλέφωνο καλούντα' },
          service_type: { type: 'string', description: isEn ? 'Appointment type' : 'Τύπος ραντεβού' },
          notes: { type: 'string', description: isEn ? 'Notes' : 'Σημειώσεις' },
        },
        required: ['date', 'time', 'caller_name', 'caller_phone'],
      },
    },
    {
      name: 'get_current_datetime',
      description: isEn
        ? 'Returns the current date and time. Call this tool if the caller asks what day or time it is, or if you need to know today\'s date to book an appointment.'
        : 'Επιστρέφει την τρέχουσα ημερομηνία και ώρα. Κάλεσε αυτό το εργαλείο αν ο πελάτης ρωτήσει τι μέρα ή ώρα είναι, ή αν χρειάζεσαι να ξέρεις τη σημερινή ημερομηνία για να κλείσεις ραντεβού.',
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'get_caller_history',
      description: isEn
        ? 'Checks if the caller has called before and retrieves history from previous calls. Call this tool at the START of every call with the caller\'s phone number to remember what was said in previous calls.'
        : 'Ελέγχει αν ο καλών έχει καλέσει ξανά και ανακτά το ιστορικό προηγούμενων κλήσεων. Κάλεσε αυτό το εργαλείο στην αρχή κάθε κλήσης με το τηλέφωνο του καλούντα για να θυμηθείς τι ειπώθηκε σε προηγούμενες κλήσεις.',
      parameters: {
        type: 'object' as const,
        properties: {
          caller_phone: { type: 'string', description: isEn ? 'Caller phone in +30... format' : 'Τηλέφωνο του καλούντα σε μορφή +30...' },
        },
        required: ['caller_phone'],
      },
    },
    {
      name: 'get_business_hours',
      description: isEn
        ? 'Returns the office business hours. Call this if the caller asks when the office is open.'
        : 'Επιστρέφει το ωράριο λειτουργίας του γραφείου. Κάλεσε αυτό αν ο πελάτης ρωτήσει πότε είναι ανοιχτά.',
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
  ];
}

export const agentRoutes = new Hono<{ Variables: { user: AuthUser } }>();

// All agent routes require authentication
agentRoutes.use('*', authMiddleware);

// ── Validation Schemas ───────────────────────────────────────────

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().min(1),
  instructions: z.string().min(10),
  greeting: z.string().min(1),
  ttsModel: z.string().optional().default('eleven_v3_conversational'),
  llmModel: z.string().optional().default('gpt-4o-mini'),
  voiceId: z.string().optional().default(''),  // Will use env default if empty
  language: z.string().optional().default('el'),
  supportedLanguages: z.array(z.string()).optional().default(['el']),
  forwardPhoneNumber: z.string().optional(), // Business owner's real phone for call transfers
  dynamicVariables: z.record(z.string()).optional(),
  knowledgeBaseDocIds: z.array(z.string()).optional(),
  voiceStability: z.number().min(0).max(1).optional(),
  voiceSimilarity: z.number().min(0).max(1).optional(),
  voiceSpeed: z.number().min(0.7).max(1.3).optional(),
  /** If provided, reuse existing ElevenLabs agent (from test-preview) instead of creating new */
  existingElevenlabsAgentId: z.string().optional(),
  /** Free-text business hours displayed in the system prompt */
  businessHoursText: z.string().max(2000).optional(),
  businessHours: z.object({
    weeklySchedule: z.record(
      z.object({
        enabled: z.boolean(),
        timeRanges: z.array(z.object({ start: z.string(), end: z.string() })),
      }),
    ),
    slotDurationMinutes: z.number().min(5).max(240),
    closedDates: z.array(z.string()),
    timezone: z.string().optional(),
  }).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  industry: z.string().min(1).max(100).optional(),
  instructions: z.string().min(10).optional(),
  greeting: z.string().min(1).optional(),
  ttsModel: z.string().optional(),
  llmModel: z.string().optional(),
  voiceId: z.string().optional(),
  language: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
  forwardPhoneNumber: z.string().optional(), // Business owner's real phone for call transfers
  dynamicVariables: z.record(z.string()).optional(),
  voiceStability: z.number().min(0).max(1).optional(),
  voiceSimilarity: z.number().min(0).max(1).optional(),
  voiceSpeed: z.number().min(0.7).max(1.3).optional(),
  /** Free-text business hours displayed in the system prompt */
  businessHoursText: z.string().max(2000).optional(),
  // Widget embed config
  widgetEnabled: z.boolean().optional(),
  widgetColor: z.string().max(20).optional(),
  widgetPosition: z.enum(['bottom-right', 'bottom-left']).optional(),
  widgetButtonText: z.string().max(50).optional(),
  widgetIconType: z.enum(['phone', 'mic', 'chat']).optional(),
  widgetAllowedOrigins: z.array(z.string().url()).optional(),
  businessHours: z.object({
    weeklySchedule: z.record(
      z.object({
        enabled: z.boolean(),
        timeRanges: z.array(z.object({ start: z.string(), end: z.string() })),
      }),
    ),
    slotDurationMinutes: z.number().min(5).max(240),
    closedDates: z.array(z.string()),
    timezone: z.string().optional(),
  }).optional(),
});

// ── Helpers ──────────────────────────────────────────────────────

/** Check if we're in dev bypass mode (no real ElevenLabs API key) */
function isDevBypass(): boolean {
  return !elevenlabsService.isConfigured();
}

async function getCustomerByUserId(userId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST /agents/test-preview — Create or update a temporary ElevenLabs
// agent for browser testing (no DB record, no customer required)
// ═══════════════════════════════════════════════════════════════════

const testPreviewSchema = z.object({
  name: z.string().min(1).max(100),
  instructions: z.string().min(10),
  greeting: z.string().min(1),
  voiceId: z.string().optional().default('aTP4J5SJLQl74WTSRXKW'),
  language: z.string().optional().default('el'),
  ttsModel: z.string().optional().default('eleven_v3_conversational'),
  llmModel: z.string().optional().default('gpt-4o-mini'),
  /** If provided, update existing preview agent instead of creating a new one */
  existingAgentId: z.string().optional(),
  voiceStability: z.number().min(0).max(1).optional(),
  voiceSimilarity: z.number().min(0).max(1).optional(),
  voiceSpeed: z.number().min(0.7).max(1.3).optional(),
});

agentRoutes.post('/test-preview', zValidator('json', testPreviewSchema), async (c) => {
  const body = c.req.valid('json');
  const voiceId = body.voiceId || env.ELEVENLABS_VOICE_ID || 'aTP4J5SJLQl74WTSRXKW';

  log.info({ name: body.name, hasExisting: !!body.existingAgentId }, 'Test preview agent request');

  if (isDevBypass()) {
    // Dev mode — return a fake ID (widget won't work, but UI won't break)
    const fakeId = body.existingAgentId || `dev_preview_${crypto.randomUUID().slice(0, 8)}`;
    return c.json<ApiResponse>({
      success: true,
      data: { elevenlabsAgentId: fakeId },
    });
  }

  try {
    if (body.existingAgentId && !body.existingAgentId.startsWith('dev_')) {
      // Update existing preview agent
      await elevenlabsService.updateAgent(body.existingAgentId, {
        name: `[Preview] ${body.name}`,
        instructions: body.instructions,
        greeting: body.greeting,
        voiceId,
        ttsModel: body.ttsModel,
        llmModel: body.llmModel,
        voiceStability: body.voiceStability,
        voiceSimilarity: body.voiceSimilarity,
        voiceSpeed: body.voiceSpeed,
      });

      log.info({ agentId: body.existingAgentId }, 'Updated preview agent');
      return c.json<ApiResponse>({
        success: true,
        data: { elevenlabsAgentId: body.existingAgentId },
      });
    }

    // Create new preview agent on ElevenLabs (lightweight, no webhook tools)
    const result = await elevenlabsService.createAgent({
      name: `[Preview] ${body.name}`,
      instructions: body.instructions,
      greeting: body.greeting,
      voiceId,
      language: body.language,
      ttsModel: body.ttsModel,
      llmModel: body.llmModel,
      voiceStability: body.voiceStability,
      voiceSimilarity: body.voiceSimilarity,
      voiceSpeed: body.voiceSpeed,
    });

    log.info({ agentId: result.agentId }, 'Created preview agent');
    return c.json<ApiResponse>({
      success: true,
      data: { elevenlabsAgentId: result.agentId },
    });
  } catch (err) {
    log.error({ err }, 'Failed to create/update preview agent');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'ELEVENLABS_ERROR', message: 'Σφάλμα δημιουργίας δοκιμαστικού agent' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /agents — List all agents for authenticated customer
// ═══════════════════════════════════════════════════════════════════

agentRoutes.get('/', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const customerAgents = await db.query.agents.findMany({
    where: eq(agents.customerId, customer.id),
    orderBy: (agents, { desc }) => [desc(agents.createdAt)],
  });

  return c.json<ApiResponse>({
    success: true,
    data: customerAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      industry: agent.industry,
      status: agent.status,
      aiProvider: agent.aiProvider,
      elevenlabsAgentId: agent.elevenlabsAgentId,
      elevenlabsPhoneNumberId: agent.elevenlabsPhoneNumberId,
      phoneNumber: agent.phoneNumber,
      forwardPhoneNumber: agent.forwardPhoneNumber,
      voiceId: agent.voiceId,
      model: agent.model,
      llmModel: agent.llmModel,
      totalCalls: 0, // TODO: compute from calls table with COUNT(*)
      isDefault: agent.isDefault,
      createdAt: agent.createdAt.toISOString(),
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /agents/:id — Get a single agent
// ═══════════════════════════════════════════════════════════════════

agentRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  return c.json<ApiResponse>({ success: true, data: agent });
});

// ═══════════════════════════════════════════════════════════════════
// POST /agents — Create a new agent (ElevenLabs or dev bypass)
// ═══════════════════════════════════════════════════════════════════

agentRoutes.post('/', zValidator('json', createAgentSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Resolve voice ID: use body value, else env default
  const voiceId = body.voiceId || env.ELEVENLABS_VOICE_ID || 'aTP4J5SJLQl74WTSRXKW';

  log.info({ customerId: customer.id, agentName: body.name, devBypass: isDevBypass() }, 'Creating agent');

  // Build client tools for this agent's language
  const agentLang = body.language || 'el';
  const clientTools = buildClientToolDefs(agentLang);

  // ── Build enhanced instructions with timezone + memory + safety + language + CALENDAR ──
  const customerTz = customer.timezone || 'Europe/Athens';
  const customerLocale = customer.locale?.startsWith('en') ? 'en' : 'el';
  const supportedLangs: string[] = body.supportedLanguages ?? ['el'];

  const enhancedInstructions = buildEnhancedInstructions({
    rawInstructions: body.instructions,
    language: body.language || supportedLangs[0] || 'el',
    supportedLanguages: supportedLangs,
    customerTimezone: customerTz,
    customerLocale,
    businessHoursText: body.businessHoursText,
  });

  try {
    let elevenlabsAgentId: string | null = null;

    if (!isDevBypass()) {
      // ── PRODUCTION: Create or reuse agent on ElevenLabs ──
      // If KB doc IDs provided, fetch their names for ElevenLabs API
      let knowledgeBaseDocs: Array<{ id: string; name: string }> | undefined;
      if (body.knowledgeBaseDocIds?.length) {
        const { inArray } = await import('drizzle-orm');
        const kbDocs = await db.query.knowledgeBaseDocuments.findMany({
          where: inArray(knowledgeBaseDocuments.elevenlabsDocId, body.knowledgeBaseDocIds),
        });
        knowledgeBaseDocs = kbDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name }));
      }

      if (body.existingElevenlabsAgentId && !body.existingElevenlabsAgentId.startsWith('dev_')) {
        // Reuse existing preview agent — update it with full config (client tools, proper name)
        await elevenlabsService.updateAgent(body.existingElevenlabsAgentId, {
          name: `${body.name} - ${customer.businessName}`,
          instructions: enhancedInstructions,
          greeting: body.greeting,
          voiceId,
          ttsModel: body.ttsModel,
          llmModel: body.llmModel,
          clientTools,
          supportedLanguages: supportedLangs,
          forwardPhoneNumber: body.forwardPhoneNumber,
          voiceStability: body.voiceStability,
          voiceSimilarity: body.voiceSimilarity,
          voiceSpeed: body.voiceSpeed,
          knowledgeBaseDocs,
        });
        elevenlabsAgentId = body.existingElevenlabsAgentId;
        log.info({ agentId: elevenlabsAgentId }, 'Reused preview agent');
      } else {
        // Create a brand new agent
        const result = await elevenlabsService.createAgent({
          name: `${body.name} - ${customer.businessName}`,
          instructions: enhancedInstructions,
          greeting: body.greeting,
          voiceId,
          language: body.language,
          supportedLanguages: supportedLangs,
          ttsModel: body.ttsModel,
          llmModel: body.llmModel,
          knowledgeBaseDocs,
          clientTools,
          forwardPhoneNumber: body.forwardPhoneNumber,
          voiceStability: body.voiceStability,
          voiceSimilarity: body.voiceSimilarity,
          voiceSpeed: body.voiceSpeed,
        });
        elevenlabsAgentId = result.agentId;
      }
    } else {
      // ── DEV BYPASS: Generate fake ID, no API call ──
      elevenlabsAgentId = `dev_agent_${crypto.randomUUID().slice(0, 8)}`;
      log.info({ fakeAgentId: elevenlabsAgentId }, 'Dev bypass: created fake agent ID');
    }

    // Check if this is the first agent (make it default)
    const existingAgents = await db.query.agents.findMany({
      where: eq(agents.customerId, customer.id),
    });
    const isFirst = existingAgents.length === 0;

    // Store in our database
    const [newAgent] = await db
      .insert(agents)
      .values({
        customerId: customer.id,
        elevenlabsAgentId,
        aiProvider: 'elevenlabs',
        name: body.name,
        industry: body.industry,
        status: isDevBypass() ? 'draft' : 'active',
        model: body.ttsModel,
        llmModel: body.llmModel,
        instructions: body.instructions,
        greeting: body.greeting,
        voiceId,
        language: body.language,
        supportedLanguages: supportedLangs,
        tools: clientTools,
        forwardPhoneNumber: body.forwardPhoneNumber ?? null,
        dynamicVariables: body.dynamicVariables ?? {},
        ...(body.voiceStability !== undefined ? { voiceStability: body.voiceStability } : {}),
        ...(body.voiceSimilarity !== undefined ? { voiceSimilarity: body.voiceSimilarity } : {}),
        ...(body.voiceSpeed !== undefined ? { voiceSpeed: body.voiceSpeed } : {}),
        ...(body.businessHours ? { businessHours: body.businessHours } : {}),
        ...(body.businessHoursText !== undefined ? { businessHoursText: body.businessHoursText || null } : {}),
        isDefault: isFirst,
      })
      .returning();

    log.info(
      { agentId: newAgent?.id, elevenlabsAgentId, devBypass: isDevBypass() },
      'Agent created successfully',
    );

    // If KB doc IDs provided (e.g. from onboarding), attach them to this agent in DB
    if (body.knowledgeBaseDocIds?.length && newAgent) {
      const { inArray } = await import('drizzle-orm');
      await db
        .update(knowledgeBaseDocuments)
        .set({ agentId: newAgent.id, updatedAt: new Date() })
        .where(inArray(knowledgeBaseDocuments.elevenlabsDocId, body.knowledgeBaseDocIds));
      log.info({ agentId: newAgent.id, docCount: body.knowledgeBaseDocIds.length }, 'KB docs attached to agent');
    }

    return c.json<ApiResponse>({ success: true, data: newAgent }, 201);
  } catch (error) {
    log.error({ error }, 'Failed to create agent');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ELEVENLABS_ERROR', message: 'Failed to create AI agent' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /agents/:id — Update an agent (syncs to ElevenLabs)
// ═══════════════════════════════════════════════════════════════════

agentRoutes.patch('/:id', zValidator('json', updateAgentSchema), async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const body = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  try {
    // Rebuild enhanced instructions using shared prompt builder
    const updatedInstructions = body.instructions || agent.instructions;
    const updatedSupportedLangs: string[] = body.supportedLanguages ?? (agent.supportedLanguages as string[] ?? ['el']);

    const updateEnhancedInstructions = buildEnhancedInstructions({
      rawInstructions: updatedInstructions,
      language: body.language || (agent.language as string) || updatedSupportedLangs[0] || 'el',
      supportedLanguages: updatedSupportedLangs,
      customerTimezone: customer.timezone || 'Europe/Athens',
      customerLocale: customer.locale?.startsWith('en') ? 'en' : 'el',
      businessHoursText: body.businessHoursText !== undefined ? body.businessHoursText : (agent.businessHoursText as string | null),
    });

    // Fetch KB docs for this agent (pass to ElevenLabs on update)
    const kbDocs = await db.query.knowledgeBaseDocuments.findMany({
      where: and(
        eq(knowledgeBaseDocuments.agentId, agentId),
        eq(knowledgeBaseDocuments.status, 'ready'),
      ),
    });
    const kbDocObjs = kbDocs
      .filter(d => !!d.elevenlabsDocId)
      .map(d => ({ id: d.elevenlabsDocId!, name: d.name || d.elevenlabsDocId! }));

    // Rebuild client tools with current language
    const updateLang = body.language || (agent.language as string) || 'el';
    const updateClientTools = buildClientToolDefs(updateLang);

    // Update on ElevenLabs (skip in dev bypass)
    if (!isDevBypass() && agent.elevenlabsAgentId && !agent.elevenlabsAgentId.startsWith('dev_')) {
      await elevenlabsService.updateAgent(agent.elevenlabsAgentId, {
        name: body.name ? `${body.name} - ${customer.businessName}` : undefined,
        instructions: updateEnhancedInstructions,
        greeting: body.greeting,
        voiceId: body.voiceId,
        language: updateLang,
        ttsModel: body.ttsModel,
        llmModel: body.llmModel,
        forwardPhoneNumber: body.forwardPhoneNumber,
        clientTools: updateClientTools,
        supportedLanguages: updatedSupportedLangs,
        voiceStability: body.voiceStability,
        voiceSimilarity: body.voiceSimilarity,
        voiceSpeed: body.voiceSpeed,
        ...(kbDocObjs.length > 0 ? { knowledgeBaseDocs: kbDocObjs } : {}),
      });
    }

    // Update in our database
    const [updated] = await db
      .update(agents)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.industry ? { industry: body.industry } : {}),
        ...(body.instructions ? { instructions: body.instructions } : {}),
        ...(body.greeting ? { greeting: body.greeting } : {}),
        ...(body.ttsModel ? { model: body.ttsModel } : {}),
        ...(body.llmModel ? { llmModel: body.llmModel } : {}),
        ...(body.voiceId ? { voiceId: body.voiceId } : {}),
        ...(body.language ? { language: body.language } : {}),
        ...(body.supportedLanguages ? { supportedLanguages: body.supportedLanguages } : {}),
        ...(body.forwardPhoneNumber !== undefined ? { forwardPhoneNumber: body.forwardPhoneNumber } : {}),
        ...(body.dynamicVariables ? { dynamicVariables: body.dynamicVariables } : {}),
        ...(body.voiceStability !== undefined ? { voiceStability: body.voiceStability } : {}),
        ...(body.voiceSimilarity !== undefined ? { voiceSimilarity: body.voiceSimilarity } : {}),
        ...(body.voiceSpeed !== undefined ? { voiceSpeed: body.voiceSpeed } : {}),
        ...(body.widgetEnabled !== undefined ? { widgetEnabled: body.widgetEnabled } : {}),
        ...(body.widgetColor ? { widgetColor: body.widgetColor } : {}),
        ...(body.widgetPosition ? { widgetPosition: body.widgetPosition } : {}),
        ...(body.widgetButtonText ? { widgetButtonText: body.widgetButtonText } : {}),
        ...(body.widgetIconType ? { widgetIconType: body.widgetIconType } : {}),
        ...(body.widgetAllowedOrigins !== undefined ? { widgetAllowedOrigins: body.widgetAllowedOrigins } : {}),
        ...(body.businessHours ? { businessHours: body.businessHours } : {}),
        ...(body.businessHoursText !== undefined ? { businessHoursText: body.businessHoursText || null } : {}),
        tools: updateClientTools,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId))
      .returning();

    return c.json<ApiResponse>({ success: true, data: updated });
  } catch (error) {
    log.error({ error, agentId }, 'Failed to update agent');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ELEVENLABS_ERROR', message: 'Failed to update AI agent' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /agents/:id — Delete agent (+ ElevenLabs cleanup)
// ═══════════════════════════════════════════════════════════════════

agentRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
  });

  if (!agent) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  try {
    // Delete from ElevenLabs (skip in dev bypass)
    if (!isDevBypass() && agent.elevenlabsAgentId && !agent.elevenlabsAgentId.startsWith('dev_')) {
      await elevenlabsService.deleteAgent(agent.elevenlabsAgentId);
    }

    // Delete from our database (cascades to calls via FK)
    await db.delete(agents).where(eq(agents.id, agentId));

    log.info({ agentId }, 'Agent deleted');
    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    log.error({ error, agentId }, 'Failed to delete agent');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ELEVENLABS_ERROR', message: 'Failed to delete AI agent' } },
      500,
    );
  }
});
