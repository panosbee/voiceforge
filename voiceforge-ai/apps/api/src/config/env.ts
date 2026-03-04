// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Environment Configuration
// Validates all required env vars at startup with Zod
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env from monorepo root (two levels up from apps/api/)
const rootEnvPath = resolve(process.cwd(), '../../.env');
const localEnvPath = resolve(process.cwd(), '.env');

if (existsSync(localEnvPath)) {
  config({ path: localEnvPath });
}
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath }); // won't overwrite existing vars
}

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Encryption (AES-256-GCM for stored API keys)
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  // Supabase JWT (production: verify tokens locally without HTTP round-trip)
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),

  // Redis (production: distributed rate limiting, sessions, caching)
  REDIS_URL: z.string().url().optional(),

  // Telnyx (Phone Numbers + SMS — SIP trunk to ElevenLabs)
  TELNYX_API_KEY: z.string().default('dev-placeholder'),
  TELNYX_PUBLIC_KEY: z.string().default(''),
  TELNYX_WEBHOOK_SECRET: z.string().default(''),
  TELNYX_MESSAGING_PROFILE_ID: z.string().default(''),
  TELNYX_SMS_FROM_NUMBER: z.string().default(''),  // +30 number to send SMS from

  // ElevenLabs (Primary AI Platform)
  ELEVENLABS_API_KEY: z.string().default('dev-placeholder'),
  ELEVENLABS_VOICE_ID: z.string().default(''),
  ELEVENLABS_MODEL_ID: z.string().default('eleven_multilingual_v2'),
  ELEVENLABS_WEBHOOK_SECRET: z.string().default(''),

  // Supabase
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().default('http://localhost:54321'),
  SUPABASE_ANON_KEY: z.string().default('dev-placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('dev-placeholder'),

  // Stripe (optional in dev — required for billing features)
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_STARTER_PRICE_ID: z.string().default(''),
  STRIPE_PRO_PRICE_ID: z.string().default(''),
  STRIPE_BUSINESS_PRICE_ID: z.string().default(''),

  // Google Calendar
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // Web Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().email().optional(),

  // Resend
  RESEND_API_KEY: z.string().optional(),

  // OpenAI (for AI support chatbot — optional, falls back to ElevenLabs agent)
  OPENAI_API_KEY: z.string().optional(),

  // Admin Panel
  ADMIN_SECRET: z.string().min(8).default('voiceforge-admin-2026'),
  ADMIN_EMAIL: z.string().email().default('admin@voiceforge.ai'),

  // Data retention (GDPR — days before auto-cleanup)
  DATA_RETENTION_CALLS_DAYS: z.coerce.number().int().positive().default(365),
  DATA_RETENTION_WEBHOOKS_DAYS: z.coerce.number().int().positive().default(90),
});

/** Parse and validate environment — throws on invalid config */
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('═══════════════════════════════════════════');
    console.error('  Invalid environment configuration:');
    console.error(formatted);
    console.error('═══════════════════════════════════════════');
    process.exit(1);
  }

  const data = parsed.data;

  // ── Production enforcement: critical secrets MUST be real values ──
  if (data.NODE_ENV === 'production') {
    const errors: string[] = [];

    if (data.TELNYX_API_KEY === 'dev-placeholder' || !data.TELNYX_API_KEY) {
      errors.push('TELNYX_API_KEY must be set in production');
    }
    if (data.ELEVENLABS_API_KEY === 'dev-placeholder' || !data.ELEVENLABS_API_KEY) {
      errors.push('ELEVENLABS_API_KEY must be set in production');
    }
    if (data.SUPABASE_ANON_KEY === 'dev-placeholder' || !data.SUPABASE_ANON_KEY) {
      errors.push('SUPABASE_ANON_KEY must be set in production');
    }
    if (data.SUPABASE_SERVICE_ROLE_KEY === 'dev-placeholder' || !data.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY must be set in production');
    }
    if (!data.SUPABASE_JWT_SECRET) {
      errors.push('SUPABASE_JWT_SECRET is required in production for local JWT verification');
    }
    if (!data.TELNYX_PUBLIC_KEY) {
      errors.push('TELNYX_PUBLIC_KEY is required for webhook signature verification');
    }
    if (data.API_BASE_URL.includes('localhost')) {
      errors.push('API_BASE_URL must not contain localhost in production');
    }
    if (data.FRONTEND_URL.includes('localhost')) {
      errors.push('FRONTEND_URL must not contain localhost in production');
    }

    if (errors.length > 0) {
      console.error('═══════════════════════════════════════════');
      console.error('  ⛔ Production environment validation failed:');
      errors.forEach((e) => console.error(`  ✗ ${e}`));
      console.error('═══════════════════════════════════════════');
      process.exit(1);
    }
  }

  return data;
}

export const env = loadEnv();

/** Type-safe env access */
export type Env = z.infer<typeof envSchema>;
