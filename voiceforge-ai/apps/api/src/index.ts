// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — API Server Entry Point
// Hono + Node.js HTTP server
// ═══════════════════════════════════════════════════════════════════

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { HTTPException } from 'hono/http-exception';

import { env, logger } from './config/index.js';
import { disconnectDb } from './db/connection.js';
import { telnyxWebhookMiddleware } from './middleware/webhook-verify.js';
import { apiRateLimiter, webhookRateLimiter } from './middleware/rate-limit.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { customerRoutes } from './routes/customers.js';
import { agentRoutes } from './routes/agents.js';
import { numberRoutes } from './routes/numbers.js';
import { callRoutes } from './routes/calls.js';
import { webhookRoutes } from './routes/webhooks.js';
import { toolRoutes } from './routes/tools.js';
import { billingRoutes, billingWebhookRoutes } from './routes/billing.js';
import { devAuthRoutes } from './routes/dev-auth.js';
import { elevenlabsWebhookRoutes } from './routes/elevenlabs-webhooks.js';
import { knowledgeBaseRoutes } from './routes/knowledge-base.js';
import { flowRoutes } from './routes/flows.js';
import { voiceRoutes } from './routes/voices.js';
import { gdprRoutes } from './routes/gdpr.js';
import { kbWizardRoutes } from './routes/kb-wizard.js';
import { supportChatRoutes } from './routes/support-chat.js';
import { adminRoutes } from './routes/admin.js';
import { registrationRoutes } from './routes/registration.js';

// ── App Setup ────────────────────────────────────────────────────

const app = new Hono();

// ── Global Middleware ────────────────────────────────────────────

// Request ID — unique per request for tracing
app.use('*', requestId());

// Body size limit — prevent payload attacks (2MB default, 512KB for API)
app.use('/api/*', bodyLimit({ maxSize: 512 * 1024 })); // 512KB for API
app.use('/webhooks/*', bodyLimit({ maxSize: 2 * 1024 * 1024 })); // 2MB for webhooks

// CORS — allow frontend origin only
app.use(
  '*',
  cors({
    origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : ['http://localhost:3000', env.FRONTEND_URL],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Admin-Token'],
    credentials: true,
    maxAge: 86400,
  }),
);

// Security headers — CSP, HSTS, X-Frame-Options, etc.
app.use(
  '*',
  secureHeaders({
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginEmbedderPolicy: false, // Allow external resources
  }),
);

// Request timing
app.use('*', timing());

// HTTP logging (dev only — production uses structured JSON logs)
if (env.NODE_ENV === 'development') {
  app.use('*', honoLogger());
}

// ── Rate Limiting ────────────────────────────────────────────────

app.use('/api/*', apiRateLimiter);
app.use('/webhooks/*', webhookRateLimiter);

// ── Routes ───────────────────────────────────────────────────────

// Health check (no auth)
app.route('/health', healthRoutes);

// Telnyx webhooks (signature verification, no JWT auth)
app.use('/webhooks/telnyx/*', telnyxWebhookMiddleware);
app.route('/webhooks', webhookRoutes);

// Stripe webhooks (raw body needed for signature verification, no JWT auth)
app.route('/webhooks', billingWebhookRoutes);

// Tool webhooks called by Telnyx during live calls (no JWT auth, but verified via tool headers)
app.route('/tools', toolRoutes);

// ElevenLabs webhooks (post-conversation, server tools)
app.route('/webhooks/elevenlabs', elevenlabsWebhookRoutes);

// Public registration & license activation (no auth)
app.route('/registration', registrationRoutes);

// Admin panel (protected by ADMIN_SECRET)
app.route('/admin', adminRoutes);

// Dev auth routes — ONLY in development (never exposed in production)
if (env.NODE_ENV === 'development') {
  app.route('/auth/dev', devAuthRoutes);
  logger.warn('⚠️  Dev auth routes enabled — DO NOT use in production');
}

// Authenticated API routes
app.route('/api/customers', customerRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/numbers', numberRoutes);
app.route('/api/calls', callRoutes);
app.route('/api/knowledge-base', knowledgeBaseRoutes);
app.route('/api/flows', flowRoutes);
app.route('/api/voices', voiceRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/gdpr', gdprRoutes);
app.route('/api/kb-wizard', kbWizardRoutes);
app.route('/api/support-chat', supportChatRoutes);

// ── Global Error Handler ─────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    logger.warn({ status: err.status, message: err.message, path: c.req.path }, 'HTTP exception');
    return c.json(
      {
        success: false,
        error: { code: 'HTTP_ERROR', message: err.message },
      },
      err.status,
    );
  }

  logger.error({ err, path: c.req.path, method: c.req.method }, 'Unhandled error');
  return c.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    },
    500,
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` },
    },
    404,
  );
});

// ── Server Start ─────────────────────────────────────────────────

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    logger.info(
      {
        port: info.port,
        env: env.NODE_ENV,
        baseUrl: env.API_BASE_URL,
      },
      `🚀 VoiceForge API running on port ${info.port}`,
    );
  },
);

// ── Graceful Shutdown ────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');

  server.close(async () => {
    await disconnectDb();
    logger.info('Server shut down gracefully');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
