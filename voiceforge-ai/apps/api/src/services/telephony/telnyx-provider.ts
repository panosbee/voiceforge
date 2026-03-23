// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telnyx Telephony Provider
// Wraps existing telnyx.ts functions behind TelephonyProvider interface
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
import * as telnyxService from '../telnyx.js';
export class TelnyxProvider implements TelephonyProvider {
  readonly name = 'telnyx';

  isConfigured(): boolean {
    return telnyxService.isTelnyxConfigured();
  }

  isSmsConfigured(): boolean {
    return telnyxService.isSmsConfigured();
  }

  async searchAvailableNumbers(options?: SearchNumbersOptions): Promise<AvailableNumber[]> {
    const result = await telnyxService.searchAvailableNumbersMaster({
      locality: options?.locality,
      areaCode: options?.areaCode,
      limit: options?.limit,
    });
    // Map from telnyx AvailableNumber to our interface (same shape)
    return result;
  }

  async listOwnedNumbers(): Promise<OwnedNumber[]> {
    return telnyxService.listOwnedNumbersMaster();
  }

  async purchasePhoneNumber(phoneNumber: string): Promise<PurchaseResult> {
    return telnyxService.purchasePhoneNumberMaster(phoneNumber);
  }

  async createSipConnection(connectionName: string): Promise<SipConnectionResult> {
    return telnyxService.createSipConnection(connectionName);
  }

  async assignNumberToSipConnection(phoneNumber: string, connectionId: string): Promise<AssignNumberResult> {
    return telnyxService.assignNumberToSipConnection(phoneNumber, connectionId);
  }

  getTerminationUri(): string | undefined {
    return 'sip.telnyx.com';
  }

  requiresSipWiring(): boolean {
    return true;
  }

  async sendSms(params: { to: string; text: string }): Promise<SmsResult> {
    return telnyxService.sendSms(params);
  }

  async sendCallSummarySms(params: {
    to: string;
    callerPhone: string;
    agentName: string;
    durationSeconds: number;
    summary: string;
    appointmentBooked: boolean;
  }): Promise<SmsResult> {
    return telnyxService.sendCallSummarySms(params);
  }
}
