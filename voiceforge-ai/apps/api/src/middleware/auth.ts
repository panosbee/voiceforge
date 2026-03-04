// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Auth Middleware
// Verifies Supabase JWT locally (production) or Dev JWT (development)
// Production: Cryptographic HS256 verification — no HTTP round-trips
// ═══════════════════════════════════════════════════════════════════

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { isDevAuthMode, verifyDevToken } from '../services/dev-auth.js';

const log = createLogger('auth');

/** Decoded JWT payload from Supabase */
export interface AuthUser {
  sub: string; // User ID
  email: string;
  role: string;
  aud: string;
  exp: number;
}

// ── JWT Crypto Helpers ───────────────────────────────────────────

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function base64urlEncodeBuffer(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verify a Supabase JWT locally using HS256 (HMAC-SHA256).
 * No HTTP round-trip needed — uses SUPABASE_JWT_SECRET.
 */
function verifySupabaseJwt(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify header is HS256
    const header = JSON.parse(base64urlDecode(headerB64!)) as { alg: string; typ: string };
    if (header.alg !== 'HS256') {
      log.warn({ alg: header.alg }, 'Unsupported JWT algorithm');
      return null;
    }

    // Verify signature
    const secret = env.SUPABASE_JWT_SECRET!;
    const expectedSig = base64urlEncodeBuffer(
      createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest(),
    );

    if (signatureB64 !== expectedSig) {
      return null;
    }

    // Parse payload
    const payload = JSON.parse(base64urlDecode(payloadB64!)) as {
      sub: string;
      email: string;
      role: string;
      aud: string;
      exp: number;
    };

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      aud: payload.aud,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Middleware: Validates auth token.
 * - In dev mode: verifies locally-signed HS256 JWT
 * - In production: verifies Supabase JWT locally with SUPABASE_JWT_SECRET (no HTTP)
 *   Falls back to Supabase /auth/v1/user if JWT_SECRET not configured.
 * Sets `c.set('user', authUser)` on success.
 * Throws 401 on missing/invalid token.
 */
export const authMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    log.warn('Missing or invalid Authorization header');
    throw new HTTPException(401, { message: 'Missing authentication token' });
  }

  const token = authHeader.slice(7);

  try {
    // ── Dev auth mode: verify locally ──────────────────────────
    if (isDevAuthMode()) {
      const payload = verifyDevToken(token);

      if (!payload) {
        throw new HTTPException(401, { message: 'Invalid or expired dev token' });
      }

      const user: AuthUser = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        aud: payload.aud,
        exp: payload.exp,
      };

      c.set('user', user);
      await next();
      return;
    }

    // ── Production: local JWT verification (fast, no HTTP) ─────
    if (env.SUPABASE_JWT_SECRET) {
      const user = verifySupabaseJwt(token);

      if (!user) {
        throw new HTTPException(401, { message: 'Invalid or expired token' });
      }

      c.set('user', user);
      await next();
      return;
    }

    // ── Fallback: verify via Supabase HTTP (slow, avoid in prod) ──
    log.warn('Using Supabase HTTP verification — set SUPABASE_JWT_SECRET for production');
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'Supabase token verification failed');
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }

    const userData = (await response.json()) as {
      id: string;
      email: string;
      role: string;
      aud: string;
    };

    const user: AuthUser = {
      sub: userData.id,
      email: userData.email,
      role: userData.role,
      aud: userData.aud,
      exp: 0,
    };

    c.set('user', user);
    await next();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    log.error({ error }, 'Auth middleware error');
    throw new HTTPException(401, { message: 'Authentication failed' });
  }
});
