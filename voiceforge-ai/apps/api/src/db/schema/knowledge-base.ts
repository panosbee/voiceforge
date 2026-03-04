// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Knowledge Base Documents Schema
// Tracks files/URLs/text uploaded to ElevenLabs KB
// ElevenLabs handles parsing, chunking, embedding & RAG natively
// ═══════════════════════════════════════════════════════════════════

import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { agents } from './agents';

// ── Enums ────────────────────────────────────────────────────────

export const kbDocStatusEnum = pgEnum('kb_doc_status', [
  'uploading',  // File is being processed
  'ready',      // Successfully indexed by ElevenLabs
  'failed',     // Upload/processing failed
  'deleting',   // Being removed
]);

export const kbDocSourceEnum = pgEnum('kb_doc_source', [
  'file',   // Uploaded file (PDF, DOCX, TXT, etc.)
  'url',    // Scraped from URL
  'text',   // Raw text input
]);

// ── Table ────────────────────────────────────────────────────────

export const knowledgeBaseDocuments = pgTable('knowledge_base_documents', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** Owner customer */
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),

  /** Agent this doc is attached to (nullable = standalone/unattached) */
  agentId: uuid('agent_id')
    .references(() => agents.id, { onDelete: 'set null' }),

  /** ElevenLabs document ID (returned from KB API) */
  elevenlabsDocId: text('elevenlabs_doc_id').notNull().unique(),

  /** Display name (filename or user-provided name) */
  name: text('name').notNull(),

  /** Source type */
  source: kbDocSourceEnum('source').notNull().default('file'),

  /** Original URL (for url source) */
  sourceUrl: text('source_url'),

  /** MIME type (for file source) */
  mimeType: text('mime_type'),

  /** File size in bytes (for file source) */
  fileSize: integer('file_size'),

  /** Processing status */
  status: kbDocStatusEnum('status').notNull().default('uploading'),

  /** Error message if status = failed */
  errorMessage: text('error_message'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────

export const knowledgeBaseDocumentsRelations = relations(knowledgeBaseDocuments, ({ one }) => ({
  customer: one(customers, {
    fields: [knowledgeBaseDocuments.customerId],
    references: [customers.id],
  }),
  agent: one(agents, {
    fields: [knowledgeBaseDocuments.agentId],
    references: [agents.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────

export type KBDocumentSelect = typeof knowledgeBaseDocuments.$inferSelect;
export type KBDocumentInsert = typeof knowledgeBaseDocuments.$inferInsert;
