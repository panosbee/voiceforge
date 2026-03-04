// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Structured Logger (Pino)
// Production: JSON output with PII redaction for GDPR compliance
// ═══════════════════════════════════════════════════════════════════

import pino from 'pino';
import { env } from './env.js';

// ── PII Redaction Paths ──────────────────────────────────────────
// These paths are redacted in production logs to comply with GDPR.
// In development, logging is unredacted for debugging convenience.

const PII_REDACTION_PATHS = [
  'email',
  'phone',
  'callerNumber',
  'callerPhone',
  'ownerName',
  'businessName',
  '*.email',
  '*.phone',
  '*.callerNumber',
  '*.callerPhone',
  '*.ownerName',
  '*.businessName',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // PII redaction in production — replaces sensitive values with [REDACTED]
  redact: env.NODE_ENV === 'production'
    ? {
        paths: PII_REDACTION_PATHS,
        censor: '[REDACTED]',
      }
    : undefined,
  base: {
    service: 'voiceforge-api',
    env: env.NODE_ENV,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Timestamp format for production (ISO 8601)
  timestamp: env.NODE_ENV === 'production' ? pino.stdTimeFunctions.isoTime : undefined,
});

/** Create a child logger with module context */
export function createLogger(module: string) {
  return logger.child({ module });
}
