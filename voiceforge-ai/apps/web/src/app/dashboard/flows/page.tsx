// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Flow Builder Page (Expert Mode)
// Card-based multi-agent flows with routing rules
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Input, Textarea, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { getIndustryLabels } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  GitBranch, Plus, Trash2, Play, ArrowRight, ChevronDown, ChevronUp,
  Bot, Star, Save, AlertCircle, Loader2, CheckCircle2, MessageCircle, Pencil, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { GREEK_VOICES, ELEVENLABS_LLM_MODELS, ELEVENLABS_TTS_MODELS, DEFAULT_LLM_MODEL, DEFAULT_TTS_MODEL } from '@voiceforge/shared';
import type { ApiResponse, AgentFlow, FlowWithAgents, FlowAgentCard, RoutingRule, FlowRoutingRules } from '@voiceforge/shared';
import { AgentTestWidget } from '@/components/agent-test-widget';
import { KnowledgeBaseUpload } from '@/components/knowledge-base-upload';

// ═══════════════════════════════════════════════════════════════════
// Option arrays for selectors
// ═══════════════════════════════════════════════════════════════════

const llmOptions = ELEVENLABS_LLM_MODELS.map((m) => ({
  value: m.id,
  label: `${m.name} — ${m.description}`,
}));
const ttsOptions = ELEVENLABS_TTS_MODELS.map((m) => ({
  value: m.id,
  label: `${m.name} — ${m.description}`,
}));

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface LocalAgent extends FlowAgentCard {
  isExpanded: boolean;
}

interface LocalRule {
  targetAgentId: string;
  condition: string;
  transferMessage: string;
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════

export default function FlowsPage() {
  const { t } = useI18n();
  const [flows, setFlows] = useState<AgentFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

  // Flow builder state
  const [flowData, setFlowData] = useState<AgentFlow | null>(null);
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [routingRules, setRoutingRules] = useState<FlowRoutingRules>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [testingAgent, setTestingAgent] = useState<{ id: string; name: string } | null>(null);

  // ── Load Flows List ──────────────────────────────────────────────

  const loadFlows = useCallback(async () => {
    try {
      const result = await api.get<ApiResponse<AgentFlow[]>>('/api/flows');
      if (result.success && result.data) {
        setFlows(result.data);
        // Auto-open first flow
        if (result.data.length > 0 && !activeFlowId) {
          setActiveFlowId(result.data[0]!.id);
        }
      }
    } catch {
      toast.error(t.flows.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [activeFlowId]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // ── Load Flow Detail (when activeFlowId changes) ────────────────

  const loadFlowDetail = useCallback(async (flowId: string) => {
    try {
      const result = await api.get<ApiResponse<FlowWithAgents>>(`/api/flows/${flowId}`);
      if (result.success && result.data) {
        setFlowData(result.data.flow);
        setAgents(result.data.agents.map((a) => ({ ...a, isExpanded: false })));
        setRoutingRules(result.data.flow.routingRules);
      }
    } catch {
      toast.error(t.flows.loadFlowError);
    }
  }, []);

  useEffect(() => {
    if (activeFlowId) {
      loadFlowDetail(activeFlowId);
    }
  }, [activeFlowId, loadFlowDetail]);

  // ── Create Flow ──────────────────────────────────────────────────

  const handleCreateFlow = async () => {
    const name = prompt(t.flows.flowNamePrompt);
    if (!name) return;

    try {
      const result = await api.post<ApiResponse<AgentFlow>>('/api/flows', { name, description: '' });
      if (result.success && result.data) {
        toast.success(`"${name}" ${t.flows.flowCreated}`);
        setFlows((prev) => [result.data!, ...prev]);
        setActiveFlowId(result.data.id);
      }
    } catch {
      toast.error(t.flows.flowCreateError);
    }
  };

  // ── Delete Flow ──────────────────────────────────────────────────

  const handleDeleteFlow = async (flowId: string, name: string) => {
    if (!confirm(`${t.flows.deleteConfirm} "${name}"; ${t.flows.deleteConfirmSuffix}`)) return;

    try {
      await api.delete<ApiResponse<void>>(`/api/flows/${flowId}`);
      toast.success(`"${name}" ${t.flows.flowDeleted}`);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
      if (activeFlowId === flowId) {
        setActiveFlowId(null);
        setFlowData(null);
        setAgents([]);
        setRoutingRules({});
      }
    } catch {
      toast.error(t.flows.flowDeleteError);
    }
  };

  // ── Add Agent to Flow ────────────────────────────────────────────

  const handleAddAgent = async () => {
    if (!activeFlowId) return;
    setIsAddingAgent(true);

    try {
      const defaultName = `Agent ${agents.length + 1}`;
      const defaultInstructions = t.flows.defaultInstructions;

      const result = await api.post<ApiResponse<{ id: string; name: string; elevenlabsAgentId: string; isEntryAgent: boolean }>>(
        `/api/flows/${activeFlowId}/add-agent`,
        {
          name: defaultName,
          industry: 'general',
          voiceId: GREEK_VOICES[0].id,
          greeting: t.flows.defaultGreeting,
          instructions: defaultInstructions,
          language: 'el',
        },
      );

      if (result.success && result.data) {
        const newAgent: LocalAgent = {
          id: result.data.id,
          name: result.data.name,
          industry: 'general',
          voiceId: GREEK_VOICES[0].id,
          greeting: t.flows.defaultGreeting,
          instructions: defaultInstructions,
          status: 'active',
          elevenlabsAgentId: result.data.elevenlabsAgentId,
          isEntryAgent: result.data.isEntryAgent,
          routingRules: [],
          kbDocCount: 0,
          isExpanded: true, // Auto-expand new card
        };
        setAgents((prev) => [...prev, newAgent]);
        toast.success(`Agent "${defaultName}" ${t.flows.agentAdded}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t.flows.agentAddError;
      toast.error(msg);
    } finally {
      setIsAddingAgent(false);
    }
  };

  // ── Remove Agent from Flow ───────────────────────────────────────

  const handleRemoveAgent = async (agentId: string, agentName: string) => {
    if (!activeFlowId) return;
    if (!confirm(`${t.flows.removeConfirm} "${agentName}" ${t.flows.removeConfirmSuffix}`)) return;

    try {
      await api.delete<ApiResponse<void>>(`/api/flows/${activeFlowId}/agents/${agentId}`);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      // Remove routing rules referencing this agent
      setRoutingRules((prev) => {
        const next: FlowRoutingRules = {};
        for (const [sourceId, rules] of Object.entries(prev)) {
          if (sourceId === agentId) continue;
          next[sourceId] = rules.filter((r) => r.targetAgentId !== agentId);
        }
        return next;
      });
      toast.success(`"${agentName}" ${t.flows.agentRemoved}`);
    } catch {
      toast.error(t.flows.agentRemoveError);
    }
  };

  // ── Update Agent (inline edit) ───────────────────────────────────

  const handleUpdateAgent = async (agentId: string, updates: Partial<{
    name: string;
    industry: string;
    voiceId: string;
    greeting: string;
    instructions: string;
    ttsModel: string;
    llmModel: string;
  }>) => {
    try {
      const result = await api.patch<ApiResponse<{ id: string; name: string }>>(`/api/agents/${agentId}`, updates);
      if (result.success) {
        // Apply changes to local agent state
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a)));
        toast.success(t.flows.agentUpdated);
      }
    } catch {
      toast.error(t.flows.agentUpdateError);
    }
  };

  // ── Save Routing Rules ───────────────────────────────────────────

  const handleSaveRules = async () => {
    if (!activeFlowId) return;
    setIsSaving(true);

    try {
      await api.patch<ApiResponse<AgentFlow>>(`/api/flows/${activeFlowId}`, {
        routingRules,
        agentOrder: agents.map((a) => a.id),
        entryAgentId: agents.find((a) => a.isEntryAgent)?.id ?? agents[0]?.id ?? null,
      });
      toast.success(t.flows.rulesSaved);
    } catch {
      toast.error(t.flows.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Deploy Flow ──────────────────────────────────────────────────

  const handleDeploy = async () => {
    if (!activeFlowId) return;
    if (agents.length < 2) {
      toast.error(t.flows.needTwoAgents);
      return;
    }

    // Save rules first
    await handleSaveRules();

    setIsDeploying(true);
    try {
      const result = await api.post<ApiResponse<{ deployed: boolean; agentCount: number; results: Array<{ agentId: string; name: string; status: string }> }>>(
        `/api/flows/${activeFlowId}/deploy`,
      );

      if (result.success && result.data?.deployed) {
        const failed = result.data.results?.filter((r) => r.status === 'error') ?? [];
        if (failed.length > 0) {
          toast.warning(`Deploy: ${failed.length} ${t.flows.deployPartialErrors}`);
        } else {
          toast.success(`Deploy: ${result.data.agentCount} ${t.flows.deploySuccess}`);
        }
        // Reload flow
        loadFlowDetail(activeFlowId);
        loadFlows();
      }
    } catch {
      toast.error(t.flows.deployError);
    } finally {
      setIsDeploying(false);
    }
  };

  // ── Routing Rule Helpers ─────────────────────────────────────────

  const addRule = (sourceAgentId: string) => {
    const otherAgents = agents.filter((a) => a.id !== sourceAgentId);
    if (otherAgents.length === 0) {
      toast.error(t.flows.needOneMoreAgent);
      return;
    }

    setRoutingRules((prev) => ({
      ...prev,
      [sourceAgentId]: [
        ...(prev[sourceAgentId] || []),
        {
          targetAgentId: otherAgents[0]!.id,
          condition: '',
          transferMessage: '',
        },
      ],
    }));
  };

  const updateRule = (sourceAgentId: string, ruleIndex: number, field: keyof LocalRule, value: string) => {
    setRoutingRules((prev) => {
      const rules = [...(prev[sourceAgentId] || [])];
      const existing = rules[ruleIndex]!;
      rules[ruleIndex] = { targetAgentId: existing.targetAgentId, condition: existing.condition, transferMessage: existing.transferMessage, [field]: value };
      return { ...prev, [sourceAgentId]: rules };
    });
  };

  const removeRule = (sourceAgentId: string, ruleIndex: number) => {
    setRoutingRules((prev) => {
      const rules = [...(prev[sourceAgentId] || [])];
      rules.splice(ruleIndex, 1);
      return { ...prev, [sourceAgentId]: rules };
    });
  };

  // ── Toggle Expand ────────────────────────────────────────────────

  const toggleExpand = (agentId: string) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, isExpanded: !a.isExpanded } : a)));
  };

  const setEntryAgent = (agentId: string) => {
    setAgents((prev) => prev.map((a) => ({ ...a, isEntryAgent: a.id === agentId })));
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.flows.title}
        description={t.flows.description}
        action={
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreateFlow}>
            {t.flows.newFlow}
          </Button>
        }
      />

      {/* Flow selector tabs */}
      {flows.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {flows.map((flow) => (
            <div
              key={flow.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveFlowId(flow.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveFlowId(flow.id); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border cursor-pointer ${
                activeFlowId === flow.id
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-tertiary'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              {flow.name}
              {flow.isActive && <Badge variant="success">Active</Badge>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFlow(flow.id, flow.name);
                }}
                className="ml-1 p-0.5 rounded hover:bg-danger-50 hover:text-danger-600 transition-colors"
                title={t.flows.deleteFlowTitle}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {flows.length === 0 && (
        <EmptyState
          icon={<GitBranch className="w-12 h-12" />}
          title={t.flows.noFlows}
          description={t.flows.noFlowsDescription}
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreateFlow}>
              {t.flows.createFlow}
            </Button>
          }
        />
      )}

      {/* Flow Builder */}
      {activeFlowId && flowData && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">
                {agents.length} / {flowData.maxAgents} agents
              </span>
              {agents.length < flowData.maxAgents && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={isAddingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={handleAddAgent}
                  disabled={isAddingAgent}
                >
                  {t.flows.addAgent}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                onClick={handleSaveRules}
                disabled={isSaving || agents.length === 0}
              >
                {t.flows.save}
              </Button>
              <Button
                size="sm"
                leftIcon={isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                onClick={handleDeploy}
                disabled={isDeploying || agents.length < 2}
              >
                {t.flows.deployFlow}
              </Button>
            </div>
          </div>

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <Card className="border-dashed border-2 cursor-pointer hover:border-brand-300 transition-colors" padding="lg">
              <button onClick={handleAddAgent} className="w-full flex flex-col items-center gap-2 text-text-tertiary hover:text-brand-600 transition-colors">
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">{t.flows.addFirstAgent}</span>
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {agents.map((agent, index) => (
                <AgentFlowCard
                  key={agent.id}
                  agent={agent}
                  index={index}
                  allAgents={agents}
                  rules={routingRules[agent.id] || []}
                  onToggleExpand={() => toggleExpand(agent.id)}
                  onSetEntry={() => setEntryAgent(agent.id)}
                  onRemove={() => handleRemoveAgent(agent.id, agent.name)}
                  onUpdate={(updates) => handleUpdateAgent(agent.id, updates)}
                  onTest={() => {
                    if (agent.elevenlabsAgentId && !agent.elevenlabsAgentId.startsWith('dev_')) {
                      setTestingAgent({ id: agent.elevenlabsAgentId, name: agent.name });
                    } else {
                      toast.error(t.flows.noElevenLabsId);
                    }
                  }}
                  onAddRule={() => addRule(agent.id)}
                  onUpdateRule={(ruleIdx, field, value) => updateRule(agent.id, ruleIdx, field, value)}
                  onRemoveRule={(ruleIdx) => removeRule(agent.id, ruleIdx)}
                />
              ))}

              {/* Add another agent placeholder */}
              {agents.length < flowData.maxAgents && (
                <Card className="border-dashed border-2 cursor-pointer hover:border-brand-300 transition-colors" padding="sm">
                  <button
                    onClick={handleAddAgent}
                    disabled={isAddingAgent}
                    className="w-full flex items-center justify-center gap-2 py-3 text-text-tertiary hover:text-brand-600 transition-colors"
                  >
                    {isAddingAgent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    <span className="text-sm font-medium">{t.flows.addAgent}</span>
                  </button>
                </Card>
              )}
            </div>
          )}

          {/* Flow visualization summary */}
          {agents.length >= 2 && (
            <Card padding="md" className="bg-surface-secondary">
              <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-brand-600" />
                {t.flows.flowArchitecture}
              </h4>
              <div className="space-y-1">
                {agents.map((agent) => {
                  const rules = routingRules[agent.id] || [];
                  return (
                    <div key={agent.id} className="text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">
                        {agent.isEntryAgent && '⭐ '}
                        {agent.name}
                      </span>
                      {rules.length > 0 && (
                        <span className="ml-2">
                          → {rules.map((r) => {
                            const target = agents.find((a) => a.id === r.targetAgentId);
                            return target?.name ?? '???';
                          }).join(', ')}
                        </span>
                      )}
                      {rules.length === 0 && <span className="ml-2 text-text-tertiary">{t.flows.noRules}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Test Widget Modal */}
      {testingAgent && (
        <AgentTestWidget
          agentId={testingAgent.id}
          agentName={testingAgent.name}
          onClose={() => setTestingAgent(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Agent Flow Card Component
// ═══════════════════════════════════════════════════════════════════

interface AgentFlowCardProps {
  agent: LocalAgent;
  index: number;
  allAgents: LocalAgent[];
  rules: RoutingRule[];
  onToggleExpand: () => void;
  onSetEntry: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<{ name: string; industry: string; voiceId: string; greeting: string; instructions: string; ttsModel: string; llmModel: string }>) => void;
  onTest: () => void;
  onAddRule: () => void;
  onUpdateRule: (ruleIndex: number, field: keyof LocalRule, value: string) => void;
  onRemoveRule: (ruleIndex: number) => void;
}

function AgentFlowCard({
  agent,
  index,
  allAgents,
  rules,
  onToggleExpand,
  onSetEntry,
  onRemove,
  onUpdate,
  onTest,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}: AgentFlowCardProps) {
  const { t } = useI18n();
  const industryLabels = getIndustryLabels(t);
  const industryOptions = Object.entries(industryLabels).map(([value, label]) => ({ value, label }));
  const voiceOptions = GREEK_VOICES.map((v) => ({
    value: v.id,
    label: `${v.name} (${v.gender === 'female' ? t.flows.female : t.flows.male})`,
  }));
  const voice = GREEK_VOICES.find((v) => v.id === agent.voiceId);
  const otherAgents = allAgents.filter((a) => a.id !== agent.id);

  // Local edit state
  const [editName, setEditName] = useState(agent.name);
  const [editIndustry, setEditIndustry] = useState(agent.industry);
  const [editVoiceId, setEditVoiceId] = useState(agent.voiceId);
  const [editGreeting, setEditGreeting] = useState(agent.greeting);
  const [editInstructions, setEditInstructions] = useState(agent.instructions);
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  // Track if local values differ from saved values
  const hasChanges =
    editName !== agent.name ||
    editIndustry !== agent.industry ||
    editVoiceId !== agent.voiceId ||
    editGreeting !== agent.greeting ||
    editInstructions !== agent.instructions;

  // Sync local state when agent prop changes externally
  useEffect(() => {
    setEditName(agent.name);
    setEditIndustry(agent.industry);
    setEditVoiceId(agent.voiceId);
    setEditGreeting(agent.greeting);
    setEditInstructions(agent.instructions);
  }, [agent.name, agent.industry, agent.voiceId, agent.greeting, agent.instructions]);

  const handleSaveAgent = async () => {
    if (!editName.trim()) {
      toast.error(t.flows.nameRequired);
      return;
    }
    setIsSavingAgent(true);
    try {
      await onUpdate({
        name: editName.trim(),
        industry: editIndustry,
        voiceId: editVoiceId,
        greeting: editGreeting.trim(),
        instructions: editInstructions.trim(),
      });
    } finally {
      setIsSavingAgent(false);
    }
  };

  return (
    <Card padding="none" hover>
      {/* Header — always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-secondary/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          {/* Index badge */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            agent.isEntryAgent
              ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300'
              : 'bg-surface-tertiary text-text-secondary'
          }`}>
            {index + 1}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text-primary">{agent.name}</h3>
              {agent.isEntryAgent && (
                <Badge variant="brand">
                  <Star className="w-3 h-3 mr-0.5" /> Entry
                </Badge>
              )}
              <Badge variant={agent.status === 'active' ? 'success' : 'default'}>
                {agent.status === 'active' ? t.flows.activeStatus : agent.status}
              </Badge>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">
              {voice ? `${voice.name} (${voice.gender === 'female' ? t.flows.femaleShort : t.flows.maleShort})` : agent.voiceId}
              {' • '}
              {industryLabels[agent.industry] ?? agent.industry}
              {agent.kbDocCount > 0 && ` • ${agent.kbDocCount} KB docs`}
              {rules.length > 0 && ` • ${rules.length} ${t.flows.rules}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {agent.elevenlabsAgentId && (
            <CheckCircle2 className="w-4 h-4 text-success-500" />
          )}
          {agent.isExpanded ? <ChevronUp className="w-5 h-5 text-text-tertiary" /> : <ChevronDown className="w-5 h-5 text-text-tertiary" />}
        </div>
      </button>

      {/* Expanded content — EDITABLE */}
      {agent.isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Agent editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.agentName}</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t.flows.namePlaceholder}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.industryCat}</label>
              <Select
                value={editIndustry}
                onChange={(e) => setEditIndustry(e.target.value)}
                options={industryOptions}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.voice}</label>
              <Select
                value={editVoiceId}
                onChange={(e) => setEditVoiceId(e.target.value)}
                options={voiceOptions}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.elevenlabsId}</label>
              <p className="text-xs text-text-tertiary pt-2 font-mono truncate">
                {agent.elevenlabsAgentId || t.flows.willCreateOnDeploy}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.greeting}</label>
              <Input
                value={editGreeting}
                onChange={(e) => setEditGreeting(e.target.value)}
                placeholder={t.flows.greetingPlaceholder}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-text-tertiary mb-1 block">{t.flows.instructions}</label>
              <Textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder={t.flows.instructionsPlaceholder}
                rows={4}
              />
            </div>
          </div>

          {/* Save button — only shows when there are changes */}
          {hasChanges && (
            <div className="flex justify-end">
              <Button
                size="sm"
                leftIcon={isSavingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                onClick={handleSaveAgent}
                disabled={isSavingAgent}
              >
                {t.flows.saveChanges}
              </Button>
            </div>
          )}

          {/* Knowledge Base */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1 mb-2">
              <BookOpen className="w-4 h-4 text-brand-500" />
              {t.flows.knowledgeBaseTitle}
            </h4>
            <p className="text-xs text-text-tertiary mb-3">
              {t.flows.knowledgeBaseHint}
            </p>
            <KnowledgeBaseUpload
              agentId={agent.id}
              compact
            />
          </div>

          {/* Routing Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1">
                <ArrowRight className="w-4 h-4 text-brand-500" />
                {t.flows.routingRules}
              </h4>
              {otherAgents.length > 0 && (
                <Button size="sm" variant="ghost" leftIcon={<Plus className="w-3 h-3" />} onClick={onAddRule}>
                  {t.flows.newRule}
                </Button>
              )}
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-text-tertiary italic">
                {otherAgents.length === 0
                  ? t.flows.addMoreAgentsForRules
                  : t.flows.noRulesHandleAll
                }
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, ruleIdx) => (
                  <div key={ruleIdx} className="flex items-start gap-2 p-3 rounded-lg bg-surface-secondary border border-border">
                    <div className="flex-1 space-y-2">
                      {/* Condition */}
                      <div>
                        <label className="text-xs text-text-tertiary">{t.flows.ruleCondition}</label>
                        <Input
                          value={rule.condition}
                          onChange={(e) => onUpdateRule(ruleIdx, 'condition', e.target.value)}
                          placeholder={t.flows.conditionPlaceholder}
                          className="mt-1"
                        />
                      </div>

                      {/* Target agent */}
                      <div>
                        <label className="text-xs text-text-tertiary">{t.flows.ruleTransferTo}</label>
                        <Select
                          value={rule.targetAgentId}
                          onChange={(e) => onUpdateRule(ruleIdx, 'targetAgentId', e.target.value)}
                          options={otherAgents.map((a) => ({ value: a.id, label: a.name }))}
                          className="mt-1"
                        />
                      </div>

                      {/* Transfer message */}
                      <div>
                        <label className="text-xs text-text-tertiary">{t.flows.ruleMessage}</label>
                        <Input
                          value={rule.transferMessage}
                          onChange={(e) => onUpdateRule(ruleIdx, 'transferMessage', e.target.value)}
                          placeholder={t.flows.messagePlaceholder}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveRule(ruleIdx)}
                      className="p-1.5 rounded hover:bg-danger-50 hover:text-danger-600 text-text-tertiary transition-colors shrink-0 mt-4"
                      title=""
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              {!agent.isEntryAgent && (
                <Button size="sm" variant="ghost" leftIcon={<Star className="w-3.5 h-3.5" />} onClick={onSetEntry}>
                  {t.flows.setAsEntry}
                </Button>
              )}
              {agent.elevenlabsAgentId && !agent.elevenlabsAgentId.startsWith('dev_') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  leftIcon={<MessageCircle className="w-3.5 h-3.5" />}
                  onClick={onTest}
                >
                  {t.flows.test}
                </Button>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger-500 hover:text-danger-600 hover:bg-danger-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={onRemove}
            >
              {t.flows.remove}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
