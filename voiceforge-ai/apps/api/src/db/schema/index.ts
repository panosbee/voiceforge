// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Schema Index
// Re-exports all tables, relations, enums, and types
// ═══════════════════════════════════════════════════════════════════

export {
  customers,
  customersRelations,
  industryEnum,
  planEnum,
  type CustomerSelect,
  type CustomerInsert,
} from './customers';

export {
  agents,
  agentsRelations,
  agentStatusEnum,
  aiProviderEnum,
  type AgentSelect,
  type AgentInsert,
} from './agents';

export {
  calls,
  callsRelations,
  callStatusEnum,
  callDirectionEnum,
  type CallSelect,
  type CallInsert,
} from './calls';

export {
  appointments,
  appointmentsRelations,
  appointmentStatusEnum,
  type AppointmentSelect,
  type AppointmentInsert,
} from './appointments';

export {
  webhookEvents,
  type WebhookEventSelect,
  type WebhookEventInsert,
} from './webhook-events';

export {
  knowledgeBaseDocuments,
  knowledgeBaseDocumentsRelations,
  kbDocStatusEnum,
  kbDocSourceEnum,
  type KBDocumentSelect,
  type KBDocumentInsert,
} from './knowledge-base';

export {
  agentFlows,
  agentFlowsRelations,
  type AgentFlowSelect,
  type AgentFlowInsert,
} from './agent-flows';

export {
  auditLogs,
  auditActionEnum,
  type AuditLogSelect,
  type AuditLogInsert,
} from './audit-logs';

export {
  callerMemories,
  callerMemoriesRelations,
  type CallerMemorySelect,
  type CallerMemoryInsert,
} from './caller-memories';

export {
  licenseKeys,
  licenseKeysRelations,
  licenseStatusEnum,
  type LicenseKeySelect,
  type LicenseKeyInsert,
} from './license-keys';

export {
  pendingRegistrations,
  type PendingRegistrationSelect,
  type PendingRegistrationInsert,
} from './pending-registrations';
