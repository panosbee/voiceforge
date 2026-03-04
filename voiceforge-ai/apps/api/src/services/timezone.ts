// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Timezone Utility Service
// Universal timezone-aware date/time handling
// Ensures correct date/time regardless of server location
// ═══════════════════════════════════════════════════════════════════

import { createLogger } from '../config/logger.js';

const log = createLogger('timezone');

/**
 * Supported IANA timezones used across the platform.
 * Customers select their timezone during onboarding.
 */
export const SUPPORTED_TIMEZONES = [
  'Europe/Athens',    // Greece (UTC+2 / UTC+3 DST)
  'Europe/Nicosia',   // Cyprus (UTC+2 / UTC+3 DST)
  'Europe/London',    // UK (UTC+0 / UTC+1 DST)
  'Europe/Berlin',    // Central Europe (UTC+1 / UTC+2 DST)
  'Europe/Paris',     // France (UTC+1 / UTC+2 DST)
  'America/New_York', // US Eastern (UTC-5 / UTC-4 DST)
  'UTC',
] as const;

export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number] | string;

/**
 * Get the current date and time in a specific timezone.
 * Returns a structured object with all components.
 */
export function getCurrentDateTime(timezone: string = 'Europe/Athens'): {
  /** ISO 8601 string with timezone offset: 2026-03-02T14:30:00+02:00 */
  iso: string;
  /** Date only: 2026-03-02 */
  date: string;
  /** Time only: 14:30 */
  time: string;
  /** Full Greek formatted: Δευτέρα 2 Μαρτίου 2026, 14:30 */
  formatted_el: string;
  /** Full English formatted: Monday, March 2, 2026, 2:30 PM */
  formatted_en: string;
  /** Day name in Greek: Δευτέρα */
  dayName_el: string;
  /** Day name in English: Monday */
  dayName_en: string;
  /** Timezone name: Europe/Athens */
  timezone: string;
  /** UTC offset: +02:00 or +03:00 */
  utcOffset: string;
  /** Unix timestamp (seconds) */
  unix: number;
} {
  const now = new Date();

  // Format using Intl.DateTimeFormat for proper timezone conversion
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const fullGreek = new Intl.DateTimeFormat('el-GR', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const fullEnglish = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dayNameEl = new Intl.DateTimeFormat('el-GR', {
    timeZone: timezone,
    weekday: 'long',
  });

  const dayNameEn = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  });

  // Calculate UTC offset for this timezone
  const utcOffset = getTimezoneOffset(timezone, now);

  // Build ISO string with correct offset
  const dateParts = dateFormatter.format(now); // YYYY-MM-DD
  const timeParts = timeFormatter.format(now); // HH:MM
  const iso = `${dateParts}T${timeParts}:00${utcOffset}`;

  return {
    iso,
    date: dateParts,
    time: timeParts,
    formatted_el: fullGreek.format(now),
    formatted_en: fullEnglish.format(now),
    dayName_el: dayNameEl.format(now),
    dayName_en: dayNameEn.format(now),
    timezone,
    utcOffset,
    unix: Math.floor(now.getTime() / 1000),
  };
}

/**
 * Get the UTC offset string (e.g., "+02:00") for a timezone at a given date.
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  // Use the Intl API to get timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });

  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  const offsetStr = tzPart?.value ?? 'GMT';

  // Parse "GMT+2:00" or "GMT+02:00" or "GMT" → "+02:00"
  if (offsetStr === 'GMT' || offsetStr === 'UTC') return '+00:00';

  const match = offsetStr.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!match) return '+00:00';

  const sign = match[1] ?? '+';
  const hours = (match[2] ?? '00').padStart(2, '0');
  const minutes = (match[3] ?? '00').padStart(2, '0');

  return `${sign}${hours}:${minutes}`;
}

/**
 * Parse a date string (YYYY-MM-DD) in a specific timezone.
 * Returns a Date object in UTC that represents the start of that day in the given timezone.
 *
 * Example: parseInTimezone('2026-03-02', 'Europe/Athens')
 * → For Athens UTC+2: returns Date('2026-03-01T22:00:00Z') (midnight Athens = 22:00 UTC prev day)
 */
export function parseInTimezone(dateStr: string, timezone: string): Date {
  // Get the UTC offset for that date in that timezone
  const tempDate = new Date(`${dateStr}T12:00:00Z`); // Use noon to avoid DST edge cases
  const offset = getTimezoneOffset(timezone, tempDate);

  // Parse offset to minutes
  const offsetMinutes = parseOffsetToMinutes(offset);

  // Create the date at midnight in the target timezone
  const utcDate = new Date(`${dateStr}T00:00:00Z`);
  utcDate.setMinutes(utcDate.getMinutes() - offsetMinutes);

  return utcDate;
}

/**
 * Parse a date+time string (YYYY-MM-DD + HH:MM) in a specific timezone.
 * Returns a Date object in UTC.
 *
 * Example: parseDateTimeInTimezone('2026-03-02', '14:30', 'Europe/Athens')
 * → Returns Date('2026-03-02T12:30:00Z') (14:30 Athens = 12:30 UTC)
 */
export function parseDateTimeInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
  const tempDate = new Date(`${dateStr}T${timeStr}:00Z`);
  const offset = getTimezoneOffset(timezone, tempDate);
  const offsetMinutes = parseOffsetToMinutes(offset);

  const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);
  utcDate.setMinutes(utcDate.getMinutes() - offsetMinutes);

  return utcDate;
}

/**
 * Get the start and end of a month in a specific timezone (as UTC Dates).
 * Used for calendar queries.
 */
export function getMonthRangeInTimezone(
  year: number,
  month: number,
  timezone: string,
): { startDate: Date; endDate: Date } {
  // First day of month at midnight in the given timezone
  const firstDayStr = `${year}-${month.toString().padStart(2, '0')}-01`;
  const startDate = parseInTimezone(firstDayStr, timezone);

  // Last day of month at 23:59:59.999 in the given timezone
  const lastDay = new Date(year, month, 0).getDate(); // e.g., 31 for March
  const lastDayStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  const endDate = parseDateTimeInTimezone(lastDayStr, '23:59', timezone);
  // Add 59 seconds and 999 ms for end of day
  endDate.setSeconds(59, 999);

  return { startDate, endDate };
}

/**
 * Get the start and end of a day in a specific timezone (as UTC Dates).
 * Used for availability checks.
 */
export function getDayRangeInTimezone(
  dateStr: string,
  timezone: string,
): { startDate: Date; endDate: Date } {
  const startDate = parseInTimezone(dateStr, timezone);
  const endDate = parseDateTimeInTimezone(dateStr, '23:59', timezone);
  endDate.setSeconds(59, 999);

  return { startDate, endDate };
}

/**
 * Format a UTC Date into a time string (HH:MM) in a specific timezone.
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format a UTC Date into a date string (YYYY-MM-DD) in a specific timezone.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Format a UTC Date into a Greek-friendly display string.
 */
export function formatGreekDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a UTC Date into a Greek-friendly display string with time.
 */
export function formatGreekDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Build a system prompt addendum that injects current date/time awareness.
 * This should be prepended to every agent's instructions so the AI knows
 * the correct date, time, and day of the week.
 */
export function buildDateTimePromptInjection(timezone: string = 'Europe/Athens', locale: string = 'el'): string {
  const dt = getCurrentDateTime(timezone);

  if (locale === 'el') {
    return [
      `\n[ΠΛΗΡΟΦΟΡΙΕΣ ΗΜΕΡΟΜΗΝΙΑΣ & ΩΡΑΣ]`,
      `Τρέχουσα ημερομηνία: ${dt.formatted_el}`,
      `Ημέρα: ${dt.dayName_el}`,
      `Ζώνη ώρας: ${dt.timezone} (${dt.utcOffset})`,
      `Σημαντικό: Χρησιμοποίησε αυτές τις πληροφορίες για να προσφέρεις ακριβή χρόνο στον πελάτη.`,
      `Αν ο πελάτης ρωτήσει "τι ώρα είναι" ή "τι μέρα είναι", απάντησε με βάση αυτά τα δεδομένα.\n`,
    ].join('\n');
  }

  return [
    `\n[DATE & TIME INFORMATION]`,
    `Current date: ${dt.formatted_en}`,
    `Day: ${dt.dayName_en}`,
    `Timezone: ${dt.timezone} (${dt.utcOffset})`,
    `Important: Use this information to provide accurate time references to the caller.`,
    `If the caller asks "what time is it" or "what day is it", respond based on this data.\n`,
  ].join('\n');
}

// ── Internal Helpers ─────────────────────────────────────────────

function parseOffsetToMinutes(offset: string): number {
  const match = offset.match(/([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2] ?? '0', 10);
  const minutes = parseInt(match[3] ?? '0', 10);

  return sign * (hours * 60 + minutes);
}
