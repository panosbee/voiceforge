// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Agent Edit/Create Modal
// LLM/TTS model selection + conversational voice test via ElevenLabs widget
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Button, Input, Textarea, Select, Spinner } from '@/components/ui';
import { KnowledgeBaseUpload } from '@/components/knowledge-base-upload';
import { KBWizard } from '@/components/kb-wizard';
import { AgentTestWidget } from '@/components/agent-test-widget';
import { api } from '@/lib/api-client';
import { getIndustryLabels } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  GREEK_VOICES,
  ELEVENLABS_LLM_MODELS,
  ELEVENLABS_TTS_MODELS,
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_MODEL,
  SUPPORTED_LANGUAGES,
  INDUSTRY_TEMPLATES,
  type Industry,
} from '@voiceforge/shared';
import { X, BookOpen, Settings, Phone, Globe, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Agent, CreateAgentInput, ApiResponse } from '@voiceforge/shared';

interface AgentEditModalProps {
  agentId: string | null; // null = create new
  onClose: () => void;
  onSaved: () => void;
}

const llmOptions = ELEVENLABS_LLM_MODELS.map((m) => ({
  value: m.id,
  label: `${m.name} — ${m.description}`,
}));
const ttsOptions = ELEVENLABS_TTS_MODELS.map((m) => ({
  value: m.id,
  label: `${m.name} — ${m.description}`,
}));

type ModalTab = 'settings' | 'knowledge-base' | 'ai-wizard';

export function AgentEditModal({ agentId, onClose, onSaved }: AgentEditModalProps) {
  const isEditing = !!agentId;
  const { t } = useI18n();

  const industryOpts = Object.entries(getIndustryLabels(t)).map(([value, label]) => ({ value, label }));
  const voiceOptions = GREEK_VOICES.map((v) => ({
    value: v.id,
    label: `${v.name} (${v.gender === 'female' ? t.agents.female : t.agents.male})`,
  }));

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('settings');

  // Form fields
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [greeting, setGreeting] = useState('');
  const [instructions, setInstructions] = useState('');
  const [voiceId, setVoiceId] = useState('aTP4J5SJLQl74WTSRXKW'); // Σοφία default
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL);
  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL);
  const [forwardPhoneNumber, setForwardPhoneNumber] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['el']);
  const [elevenlabsAgentId, setElevenlabsAgentId] = useState<string | null>(null);

  // Conversational voice test
  const [showTestWidget, setShowTestWidget] = useState(false);

  /** Apply industry template when user selects an industry (only for new agents) */
  const handleIndustryChange = (value: string) => {
    setIndustry(value);

    // Only auto-fill if creating new agent AND fields are empty or unchanged
    if (!isEditing && value && value in INDUSTRY_TEMPLATES) {
      const template = INDUSTRY_TEMPLATES[value as Industry];
      if (template) {
        // Auto-fill greeting if empty
        if (!greeting.trim()) {
          setGreeting(template.greeting);
        }
        // Auto-fill instructions if empty
        if (!instructions.trim()) {
          setInstructions(template.instructions);
        }
        // Auto-fill name if empty
        if (!name.trim()) {
          setName(template.agentName);
        }
        // Set suggested languages
        if (supportedLanguages.length <= 1 && supportedLanguages[0] === 'el') {
          setSupportedLanguages(template.suggestedLanguages);
        }
        toast.success(
          `✨ ${template.nameEl} — ${t.onboarding.templateApplied}`,
        );
      }
    }
  };

  // Load existing agent data
  useEffect(() => {
    if (!agentId) return;

    const loadAgent = async () => {
      try {
        const result = await api.get<ApiResponse<Agent>>(`/api/agents/${agentId}`);
        if (result.success && result.data) {
          const agent = result.data;
          setName(agent.name);
          setIndustry(agent.industry);
          setGreeting(agent.greeting);
          setInstructions(agent.instructions);
          setVoiceId(agent.voiceId);
          setLlmModel(agent.llmModel || DEFAULT_LLM_MODEL);
          setTtsModel(agent.model || DEFAULT_TTS_MODEL);
          if (agent.forwardPhoneNumber) {
            setForwardPhoneNumber(agent.forwardPhoneNumber);
          }
          if (agent.supportedLanguages && Array.isArray(agent.supportedLanguages)) {
            setSupportedLanguages(agent.supportedLanguages as string[]);
          }
          if (agent.elevenlabsAgentId) {
            setElevenlabsAgentId(agent.elevenlabsAgentId);
          }
        }
      } catch {
        toast.error(t.agents.loadError);
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    loadAgent();
  }, [agentId, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: CreateAgentInput = {
        name,
        industry: industry as CreateAgentInput['industry'],
        greeting,
        instructions,
        voiceId,
        ttsModel,
        llmModel,
        language: supportedLanguages[0] || 'el',
        supportedLanguages,
        forwardPhoneNumber: forwardPhoneNumber.trim() || undefined,
      };

      if (isEditing) {
        await api.patch<ApiResponse<Agent>>(`/api/agents/${agentId}`, payload);
        toast.success(t.agents.updateSuccess);
      } else {
        await api.post<ApiResponse<{ id: string }>>('/api/agents', payload);
        toast.success(t.agents.createSuccess);
      }

      onSaved();
    } catch {
      toast.error(isEditing ? t.agents.updateError : t.agents.createError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditing ? t.agents.editAgent : t.agents.newAgent}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-tertiary text-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs (only show when editing — KB needs agentId) */}
        {isEditing && (
          <div className="flex border-b border-border px-6">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'settings'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Settings className="w-4 h-4" />
              {t.agents.settingsTab}
            </button>
            <button
              onClick={() => setActiveTab('knowledge-base')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'knowledge-base'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              {t.agents.knowledgeBaseTab}
            </button>
            <button
              onClick={() => setActiveTab('ai-wizard')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'ai-wizard'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Globe className="w-4 h-4" />
              {t.agents.wizardTab}
            </button>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : activeTab === 'settings' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <Input
              label={t.agents.name}
              placeholder={t.agents.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Select
              label={t.agents.industry}
              placeholder={t.agents.selectIndustry}
              options={industryOpts}
              value={industry}
              onChange={(e) => handleIndustryChange(e.target.value)}
              required
            />

            {/* Template hint — shown when creating new agent and industry is selected */}
            {!isEditing && industry && industry in INDUSTRY_TEMPLATES && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/5 border border-brand-500/20 rounded-xl">
                <Wand2 className="w-4 h-4 text-brand-500 shrink-0" />
                <p className="text-xs text-brand-600 dark:text-brand-400">
                  {supportedLanguages[0] === 'el'
                    ? `Template "${INDUSTRY_TEMPLATES[industry as Industry]?.nameEl}" εφαρμόστηκε. Μπορείτε να προσαρμόσετε τα πεδία.`
                    : `Template "${INDUSTRY_TEMPLATES[industry as Industry]?.nameEn}" applied. You can customize the fields.`}
                </p>
              </div>
            )}

            {/* Supported Languages — multi-select checkboxes */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />
                  {t.agents.supportedLanguages}
                </div>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-surface-secondary rounded-xl border border-border">
                {SUPPORTED_LANGUAGES.slice(0, 14).map((lang) => (
                  <label
                    key={lang.code}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      supportedLanguages.includes(lang.code)
                        ? 'bg-brand-500/10 text-brand-600 border border-brand-500/30'
                        : 'hover:bg-surface-tertiary text-text-secondary border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={supportedLanguages.includes(lang.code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSupportedLanguages([...supportedLanguages, lang.code]);
                        } else {
                          // Don't allow removing all languages
                          if (supportedLanguages.length > 1) {
                            setSupportedLanguages(supportedLanguages.filter((c) => c !== lang.code));
                          }
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-base">{lang.flag}</span>
                    <span className="truncate">{lang.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.supportedLanguagesHint}
              </p>
            </div>

            {/* Voice + Conversational Test */}
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label={t.agents.voice}
                    options={voiceOptions}
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                  />
                </div>
                {isEditing && elevenlabsAgentId && !elevenlabsAgentId.startsWith('dev_') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestWidget(true)}
                    className="mb-0.5 shrink-0"
                    leftIcon={<Phone className="w-4 h-4" />}
                  >
                    {t.agents.testAgent}
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                {isEditing && elevenlabsAgentId
                  ? t.agents.testHintConnected
                  : t.agents.testHintSaveFirst}
              </p>
            </div>

            {/* TTS Model */}
            <div>
              <Select
                label={t.agents.ttsModel}
                options={ttsOptions}
                value={ttsModel}
                onChange={(e) => setTtsModel(e.target.value)}
              />
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.ttsHint}
              </p>
            </div>

            {/* LLM Model */}
            <div>
              <Select
                label={t.agents.llmModel}
                options={llmOptions}
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              />
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.llmHint}
              </p>
            </div>

            <Textarea
              label={t.agents.greeting}
              placeholder={t.agents.greetingPlaceholder}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              required
            />

            {/* Forward Phone Number */}
            <div>
              <Input
                label={t.agents.forwardPhone}
                placeholder={t.agents.forwardPhonePlaceholder}
                value={forwardPhoneNumber}
                onChange={(e) => setForwardPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.forwardPhoneHint}
              </p>
            </div>

            <Textarea
              label={t.agents.instructions}
              placeholder={t.agents.instructionsPlaceholder}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={10}
              required
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button type="submit" isLoading={isSaving}>
                {isEditing ? t.common.save : t.agents.createAgent}
              </Button>
            </div>
          </form>
        ) : activeTab === 'knowledge-base' ? (
          /* Knowledge Base Tab */
          <div className="p-6">
            <KnowledgeBaseUpload agentId={agentId} />
          </div>
        ) : (
          /* AI Wizard Tab */
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-text-primary">{t.agents.aiKnowledgeWizard}</h3>
              <p className="text-sm text-text-tertiary mt-1">{t.agents.aiKnowledgeWizardDescription}</p>
            </div>
            <KBWizard
              agentId={agentId ?? undefined}
              language={supportedLanguages[0] || 'el'}
              onApplyPrompt={(prompt, greet) => {
                setInstructions(prompt);
                setGreeting(greet);
                setActiveTab('settings');
                toast.success(supportedLanguages[0] === 'el' ? 'Οι οδηγίες εφαρμόστηκαν!' : 'Instructions applied!');
              }}
            />
          </div>
        )}
      </div>

      {/* Conversational Voice Test Widget */}
      {showTestWidget && elevenlabsAgentId && (
        <AgentTestWidget
          agentId={elevenlabsAgentId}
          agentName={name || t.agents.title}
          onClose={() => setShowTestWidget(false)}
        />
      )}
    </div>
  );
}
