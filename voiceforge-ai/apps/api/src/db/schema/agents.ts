// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agents Schema
// Maps to 'agents' table — each row is an AI Agent
// Primary: ElevenLabs | Legacy: Telnyx | Dev: Bypass mode
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { calls } from './calls';

// ── Enums ────────────────────────────────────────────────────────

export const agentStatusEnum = pgEnum('agent_status', ['draft', 'active', 'paused', 'error']);
export const aiProviderEnum = pgEnum('ai_provider', ['elevenlabs', 'telnyx']);

// ── Table ────────────────────────────────────────────────────────

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),

  // AI Provider
  aiProvider: aiProviderEnum('ai_provider').notNull().default('elevenlabs'),

  // ElevenLabs IDs (primary)
  elevenlabsAgentId: text('elevenlabs_agent_id').unique(),

  // Telnyx IDs (legacy / phone numbers only)
  telnyxAssistantId: text('telnyx_assistant_id').unique(),
  telnyxNumberOrderId: text('telnyx_number_order_id'),

  // ElevenLabs Phone Number (SIP trunk link)
  elevenlabsPhoneNumberId: text('elevenlabs_phone_number_id'),
  telnyxConnectionId: text('telnyx_connection_id'),

  // Agent identity
  name: text('name').notNull(), // e.g. "Sofia"
  industry: text('industry').notNull().default('general'),
  status: agentStatusEnum('status').notNull().default('draft'),

  // LLM config
  llmModel: text('llm_model').notNull().default('gpt-4o-mini'), // ElevenLabs LLM: gpt-4o-mini, gpt-4o, claude-3-5-sonnet, gemini-2.0-flash
  model: text('model').notNull().default('eleven_flash_v2_5'), // TTS model: eleven_multilingual_v2, eleven_flash_v2_5, eleven_turbo_v2_5
  instructions: text('instructions').notNull(), // System prompt with {{dynamic_variables}}
  greeting: text('greeting').notNull(), // Opening line
  llmApiKeyRef: text('llm_api_key_ref'), // Integration secret identifier (BYO key)

  // Voice (TTS)
  voiceId: text('voice_id').notNull().default('aTP4J5SJLQl74WTSRXKW'), // ElevenLabs Σοφία
  voiceSpeed: integer('voice_speed').notNull().default(1),
  voiceApiKeyRef: text('voice_api_key_ref'), // ElevenLabs integration secret

  // Phone
  phoneNumber: text('phone_number'), // Assigned +30 Telnyx number (AI answers here)
  forwardPhoneNumber: text('forward_phone_number'), // Business owner's real phone (transfer target)
  language: text('language').notNull().default('el'),
  supportedLanguages: jsonb('supported_languages').notNull().default('["el"]'), // e.g. ['el', 'en', 'de']

  // Tools (stored as JSONB for flexibility)
  tools: jsonb('tools').notNull().default('[]'), // AgentTool[]

  // Dynamic variables (defaults)
  dynamicVariables: jsonb('dynamic_variables').notNull().default('{}'),

  // Telephony settings
  noiseSuppression: text('noise_suppression').notNull().default('krisp'),
  timeLimitSecs: integer('time_limit_secs').notNull().default(1800),
  userIdleTimeoutSecs: integer('user_idle_timeout_secs').notNull().default(7215),
  voicemailDetection: boolean('voicemail_detection').notNull().default(true),
  recordingEnabled: boolean('recording_enabled').notNull().default(true),
  recordingFormat: text('recording_format').notNull().default('mp3'),

  // Transcription settings
  sttModel: text('stt_model').notNull().default('deepgram/nova-3'),
  sttRegion: text('stt_region').notNull().default('eu'),
  eotTimeoutMs: integer('eot_timeout_ms').notNull().default(700),
  eotThreshold: integer('eot_threshold').notNull().default(50), // stored as 50 = 0.50
  eagerEotThreshold: integer('eager_eot_threshold').notNull().default(30), // 30 = 0.30

  // Insights
  insightGroupId: text('insight_group_id'),

  // Flags
  isDefault: boolean('is_default').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const agentsRelations = relations(agents, ({ one, many }) => ({
  customer: one(customers, {
    fields: [agents.customerId],
    references: [customers.id],
  }),
  calls: many(calls),
}));

// ── Types ────────────────────────────────────────────────────────

export type AgentSelect = typeof agents.$inferSelect;
export type AgentInsert = typeof agents.$inferInsert;
