// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — i18n Context & Hook
// React context for language switching with localStorage persistence
// ═══════════════════════════════════════════════════════════════════

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Translations, Locale } from './types';
import { el } from './el';
import { en } from './en';

const DICTIONARIES: Record<Locale, Translations> = { el, en };
const STORAGE_KEY = 'voiceforge-locale';
const DEFAULT_LOCALE: Locale = 'el';

interface I18nContextValue {
  /** Current locale */
  locale: Locale;
  /** All translations for the current locale */
  t: Translations;
  /** Switch language */
  setLocale: (locale: Locale) => void;
  /** Available locales */
  locales: readonly Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Get persisted locale from localStorage (SSR-safe) */
function getPersistedLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'el' || stored === 'en') return stored;
  } catch {
    // localStorage not available
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setLocaleState(getPersistedLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage not available
    }
    // Update <html lang> attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  }, []);

  const value: I18nContextValue = {
    locale,
    t: DICTIONARIES[locale],
    setLocale,
    locales: ['el', 'en'] as const,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook to access translations and locale.
 * Must be used within <I18nProvider>.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within <I18nProvider>');
  }
  return ctx;
}

/**
 * Get translations for a given locale (non-hook, for server components or utilities).
 */
export function getTranslations(locale: Locale = DEFAULT_LOCALE): Translations {
  return DICTIONARIES[locale];
}

export { type Locale, type Translations };
