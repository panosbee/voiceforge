// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Development Auth Service
// JWT-based auth for local development WITHOUT Supabase.
// ⚠️  THIS IS DEV-ONLY — never use in production.
// ═══════════════════════════════════════════════════════════════════

import { createHmac, randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('dev-auth');

// We use ENCRYPTION_KEY as our JWT signing secret in dev mode
const DEV_JWT_SECRET = env.ENCRYPTION_KEY;

// ═══════════════════════════════════════════════════════════════════
// Simple JWT implementation (HS256)
// ═══════════════════════════════════════════════════════════════════

function base64url(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input)
    ? input.toString('base64')
    : Buffer.from(input).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

export interface DevTokenPayload {
  sub: string;       // User ID (UUID)
  email: string;
  role: string;
  aud: string;
  iat: number;
  exp: number;
}

/**
 * Create a signed HS256 JWT for development.
 */
export function createDevToken(payload: Omit<DevTokenPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: DevTokenPayload = {
    ...payload,
    iat: now,
    exp: now + 86400 * 30, // 30 days
  };

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(fullPayload));
  const signature = base64url(
    createHmac('sha256', DEV_JWT_SECRET).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
}

/**
 * Verify a dev JWT token. Returns payload or null.
 */
export function verifyDevToken(token: string): DevTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = base64url(
      createHmac('sha256', DEV_JWT_SECRET).update(`${header}.${body}`).digest(),
    );

    if (signature !== expectedSig) {
      return null;
    }

    const payload = JSON.parse(base64urlDecode(body!)) as DevTokenPayload;

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a new dev user ID (deterministic per email for consistency).
 */
export function generateDevUserId(email: string): string {
  // Use a deterministic UUID-like ID based on email so same email = same user
  const hash = createHmac('sha256', DEV_JWT_SECRET).update(email).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),  // version 4
    ((parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

/** Check if we're in dev auth mode */
export function isDevAuthMode(): boolean {
  return env.NODE_ENV === 'development' && (
    !env.SUPABASE_URL ||
    env.SUPABASE_URL === 'http://localhost:54321' ||
    env.SUPABASE_ANON_KEY === 'dev-placeholder'
  );
}
