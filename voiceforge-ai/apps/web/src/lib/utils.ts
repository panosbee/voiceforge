// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Utility Functions
// ═══════════════════════════════════════════════════════════════════

import { type ClassValue, clsx } from 'clsx';
import type { Translations } from '@/lib/i18n/types';

/** Merge class names (clsx) — used for conditional Tailwind classes */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format a phone number for display (+302101234567 → +30 210 123 4567) */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Greek format
  if (phone.startsWith('+30')) {
    const digits = phone.slice(3);
    return `+30 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

/** Format duration in seconds to m:ss or h:mm:ss */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format a date to locale-aware string */
export function formatDate(date: string | Date, locale: 'el' | 'en' = 'el', options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/** Format a date to relative time — locale-aware */
export function formatRelativeTime(date: string | Date, t?: Translations['shared']): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Default Greek for backward compatibility
  if (!t) {
    if (diffSec < 60) return 'μόλις τώρα';
    if (diffMin < 60) return `πριν ${diffMin} λεπτ${diffMin === 1 ? 'ό' : 'ά'}`;
    if (diffHour < 24) return `πριν ${diffHour} ώρ${diffHour === 1 ? 'α' : 'ες'}`;
    if (diffDay < 7) return `πριν ${diffDay} μέρ${diffDay === 1 ? 'α' : 'ες'}`;
    return formatDate(d, 'el');
  }

  if (diffSec < 60) return t.justNow;
  if (diffMin === 1) return t.minuteAgo;
  if (diffMin < 60) return `${diffMin} ${t.minutesAgo}`;
  if (diffHour === 1) return t.hourAgo;
  if (diffHour < 24) return `${diffHour} ${t.hoursAgo}`;
  if (diffDay === 1) return t.dayAgo;
  if (diffDay < 7) return `${diffDay} ${t.daysAgo}`;
  return formatDate(d, 'el');
}

/** Get industry labels using translations (locale-aware) */
export function getIndustryLabels(t: Translations): Record<string, string> {
  return t.shared.industries;
}

/** Get plan labels using translations (locale-aware) */
export function getPlanLabels(t: Translations): Record<string, { name: string; description: string; price: string }> {
  return t.shared.plans;
}

/** Get call status labels using translations (locale-aware) */
export function getCallStatusLabels(t: Translations): Record<string, { label: string; color: string }> {
  return {
    ringing: { label: t.calls.statusLabels.ringing, color: 'text-warning-500' },
    in_progress: { label: t.calls.statusLabels.in_progress, color: 'text-brand-500' },
    completed: { label: t.calls.statusLabels.completed, color: 'text-success-500' },
    missed: { label: t.calls.statusLabels.missed, color: 'text-danger-500' },
    voicemail: { label: t.calls.statusLabels.voicemail, color: 'text-warning-500' },
    failed: { label: t.calls.statusLabels.failed, color: 'text-danger-500' },
  };
}

// ── Legacy exports (kept for backward compat — prefer locale-aware versions) ──

/** @deprecated Use getIndustryLabels(t) instead */
export const INDUSTRY_LABELS: Record<string, string> = {
  law_office: 'Δικηγορικό Γραφείο',
  medical_practice: 'Ιατρείο',
  dental_clinic: 'Οδοντιατρείο',
  real_estate: 'Μεσιτικό Γραφείο',
  beauty_salon: 'Κομμωτήριο / Salon',
  accounting: 'Λογιστικό Γραφείο',
  veterinary: 'Κτηνιατρείο',
  general: 'Γενική Επιχείρηση',
};

/** @deprecated Use getPlanLabels(t) instead */
export const PLAN_LABELS: Record<string, { name: string; description: string; price: string }> = {
  starter: { name: 'Starter', description: '100 λεπτά/μήνα, 1 agent, 1 αριθμός', price: '€29' },
  pro: { name: 'Pro', description: '500 λεπτά/μήνα, 3 agents, 3 αριθμοί', price: '€79' },
  business: { name: 'Business', description: '2000 λεπτά/μήνα, 10 agents, 10 αριθμοί', price: '€199' },
};

/** @deprecated Use getCallStatusLabels(t) instead */
export const CALL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ringing: { label: 'Κλήση σε εξέλιξη', color: 'text-warning-500' },
  in_progress: { label: 'Σε εξέλιξη', color: 'text-brand-500' },
  completed: { label: 'Ολοκληρωμένη', color: 'text-success-500' },
  missed: { label: 'Αναπάντητη', color: 'text-danger-500' },
  voicemail: { label: 'Τηλεφωνητής', color: 'text-warning-500' },
  failed: { label: 'Αποτυχία', color: 'text-danger-500' },
};
