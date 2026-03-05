// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — AI Knowledge Base Wizard Component
// Multi-step wizard that asks business questions and generates
// a structured KB document + system prompt + greeting
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Textarea, Spinner } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { Wand2, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiResponse } from '@voiceforge/shared';

interface WizardQuestion {
  id: string;
  question: string;
  questionEn: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

interface WizardResult {
  document: { id: string; name: string; elevenlabsDocId: string };
  generatedPrompt: string;
  generatedGreeting: string;
  kbContent: string;
}

interface KBWizardProps {
  agentId?: string;
  language?: string;
  onComplete?: (result: WizardResult) => void;
  onApplyPrompt?: (prompt: string, greeting: string) => void;
}

type WizardStep = 'questions' | 'generating' | 'result';

export function KBWizard({ agentId, language = 'el', onComplete, onApplyPrompt }: KBWizardProps) {
  const { t } = useI18n();
  const isGreek = language === 'el';

  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>('questions');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load questions from API
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await api.get<ApiResponse<WizardQuestion[]>>('/api/kb-wizard/questions');
        if (response.success && response.data) {
          setQuestions(response.data);
        }
      } catch {
        // Fallback to minimal questions if API fails
        setQuestions([
          { id: 'business_name', question: t.kbWizard.question1, questionEn: 'What is your business name?', placeholder: t.kbWizard.question1Placeholder, required: true, type: 'text' },
          { id: 'business_type', question: t.kbWizard.question2, questionEn: 'What type of business is it?', placeholder: t.kbWizard.question2Placeholder, required: true, type: 'text' },
          { id: 'services', question: t.kbWizard.question3, questionEn: 'What services do you offer?', placeholder: t.kbWizard.question3Placeholder, required: true, type: 'textarea' },
          { id: 'working_hours', question: t.kbWizard.question4, questionEn: 'What are your working hours?', placeholder: t.kbWizard.question4Placeholder, required: true, type: 'textarea' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    loadQuestions();
  }, []);

  const currentQuestion = questions[currentStep];
  const isLastQuestion = currentStep === questions.length - 1;
  const canProceed = !currentQuestion?.required || (answers[currentQuestion?.id] ?? '').trim().length > 0;

  const handleNext = () => {
    if (isLastQuestion) {
      handleGenerate();
    } else {
      setCurrentStep((s) => Math.min(s + 1, questions.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleGenerate = async () => {
    setWizardStep('generating');
    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<WizardResult>>('/api/kb-wizard/generate', {
        answers,
        language,
        agentId,
      });

      if (response.success && response.data) {
        setResult(response.data);
        setWizardStep('result');
        toast.success(t.agents.aiKnowledgeWizardDone);
        onComplete?.(response.data);
      } else {
        throw new Error('Failed to generate');
      }
    } catch {
      setError(t.agents.aiKnowledgeWizardError);
      setWizardStep('questions');
      toast.error(t.agents.aiKnowledgeWizardError);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Generating step ──
  if (wizardStep === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <Spinner size="lg" />
          <Sparkles className="w-6 h-6 text-brand-500 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <p className="text-text-secondary text-sm">{t.agents.aiKnowledgeWizardGenerating}</p>
      </div>
    );
  }

  // ── Result step ──
  if (wizardStep === 'result' && result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-green-600">
          <CheckCircle className="w-6 h-6" />
          <h3 className="text-lg font-semibold">{t.agents.aiKnowledgeWizardDone}</h3>
        </div>

        {/* Generated KB preview */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t.kbWizard.knowledgeFile}
            </label>
            <div className="bg-surface-secondary rounded-xl p-4 max-h-48 overflow-y-auto border border-border">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                {result.kbContent.slice(0, 1500)}{result.kbContent.length > 1500 ? '...' : ''}
              </pre>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t.kbWizard.suggestedInstructions}
            </label>
            <div className="bg-surface-secondary rounded-xl p-4 max-h-32 overflow-y-auto border border-border">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap">{result.generatedPrompt}</pre>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t.kbWizard.suggestedGreeting}
            </label>
            <div className="bg-surface-secondary rounded-xl p-3 border border-border">
              <p className="text-sm text-text-secondary">{result.generatedGreeting}</p>
            </div>
          </div>
        </div>

        {/* Apply button */}
        {onApplyPrompt && (
          <Button
            onClick={() => onApplyPrompt(result.generatedPrompt, result.generatedGreeting)}
            className="w-full"
            leftIcon={<Wand2 className="w-4 h-4" />}
          >
            {t.kbWizard.applyInstructionsBtn}
          </Button>
        )}
      </div>
    );
  }

  // ── Questions step ──
  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-surface-tertiary rounded-full h-2 overflow-hidden">
          <div
            className="bg-brand-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-tertiary whitespace-nowrap">
          {currentStep + 1} / {questions.length}
        </span>
      </div>

      {/* Current question */}
      {currentQuestion && (
        <div className="space-y-3">
          <h3 className="text-base font-medium text-text-primary">
            {isGreek ? currentQuestion.question : currentQuestion.questionEn}
            {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
          </h3>

          {currentQuestion.type === 'textarea' ? (
            <Textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              placeholder={currentQuestion.placeholder}
              rows={4}
            />
          ) : (
            <Input
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              placeholder={currentQuestion.placeholder}
            />
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          {t.common.back}
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed}
          isLoading={isGenerating}
          rightIcon={isLastQuestion ? <Wand2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        >
          {isLastQuestion ? t.kbWizard.createBtn : t.common.next}
        </Button>
      </div>
    </div>
  );
}
