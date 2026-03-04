// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Knowledge Base Types
// Shared types for KB documents (ElevenLabs native RAG)
// ═══════════════════════════════════════════════════════════════════

/** Source type of a KB document */
export type KBDocSource = 'file' | 'url' | 'text';

/** Processing status of a KB document */
export type KBDocStatus = 'uploading' | 'ready' | 'failed' | 'deleting';

/** Knowledge Base document record */
export interface KBDocument {
  id: string;
  customerId: string;
  agentId: string | null;
  elevenlabsDocId: string;
  name: string;
  source: KBDocSource;
  sourceUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: KBDocStatus;
  errorMessage: string | null;
  createdAt: string; // ISO string in API responses
}

/** Summary for list views */
export interface KBDocumentSummary {
  id: string;
  elevenlabsDocId: string;
  name: string;
  source: KBDocSource;
  sourceUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: KBDocStatus;
  agentId: string | null;
  createdAt: string;
}

/** Input for URL upload */
export interface UploadKBUrlInput {
  url: string;
  name: string;
  agentId?: string | null;
}

/** Input for text upload */
export interface UploadKBTextInput {
  text: string;
  name: string;
  agentId?: string | null;
}

/** Input for attaching a doc to an agent */
export interface AttachKBDocInput {
  agentId: string | null;
}
