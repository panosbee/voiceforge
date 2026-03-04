// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Knowledge Base Routes
// Upload files/URLs/text → ElevenLabs KB API (native RAG)
// ElevenLabs handles parsing, chunking, embedding & retrieval
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { knowledgeBaseDocuments, agents, customers } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('knowledge-base');

// Allowed file types for KB upload
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/epub+zip',
];

// Max file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const knowledgeBaseRoutes = new Hono<{ Variables: { user: AuthUser } }>();

// All KB routes require authentication
knowledgeBaseRoutes.use('*', authMiddleware);

// ── Helpers ──────────────────────────────────────────────────────

async function getCustomerByUserId(userId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });
}

/** Check if we're in dev bypass mode */
function isDevBypass(): boolean {
  return !elevenlabsService.isConfigured();
}

// ═══════════════════════════════════════════════════════════════════
// POST /knowledge-base/upload-file — Upload a file to KB
// Multipart form-data: file + name (optional) + agentId (optional)
// ═══════════════════════════════════════════════════════════════════

knowledgeBaseRoutes.post('/upload-file', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // Parse multipart form data
  const body = await c.req.parseBody();
  const file = body['file'];
  const name = (body['name'] as string) || '';
  const agentId = (body['agentId'] as string) || null;

  // Validate file
  if (!file || !(file instanceof File)) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Δεν βρέθηκε αρχείο. Χρησιμοποιήστε multipart/form-data με πεδίο "file".' },
    }, 400);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
    }, 400);
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Μη αποδεκτός τύπος αρχείου: ${file.type}. Αποδεκτοί τύποι: PDF, DOCX, TXT, MD, CSV, HTML, EPUB`,
      },
    }, 400);
  }

  // If agent specified, verify ownership
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
    });
    if (!agent) {
      return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
    }
  }

  const displayName = name || file.name || 'Untitled Document';

  try {
    let elevenlabsDocId: string;

    if (isDevBypass()) {
      // Dev mode: generate fake ID
      elevenlabsDocId = `dev_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      log.info({ docId: elevenlabsDocId, name: displayName, devBypass: true }, 'Dev bypass KB upload');
    } else {
      // Real ElevenLabs upload
      const result = await elevenlabsService.uploadKBDocument(file, displayName);
      elevenlabsDocId = result.id;
    }

    // Save to database
    const rows = await db.insert(knowledgeBaseDocuments).values({
      customerId: customer.id,
      agentId: agentId,
      elevenlabsDocId,
      name: displayName,
      source: 'file',
      mimeType: file.type || null,
      fileSize: file.size,
      status: 'ready',
    }).returning();
    const doc = rows[0]!;

    // If agent specified, attach KB to the ElevenLabs agent
    if (agentId && !isDevBypass()) {
      const agentDocs = await db.query.knowledgeBaseDocuments.findMany({
        where: and(
          eq(knowledgeBaseDocuments.agentId, agentId),
          eq(knowledgeBaseDocuments.status, 'ready'),
        ),
      });
      const docIds = agentDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name }));
      const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
      if (agent?.elevenlabsAgentId) {
        await elevenlabsService.attachKBToAgent(agent.elevenlabsAgentId, docIds);
      }
    }

    log.info({ docId: doc.id, elevenlabsDocId, name: displayName }, 'KB file uploaded successfully');

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: doc.id,
        elevenlabsDocId: doc.elevenlabsDocId,
        name: doc.name,
        source: doc.source,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        status: doc.status,
        agentId: doc.agentId,
        createdAt: doc.createdAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    log.error({ error, name: displayName }, 'Failed to upload KB file');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'ELEVENLABS_ERROR', message: 'Αποτυχία upload αρχείου στο ElevenLabs KB' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /knowledge-base/upload-url — Upload from URL
// ═══════════════════════════════════════════════════════════════════

const uploadUrlSchema = z.object({
  url: z.string().url('Μη έγκυρο URL'),
  name: z.string().min(1, 'Απαιτείται όνομα').max(200),
  agentId: z.string().uuid().nullable().optional(),
});

knowledgeBaseRoutes.post('/upload-url', zValidator('json', uploadUrlSchema), async (c) => {
  const user = c.get('user');
  const { url, name, agentId } = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // If agent specified, verify ownership
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
    });
    if (!agent) {
      return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
    }
  }

  try {
    let elevenlabsDocId: string;

    if (isDevBypass()) {
      elevenlabsDocId = `dev_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      log.info({ docId: elevenlabsDocId, url, devBypass: true }, 'Dev bypass KB URL upload');
    } else {
      const result = await elevenlabsService.uploadKBUrl(url, name);
      elevenlabsDocId = result.id;
    }

    const urlRows = await db.insert(knowledgeBaseDocuments).values({
      customerId: customer.id,
      agentId: agentId ?? null,
      elevenlabsDocId,
      name,
      source: 'url',
      sourceUrl: url,
      status: 'ready',
    }).returning();
    const doc = urlRows[0]!;

    // If agent specified, re-attach all KB docs
    if (agentId && !isDevBypass()) {
      const agentDocs = await db.query.knowledgeBaseDocuments.findMany({
        where: and(
          eq(knowledgeBaseDocuments.agentId, agentId),
          eq(knowledgeBaseDocuments.status, 'ready'),
        ),
      });
      const docIds = agentDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name }));
      const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
      if (agent?.elevenlabsAgentId) {
        await elevenlabsService.attachKBToAgent(agent.elevenlabsAgentId, docIds);
      }
    }

    log.info({ docId: doc.id, url }, 'KB URL uploaded successfully');

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: doc.id,
        elevenlabsDocId: doc.elevenlabsDocId,
        name: doc.name,
        source: doc.source,
        sourceUrl: doc.sourceUrl,
        status: doc.status,
        agentId: doc.agentId,
        createdAt: doc.createdAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    log.error({ error, url }, 'Failed to upload KB from URL');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'ELEVENLABS_ERROR', message: 'Αποτυχία upload URL στο ElevenLabs KB' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /knowledge-base/upload-text — Upload raw text
// ═══════════════════════════════════════════════════════════════════

const uploadTextSchema = z.object({
  text: z.string().min(10, 'Το κείμενο πρέπει να είναι τουλάχιστον 10 χαρακτήρες').max(500_000),
  name: z.string().min(1, 'Απαιτείται όνομα').max(200),
  agentId: z.string().uuid().nullable().optional(),
});

knowledgeBaseRoutes.post('/upload-text', zValidator('json', uploadTextSchema), async (c) => {
  const user = c.get('user');
  const { text, name, agentId } = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  // If agent specified, verify ownership
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
    });
    if (!agent) {
      return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
    }
  }

  try {
    let elevenlabsDocId: string;

    if (isDevBypass()) {
      elevenlabsDocId = `dev_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      log.info({ docId: elevenlabsDocId, name, devBypass: true }, 'Dev bypass KB text upload');
    } else {
      const result = await elevenlabsService.uploadKBText(text, name);
      elevenlabsDocId = result.id;
    }

    const textRows = await db.insert(knowledgeBaseDocuments).values({
      customerId: customer.id,
      agentId: agentId ?? null,
      elevenlabsDocId,
      name,
      source: 'text',
      fileSize: new TextEncoder().encode(text).length,
      status: 'ready',
    }).returning();
    const doc = textRows[0]!;

    // If agent specified, re-attach all KB docs
    if (agentId && !isDevBypass()) {
      const agentDocs = await db.query.knowledgeBaseDocuments.findMany({
        where: and(
          eq(knowledgeBaseDocuments.agentId, agentId),
          eq(knowledgeBaseDocuments.status, 'ready'),
        ),
      });
      const docIds = agentDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name }));
      const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
      if (agent?.elevenlabsAgentId) {
        await elevenlabsService.attachKBToAgent(agent.elevenlabsAgentId, docIds);
      }
    }

    log.info({ docId: doc.id, name }, 'KB text uploaded successfully');

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: doc.id,
        elevenlabsDocId: doc.elevenlabsDocId,
        name: doc.name,
        source: doc.source,
        fileSize: doc.fileSize,
        status: doc.status,
        agentId: doc.agentId,
        createdAt: doc.createdAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    log.error({ error, name }, 'Failed to upload KB text');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'ELEVENLABS_ERROR', message: 'Αποτυχία upload κειμένου στο ElevenLabs KB' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /knowledge-base — List KB documents
// Query: ?agentId=xxx (optional filter)
// ═══════════════════════════════════════════════════════════════════

knowledgeBaseRoutes.get('/', async (c) => {
  const user = c.get('user');
  const agentId = c.req.query('agentId') ?? null;

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const conditions = [eq(knowledgeBaseDocuments.customerId, customer.id)];
  if (agentId) {
    conditions.push(eq(knowledgeBaseDocuments.agentId, agentId));
  }

  const docs = await db.query.knowledgeBaseDocuments.findMany({
    where: and(...conditions),
    orderBy: (kbDocs, { desc }) => [desc(kbDocs.createdAt)],
  });

  return c.json<ApiResponse>({
    success: true,
    data: docs.map((doc) => ({
      id: doc.id,
      elevenlabsDocId: doc.elevenlabsDocId,
      name: doc.name,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      status: doc.status,
      agentId: doc.agentId,
      createdAt: doc.createdAt.toISOString(),
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /knowledge-base/:id — Delete a KB document
// ═══════════════════════════════════════════════════════════════════

knowledgeBaseRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const docId = c.req.param('id');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const doc = await db.query.knowledgeBaseDocuments.findFirst({
    where: and(
      eq(knowledgeBaseDocuments.id, docId),
      eq(knowledgeBaseDocuments.customerId, customer.id),
    ),
  });

  if (!doc) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  try {
    // Delete from ElevenLabs
    if (!isDevBypass()) {
      try {
        await elevenlabsService.deleteKBDocument(doc.elevenlabsDocId);
      } catch (error) {
        log.warn({ error, elevenlabsDocId: doc.elevenlabsDocId }, 'Failed to delete from ElevenLabs (may already be deleted)');
      }
    }

    // Delete from database
    await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, docId));

    // If was attached to agent, re-sync agent KB
    if (doc.agentId && !isDevBypass()) {
      const remainingDocs = await db.query.knowledgeBaseDocuments.findMany({
        where: and(
          eq(knowledgeBaseDocuments.agentId, doc.agentId),
          eq(knowledgeBaseDocuments.status, 'ready'),
        ),
      });
      const agent = await db.query.agents.findFirst({ where: eq(agents.id, doc.agentId) });
      if (agent?.elevenlabsAgentId) {
        await elevenlabsService.attachKBToAgent(
          agent.elevenlabsAgentId,
          remainingDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name })),
        );
      }
    }

    log.info({ docId, name: doc.name }, 'KB document deleted');

    return c.json<ApiResponse>({ success: true, data: { id: docId } });
  } catch (error) {
    log.error({ error, docId }, 'Failed to delete KB document');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Αποτυχία διαγραφής εγγράφου' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /knowledge-base/:id/attach — Attach/detach doc to/from agent
// ═══════════════════════════════════════════════════════════════════

const attachSchema = z.object({
  agentId: z.string().uuid().nullable(),
});

knowledgeBaseRoutes.post('/:id/attach', zValidator('json', attachSchema), async (c) => {
  const user = c.get('user');
  const docId = c.req.param('id');
  const { agentId } = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const doc = await db.query.knowledgeBaseDocuments.findFirst({
    where: and(
      eq(knowledgeBaseDocuments.id, docId),
      eq(knowledgeBaseDocuments.customerId, customer.id),
    ),
  });

  if (!doc) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  // Verify agent ownership
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.customerId, customer.id)),
    });
    if (!agent) {
      return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
    }
  }

  const oldAgentId = doc.agentId;

  // Update document's agent reference
  await db.update(knowledgeBaseDocuments)
    .set({ agentId, updatedAt: new Date() })
    .where(eq(knowledgeBaseDocuments.id, docId));

  // Re-sync KB for old agent (remove doc)
  if (oldAgentId && oldAgentId !== agentId && !isDevBypass()) {
    const oldAgentDocs = await db.query.knowledgeBaseDocuments.findMany({
      where: and(
        eq(knowledgeBaseDocuments.agentId, oldAgentId),
        eq(knowledgeBaseDocuments.status, 'ready'),
      ),
    });
    const oldAgent = await db.query.agents.findFirst({ where: eq(agents.id, oldAgentId) });
    if (oldAgent?.elevenlabsAgentId) {
      await elevenlabsService.attachKBToAgent(
        oldAgent.elevenlabsAgentId,
        oldAgentDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name })),
      );
    }
  }

  // Re-sync KB for new agent (add doc)
  if (agentId && !isDevBypass()) {
    const newAgentDocs = await db.query.knowledgeBaseDocuments.findMany({
      where: and(
        eq(knowledgeBaseDocuments.agentId, agentId),
        eq(knowledgeBaseDocuments.status, 'ready'),
      ),
    });
    const newAgent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
    if (newAgent?.elevenlabsAgentId) {
      await elevenlabsService.attachKBToAgent(
        newAgent.elevenlabsAgentId,
        newAgentDocs.map((d) => ({ id: d.elevenlabsDocId, name: d.name })),
      );
    }
  }

  log.info({ docId, oldAgentId, newAgentId: agentId }, 'KB doc agent attachment updated');

  return c.json<ApiResponse>({ success: true, data: { id: docId, agentId } });
});
