// ═══════════════════════════════════════════════════════════════════
// GDPR Cookie Consent Banner
// Art. 7 — Consent for non-essential cookies
// Stores decision in localStorage; auto-hides once accepted/rejected
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

const CONSENT_KEY = 'voiceforge_cookie_consent';

type ConsentStatus = 'accepted' | 'rejected' | null;

export function CookieConsentBanner() {
  const { t } = useI18n();
  const [status, setStatus] = useState<ConsentStatus | 'loading'>('loading');

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentStatus | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(stored);
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setStatus('accepted');
  };

  const reject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    setStatus('rejected');
  };

  // Hide banner once user has made a choice or while loading
  if (status !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="max-w-4xl mx-auto bg-surface border border-border rounded-xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Text */}
        <div className="flex-1 text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{t.gdpr.cookieTitle} </span>
          {t.gdpr.cookieDescription}{' '}
          <Link
            href="/privacy"
            className="text-brand-600 underline hover:text-brand-700 transition-colors"
            target="_blank"
          >
            {t.gdpr.cookiePrivacyLink}
          </Link>
          .
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={reject}
            className="text-sm text-text-secondary hover:text-text-primary underline transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
          >
            {t.gdpr.cookieReject}
          </button>
          <button
            onClick={accept}
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            {t.gdpr.cookieAccept}
          </button>
        </div>
      </div>
    </div>
  );
}
