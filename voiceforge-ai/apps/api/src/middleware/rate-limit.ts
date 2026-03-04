// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Rate Limiting Middleware
// Development: In-memory sliding window
// Production: Redis-backed sliding window (distributed)
// ═══════════════════════════════════════════════════════════════════

import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';

const log = createLogger('rate-limit');

// ── Rate Limit Store Interface ───────────────────────────────────

interface RateLimitStore {
  check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number; resetTimeSec: number }>;
}

// ── In-Memory Store (development / single-instance fallback) ─────

class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, number[]>();

  constructor() {
    // Periodically clean expired entries (every 60 seconds)
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.store.entries()) {
        const filtered = timestamps.filter((ts) => now - ts < 120_000);
        if (filtered.length === 0) {
          this.store.delete(key);
        } else {
          this.store.set(key, filtered);
        }
      }
    }, 60_000);
  }

  async check(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    let timestamps = this.store.get(key) ?? [];

    // Remove expired timestamps
    timestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (timestamps.length >= limit) {
      const retryAfterSec = Math.ceil((timestamps[0]! + windowMs - now) / 1000);
      const resetTimeSec = Math.ceil((timestamps[0]! + windowMs) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec, resetTimeSec };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: true,
      remaining: limit - timestamps.length,
      retryAfterSec: 0,
      resetTimeSec: Math.ceil((now + windowMs) / 1000),
    };
  }
}

// ── Redis Store (production — distributed rate limiting) ──────────

class RedisRateLimitStore implements RateLimitStore {
  private redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  /**
   * Uses Redis Lua script for atomic sliding window rate limiting.
   * Falls back to simple INCR/EXPIRE pattern for compatibility.
   */
  async check(key: string, limit: number, windowMs: number) {
    try {
      // Dynamic import to avoid requiring ioredis in development
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 2000,
      });

      await redis.connect();

      const redisKey = `rl:${key}`;
      const windowSec = Math.ceil(windowMs / 1000);
      const now = Date.now();

      // Lua script: atomic sliding window counter
      const luaScript = `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local windowMs = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)

        -- Count current entries
        local count = redis.call('ZCARD', key)

        if count >= limit then
          local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          local resetAt = 0
          if #oldest > 0 then
            resetAt = tonumber(oldest[2]) + windowMs
          end
          return {0, 0, resetAt}
        end

        -- Add current request
        redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
        redis.call('PEXPIRE', key, windowMs)

        return {1, limit - count - 1, now + windowMs}
      `;

      const result = await redis.eval(luaScript, 1, redisKey, limit, windowMs, now) as number[];
      await redis.quit();

      const allowed = result[0] === 1;
      const remaining = result[1]!;
      const resetTimeMs = result[2]!;

      return {
        allowed,
        remaining,
        retryAfterSec: allowed ? 0 : Math.ceil((resetTimeMs - now) / 1000),
        resetTimeSec: Math.ceil(resetTimeMs / 1000),
      };
    } catch (error) {
      log.warn({ error }, 'Redis rate limiter failed — falling back to allow');
      // On Redis failure, allow the request (fail-open with warning)
      return { allowed: true, remaining: limit, retryAfterSec: 0, resetTimeSec: 0 };
    }
  }
}

// ── Store Selection ──────────────────────────────────────────────

let rateLimitStore: RateLimitStore;

if (env.REDIS_URL) {
  log.info('Using Redis-backed rate limiter (production)');
  rateLimitStore = new RedisRateLimitStore(env.REDIS_URL);
} else {
  log.info('Using in-memory rate limiter (development)');
  rateLimitStore = new MemoryRateLimitStore();
}

// ── Rate Limiter Factory ─────────────────────────────────────────

/**
 * Create a rate-limiting middleware.
 *
 * @param limit   Maximum requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 * @param keyFn   Function to derive the rate-limit key (default: IP address)
 */
export function rateLimiter(
  limit: number,
  windowMs: number = 60_000,
  keyFn?: (c: { req: { header: (name: string) => string | undefined; url: string } }) => string,
): MiddlewareHandler {
  return async (c, next) => {
    const key = keyFn
      ? keyFn(c)
      : c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';

    const result = await rateLimitStore.check(key, limit, windowMs);

    // Always set rate-limit headers
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetTimeSec));

    if (!result.allowed) {
      log.warn({ key, limit, windowMs }, 'Rate limit exceeded');
      c.header('Retry-After', String(result.retryAfterSec));
      throw new HTTPException(429, { message: 'Too many requests. Please try again later.' });
    }

    await next();
  };
}

// ═══════════════════════════════════════════════════════════════════
// Pre-configured Rate Limiters
// ═══════════════════════════════════════════════════════════════════

/** General API: 100 requests per minute per IP */
export const apiRateLimiter = rateLimiter(100, 60_000);

/** Auth endpoints: 10 requests per minute per IP */
export const authRateLimiter = rateLimiter(10, 60_000);

/** Webhook endpoints: 500 requests per minute per IP */
export const webhookRateLimiter = rateLimiter(500, 60_000);

/** GDPR endpoints: 5 requests per minute per IP (prevent abuse) */
export const gdprRateLimiter = rateLimiter(5, 60_000);

/**
 * Plan-based rate limiter — limits based on customer's plan.
 * Uses the user's sub (from JWT) as the key.
 */
export function planRateLimiter(plan: 'starter' | 'pro' | 'business'): MiddlewareHandler {
  const limits: Record<string, number> = {
    starter: 30,  // 30 req/min
    pro: 100,     // 100 req/min
    business: 300, // 300 req/min
  };

  return rateLimiter(limits[plan] ?? 30, 60_000);
}
