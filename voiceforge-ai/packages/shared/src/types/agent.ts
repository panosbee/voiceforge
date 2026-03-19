import type { AgentStatus, Industry, AiProvider } from '../constants';

/** AI Agent record — maps to an ElevenLabs Agent (or legacy Telnyx Assistant) */
export interface Agent {
  id: string;
  customerId: string;
  /** ElevenLabs agent ID (primary) */
  elevenlabsAgentId: string | null;
  /** Legacy Telnyx assistant ID (for backwards compat) */
  telnyxAssistantId: string | null;
  /** Which AI platform manages this agent */
  aiProvider: AiProvider;
  name: string; // Display name, e.g. "Sofia"
  industry: Industry;
  status: AgentStatus;
  instructions: string; // System prompt (with {{dynamic_variables}})
  greeting: string; // Opening line (first_message)
  model: string; // TTS model ID (eleven_flash_v2_5, eleven_multilingual_v2, etc.)
  llmModel: string; // LLM model ID (gpt-4o-mini, gpt-4o, claude-3-5-sonnet, etc.)
  voiceId: string; // TTS voice ID (ElevenLabs voice_id)
  phoneNumber: string | null; // Assigned +30 Telnyx number (AI answers here)
  forwardPhoneNumber: string | null; // Business owner's real phone (transfer target)
  telnyxNumberOrderId: string | null;
  language: string; // Primary language, e.g. "el" for Greek
  supportedLanguages: string[]; // All languages this agent supports, e.g. ['el', 'en', 'de']
  tools: AgentTool[];
  dynamicVariables: Record<string, string>;
  /** Free-text business hours description (injected into system prompt) */
  businessHoursText: string | null;
  /** Per-agent business hours configuration (working days, hours, slot duration, closed dates) */
  businessHours: BusinessHoursConfig;
  telephonySettings: TelephonySettings;
  transcriptionSettings: TranscriptionSettings;
  isDefault: boolean; // Is this the customer's primary agent?
  // Widget embed configuration
  widgetEnabled: boolean;
  widgetColor: string;
  widgetPosition: 'bottom-right' | 'bottom-left';
  widgetButtonText: string;
  widgetIconType: 'phone' | 'mic' | 'chat';
  widgetAllowedOrigins: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Tool attached to an agent */
export interface AgentTool {
  type: 'webhook' | 'hangup' | 'transfer' | 'handoff' | 'dtmf' | 'send_message';
  webhook?: WebhookTool;
  transfer?: TransferTool;
}

/** Webhook tool configuration */
export interface WebhookTool {
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Array<{ name: string; value: string }>;
  bodyParameters?: Record<string, unknown>;
  async?: boolean;
  timeoutMs?: number;
}

/** Transfer tool configuration */
export interface TransferTool {
  targets: Array<{
    name: string;
    number: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// Business Hours Configuration — per-agent scheduling
// Replaces hardcoded 09:00-17:00 Mon-Fri with configurable schedule
// ═══════════════════════════════════════════════════════════════════

/** Time range for a single work period (e.g. morning shift, afternoon shift) */
export interface TimeRange {
  start: string; // HH:MM (24h format)
  end: string;   // HH:MM (24h format)
}

/** Working schedule for a single day */
export interface DaySchedule {
  enabled: boolean;       // true = business is open
  timeRanges: TimeRange[]; // Work periods (supports lunch breaks: [{start:'09:00',end:'12:30'},{start:'14:00',end:'17:00'}])
}

/** Full business hours config per agent */
export interface BusinessHoursConfig {
  /** 0=Sunday, 1=Monday ... 6=Saturday */
  weeklySchedule: Record<string, DaySchedule>;
  /** Duration of each appointment slot in minutes (default: 30) */
  slotDurationMinutes: number;
  /** Specific dates when the business is closed (YYYY-MM-DD format) */
  closedDates: string[];
  /** Timezone override (defaults to customer timezone if empty) */
  timezone?: string;
}

/** Default business hours: Mon-Fri 09:00-12:30, 14:00-17:00 */
export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  weeklySchedule: {
    '0': { enabled: false, timeRanges: [] }, // Sunday
    '1': { enabled: true, timeRanges: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '17:00' }] },
    '2': { enabled: true, timeRanges: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '17:00' }] },
    '3': { enabled: true, timeRanges: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '17:00' }] },
    '4': { enabled: true, timeRanges: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '17:00' }] },
    '5': { enabled: true, timeRanges: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '17:00' }] },
    '6': { enabled: false, timeRanges: [] }, // Saturday
  },
  slotDurationMinutes: 30,
  closedDates: [],
};

/** Telephony settings per agent */
export interface TelephonySettings {
  noiseSuppression: 'krisp' | 'none';
  timeLimitSecs: number;
  userIdleTimeoutSecs: number;
  voicemailDetection: boolean;
  recordingEnabled: boolean;
  recordingFormat: 'mp3' | 'wav';
}

/** STT/Transcription settings per agent */
export interface TranscriptionSettings {
  model: string;
  language: string;
  region: string;
  smartFormat: boolean;
  numerals: boolean;
  eotTimeoutMs: number;
  eotThreshold: number;
  eagerEotThreshold: number;
}

/** Payload for creating/updating an agent */
export interface CreateAgentInput {
  name: string;
  industry: Industry;
  instructions: string;
  greeting: string;
  ttsModel?: string;
  llmModel?: string;
  voiceId?: string;
  language?: string;
  supportedLanguages?: string[];
  phoneNumber?: string;
  forwardPhoneNumber?: string;
  tools?: AgentTool[];
  dynamicVariables?: Record<string, string>;
  /** Free-text business hours to inject in the system prompt */
  businessHoursText?: string;
}

/** Agent summary for list views */
export interface AgentSummary {
  id: string;
  name: string;
  industry: Industry;
  status: AgentStatus;
  aiProvider: AiProvider;
  elevenlabsAgentId: string | null;
  phoneNumber: string | null;
  forwardPhoneNumber: string | null;
  voiceId: string;
  model: string;
  llmModel: string;
  totalCalls: number;
  isDefault: boolean;
  createdAt: string;
}

/** Agent detail — full object for single-agent view or edit */
export interface AgentDetail extends Agent {
  customer?: {
    id: string;
    businessName: string;
  };
}
