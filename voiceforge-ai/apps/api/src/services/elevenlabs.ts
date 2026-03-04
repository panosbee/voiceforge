// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — ElevenLabs Service Layer
// Primary AI platform: agents, KB, handoff, conversations
// Telnyx handles ONLY phone numbers via SIP trunk
// ═══════════════════════════════════════════════════════════════════

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import * as fs from 'fs';

const log = createLogger('elevenlabs');

// ── Client singleton ─────────────────────────────────────────────

let _client: ElevenLabsClient | null = null;

/**
 * Get or create the ElevenLabs client.
 * Uses the master ELEVENLABS_API_KEY from env.
 */
export function getClient(): ElevenLabsClient {
  if (!_client) {
    if (!env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY === 'dev-placeholder') {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    _client = new ElevenLabsClient({
      apiKey: env.ELEVENLABS_API_KEY,
    });
    log.info('ElevenLabs client initialized');
  }
  return _client;
}

/**
 * Check if ElevenLabs is configured (API key present and not placeholder).
 */
export function isConfigured(): boolean {
  return !!env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY !== 'dev-placeholder';
}

// ═══════════════════════════════════════════════════════════════════
// AGENTS (Conversational AI)
// ═══════════════════════════════════════════════════════════════════

export interface CreateAgentParams {
  name: string;
  instructions: string;
  greeting: string;
  voiceId: string;
  language: string;
  /** TTS model: eleven_v3_conversational, eleven_multilingual_v2, eleven_flash_v2_5, eleven_turbo_v2_5 */
  ttsModel?: string;
  /** LLM model: gpt-4o-mini, gpt-5, claude-sonnet-4-5, gemini-2.5-flash, etc. */
  llmModel?: string;
  /** Agent IDs this agent can transfer to */
  transferTargets?: Array<{
    agentId: string;
    condition: string;
    transferMessage: string;
  }>;
  /** KB document IDs to attach */
  knowledgeBaseDocIds?: string[];
  /** Knowledge base docs with id+name (preferred over knowledgeBaseDocIds) */
  knowledgeBaseDocs?: Array<{ id: string; name: string }>;
  /** Webhook tools (server tools) */
  webhookTools?: Array<{
    name: string;
    description: string;
    url: string;
    method: string;
    parameters?: Record<string, unknown>;
  }>;
  /** Business owner's real phone — when set, adds transfer_to_number system tool */
  forwardPhoneNumber?: string;
  /** Languages this agent supports — used for language detection + consistency */
  supportedLanguages?: string[];
}

export interface CreateAgentResult {
  agentId: string;
  name: string;
}

/**
 * Create an ElevenLabs Conversational AI Agent.
 */
export async function createAgent(params: CreateAgentParams): Promise<CreateAgentResult> {
  const client = getClient();

  log.info({ name: params.name, voice: params.voiceId }, 'Creating ElevenLabs agent');

  // Build tools array
  const tools: Array<Record<string, unknown>> = [];

  // Add end_call system tool
  tools.push({
    type: 'system',
    name: 'end_call',
    description: 'Κλείσε την κλήση όταν ο πελάτης θέλει να τερματίσει τη συνομιλία',
    params: { systemToolType: 'end_call' },
  });

  // Add language detection system tool
  tools.push({
    type: 'system',
    name: 'language_detection',
    description: 'Αναγνώρισε τη γλώσσα του πελάτη',
    params: { systemToolType: 'language_detection' },
  });

  // Add agent transfer tools if targets specified
  if (params.transferTargets && params.transferTargets.length > 0) {
    tools.push({
      type: 'system',
      name: 'transfer_to_agent',
      description: 'Μεταφορά σε εξειδικευμένο πράκτορα',
      params: {
        systemToolType: 'transfer_to_agent',
        transfers: params.transferTargets.map((t) => ({
          agentId: t.agentId,
          condition: t.condition,
          delayMs: 1000,
          transferMessage: t.transferMessage,
          enableTransferredAgentFirstMessage: true,
        })),
      },
    });
  }

  // Add transfer to phone number tool if business owner phone is set
  if (params.forwardPhoneNumber) {
    tools.push({
      type: 'system',
      name: 'transfer_to_number',
      description: 'Μεταφέρει την κλήση στον ιδιοκτήτη της επιχείρησης όταν ο πελάτης ζητά να μιλήσει με άνθρωπο ή όταν δεν μπορείς να βοηθήσεις',
      params: {
        systemToolType: 'transfer_to_number',
        transfers: [
          {
            phoneNumber: params.forwardPhoneNumber,
            condition: 'Ο πελάτης ζητά να μιλήσει με άνθρωπο, ή το ζήτημα δεν μπορεί να επιλυθεί αυτόματα',
          },
        ],
        enableClientMessage: true,
      },
    });
  }

  // Add webhook tools (ElevenLabs expects type: 'webhook' with 'apiSchema')
  if (params.webhookTools) {
    for (const wt of params.webhookTools) {
      tools.push({
        type: 'webhook',
        name: wt.name,
        description: wt.description,
        apiSchema: {
          url: wt.url,
          method: wt.method?.toUpperCase() ?? 'POST',
          ...(wt.parameters ? {
            requestBodySchema: wt.parameters,
          } : {}),
        },
      });
    }
  }

  // Build knowledge base config — prefer knowledgeBaseDocs (has name), fallback to knowledgeBaseDocIds
  const knowledgeBase = params.knowledgeBaseDocs
    ? params.knowledgeBaseDocs.map((doc) => ({ type: 'file' as const, id: doc.id, name: doc.name }))
    : (params.knowledgeBaseDocIds ?? []).map((docId) => ({ type: 'file' as const, id: docId, name: docId }));

  try {
    const ttsModelId = params.ttsModel || env.ELEVENLABS_MODEL_ID || 'eleven_v3_conversational';
    const llmModel = params.llmModel || 'gpt-4o-mini';

    const response = await client.conversationalAi.agents.create({
      name: params.name,
      conversationConfig: {
        agent: {
          prompt: {
            prompt: params.instructions,
            llm: llmModel,
            ...(knowledgeBase.length > 0
              ? {
                  knowledgeBase,
                  rag: {
                    enabled: true,
                  },
                }
              : {}),
            ...(tools.length > 0 ? { tools } : {}),
          },
          firstMessage: params.greeting,
          language: params.language,
        },
        tts: {
          voiceId: params.voiceId,
          modelId: ttsModelId,
        },
        // Turn management: conversational mode allows caller to interrupt the agent naturally
        turn: {
          mode: {
            type: 'conversational',
          },
        },
        // Conversation limits
        conversation: {
          maxDurationSeconds: 1800, // 30 min max per call
        },
      },
    } as any);

    const agentId = (response as any).agentId ?? (response as any).agent_id;
    log.info({ agentId, name: params.name }, 'ElevenLabs agent created');

    return { agentId, name: params.name };
  } catch (error) {
    log.error({ error, name: params.name }, 'Failed to create ElevenLabs agent');
    throw error;
  }
}

/**
 * Update an existing ElevenLabs agent.
 */
export async function updateAgent(
  agentId: string,
  updates: Partial<CreateAgentParams>,
): Promise<void> {
  const client = getClient();

  log.info({ agentId }, 'Updating ElevenLabs agent');

  const body: Record<string, unknown> = {};

  if (updates.name) body.name = updates.name;

  const conversationConfig: Record<string, unknown> = {};
  const agentConfig: Record<string, unknown> = {};
  const promptConfig: Record<string, unknown> = {};

  if (updates.instructions) promptConfig.prompt = updates.instructions;
  if (updates.knowledgeBaseDocs) {
    promptConfig.knowledgeBase = updates.knowledgeBaseDocs.map((doc) => ({ type: 'file', id: doc.id, name: doc.name }));
    promptConfig.rag = { enabled: true };
  } else if (updates.knowledgeBaseDocIds) {
    promptConfig.knowledgeBase = updates.knowledgeBaseDocIds.map((id) => ({ type: 'file', id, name: id }));
    promptConfig.rag = { enabled: true };
  }

  // Build tools array for transfer targets and forward phone number
  if (updates.transferTargets !== undefined || updates.forwardPhoneNumber !== undefined) {
    const tools: Array<Record<string, unknown>> = [];

    // Always include base system tools
    tools.push({
      type: 'system',
      name: 'end_call',
      description: 'Κλείσε την κλήση όταν ο πελάτης θέλει να τερματίσει τη συνομιλία',
      params: { systemToolType: 'end_call' },
    });
    tools.push({
      type: 'system',
      name: 'language_detection',
      description: 'Αναγνώρισε τη γλώσσα του πελάτη',
      params: { systemToolType: 'language_detection' },
    });

    // Add agent transfer tool if targets specified
    if (updates.transferTargets && updates.transferTargets.length > 0) {
      tools.push({
        type: 'system',
        name: 'transfer_to_agent',
        description: 'Μεταφορά σε εξειδικευμένο πράκτορα',
        params: {
          systemToolType: 'transfer_to_agent',
          transfers: updates.transferTargets.map((t) => ({
            agentId: t.agentId,
            condition: t.condition,
            delayMs: 1000,
            transferMessage: t.transferMessage,
            enableTransferredAgentFirstMessage: true,
          })),
        },
      });
    }

    // Add transfer to phone number tool if business owner phone is set
    if (updates.forwardPhoneNumber) {
      tools.push({
        type: 'system',
        name: 'transfer_to_number',
        description: 'Μεταφέρει την κλήση στον ιδιοκτήτη της επιχείρησης όταν ο πελάτης ζητά να μιλήσει με άνθρωπο ή όταν δεν μπορείς να βοηθήσεις',
        params: {
          systemToolType: 'transfer_to_number',
          transfers: [
            {
              phoneNumber: updates.forwardPhoneNumber,
              condition: 'Ο πελάτης ζητά να μιλήσει με άνθρωπο, ή το ζήτημα δεν μπορεί να επιλυθεί αυτόματα',
            },
          ],
          enableClientMessage: true,
        },
      });
    }

    promptConfig.tools = tools;
  }

  if (Object.keys(promptConfig).length > 0) {
    agentConfig.prompt = promptConfig;
  }
  if (updates.greeting) agentConfig.firstMessage = updates.greeting;
  if (updates.language) agentConfig.language = updates.language;

  if (Object.keys(agentConfig).length > 0) {
    conversationConfig.agent = agentConfig;
  }

  if (updates.voiceId || updates.ttsModel) {
    conversationConfig.tts = {
      ...(updates.voiceId ? { voiceId: updates.voiceId } : {}),
      ...(updates.ttsModel ? { modelId: updates.ttsModel } : {}),
    };
  }

  // Always ensure conversational turn mode is set (allows interruption)
  conversationConfig.turn = {
    mode: {
      type: 'conversational',
    },
  };

  // Update LLM model if specified
  if (updates.llmModel) {
    if (!promptConfig.llm) {
      promptConfig.llm = updates.llmModel;
    }
  }

  if (Object.keys(conversationConfig).length > 0) {
    body.conversationConfig = conversationConfig;
  }

  try {
    await client.conversationalAi.agents.update(agentId, body);
    log.info({ agentId }, 'ElevenLabs agent updated');
  } catch (error) {
    log.error({ error, agentId }, 'Failed to update ElevenLabs agent');
    throw error;
  }
}

/**
 * Delete an ElevenLabs agent.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const client = getClient();

  log.info({ agentId }, 'Deleting ElevenLabs agent');

  try {
    await client.conversationalAi.agents.delete(agentId);
    log.info({ agentId }, 'ElevenLabs agent deleted');
  } catch (error) {
    log.error({ error, agentId }, 'Failed to delete ElevenLabs agent');
    throw error;
  }
}

/**
 * Get an ElevenLabs agent by ID.
 */
export async function getAgent(agentId: string): Promise<Record<string, unknown>> {
  const client = getClient();
  const response = await client.conversationalAi.agents.get(agentId);
  return response as unknown as Record<string, unknown>;
}

/**
 * List all ElevenLabs agents.
 */
export async function listAgents(): Promise<Array<Record<string, unknown>>> {
  const client = getClient();
  const response = await client.conversationalAi.agents.list();
  const data = response as unknown as Record<string, unknown>;
  return (data.agents ?? []) as Array<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════

export interface KBDocument {
  id: string;
  name: string;
}

/**
 * Upload a file to ElevenLabs Knowledge Base.
 * Accepts a file path (string) or a File/Blob (from multipart upload).
 * No need for: pdf-parse, chunking, embeddings, buckets, webhook search.
 * ElevenLabs handles ALL of that natively.
 */
export async function uploadKBDocument(
  file: string | Blob | File,
  fileName: string,
): Promise<KBDocument> {
  const client = getClient();

  log.info({ fileName }, 'Uploading KB document to ElevenLabs');

  try {
    // Accept both file path (string) and Blob/File
    const fileData = typeof file === 'string' ? fs.createReadStream(file) : file;

    const response = await (client.conversationalAi as Record<string, any>).knowledgeBase.documents.createFromFile({
      file: fileData,
      name: fileName,
    });

    const doc = response as unknown as Record<string, unknown>;
    const docId = (doc.id ?? doc.document_id) as string;

    log.info({ docId, fileName }, 'KB document uploaded');

    return { id: docId, name: fileName };
  } catch (error) {
    log.error({ error, fileName }, 'Failed to upload KB document');
    throw error;
  }
}

/**
 * Upload text content to ElevenLabs Knowledge Base.
 */
export async function uploadKBText(
  text: string,
  name: string,
): Promise<KBDocument> {
  const client = getClient();

  log.info({ name, textLength: text.length }, 'Uploading KB text to ElevenLabs');

  try {
    const response = await (client.conversationalAi as Record<string, any>).knowledgeBase.documents.createFromText({
      text,
      name,
    });

    const doc = response as unknown as Record<string, unknown>;
    const docId = (doc.id ?? doc.document_id) as string;

    log.info({ docId, name }, 'KB text uploaded');

    return { id: docId, name };
  } catch (error) {
    log.error({ error, name }, 'Failed to upload KB text');
    throw error;
  }
}

/**
 * Upload from URL to ElevenLabs Knowledge Base.
 */
export async function uploadKBUrl(
  url: string,
  name: string,
): Promise<KBDocument> {
  const client = getClient();

  log.info({ url, name }, 'Uploading KB from URL to ElevenLabs');

  try {
    const response = await (client.conversationalAi as Record<string, any>).knowledgeBase.documents.createFromUrl({
      url,
      name,
    });

    const doc = response as unknown as Record<string, unknown>;
    const docId = (doc.id ?? doc.document_id) as string;

    log.info({ docId, name }, 'KB URL document uploaded');

    return { id: docId, name };
  } catch (error) {
    log.error({ error, url }, 'Failed to upload KB from URL');
    throw error;
  }
}

/**
 * Delete a KB document.
 */
export async function deleteKBDocument(documentId: string): Promise<void> {
  const client = getClient();

  log.info({ documentId }, 'Deleting KB document');

  try {
    await (client.conversationalAi as Record<string, any>).knowledgeBase.documents.delete(documentId);
    log.info({ documentId }, 'KB document deleted');
  } catch (error) {
    log.error({ error, documentId }, 'Failed to delete KB document');
    throw error;
  }
}

/**
 * Attach KB documents to an agent (enables RAG).
 */
export async function attachKBToAgent(
  agentId: string,
  docs: Array<{ id: string; name: string }>,
): Promise<void> {
  log.info({ agentId, docCount: docs.length }, 'Attaching KB to agent');

  await updateAgent(agentId, {
    knowledgeBaseDocs: docs,
  });

  log.info({ agentId }, 'KB documents attached to agent');
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSATIONS / ANALYTICS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get conversations for an agent (call history).
 */
export async function getConversations(
  agentId: string,
  limit: number = 50,
): Promise<Array<Record<string, unknown>>> {
  const client = getClient();

  try {
    const response = await client.conversationalAi.conversations.list({
      agentId,
    });

    const data = response as unknown as Record<string, unknown>;
    return (data.conversations ?? []) as Array<Record<string, unknown>>;
  } catch (error) {
    log.error({ error, agentId }, 'Failed to list conversations');
    throw error;
  }
}

/**
 * Get a specific conversation details (transcript, etc.).
 */
export async function getConversation(
  conversationId: string,
): Promise<Record<string, unknown>> {
  const client = getClient();

  const response = await client.conversationalAi.conversations.get(conversationId);
  return response as unknown as Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// VOICES
// ═══════════════════════════════════════════════════════════════════

/**
 * List available voices (useful for voice picker UI).
 */
export async function listVoices(): Promise<Array<{ voiceId: string; name: string; language: string }>> {
  const client = getClient();

  try {
    const response = await client.voices.getAll();
    const data = response as unknown as Record<string, unknown>;
    const voices = (data.voices ?? []) as Array<Record<string, unknown>>;

    return voices.map((v) => ({
      voiceId: v.voice_id as string,
      name: v.name as string,
      language: ((v.labels as Record<string, string>)?.language ?? 'unknown') as string,
    }));
  } catch (error) {
    log.error({ error }, 'Failed to list voices');
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEXT-TO-SPEECH PREVIEW
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a TTS audio preview for a voice.
 * Returns audio as ArrayBuffer (MP3).
 * Used for voice preview in the UI before creating/editing agents.
 */
export async function generateVoicePreview(
  voiceId: string,
  text: string,
  modelId: string = 'eleven_flash_v2_5',
): Promise<ArrayBuffer> {
  if (!isConfigured()) {
    throw new Error('ElevenLabs not configured');
  }

  log.info({ voiceId, textLength: text.length, modelId }, 'Generating TTS voice preview');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    log.error({ status: response.status, body, voiceId }, 'TTS preview failed');
    throw new Error(`TTS preview failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  log.info({ voiceId, bytes: buffer.byteLength }, 'TTS preview generated');
  return buffer;
}

// ═══════════════════════════════════════════════════════════════════
// PHONE NUMBERS — SIP TRUNK (Telnyx → ElevenLabs)
// ═══════════════════════════════════════════════════════════════════

/**
 * Import a phone number into ElevenLabs via SIP trunk.
 * This tells ElevenLabs to accept inbound SIP calls for this number
 * and route them to the specified agent.
 *
 * Flow: Telnyx purchases +30 number → Telnyx SIP → ElevenLabs SIP trunk → Agent
 */
export async function importPhoneNumber(params: {
  phoneNumber: string;
  agentId: string;
  label: string;
  /** Telnyx SIP termination URI for outbound calls from ElevenLabs */
  terminationUri?: string;
}): Promise<{ phoneNumberId: string }> {
  const client = getClient();

  log.info({ phoneNumber: params.phoneNumber, agentId: params.agentId, label: params.label }, 'Importing phone number via SIP trunk');

  const result = await client.conversationalAi.phoneNumbers.create({
    provider: 'sip_trunk',
    phoneNumber: params.phoneNumber,
    label: params.label,
    inboundTrunkConfig: {
      // Telnyx SIP IPs — allow inbound SIP INVITE from Telnyx infrastructure
      allowedAddresses: [
        '52.2.22.216/30',     // Telnyx US East
        '52.42.159.76/30',    // Telnyx US West
        '169.55.46.12/30',    // Telnyx EU
        '198.23.143.0/24',    // Telnyx Additional
      ],
    },
    outboundTrunkConfig: params.terminationUri ? {
      // Outbound: ElevenLabs → Telnyx SIP → PSTN
      address: params.terminationUri,
    } : undefined,
  });

  log.info({ phoneNumberId: result.phoneNumberId, phoneNumber: params.phoneNumber }, 'Phone number imported to ElevenLabs');

  // Assign agent to this phone number
  await client.conversationalAi.phoneNumbers.update(result.phoneNumberId, {
    agentId: params.agentId,
  });

  log.info({ phoneNumberId: result.phoneNumberId, agentId: params.agentId }, 'Agent assigned to phone number');

  return { phoneNumberId: result.phoneNumberId };
}

/**
 * Update the agent assigned to a phone number.
 */
export async function updatePhoneNumberAgent(
  phoneNumberId: string,
  agentId: string,
): Promise<void> {
  const client = getClient();

  log.info({ phoneNumberId, agentId }, 'Updating phone number agent assignment');

  await client.conversationalAi.phoneNumbers.update(phoneNumberId, {
    agentId,
  });

  log.info({ phoneNumberId, agentId }, 'Phone number agent updated');
}

/**
 * Delete a phone number from ElevenLabs.
 */
export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  const client = getClient();

  log.info({ phoneNumberId }, 'Deleting phone number from ElevenLabs');
  await client.conversationalAi.phoneNumbers.delete(phoneNumberId);
  log.info({ phoneNumberId }, 'Phone number deleted from ElevenLabs');
}

/**
 * List all phone numbers registered in ElevenLabs.
 */
export async function listPhoneNumbers(): Promise<Array<{
  phoneNumberId: string;
  phoneNumber: string;
  agentId: string | null;
  label: string;
  provider: string;
}>> {
  const client = getClient();

  const numbers = await client.conversationalAi.phoneNumbers.list();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return numbers.map((n: any) => ({
    phoneNumberId: n.phoneNumberId ?? n.phone_number_id ?? '',
    phoneNumber: n.phoneNumber ?? n.phone_number ?? '',
    agentId: n.agentId ?? n.agent_id ?? null,
    label: n.label ?? '',
    provider: n.provider ?? 'sip_trunk',
  }));
}
