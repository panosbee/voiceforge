// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Language Toggle Component
// Compact EL/EN switcher for header, sidebar, and landing page
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useI18n, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LOCALE_LABELS: Record<Locale, string> = {
  el: 'ΕΛ',
  en: 'EN',
};

interface LanguageToggleProps {
  className?: string;
  /** Compact mode for sidebar */
  compact?: boolean;
}

export function LanguageToggle({ className, compact = false }: LanguageToggleProps) {
  const { locale, setLocale, locales } = useI18n();

  return (
    <div className={cn('flex items-center rounded-lg bg-surface-tertiary p-0.5', className)}>
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          className={cn(
            'px-2 py-1 text-xs font-semibold rounded-md transition-all duration-150',
            locale === loc
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-text-tertiary hover:text-text-secondary',
            compact && 'px-1.5 py-0.5 text-[10px]',
          )}
          title={loc === 'el' ? 'Ελληνικά' : 'English'}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
