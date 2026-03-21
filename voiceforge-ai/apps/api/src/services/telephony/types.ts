// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telephony Provider Interface
// Provider-agnostic abstraction for phone number operations & SMS
// Supports Telnyx, Twilio, or any future carrier
// ═══════════════════════════════════════════════════════════════════

/**
 * A phone number returned from a search query.
 */
export interface AvailableNumber {
  phoneNumber: string;
  monthlyCost: string;
  upfrontCost: string;
  currency: string;
  features: string[];
  region: string;
}

/**
 * Result of purchasing a phone number.
 */
export interface PurchaseResult {
  orderId: string;
  status: string;
}

/**
 * Result of setting up the SIP trunk / connection.
 */
export interface SipConnectionResult {
  connectionId: string;
}

/**
 * Result of assigning a number to a SIP connection.
 */
export interface AssignNumberResult {
  phoneNumberResourceId: string;
}

/**
 * A phone number owned/purchased on the account.
 */
export interface OwnedNumber {
  phoneNumber: string;
  status: string;
  connectionId: string | null;
  monthlyCost: string;
  currency: string;
}

/**
 * Options for searching available numbers.
 */
export interface SearchNumbersOptions {
  locality?: string;
  areaCode?: string;
  limit?: number;
}

/**
 * Result of sending an SMS.
 */
export interface SmsResult {
  messageId: string;
}

/**
 * The telephony provider interface.
 * Implement this for each carrier (Telnyx, Twilio, etc.)
 *
 * Only covers the operations actually used in production:
 *   - Phone number search & purchase
 *   - SIP connection management (Telnyx) or native import (Twilio)
 *   - SMS sending
 */
export interface TelephonyProvider {
  /** Provider name for logging and UI */
  readonly name: string;

  /** Whether the provider is properly configured */
  isConfigured(): boolean;

  /** Whether SMS sending is configured */
  isSmsConfigured(): boolean;

  // ── Phone Numbers ────────────────────────────────────────────

  /** Search available Greek phone numbers */
  searchAvailableNumbers(options?: SearchNumbersOptions): Promise<AvailableNumber[]>;

  /** List phone numbers owned/purchased on the master account */
  listOwnedNumbers(): Promise<OwnedNumber[]>;

  /** Purchase a phone number */
  purchasePhoneNumber(phoneNumber: string): Promise<PurchaseResult>;

  // ── SIP / Connection ─────────────────────────────────────────

  /** Create a SIP connection (Telnyx) or no-op (Twilio native) */
  createSipConnection(connectionName: string): Promise<SipConnectionResult>;

  /** Assign a number to a SIP connection. No-op for providers with native ElevenLabs integration */
  assignNumberToSipConnection(phoneNumber: string, connectionId: string): Promise<AssignNumberResult>;

  /**
   * Get the SIP termination URI for ElevenLabs outbound calls.
   * e.g. 'sip.telnyx.com' for Telnyx, undefined for Twilio native.
   */
  getTerminationUri(): string | undefined;

  /**
   * Whether numbers need manual SIP wiring (Telnyx) or are handled
   * natively by ElevenLabs (Twilio).
   */
  requiresSipWiring(): boolean;

  // ── SMS ──────────────────────────────────────────────────────

  /** Send a raw SMS */
  sendSms(params: { to: string; text: string }): Promise<SmsResult>;

  /** Send a post-call SMS summary */
  sendCallSummarySms(params: {
    to: string;
    callerPhone: string;
    agentName: string;
    durationSeconds: number;
    summary: string;
    appointmentBooked: boolean;
  }): Promise<SmsResult>;
}
