// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Twilio Telephony Provider
// ElevenLabs-native Twilio integration (no SIP management needed)
// ═══════════════════════════════════════════════════════════════════

import type {
  TelephonyProvider,
  AvailableNumber,
  OwnedNumber,
  PurchaseResult,
  SipConnectionResult,
  AssignNumberResult,
  SearchNumbersOptions,
  SmsResult,
} from './types.js';
import Twilio from 'twilio';
import { env } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';

const log = createLogger('telephony:twilio');

function getClient(): Twilio.Twilio {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio is not configured — TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required');
  }
  return Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export class TwilioProvider implements TelephonyProvider {
  readonly name = 'twilio';

  isConfigured(): boolean {
    return !!env.TWILIO_ACCOUNT_SID
      && !!env.TWILIO_AUTH_TOKEN
      && env.TWILIO_ACCOUNT_SID !== 'dev-placeholder';
  }

  isSmsConfigured(): boolean {
    return this.isConfigured() && !!env.TWILIO_SMS_FROM_NUMBER;
  }

  async searchAvailableNumbers(options?: SearchNumbersOptions): Promise<AvailableNumber[]> {
    if (!this.isConfigured()) {
      log.warn('Twilio not configured — returning empty number list');
      return [];
    }

    log.info({ options }, 'Searching available Greek numbers via Twilio');

    const client = getClient();

    try {
      // Twilio availablePhoneNumbers for Greece (local)
      const query = client.availablePhoneNumbers('GR').local;
      const params: Record<string, unknown> = {};

      if (options?.areaCode) params.areaCode = options.areaCode;
      if (options?.locality) params.inLocality = options.locality;

      const numbers = await query.list({
        ...params,
        limit: options?.limit ?? 20,
        voiceEnabled: true,
      });

      const result: AvailableNumber[] = numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        monthlyCost: '0',
        upfrontCost: '0',
        currency: 'USD',
        features: n.capabilities ? Object.entries(n.capabilities).filter(([, v]) => v).map(([k]) => k) : ['voice'],
        region: n.locality || 'GR',
      }));

      log.info({ count: result.length }, 'Available numbers found (Twilio)');
      return result;
    } catch (error: unknown) {
      // Twilio may not have self-service GR numbers — log and return empty
      const errMsg = error instanceof Error ? error.message : String(error);
      log.warn({ error: errMsg }, 'Twilio GR number search returned error — may require Exclusive Number Order');
      return [];
    }
  }

  async listOwnedNumbers(): Promise<OwnedNumber[]> {
    if (!this.isConfigured()) {
      log.warn('Twilio not configured — returning empty owned number list');
      return [];
    }

    const client = getClient();
    const numbers = await client.incomingPhoneNumbers.list();

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      status: n.status ?? 'in-use',
      connectionId: null,
      monthlyCost: '0',
      currency: 'USD',
    }));
  }

  async purchasePhoneNumber(phoneNumber: string): Promise<PurchaseResult> {
    if (!this.isConfigured()) {
      throw new Error('Twilio is not configured');
    }

    log.info({ phoneNumber }, 'Purchasing phone number via Twilio');

    const client = getClient();
    const number = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceReceiveMode: 'voice',
    });

    log.info({ sid: number.sid, phoneNumber: number.phoneNumber }, 'Twilio number purchased');

    return {
      orderId: number.sid,
      status: 'success',
    };
  }

  /**
   * No-op: Twilio numbers use ElevenLabs native integration — no SIP wiring needed.
   */
  async createSipConnection(connectionName: string): Promise<SipConnectionResult> {
    void connectionName;
    log.info('Twilio uses native ElevenLabs integration — SIP connection not needed');
    return { connectionId: 'twilio-native' };
  }

  /**
   * No-op: ElevenLabs native Twilio integration handles routing.
   */
  async assignNumberToSipConnection(phoneNumber: string, connectionId: string): Promise<AssignNumberResult> {
    void phoneNumber;
    void connectionId;
    log.info('Twilio uses native ElevenLabs integration — number assignment not needed');
    return { phoneNumberResourceId: 'twilio-native' };
  }

  /**
   * Twilio numbers use ElevenLabs native import — no termination URI needed.
   */
  getTerminationUri(): string | undefined {
    return undefined;
  }

  requiresSipWiring(): boolean {
    return false;
  }

  async sendSms(params: { to: string; text: string }): Promise<SmsResult> {
    if (!this.isSmsConfigured()) {
      log.warn('Twilio SMS not configured — skipping SMS');
      return { messageId: 'skipped' };
    }

    log.info({ to: params.to }, 'Sending SMS via Twilio');

    const client = getClient();
    const message = await client.messages.create({
      from: env.TWILIO_SMS_FROM_NUMBER,
      to: params.to,
      body: params.text,
    });

    log.info({ messageId: message.sid, to: params.to }, 'SMS sent via Twilio');
    return { messageId: message.sid };
  }

  async sendCallSummarySms(params: {
    to: string;
    callerPhone: string;
    agentName: string;
    durationSeconds: number;
    summary: string;
    appointmentBooked: boolean;
  }): Promise<SmsResult> {
    const minutes = Math.floor(params.durationSeconds / 60);
    const seconds = params.durationSeconds % 60;
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const appointment = params.appointmentBooked ? '\n📅 Κλείστηκε ραντεβού!' : '';

    const text = [
      `📞 VoiceForge AI — Νέα κλήση`,
      `Καλών: ${params.callerPhone}`,
      `Βοηθός: ${params.agentName}`,
      `Διάρκεια: ${duration}`,
      `Περίληψη: ${params.summary.slice(0, 300)}`,
      appointment,
    ].filter(Boolean).join('\n');

    return this.sendSms({ to: params.to, text });
  }
}
