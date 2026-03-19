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
import { X, BookOpen, Settings, Phone, Globe, Wand2, Code2, Copy, Check, Eye, ClipboardList } from 'lucide-react';
import { TaskEmailsEditor } from '@/components/task-emails-editor';
import { toast } from 'sonner';
import type { Agent, CreateAgentInput, ApiResponse } from '@voiceforge/shared';
import { API_URL } from '@/lib/env';

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

type ModalTab = 'settings' | 'knowledge-base' | 'ai-wizard' | 'embed' | 'task-routing';

export function AgentEditModal({ agentId, onClose, onSaved }: AgentEditModalProps) {
  const isEditing = !!agentId;
  const { t, locale } = useI18n();

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
  const [primaryLanguage, setPrimaryLanguage] = useState('el');
  const [businessHoursText, setBusinessHoursText] = useState('');
  const [elevenlabsAgentId, setElevenlabsAgentId] = useState<string | null>(null);

  // Widget embed config
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [widgetColor, setWidgetColor] = useState('#6366f1');
  const [widgetPosition, setWidgetPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [widgetButtonText, setWidgetButtonText] = useState('Talk to us');
  const [widgetIconType, setWidgetIconType] = useState<'phone' | 'mic' | 'chat'>('phone');
  const [widgetAllowedOrigins, setWidgetAllowedOrigins] = useState<string[]>([]);
  const [isSavingWidget, setIsSavingWidget] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // Conversational voice test
  const [showTestWidget, setShowTestWidget] = useState(false);

  // Keep primaryLanguage in sync — if removed from supported list, pick first remaining
  const updateSupportedLanguages = (langs: string[]) => {
    setSupportedLanguages(langs);
    if (langs.length === 1) {
      setPrimaryLanguage(langs[0] ?? 'el');
    } else if (!langs.includes(primaryLanguage)) {
      setPrimaryLanguage(langs[0] ?? 'el');
    }
  };

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
          updateSupportedLanguages(template.suggestedLanguages);
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
          if (agent.language) {
            setPrimaryLanguage(agent.language);
          }
          if (agent.elevenlabsAgentId) {
            setElevenlabsAgentId(agent.elevenlabsAgentId);
          }
          if ((agent as any).businessHoursText) {
            setBusinessHoursText((agent as any).businessHoursText);
          }
          // Widget embed config
          if ((agent as any).widgetEnabled !== undefined) setWidgetEnabled((agent as any).widgetEnabled);
          if ((agent as any).widgetColor) setWidgetColor((agent as any).widgetColor);
          if ((agent as any).widgetPosition) setWidgetPosition((agent as any).widgetPosition);
          if ((agent as any).widgetButtonText) setWidgetButtonText((agent as any).widgetButtonText);
          if ((agent as any).widgetIconType) setWidgetIconType((agent as any).widgetIconType);
          if ((agent as any).widgetAllowedOrigins && Array.isArray((agent as any).widgetAllowedOrigins)) {
            setWidgetAllowedOrigins((agent as any).widgetAllowedOrigins);
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
        language: primaryLanguage,
        supportedLanguages,
        forwardPhoneNumber: forwardPhoneNumber.trim() || undefined,
        businessHoursText: businessHoursText.trim() || undefined,
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
            <button
              onClick={() => setActiveTab('embed')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'embed'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Code2 className="w-4 h-4" />
              {t.agents.embedTab}
            </button>
            <button
              onClick={() => setActiveTab('task-routing')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'task-routing'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Tasks
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
                  {locale === 'el'
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
                          updateSupportedLanguages([...supportedLanguages, lang.code]);
                        } else {
                          // Don't allow removing all languages
                          if (supportedLanguages.length > 1) {
                            updateSupportedLanguages(supportedLanguages.filter((c) => c !== lang.code));
                          }
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-base">{lang.flag}</span>
                    <span className="truncate">{locale === 'en' ? lang.nameEn : lang.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.supportedLanguagesHint}
              </p>

              {/* Primary Language selector — shown when 2+ languages selected */}
              {supportedLanguages.length > 1 && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {t.agents.primaryLanguage}
                  </label>
                  <select
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    {supportedLanguages.map((code) => {
                      const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
                      return (
                        <option key={code} value={code}>
                          {lang?.flag} {locale === 'en' ? lang?.nameEn : lang?.name}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {t.agents.primaryLanguageHint}
                  </p>
                </div>
              )}
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

            <div>
              <Textarea
                label={t.agents.businessHoursText}
                placeholder={t.agents.businessHoursTextPlaceholder}
                value={businessHoursText}
                onChange={(e) => setBusinessHoursText(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-text-tertiary mt-1">
                {t.agents.businessHoursTextHint}
              </p>
            </div>

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
        ) : activeTab === 'ai-wizard' ? (
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
        ) : activeTab === 'task-routing' ? (
          /* ── Task Routing Tab ── */
          <TaskEmailsEditor agentId={agentId!} />
        ) : activeTab === 'embed' ? (
          /* ── Embed Widget Tab ── */
          <EmbedTabContent
            agentId={agentId}
            elevenlabsAgentId={elevenlabsAgentId}
            widgetEnabled={widgetEnabled}
            setWidgetEnabled={setWidgetEnabled}
            widgetColor={widgetColor}
            setWidgetColor={setWidgetColor}
            widgetPosition={widgetPosition}
            setWidgetPosition={setWidgetPosition}
            widgetButtonText={widgetButtonText}
            setWidgetButtonText={setWidgetButtonText}
            widgetIconType={widgetIconType}
            setWidgetIconType={setWidgetIconType}
            widgetAllowedOrigins={widgetAllowedOrigins}
            setWidgetAllowedOrigins={setWidgetAllowedOrigins}
            isSavingWidget={isSavingWidget}
            setIsSavingWidget={setIsSavingWidget}
            embedCopied={embedCopied}
            setEmbedCopied={setEmbedCopied}
            t={t}
            locale={locale}
          />
        ) : null}
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

// ═══════════════════════════════════════════════════════════════════
// Embed Tab Content — Widget configuration & code snippet
// ═══════════════════════════════════════════════════════════════════

interface EmbedTabProps {
  agentId: string | null;
  elevenlabsAgentId: string | null;
  widgetEnabled: boolean;
  setWidgetEnabled: (v: boolean) => void;
  widgetColor: string;
  setWidgetColor: (v: string) => void;
  widgetPosition: 'bottom-right' | 'bottom-left';
  setWidgetPosition: (v: 'bottom-right' | 'bottom-left') => void;
  widgetButtonText: string;
  setWidgetButtonText: (v: string) => void;
  widgetIconType: 'phone' | 'mic' | 'chat';
  setWidgetIconType: (v: 'phone' | 'mic' | 'chat') => void;
  widgetAllowedOrigins: string[];
  setWidgetAllowedOrigins: (v: string[]) => void;
  isSavingWidget: boolean;
  setIsSavingWidget: (v: boolean) => void;
  embedCopied: boolean;
  setEmbedCopied: (v: boolean) => void;
  t: any;
  locale: string;
}

function EmbedTabContent({
  agentId,
  elevenlabsAgentId,
  widgetEnabled,
  setWidgetEnabled,
  widgetColor,
  setWidgetColor,
  widgetPosition,
  setWidgetPosition,
  widgetButtonText,
  setWidgetButtonText,
  widgetIconType,
  setWidgetIconType,
  widgetAllowedOrigins,
  setWidgetAllowedOrigins,
  isSavingWidget,
  setIsSavingWidget,
  embedCopied,
  setEmbedCopied,
  t,
  locale,
}: EmbedTabProps) {
  const [originsInput, setOriginsInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  if (!agentId) {
    return (
      <div className="p-6 text-center text-text-tertiary">
        <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{t.agents.embedSaveFirst}</p>
      </div>
    );
  }

  const embedCode = `<script src="${API_URL}/widget/embed.js" data-agent-id="${agentId}" async><\/script>`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      toast.success(t.agents.embedCopied);
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setEmbedCopied(true);
      toast.success(t.agents.embedCopied);
      setTimeout(() => setEmbedCopied(false), 2000);
    }
  };

  const handleAddOrigin = () => {
    const trimmed = originsInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed); // validate URL
      if (!widgetAllowedOrigins.includes(trimmed)) {
        setWidgetAllowedOrigins([...widgetAllowedOrigins, trimmed]);
      }
      setOriginsInput('');
    } catch {
      toast.error(locale === 'el' ? 'Μη έγκυρο URL' : 'Invalid URL');
    }
  };

  const handleSaveWidget = async () => {
    setIsSavingWidget(true);
    try {
      await api.patch(`/api/agents/${agentId}`, {
        widgetEnabled,
        widgetColor,
        widgetPosition,
        widgetButtonText,
        widgetIconType,
        widgetAllowedOrigins,
      });
      toast.success(t.agents.embedConfigSaved);
    } catch {
      toast.error(t.agents.embedConfigError);
    } finally {
      setIsSavingWidget(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title & Description */}
      <div>
        <h3 className="text-base font-semibold text-text-primary">{t.agents.embedTitle}</h3>
        <p className="text-sm text-text-tertiary mt-1">{t.agents.embedDescription}</p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-xl border border-border">
        <div>
          <p className="text-sm font-medium text-text-primary">{t.agents.embedEnable}</p>
          <p className="text-xs text-text-tertiary mt-0.5">{t.agents.embedEnableHint}</p>
        </div>
        <button
          type="button"
          onClick={() => setWidgetEnabled(!widgetEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            widgetEnabled ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              widgetEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {widgetEnabled && (
        <>
          {/* Embed Code */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              {t.agents.embedCodeTitle}
            </label>
            <p className="text-xs text-text-tertiary mb-2">{t.agents.embedCodeDescription}</p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
                {embedCode}
              </pre>
              <button
                type="button"
                onClick={handleCopyCode}
                className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                title={t.agents.embedCopyCode}
              >
                {embedCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Customization */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">{t.agents.embedCustomize}</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Button Text */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t.agents.embedButtonText}
                </label>
                <input
                  type="text"
                  value={widgetButtonText}
                  onChange={(e) => setWidgetButtonText(e.target.value)}
                  placeholder={t.agents.embedButtonTextPlaceholder}
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t.agents.embedColor}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={widgetColor}
                    onChange={(e) => setWidgetColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={widgetColor}
                    onChange={(e) => setWidgetColor(e.target.value)}
                    maxLength={20}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t.agents.embedPosition}
                </label>
                <select
                  value={widgetPosition}
                  onChange={(e) => setWidgetPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="bottom-right">{t.agents.embedPositionRight}</option>
                  <option value="bottom-left">{t.agents.embedPositionLeft}</option>
                </select>
              </div>

              {/* Icon Type */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t.agents.embedIconType}
                </label>
                <select
                  value={widgetIconType}
                  onChange={(e) => setWidgetIconType(e.target.value as 'phone' | 'mic' | 'chat')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="phone">{t.agents.embedIconPhone}</option>
                  <option value="mic">{t.agents.embedIconMic}</option>
                  <option value="chat">{t.agents.embedIconChat}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Allowed Origins */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {t.agents.embedAllowedOrigins}
            </label>
            <p className="text-xs text-text-tertiary mb-2">{t.agents.embedAllowedOriginsHint}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={originsInput}
                onChange={(e) => setOriginsInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOrigin(); } }}
                placeholder={t.agents.embedAllowedOriginsPlaceholder}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddOrigin}>
                +
              </Button>
            </div>
            {widgetAllowedOrigins.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {widgetAllowedOrigins.map((origin, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-tertiary rounded-lg text-xs text-text-secondary"
                  >
                    {origin}
                    <button
                      type="button"
                      onClick={() => setWidgetAllowedOrigins(widgetAllowedOrigins.filter((_, j) => j !== i))}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              {t.agents.embedPreview}
            </button>
            {showPreview && (
              <div className="mt-3 relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl p-8 h-48 overflow-hidden">
                {/* Simulated webpage */}
                <div className="text-xs text-text-tertiary mb-4 font-mono">example-website.com</div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
                </div>

                {/* Simulated floating button */}
                <div
                  className={`absolute bottom-4 ${widgetPosition === 'bottom-left' ? 'left-4' : 'right-4'}`}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-full text-white text-xs font-semibold shadow-lg"
                    style={{ backgroundColor: widgetColor }}
                  >
                    {widgetIconType === 'phone' && <Phone className="w-4 h-4" />}
                    {widgetIconType === 'mic' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {widgetIconType === 'chat' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {widgetButtonText}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSaveWidget}
              isLoading={isSavingWidget}
            >
              {t.agents.embedSaveConfig}
            </Button>
          </div>
        </>
      )}

      {/* Save toggle even when disabled */}
      {!widgetEnabled && (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleSaveWidget}
            isLoading={isSavingWidget}
            variant="outline"
          >
            {t.agents.embedSaveConfig}
          </Button>
        </div>
      )}
    </div>
  );
}
