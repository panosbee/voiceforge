// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agents Management Page
// List, create, edit, delete AI agents
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Spinner, EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatPhoneNumber, getIndustryLabels } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Bot, Plus, Phone, Trash2, Pencil, Cpu, MessageCircle, PhoneCall, PhoneForwarded } from 'lucide-react';
import { toast } from 'sonner';
import { GREEK_VOICES, AI_PROVIDER } from '@voiceforge/shared';
import type { AgentSummary, ApiResponse } from '@voiceforge/shared';
import { AgentEditModal } from './agent-edit-modal';
import { AssignNumberModal } from './assign-number-modal';
import { AgentTestWidget } from '@/components/agent-test-widget';

export default function AgentsPage() {
  const { t } = useI18n();
  const industryLabels = getIndustryLabels(t);

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testingAgent, setTestingAgent] = useState<{ id: string; name: string } | null>(null);
  const [assigningNumber, setAssigningNumber] = useState<{ id: string; name: string } | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const result = await api.get<ApiResponse<AgentSummary[]>>('/api/agents');
      if (result.success && result.data) {
        setAgents(result.data);
      }
    } catch {
      toast.error(t.agents.loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleDelete = async (agentId: string, name: string) => {
    if (!confirm(`${t.agents.deleteConfirm} "${name}";`)) return;

    try {
      await api.delete<ApiResponse<void>>(`/api/agents/${agentId}`);
      toast.success(`"${name}" ${t.agents.deletedSuccess}`);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch {
      toast.error(t.agents.deleteError);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">{t.agents.active}</Badge>;
      case 'paused':
        return <Badge variant="warning">{t.agents.paused}</Badge>;
      case 'draft':
        return <Badge variant="default">{t.agents.draft}</Badge>;
      case 'error':
        return <Badge variant="danger">{t.agents.errorStatus}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
        title={t.agents.title}
        description={t.agents.description}
        action={
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            {t.agents.createNew}
          </Button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-12 h-12" />}
          title={t.agents.noAgents}
          description={t.agents.noAgentsDescription}
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              {t.agents.createAgent}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const voice = GREEK_VOICES.find((v) => v.id === agent.voiceId);

            return (
              <Card key={agent.id} padding="none" hover>
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary">{agent.name}</h3>
                        <p className="text-xs text-text-tertiary">
                          {industryLabels[agent.industry] ?? agent.industry}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(agent.status)}
                      <Badge variant="brand">
                        <Cpu className="w-3 h-3 mr-1" />
                        {agent.aiProvider === AI_PROVIDER.ELEVENLABS ? 'ElevenLabs' : 'Telnyx'}
                      </Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    {agent.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Phone className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="font-mono">{formatPhoneNumber(agent.phoneNumber)}</span>
                      </div>
                    )}
                    {agent.forwardPhoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <PhoneForwarded className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="font-mono">{formatPhoneNumber(agent.forwardPhoneNumber)}</span>
                        <span className="text-xs text-text-tertiary">{t.agents.transfer}</span>
                      </div>
                    )}
                    {agent.elevenlabsAgentId && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Cpu className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="font-mono text-xs truncate max-w-[180px]" title={agent.elevenlabsAgentId}>
                          {agent.elevenlabsAgentId}
                        </span>
                      </div>
                    )}
                    {voice && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="text-text-tertiary">🎤</span>
                        <span>{voice.name} ({voice.gender === 'female' ? t.agents.female : t.agents.male})</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="text-text-tertiary">📞</span>
                      <span>{agent.totalCalls} {t.agents.calls}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border">
                    {agent.elevenlabsAgentId && !agent.elevenlabsAgentId.startsWith('dev_') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTestingAgent({
                            id: agent.elevenlabsAgentId!,
                            name: agent.name,
                          })
                        }
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        leftIcon={<MessageCircle className="w-3.5 h-3.5" />}
                      >
                        {t.agents.testAgent}
                      </Button>
                    )}
                    {/* Assign phone number — only when agent has ElevenLabs ID but no number yet */}
                    {agent.elevenlabsAgentId && !agent.phoneNumber && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAssigningNumber({
                            id: agent.id,
                            name: agent.name,
                          })
                        }
                        className="text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                        leftIcon={<PhoneCall className="w-3.5 h-3.5" />}
                      >
                        {t.agents.assignNumber}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAgent(agent.id)}
                      leftIcon={<Pencil className="w-3.5 h-3.5" />}
                    >
                      {t.common.edit}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(agent.id, agent.name)}
                      className="text-danger-500 hover:text-danger-600 hover:bg-danger-50"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      {t.common.delete}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAgent) && (
        <AgentEditModal
          agentId={editingAgent}
          onClose={() => {
            setShowCreateModal(false);
            setEditingAgent(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingAgent(null);
            loadAgents();
          }}
        />
      )}

      {/* Test Widget Modal */}
      {testingAgent && (
        <AgentTestWidget
          agentId={testingAgent.id}
          agentName={testingAgent.name}
          onClose={() => setTestingAgent(null)}
        />
      )}

      {/* Assign Phone Number Modal */}
      {assigningNumber && (
        <AssignNumberModal
          agentId={assigningNumber.id}
          agentName={assigningNumber.name}
          onClose={() => setAssigningNumber(null)}
          onAssigned={() => {
            setAssigningNumber(null);
            loadAgents();
          }}
        />
      )}
    </div>
  );
}
