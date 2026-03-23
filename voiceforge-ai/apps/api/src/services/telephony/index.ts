// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telephony Provider Factory
// Selects Telnyx or Twilio based on TELEPHONY_PROVIDER env var
// ═══════════════════════════════════════════════════════════════════

import type { TelephonyProvider } from './types.js';
import { TelnyxProvider } from './telnyx-provider.js';
import { TwilioProvider } from './twilio-provider.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';

export type { TelephonyProvider } from './types.js';
export type {
  AvailableNumber,
  PurchaseResult,
  SipConnectionResult,
  AssignNumberResult,
  SearchNumbersOptions,
  SmsResult,
} from './types.js';

const log = createLogger('telephony');

let _provider: TelephonyProvider | null = null;

/**
 * Get the active telephony provider based on TELEPHONY_PROVIDER env var.
 * Defaults to 'telnyx' for backwards compatibility.
 * Singleton — created once and reused.
 */
export function getTelephonyProvider(): TelephonyProvider {
  if (_provider) return _provider;

  const providerName = env.TELEPHONY_PROVIDER ?? 'telnyx';

  switch (providerName) {
    case 'twilio':
      log.info('Initializing Twilio telephony provider (ElevenLabs native integration)');
      _provider = new TwilioProvider();
      break;
    case 'telnyx':
    default:
      log.info('Initializing Telnyx telephony provider');
      _provider = new TelnyxProvider();
      break;
  }

  return _provider!;
}
