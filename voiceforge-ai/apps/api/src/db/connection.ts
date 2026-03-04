// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Database Connection (Drizzle + PostgreSQL)
// Production: SSL, connection pooling, health monitoring
// ═══════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import * as schema from './schema/index.js';

const log = createLogger('database');

const isProduction = env.NODE_ENV === 'production';

/** Raw postgres.js connection — used by Drizzle */
const connection = postgres(env.DATABASE_URL, {
  max: isProduction ? 25 : 20,        // Higher pool for production load
  idle_timeout: isProduction ? 30 : 20, // Longer idle timeout in production
  connect_timeout: 10,
  prepare: false,                       // Required for Supabase connection pooling (PgBouncer)
  onnotice: () => {},                   // Suppress notices
  // Production SSL — required for managed databases (DigitalOcean, Supabase, etc.)
  ssl: isProduction ? { rejectUnauthorized: true } : false,
  // Connection lifecycle logging
  onclose: () => {
    if (isProduction) log.warn('Database connection closed unexpectedly');
  },
});

/** Drizzle ORM instance with full schema awareness */
export const db = drizzle(connection, {
  schema,
  logger: env.NODE_ENV === 'development',
});

/** Graceful shutdown */
export async function disconnectDb() {
  log.info('Closing database connection...');
  await connection.end({ timeout: 5 });
  log.info('Database connection closed');
}

/** Health check — verify DB connectivity */
export async function checkDbHealth(): Promise<{ connected: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await connection`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - start };
  } catch {
    return { connected: false, latencyMs: Date.now() - start };
  }
}

export type Database = typeof db;
