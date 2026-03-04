// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Health Check Route
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';

export const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  const start = Date.now();

  try {
    // Quick DB connectivity check
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - start;

    return c.json({
      status: 'healthy',
      service: 'voiceforge-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: { status: 'connected', latencyMs: dbLatency },
    });
  } catch {
    return c.json(
      {
        status: 'unhealthy',
        service: 'voiceforge-api',
        timestamp: new Date().toISOString(),
        db: { status: 'disconnected' },
      },
      503,
    );
  }
});
