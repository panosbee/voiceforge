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
  telephonySettings: TelephonySettings;
  transcriptionSettings: TranscriptionSettings;
  isDefault: boolean; // Is this the customer's primary agent?
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
