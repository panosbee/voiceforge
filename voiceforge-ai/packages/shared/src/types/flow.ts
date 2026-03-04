// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Flow Types (Expert Mode)
// Card-based multi-agent flows with routing rules
// ═══════════════════════════════════════════════════════════════════

/** A routing rule from one agent to another */
export interface RoutingRule {
  /** Target agent DB id */
  targetAgentId: string;
  /** Human-readable condition, e.g. "Ο πελάτης ρωτάει για οικονομικά" */
  condition: string;
  /** Message spoken during transfer, e.g. "Σας μεταφέρω στον λογιστή μας..." */
  transferMessage: string;
}

/** Routing rules indexed by source agent ID */
export type FlowRoutingRules = Record<string, RoutingRule[]>;

/** Agent Flow — multi-agent configuration */
export interface AgentFlow {
  id: string;
  customerId: string;
  name: string;
  description: string | null;
  entryAgentId: string | null;
  isActive: boolean;
  agentOrder: string[]; // agent IDs in display order
  routingRules: FlowRoutingRules;
  maxAgents: number;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a flow */
export interface CreateFlowInput {
  name: string;
  description?: string;
}

/** Payload for updating a flow */
export interface UpdateFlowInput {
  name?: string;
  description?: string;
  entryAgentId?: string | null;
  agentOrder?: string[];
  routingRules?: FlowRoutingRules;
  isActive?: boolean;
}

/** Agent card data inside a flow (summary for flow builder UI) */
export interface FlowAgentCard {
  id: string;
  name: string;
  industry: string;
  voiceId: string;
  greeting: string;
  instructions: string;
  status: string;
  elevenlabsAgentId: string | null;
  isEntryAgent: boolean;
  routingRules: RoutingRule[];
  kbDocCount: number;
}

/** Full flow with agents for the builder UI */
export interface FlowWithAgents {
  flow: AgentFlow;
  agents: FlowAgentCard[];
}
