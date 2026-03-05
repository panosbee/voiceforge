// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — AI-Powered Technical Support Chatbot Widget
// Calls the AI backend for contextual, intelligent responses.
// Knows the platform inside-out and gives industry-specific guidance.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { MessageCircle, Send, User, ChevronDown, Sparkles, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { API_URL } from '@/lib/env';
import { getDevToken, isDevAuthEnabled } from '@/lib/dev-auth';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

// Quick suggestions built from i18n in the component

/** Get auth token — uses dev cookie or Supabase session */
async function getAuthToken(): Promise<string | null> {
  // Dev auth mode — token in cookie
  if (isDevAuthEnabled()) {
    return getDevToken();
  }
  // Production: try Supabase session from cookie
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )sb-[^=]+-auth-token=([^;]*)/);
    if (match) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]!));
        return parsed?.access_token ?? null;
      } catch { /* ignore */ }
    }
  }
  return null;
}

export function SupportChatbot() {
  const { t, locale } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Send initial greeting when opened for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: t.supportChat.greeting,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length, t]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  /** Send message to AI backend */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    // Build conversation history (excluding the greeting and error messages)
    const history = messages
      .filter((m) => m.id !== 'greeting' && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/support-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: history,
          locale: locale as 'el' | 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json() as {
        success: boolean;
        data?: { response: string; source: string };
        error?: { message: string };
      };

      if (!result.success || !result.data?.response) {
        throw new Error(result.error?.message || 'Empty response');
      }

      const botMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: result.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Support chat error:', error);

      const errorMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ ' + t.supportChat.connectionError,
        timestamp: new Date(),
        error: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, locale]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleReset = () => {
    setShowSuggestions(true);
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: '👋 ' + t.supportChat.greeting,
      timestamp: new Date(),
    }]);
  };

  const suggestions = [
    t.supportChat.quickPrompts.howToStart,
    t.supportChat.quickPrompts.haveMedical,
    t.supportChat.quickPrompts.haveLaw,
    t.supportChat.quickPrompts.howKB,
    t.supportChat.quickPrompts.howPhone,
    t.supportChat.quickPrompts.whatPlans,
  ];

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all hover:scale-105 flex items-center justify-center group"
          aria-label={t.supportChat.title}
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[560px] bg-surface rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-500 text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {t.supportChat.title}
                </p>
                <p className="text-xs text-white/70">
                  {t.supportChat.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title={t.supportChat.newChat}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[320px] max-h-[400px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.error ? 'bg-red-500/10' : 'bg-brand-500/10'}`}>
                    <Sparkles className={`w-3.5 h-3.5 ${msg.error ? 'text-red-500' : 'text-brand-500'}`} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-white rounded-br-md'
                      : msg.error
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded-bl-md'
                        : 'bg-surface-secondary text-text-primary rounded-bl-md'
                  }`}
                >
                  {/* Markdown-like rendering for **bold** and bullet points */}
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-1' : ''}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                        part.startsWith('**') && part.endsWith('**') ? (
                          <strong key={j}>{part.slice(2, -2)}</strong>
                        ) : (
                          <span key={j}>{part}</span>
                        )
                      )}
                    </p>
                  ))}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-text-tertiary" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing/loading indicator */}
            {isLoading && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
                </div>
                <div className="bg-surface-secondary rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Quick suggestions — shown only at start */}
            {showSuggestions && messages.length <= 1 && (
              <div className="pt-2">
                <p className="text-xs text-text-tertiary mb-2">
                  💡 {t.supportChat.tryLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-medium hover:bg-brand-500/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 px-3 py-3 border-t border-border"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.supportChat.inputPlaceholder}
              disabled={isLoading}
              className="flex-1 bg-surface-secondary rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 border border-transparent focus:border-brand-500/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
