// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Auth Layout
// Centered card layout for login / register pages
// ═══════════════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">VoiceForge AI</h1>
          <p className="text-sm text-text-secondary mt-1">{t.auth.subtitle}</p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface border border-border rounded-xl shadow-card p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
