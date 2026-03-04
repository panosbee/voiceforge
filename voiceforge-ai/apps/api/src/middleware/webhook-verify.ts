// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telnyx Webhook Signature Verification Middleware
// Verifies Ed25519 signatures on all incoming Telnyx webhooks
// ═══════════════════════════════════════════════════════════════════

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'node:crypto';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('webhook-verify');

/** Max age of webhook (5 minutes) to prevent replay attacks */
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Middleware: Verifies Telnyx webhook signatures using Ed25519.
 *
 * Headers expected:
 *   telnyx-signature-ed25519: Base64-encoded signature
 *   telnyx-timestamp: Unix timestamp (seconds)
 *
 * Signature is verified against: "${timestamp}|${rawBody}"
 */
export const telnyxWebhookMiddleware = createMiddleware(async (c, next) => {
  const signature = c.req.header('telnyx-signature-ed25519');
  const timestamp = c.req.header('telnyx-timestamp');

  if (!signature || !timestamp) {
    log.warn('Missing Telnyx webhook signature headers');
    throw new HTTPException(401, { message: 'Missing webhook signature' });
  }

  // Check timestamp freshness (prevent replay attacks)
  const webhookTime = parseInt(timestamp, 10) * 1000;
  const now = Date.now();
  if (Math.abs(now - webhookTime) > MAX_WEBHOOK_AGE_MS) {
    log.warn({ webhookTime, now, diff: now - webhookTime }, 'Webhook timestamp too old (replay attack?)');
    throw new HTTPException(401, { message: 'Webhook timestamp expired' });
  }

  // Get the raw body for signature verification
  const rawBody = await c.req.text();

  // Reconstruct the signed payload
  const signedPayload = `${timestamp}|${rawBody}`;

  try {
    // Verify Ed25519 signature with Telnyx public key
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${env.TELNYX_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
    const signatureBuffer = Buffer.from(signature, 'base64');
    const isValid = verify(
      null, // Ed25519 doesn't use a digest algorithm
      Buffer.from(signedPayload),
      publicKey,
      signatureBuffer,
    );

    if (!isValid) {
      log.warn('Invalid Telnyx webhook signature');
      throw new HTTPException(401, { message: 'Invalid webhook signature' });
    }

    // Parse the body and store it for route handlers
    const body = JSON.parse(rawBody) as unknown;
    c.set('webhookBody' as never, body);

    log.debug('Telnyx webhook signature verified');
    await next();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    log.error({ error }, 'Webhook signature verification error');
    throw new HTTPException(401, { message: 'Webhook verification failed' });
  }
});
