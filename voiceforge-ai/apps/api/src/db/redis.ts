import Redis from 'ioredis';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('redis');

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (client) return client;

  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 50, 2000);
    },
  });

  client.on('connect', () => log.info('Connected to Redis'));
  client.on('ready', () => log.info('Redis is ready to receive commands'));
  client.on('error', (err) => log.error({ err }, 'Redis connection error'));
  client.on('close', () => log.warn('Redis connection closed'));
  client.on('reconnecting', (delay: number) => log.info({ delay }, 'Redis reconnecting'));
  client.on('end', () => log.warn('Redis connection ended, no more reconnections'));

  client.connect().catch((err) => {
    log.error({ err }, 'Failed to connect to Redis');
  });

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;

  log.info('Closing Redis connection...');
  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      client?.disconnect();
      resolve();
    }, 5000),
  );

  try {
    await Promise.race([client.quit(), timeout]);
  } catch {
    client.disconnect();
  }

  client = null;
  log.info('Redis connection closed');
}

export async function checkRedisHealth(): Promise<{ connected: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    if (!client) return { connected: false, latencyMs: 0 };
    await client.ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch {
    return { connected: false, latencyMs: Date.now() - start };
  }
}

export function _resetForTesting(): void {
  client = null;
}
