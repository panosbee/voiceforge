// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Telnyx Service Layer
// Wraps the official Telnyx Node SDK for all platform operations
// ═══════════════════════════════════════════════════════════════════

import Telnyx from 'telnyx';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { decrypt } from './encryption.js';
import { DEFAULT_TRANSCRIPTION, DEFAULT_TELEPHONY } from '@voiceforge/shared';

const log = createLogger('telnyx');

// ── Master client (for managed account operations) ───────────────

const masterClient = new Telnyx({
  apiKey: env.TELNYX_API_KEY,
  maxRetries: 3,
  timeout: 30_000,
});

/**
 * Create a Telnyx client authenticated with a customer's sub-account API key.
 * The key is stored encrypted in our DB; this decrypts it on the fly.
 */
export function createSubAccountClient(encryptedApiKey: string): Telnyx {
  const apiKey = decrypt(encryptedApiKey);
  return new Telnyx({
    apiKey,
    maxRetries: 3,
    timeout: 30_000,
  });
}

// ═══════════════════════════════════════════════════════════════════
// MANAGED ACCOUNTS
// ═══════════════════════════════════════════════════════════════════

export interface CreateManagedAccountResult {
  id: string;
  apiKey: string;
  apiToken: string;
  organizationName: string;
}

/**
 * Create a new Telnyx Managed Account for a customer.
 * Uses the master API key. Returns the sub-account ID and API key.
 */
export async function createManagedAccount(businessName: string): Promise<CreateManagedAccountResult> {
  log.info({ businessName }, 'Creating Telnyx managed account');

  const response = await masterClient.managedAccounts.create({
    business_name: businessName,
    managed_account_allow_custom_pricing: false,
    rollup_billing: true, // Manager pays, not customer
  });

  const data = response as unknown as Record<string, unknown>;
  const inner = (data.data ?? data) as Record<string, unknown>;
  log.info({ accountId: inner.id, org: inner.organization_name }, 'Managed account created');

  return {
    id: inner.id as string,
    apiKey: inner.api_key as string,
    apiToken: inner.api_token as string,
    organizationName: inner.organization_name as string,
  };
}

/**
 * List all managed accounts under the master account.
 */
export async function listManagedAccounts() {
  const accounts: Array<{ id: string; organizationName: string; createdAt: string }> = [];

  for await (const account of masterClient.managedAccounts.list()) {
    accounts.push({
      id: account.id as string,
      organizationName: account.organization_name as string,
      createdAt: account.created_at as string,
    });
  }

  return accounts;
}

// ═══════════════════════════════════════════════════════════════════
// AI ASSISTANTS
// ═══════════════════════════════════════════════════════════════════

/** Parameters for creating a Telnyx AI Assistant */
export interface CreateAssistantParams {
  name: string;
  model: string;
  instructions: string;
  greeting: string;
  voiceId: string;
  language: string;
  tools?: Array<Record<string, unknown>>;
  dynamicVariablesWebhookUrl?: string;
  dynamicVariables?: Record<string, string>;
  llmApiKeyRef?: string;
  voiceApiKeyRef?: string;
  insightGroupId?: string;
}

/**
 * Create an AI Assistant on a customer's sub-account.
 */
export async function createAssistant(
  encryptedApiKey: string,
  params: CreateAssistantParams,
): Promise<{ assistantId: string }> {
  const client = createSubAccountClient(encryptedApiKey);

  log.info({ name: params.name, model: params.model }, 'Creating AI assistant');

  const body = {
    name: params.name,
    model: params.model,
    instructions: params.instructions,
    greeting: params.greeting,
    voice_settings: {
      voice: params.voiceId,
      voice_speed: 1,
      ...(params.voiceApiKeyRef ? { api_key_ref: params.voiceApiKeyRef } : {}),
    },
    transcription: {
      model: DEFAULT_TRANSCRIPTION.model,
      language: params.language,
      region: DEFAULT_TRANSCRIPTION.region,
      settings: {
        smart_format: DEFAULT_TRANSCRIPTION.settings.smart_format,
        numerals: DEFAULT_TRANSCRIPTION.settings.numerals,
        eot_timeout_ms: DEFAULT_TRANSCRIPTION.settings.eot_timeout_ms,
        eot_threshold: DEFAULT_TRANSCRIPTION.settings.eot_threshold,
        eager_eot_threshold: DEFAULT_TRANSCRIPTION.settings.eager_eot_threshold,
      },
    },
    telephony_settings: {
      noise_suppression: DEFAULT_TELEPHONY.noise_suppression,
      time_limit_secs: DEFAULT_TELEPHONY.time_limit_secs,
      user_idle_timeout_secs: DEFAULT_TELEPHONY.user_idle_timeout_secs,
      voicemail_detection: {
        on_voicemail_detected: { action: 'stop_assistant' },
      },
    },
    enabled_features: ['telephony'],
    tools: params.tools ?? [{ type: 'hangup' }],
    ...(params.dynamicVariablesWebhookUrl
      ? { dynamic_variables_webhook_url: params.dynamicVariablesWebhookUrl }
      : {}),
    ...(params.dynamicVariables ? { dynamic_variables: params.dynamicVariables } : {}),
    ...(params.llmApiKeyRef ? { llm_api_key_ref: params.llmApiKeyRef } : {}),
    ...(params.insightGroupId ? { insight_settings: { insight_group_id: params.insightGroupId } } : {}),
  };

  // Use any to bypass strict SDK types — Telnyx SDK types may not cover all fields
  const response = await (client.ai.assistants.create as Function)(body);

  const result = response as unknown as Record<string, unknown>;
  const assistantId = (result.id ?? (result.data as Record<string, unknown>)?.id) as string;
  log.info({ assistantId, name: params.name }, 'AI assistant created');

  return { assistantId };
}

/**
 * Update an existing AI Assistant.
 */
export async function updateAssistant(
  encryptedApiKey: string,
  assistantId: string,
  updates: Partial<CreateAssistantParams>,
): Promise<void> {
  const client = createSubAccountClient(encryptedApiKey);

  log.info({ assistantId }, 'Updating AI assistant');

  const body: Record<string, unknown> = {};
  if (updates.name) body.name = updates.name;
  if (updates.model) body.model = updates.model;
  if (updates.instructions) body.instructions = updates.instructions;
  if (updates.greeting) body.greeting = updates.greeting;
  if (updates.voiceId) {
    body.voice_settings = {
      voice: updates.voiceId,
      voice_speed: 1,
      ...(updates.voiceApiKeyRef ? { api_key_ref: updates.voiceApiKeyRef } : {}),
    };
  }
  if (updates.tools) body.tools = updates.tools;
  if (updates.dynamicVariables) body.dynamic_variables = updates.dynamicVariables;
  if (updates.dynamicVariablesWebhookUrl) {
    body.dynamic_variables_webhook_url = updates.dynamicVariablesWebhookUrl;
  }

  await client.ai.assistants.update(assistantId, body);
  log.info({ assistantId }, 'AI assistant updated');
}

/**
 * Delete an AI Assistant.
 */
export async function deleteAssistant(encryptedApiKey: string, assistantId: string): Promise<void> {
  const client = createSubAccountClient(encryptedApiKey);
  log.info({ assistantId }, 'Deleting AI assistant');
  await client.ai.assistants.delete(assistantId);
  log.info({ assistantId }, 'AI assistant deleted');
}

// ═══════════════════════════════════════════════════════════════════
// PHONE NUMBERS
// ═══════════════════════════════════════════════════════════════════

export interface AvailableNumber {
  phoneNumber: string;
  monthlyCost: string;
  upfrontCost: string;
  currency: string;
  features: string[];
  region: string;
}

/**
 * Search available Greek phone numbers on a customer's sub-account.
 */
export async function searchAvailableNumbers(
  encryptedApiKey: string,
  options: {
    locality?: string;
    areaCode?: string;
    limit?: number;
  } = {},
): Promise<AvailableNumber[]> {
  const client = createSubAccountClient(encryptedApiKey);

  log.info({ options }, 'Searching available Greek numbers');

  const params = {
    'filter[country_code]': 'GR',
    'filter[phone_number_type]': 'local',
    'filter[features][]': 'voice',
    'filter[limit]': options.limit ?? 20,
    ...(options.locality ? { 'filter[locality]': options.locality } : {}),
    ...(options.areaCode ? { 'filter[national_destination_code]': options.areaCode } : {}),
  };

  const response = await (client.availablePhoneNumbers.list as Function)(params);
  const responseData = response as unknown as { data?: unknown[] };
  const rawNumbers = (responseData.data ?? []) as Array<Record<string, unknown>>;

  const numbers: AvailableNumber[] = [];
  for (const record of rawNumbers) {
    const costInfo = record.cost_information as Record<string, string> | undefined;
    const features = (record.features as Array<{ name: string }>) ?? [];

    numbers.push({
      phoneNumber: record.phone_number as string,
      monthlyCost: costInfo?.monthly_cost ?? '0',
      upfrontCost: costInfo?.upfront_cost ?? '0',
      currency: costInfo?.currency ?? 'USD',
      features: features.map((f) => f.name),
      region: 'GR',
    });
  }

  log.info({ count: numbers.length }, 'Available numbers found');
  return numbers;
}

/**
 * Purchase a phone number for a customer.
 */
export async function purchasePhoneNumber(
  encryptedApiKey: string,
  phoneNumber: string,
  connectionId?: string,
): Promise<{ orderId: string; status: string }> {
  const client = createSubAccountClient(encryptedApiKey);

  log.info({ phoneNumber }, 'Purchasing phone number');

  const response = await client.numberOrders.create({
    phone_numbers: [{ phone_number: phoneNumber }],
    ...(connectionId ? { connection_id: connectionId } : {}),
  });

  const data = response.data as Record<string, unknown>;
  log.info({ orderId: data.id, status: data.status }, 'Number order created');

  return {
    orderId: data.id as string,
    status: data.status as string,
  };
}

// ── Master-key phone number operations (no managed accounts) ─────

/**
 * Check if Telnyx is configured (API key present and not placeholder).
 */
export function isTelnyxConfigured(): boolean {
  return !!env.TELNYX_API_KEY && env.TELNYX_API_KEY !== 'dev-placeholder';
}

/**
 * Search available Greek phone numbers using the master API key.
 * Used when we don't have managed accounts (ElevenLabs architecture).
 */
export async function searchAvailableNumbersMaster(
  options: {
    locality?: string;
    areaCode?: string;
    limit?: number;
  } = {},
): Promise<AvailableNumber[]> {
  if (!isTelnyxConfigured()) {
    log.warn('Telnyx not configured — returning empty number list');
    return [];
  }

  log.info({ options }, 'Searching available Greek numbers (master key)');

  const params = {
    'filter[country_code]': 'GR',
    'filter[phone_number_type]': 'local',
    'filter[features][]': 'voice',
    'filter[limit]': options.limit ?? 20,
    ...(options.locality ? { 'filter[locality]': options.locality } : {}),
    ...(options.areaCode ? { 'filter[national_destination_code]': options.areaCode } : {}),
  };

  const response = await (masterClient.availablePhoneNumbers.list as Function)(params);
  const responseData = response as unknown as { data?: unknown[] };
  const rawNumbers = (responseData.data ?? []) as Array<Record<string, unknown>>;

  const numbers: AvailableNumber[] = [];
  for (const record of rawNumbers) {
    const costInfo = record.cost_information as Record<string, string> | undefined;
    const features = (record.features as Array<{ name: string }>) ?? [];

    numbers.push({
      phoneNumber: record.phone_number as string,
      monthlyCost: costInfo?.monthly_cost ?? '0',
      upfrontCost: costInfo?.upfront_cost ?? '0',
      currency: costInfo?.currency ?? 'USD',
      features: features.map((f) => f.name),
      region: 'GR',
    });
  }

  log.info({ count: numbers.length }, 'Available numbers found (master)');
  return numbers;
}

/**
 * Purchase a phone number using the master API key.
 */
export async function purchasePhoneNumberMaster(
  phoneNumber: string,
): Promise<{ orderId: string; status: string }> {
  if (!isTelnyxConfigured()) {
    throw new Error('Telnyx is not configured');
  }

  log.info({ phoneNumber }, 'Purchasing phone number (master key)');

  const response = await masterClient.numberOrders.create({
    phone_numbers: [{ phone_number: phoneNumber }],
  });

  const data = response.data as Record<string, unknown>;
  log.info({ orderId: data.id, status: data.status }, 'Number order created (master)');

  return {
    orderId: data.id as string,
    status: data.status as string,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SIP CONNECTIONS — Link Telnyx Numbers → ElevenLabs
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a SIP connection (FQDN connection) on Telnyx that forwards calls
 * to ElevenLabs' SIP endpoint: sip.rtc.elevenlabs.io:5060
 *
 * This connection is reused for all numbers on the master account.
 */
export async function createSipConnection(
  connectionName: string = 'VoiceForge-ElevenLabs-SIP',
): Promise<{ connectionId: string }> {
  if (!isTelnyxConfigured()) {
    throw new Error('Telnyx is not configured');
  }

  log.info({ connectionName }, 'Creating SIP connection to ElevenLabs');

  // Create an FQDN Connection pointing to ElevenLabs SIP
  const response = await fetch('https://api.telnyx.com/v2/fqdn_connections', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_name: connectionName,
      transport_protocol: 'UDP',
      active: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    log.error({ status: response.status, body }, 'Failed to create SIP connection');
    throw new Error(`SIP connection creation failed: ${response.status}`);
  }

  const result = (await response.json()) as { data: { id: string } };
  const connectionId = result.data.id;

  // Add the ElevenLabs SIP FQDN to this connection
  await fetch('https://api.telnyx.com/v2/fqdns', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fqdn_connection_id: connectionId,
      fqdn: 'sip.rtc.elevenlabs.io',
      port: 5060,
    }),
  });

  log.info({ connectionId }, 'SIP connection created → sip.rtc.elevenlabs.io:5060');
  return { connectionId };
}

/**
 * Assign a purchased phone number to a SIP connection.
 * First retrieves the Telnyx phone number resource ID, then updates it.
 */
export async function assignNumberToSipConnection(
  phoneNumber: string,
  connectionId: string,
): Promise<{ phoneNumberResourceId: string }> {
  if (!isTelnyxConfigured()) {
    throw new Error('Telnyx is not configured');
  }

  log.info({ phoneNumber, connectionId }, 'Assigning number to SIP connection');

  // 1. Find the Telnyx resource ID for this phone number
  const searchResp = await fetch(
    `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
    {
      headers: { Authorization: `Bearer ${env.TELNYX_API_KEY}` },
    },
  );

  if (!searchResp.ok) {
    const body = await searchResp.text();
    log.error({ status: searchResp.status, body, phoneNumber }, 'Failed to find phone number resource');
    throw new Error(`Phone number lookup failed: ${searchResp.status}`);
  }

  const searchResult = (await searchResp.json()) as { data: Array<{ id: string }> };
  if (!searchResult.data?.length) {
    throw new Error(`Phone number ${phoneNumber} not found in Telnyx account`);
  }

  const firstResult = searchResult.data[0];
  if (!firstResult) {
    throw new Error(`Phone number ${phoneNumber} not found in Telnyx account`);
  }
  const phoneNumberResourceId = firstResult.id;

  // 2. Update the phone number to use the SIP connection
  const updateResp = await fetch(
    `https://api.telnyx.com/v2/phone_numbers/${phoneNumberResourceId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: connectionId,
      }),
    },
  );

  if (!updateResp.ok) {
    const body = await updateResp.text();
    log.error({ status: updateResp.status, body, phoneNumber }, 'Failed to update phone number connection');
    throw new Error(`Phone number update failed: ${updateResp.status}`);
  }

  log.info({ phoneNumber, phoneNumberResourceId, connectionId }, 'Number assigned to SIP connection');
  return { phoneNumberResourceId };
}

// ═══════════════════════════════════════════════════════════════════
// SMS / MESSAGING
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if Telnyx SMS is configured (requires messaging profile + from number).
 */
export function isSmsConfigured(): boolean {
  return isTelnyxConfigured()
    && !!env.TELNYX_SMS_FROM_NUMBER
    && !!env.TELNYX_MESSAGING_PROFILE_ID;
}

/**
 * Send an SMS notification via Telnyx Messaging API.
 * Uses the master API key with the configured from-number.
 */
export async function sendSms(params: {
  to: string;
  text: string;
}): Promise<{ messageId: string }> {
  if (!isSmsConfigured()) {
    log.warn('Telnyx SMS not configured — skipping SMS');
    return { messageId: 'skipped' };
  }

  log.info({ to: params.to }, 'Sending SMS');

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.TELNYX_SMS_FROM_NUMBER,
      to: params.to,
      text: params.text,
      messaging_profile_id: env.TELNYX_MESSAGING_PROFILE_ID,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    log.error({ status: response.status, body, to: params.to }, 'SMS send failed');
    throw new Error(`SMS send failed: ${response.status} ${body}`);
  }

  const result = (await response.json()) as { data: { id: string } };
  log.info({ messageId: result.data.id, to: params.to }, 'SMS sent');
  return { messageId: result.data.id };
}

/**
 * Send a post-call SMS summary to the business owner.
 */
export async function sendCallSummarySms(params: {
  to: string;
  callerPhone: string;
  agentName: string;
  durationSeconds: number;
  summary: string;
  appointmentBooked: boolean;
}): Promise<{ messageId: string }> {
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

  return sendSms({ to: params.to, text });
}

// ═══════════════════════════════════════════════════════════════════
// INTEGRATION SECRETS
// ═══════════════════════════════════════════════════════════════════

/**
 * Store a BYO API key (OpenAI, ElevenLabs) as an Integration Secret.
 */
export async function createIntegrationSecret(
  encryptedApiKey: string,
  identifier: string,
  token: string,
): Promise<{ secretId: string }> {
  const client = createSubAccountClient(encryptedApiKey);

  log.info({ identifier }, 'Creating integration secret');

  const response = await (client.integrationSecrets.create as Function)({
    identifier,
    type: 'bearer',
    token,
  });

  const data = response as unknown as Record<string, unknown>;
  const inner = (data.data ?? data) as Record<string, unknown>;
  log.info({ secretId: inner.id, identifier }, 'Integration secret created');

  return { secretId: inner.id as string };
}

/**
 * Delete an integration secret.
 */
export async function deleteIntegrationSecret(
  encryptedApiKey: string,
  secretId: string,
): Promise<void> {
  const client = createSubAccountClient(encryptedApiKey);
  await client.integrationSecrets.delete(secretId);
  log.info({ secretId }, 'Integration secret deleted');
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * List conversations for an assistant (call history).
 */
export async function listConversations(
  encryptedApiKey: string,
  assistantId: string,
  limit: number = 50,
) {
  const client = createSubAccountClient(encryptedApiKey);

  const conversations = await (client.ai.conversations.list as Function)({
    'metadata->assistant_id': `eq.${assistantId}`,
    limit,
    order: 'last_message_at.desc',
  });

  return conversations as unknown;
}

// ═══════════════════════════════════════════════════════════════════
// ADD MESSAGES (Async Tool Results)
// ═══════════════════════════════════════════════════════════════════

/**
 * Inject messages into an active call (for async tool results).
 * Uses raw HTTP since this endpoint may not be in the SDK yet.
 */
export async function addMessagesToCall(
  encryptedApiKey: string,
  callControlId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<void> {
  const apiKey = decrypt(encryptedApiKey);

  log.info({ callControlId, messageCount: messages.length }, 'Adding messages to active call');

  const response = await fetch(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/ai_assistant_add_messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    log.error({ callControlId, status: response.status, body }, 'Failed to add messages to call');
    throw new Error(`Add messages failed: ${response.status} ${body}`);
  }

  log.info({ callControlId }, 'Messages added to call');
}
