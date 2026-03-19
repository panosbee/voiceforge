// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Tasks Routes
// CRUD for agent task emails + task list/filter + public confirm
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tasks, agentTaskEmails, agents, customers } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import type { AuthUser } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createHmac } from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';

const log = createLogger('tasks');

async function getCustomerByUserId(userId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });
}

export const taskRoutes = new Hono();

// Auth required for all authenticated task routes
taskRoutes.use('*', authMiddleware);

// ── Token Helpers ────────────────────────────────────────────────

/** Generate an HMAC confirm token for a task */
export function generateConfirmToken(taskId: string): string {
  return createHmac('sha256', env.ENCRYPTION_KEY)
    .update(taskId)
    .digest('hex')
    .slice(0, 32);
}

/** Verify a confirm token matches the task ID */
function verifyConfirmToken(taskId: string, token: string): boolean {
  const expected = generateConfirmToken(taskId);
  return expected === token;
}

// ═══════════════════════════════════════════════════════════════════
// Agent Task Emails — CRUD
// ═══════════════════════════════════════════════════════════════════

const taskEmailSchema = z.object({
  email: z.string().email(),
  roleLabel: z.string().min(1).max(200),
  roleDescription: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /tasks/emails/:agentId — List task emails for an agent
taskRoutes.get('/emails/:agentId', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { agentId } = c.req.param();

  // Verify agent belongs to customer
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customerId)),
  });
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const emails = await db.query.agentTaskEmails.findMany({
    where: eq(agentTaskEmails.agentId, agentId),
    orderBy: [agentTaskEmails.sortOrder],
  });

  return c.json({ data: emails });
});

// POST /tasks/emails/:agentId — Add a task email
taskRoutes.post('/emails/:agentId', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { agentId } = c.req.param();

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customerId)),
  });
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const body = await c.req.json();
  const parsed = taskEmailSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [created] = await db.insert(agentTaskEmails).values({
    agentId,
    email: parsed.data.email,
    roleLabel: parsed.data.roleLabel,
    roleDescription: parsed.data.roleDescription ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
  }).returning();

  log.info({ agentId, email: parsed.data.email, role: parsed.data.roleLabel }, 'Task email added');
  return c.json({ data: created }, 201);
});

// PATCH /tasks/emails/:id — Update a task email
taskRoutes.patch('/emails/:id', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { id } = c.req.param();

  // Verify ownership via join
  const existing = await db.query.agentTaskEmails.findFirst({
    where: eq(agentTaskEmails.id, id),
    with: { agent: true },
  });
  if (!existing || existing.agent.customerId !== customerId) {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = await c.req.json();
  const parsed = taskEmailSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [updated] = await db.update(agentTaskEmails)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(agentTaskEmails.id, id))
    .returning();

  return c.json({ data: updated });
});

// DELETE /tasks/emails/:id — Remove a task email
taskRoutes.delete('/emails/:id', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { id } = c.req.param();

  const existing = await db.query.agentTaskEmails.findFirst({
    where: eq(agentTaskEmails.id, id),
    with: { agent: true },
  });
  if (!existing || existing.agent.customerId !== customerId) {
    return c.json({ error: 'Not found' }, 404);
  }

  await db.delete(agentTaskEmails).where(eq(agentTaskEmails.id, id));

  log.info({ id, email: existing.email }, 'Task email removed');
  return c.json({ success: true });
});

// PUT /tasks/emails/:agentId/bulk — Replace all task emails for an agent
taskRoutes.put('/emails/:agentId/bulk', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { agentId } = c.req.param();

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.customerId, customerId)),
  });
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const body = await c.req.json();
  const schema = z.array(taskEmailSchema).max(20);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  // Transaction: delete old + insert new
  await db.delete(agentTaskEmails).where(eq(agentTaskEmails.agentId, agentId));

  if (parsed.data.length > 0) {
    await db.insert(agentTaskEmails).values(
      parsed.data.map((item, index) => ({
        agentId,
        email: item.email,
        roleLabel: item.roleLabel,
        roleDescription: item.roleDescription ?? null,
        sortOrder: item.sortOrder ?? index,
      })),
    );
  }

  const result = await db.query.agentTaskEmails.findMany({
    where: eq(agentTaskEmails.agentId, agentId),
    orderBy: [agentTaskEmails.sortOrder],
  });

  log.info({ agentId, count: parsed.data.length }, 'Task emails bulk updated');
  return c.json({ data: result });
});

// ═══════════════════════════════════════════════════════════════════
// Tasks — List & Filter (Dashboard Mini CRM)
// ═══════════════════════════════════════════════════════════════════

// GET /tasks — List tasks for customer with filters
taskRoutes.get('/', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const status = c.req.query('status');         // pending | confirmed | expired
  const agentId = c.req.query('agentId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const conditions = [eq(tasks.customerId, customerId)];
  if (status) conditions.push(eq(tasks.status, status as 'pending' | 'confirmed' | 'expired'));
  if (agentId) conditions.push(eq(tasks.agentId, agentId));

  const [taskList, countResult] = await Promise.all([
    db.query.tasks.findMany({
      where: and(...conditions),
      orderBy: [desc(tasks.createdAt)],
      limit,
      offset,
      with: { agent: { columns: { name: true } } },
    }),
    db.select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(...conditions)),
  ]);

  return c.json({
    data: taskList,
    pagination: {
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    },
  });
});

// GET /tasks/stats — Summary stats for dashboard
taskRoutes.get('/stats', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;

  const result = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending')::int`,
    confirmed: sql<number>`count(*) filter (where ${tasks.status} = 'confirmed')::int`,
    expired: sql<number>`count(*) filter (where ${tasks.status} = 'expired')::int`,
    avgConfirmHours: sql<number>`coalesce(
      extract(epoch from avg(${tasks.confirmedAt} - ${tasks.createdAt})) / 3600,
      0
    )::float`,
  })
    .from(tasks)
    .where(eq(tasks.customerId, customerId));

  return c.json({ data: result[0] });
});

// GET /tasks/:id — Single task detail
taskRoutes.get('/:id', async (c) => {
  const user = c.get('user' as never) as AuthUser;
  const customer = await getCustomerByUserId(user.sub);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerId = customer.id;
  const { id } = c.req.param();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, id), eq(tasks.customerId, customerId)),
    with: {
      agent: { columns: { name: true } },
      call: { columns: { id: true, startedAt: true, durationSeconds: true } },
    },
  });

  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: task });
});

// ═══════════════════════════════════════════════════════════════════
// Public: Task Confirmation (no auth required)
// URL: /api/tasks/confirm/:id?token=xxx
// ═══════════════════════════════════════════════════════════════════

export const taskPublicRoutes = new Hono();

taskPublicRoutes.get('/confirm/:id', async (c) => {
  const { id } = c.req.param();
  const token = c.req.query('token');

  if (!token) return c.html(renderConfirmPage('error', 'Missing confirmation token.'));

  // Verify token
  if (!verifyConfirmToken(id, token)) {
    return c.html(renderConfirmPage('error', 'Invalid or expired confirmation link.'));
  }

  // Find the task
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) return c.html(renderConfirmPage('error', 'Task not found.'));

  if (task.status === 'confirmed') {
    return c.html(renderConfirmPage('already', 'This task has already been confirmed.'));
  }

  // Mark as confirmed
  await db.update(tasks)
    .set({
      status: 'confirmed',
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));

  log.info({ taskId: id, assignedEmail: task.assignedEmail }, 'Task confirmed via email link');

  return c.html(renderConfirmPage('success', task.title));
});

// ── Confirm Page HTML ────────────────────────────────────────────

function renderConfirmPage(type: 'success' | 'already' | 'error', message: string): string {
  const emoji = type === 'success' ? '✅' : type === 'already' ? '📋' : '❌';
  const title = type === 'success' ? 'Task Completed!'
    : type === 'already' ? 'Already Confirmed'
    : 'Error';
  const color = type === 'success' ? '#10b981' : type === 'already' ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoiceForge AI — Task Confirmation</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 48px; max-width: 420px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .emoji { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${color}; font-size: 24px; margin: 0 0 12px 0; }
    p { color: #64748b; font-size: 16px; line-height: 1.6; margin: 0; }
    .task-name { color: #1e293b; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p>${type === 'success'
      ? `Το task <span class="task-name">"${escapeHtml(message)}"</span> σημειώθηκε ως ολοκληρωμένο. Ευχαριστούμε!`
      : escapeHtml(message)
    }</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
