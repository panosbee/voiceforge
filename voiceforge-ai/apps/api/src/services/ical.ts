// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — iCal Feed Service
// Fetches + parses iCal feeds (Google/Outlook/Apple Calendar)
// Syncs events to ical_cached_events table for availability checks
// ═══════════════════════════════════════════════════════════════════

import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { icalCachedEvents, customers } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('ical');

// ── Types ────────────────────────────────────────────────────────

export interface ParsedIcalEvent {
  uid: string;
  summary: string;
  startAt: Date;
  endAt: Date;
}

// ── iCal URL Validation ──────────────────────────────────────────

/**
 * Validate that an iCal URL is safe to fetch (prevent SSRF).
 * Only allows known calendar provider hosts and https protocol.
 */
export function validateIcalUrl(urlStr: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlStr);

    // Must be HTTPS
    if (url.protocol !== 'https:') {
      return { valid: false, error: 'Το URL πρέπει να χρησιμοποιεί HTTPS' };
    }

    // Block private/internal IPs (SSRF protection)
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { valid: false, error: 'Δεν επιτρέπονται τοπικές διευθύνσεις' };
    }

    // Must end with .ics or contain /basic.ics or ical format param
    const pathAndQuery = url.pathname + url.search;
    const isIcalUrl =
      pathAndQuery.includes('.ics') ||
      pathAndQuery.includes('format=ics') ||
      pathAndQuery.includes('format=ical') ||
      pathAndQuery.includes('/ical/') ||
      pathAndQuery.includes('webcal') ||
      // Google Calendar public URL pattern
      hostname === 'calendar.google.com';

    if (!isIcalUrl) {
      return { valid: false, error: 'Το URL δεν φαίνεται να είναι iCal feed (.ics)' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Μη έγκυρο URL' };
  }
}

// ── iCal Parser ──────────────────────────────────────────────────

/**
 * Parse iCal VCALENDAR text into structured events.
 * Handles standard VEVENT components with DTSTART, DTEND, SUMMARY, UID.
 */
export function parseIcalText(icsText: string): ParsedIcalEvent[] {
  const events: ParsedIcalEvent[] = [];

  // Unfold long lines per RFC 5545 (lines continued with CRLF + space/tab)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let uid = '';
  let summary = '';
  let dtStart = '';
  let dtEnd = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      summary = '';
      dtStart = '';
      dtEnd = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && uid && dtStart) {
        const startDate = parseIcalDate(dtStart);
        const endDate = dtEnd ? parseIcalDate(dtEnd) : startDate;

        if (startDate && endDate) {
          events.push({
            uid,
            summary: unescapeIcalText(summary || '(Busy)'),
            startAt: startDate,
            endAt: endDate,
          });
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    // Parse property:value lines (handle params like DTSTART;TZID=...)
    if (trimmed.startsWith('UID:')) {
      uid = trimmed.substring(4);
    } else if (trimmed.startsWith('SUMMARY:')) {
      summary = trimmed.substring(8);
    } else if (trimmed.startsWith('DTSTART')) {
      dtStart = extractIcalValue(trimmed);
    } else if (trimmed.startsWith('DTEND')) {
      dtEnd = extractIcalValue(trimmed);
    }
  }

  return events;
}

/**
 * Extract the value from an iCal property line.
 * Handles formats like: DTSTART:20240101T090000Z
 *                   and: DTSTART;TZID=Europe/Athens:20240101T090000
 *                   and: DTSTART;VALUE=DATE:20240101
 */
function extractIcalValue(line: string): string {
  // Find the last colon that separates params from value
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return '';
  return line.substring(colonIdx + 1);
}

/**
 * Parse an iCal date/datetime string into a JS Date.
 * Supports: 20240101T090000Z (UTC), 20240101T090000 (local), 20240101 (date-only)
 */
function parseIcalDate(dateStr: string): Date | null {
  const clean = dateStr.trim();

  // Full datetime with Z suffix (UTC)
  // Format: YYYYMMDDTHHmmSSZ
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11);
    const min = clean.substring(11, 13);
    const sec = clean.substring(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
  }

  // Full datetime without Z (treat as UTC for simplicity — timezone handled by TZID param)
  // Format: YYYYMMDDTHHmmSS
  if (/^\d{8}T\d{6}$/.test(clean)) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11);
    const min = clean.substring(11, 13);
    const sec = clean.substring(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
  }

  // Date only (all-day event)
  // Format: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }

  log.warn({ dateStr: clean }, 'Could not parse iCal date');
  return null;
}

/**
 * Unescape iCal text property values per RFC 5545.
 */
function unescapeIcalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ── iCal Feed Fetching ───────────────────────────────────────────

/**
 * Fetch an iCal feed from URL and return raw text.
 * Includes timeout and size limit for safety.
 */
export async function fetchIcalFeed(url: string): Promise<string> {
  const validation = validateIcalUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid iCal URL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VoiceForge-AI/1.0 (Calendar Sync)',
        Accept: 'text/calendar, application/calendar+json, text/plain',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`iCal feed returned ${response.status}: ${response.statusText}`);
    }

    // Limit response size to 5MB
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      throw new Error('iCal feed too large (>5MB)');
    }

    const text = await response.text();

    // Basic sanity check — must contain VCALENDAR
    if (!text.includes('BEGIN:VCALENDAR')) {
      throw new Error('Response is not a valid iCal feed (missing BEGIN:VCALENDAR)');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Sync to Database ─────────────────────────────────────────────

/**
 * Fetch iCal feed for a customer and sync events to the cache table.
 * Replaces all cached events for the customer (full sync).
 * Only stores events within ±90 days of now to keep data manageable.
 */
export async function syncIcalEvents(customerId: string, feedUrl: string): Promise<{
  total: number;
  synced: number;
}> {
  log.info({ customerId }, 'Syncing iCal feed');

  const icsText = await fetchIcalFeed(feedUrl);
  const allEvents = parseIcalText(icsText);

  // Filter to events within ±90 days
  const now = new Date();
  const pastCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const futureCutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const relevantEvents = allEvents.filter(
    (e) => e.endAt >= pastCutoff && e.startAt <= futureCutoff,
  );

  // Delete existing cached events for this customer
  await db.delete(icalCachedEvents).where(eq(icalCachedEvents.customerId, customerId));

  // Insert new events
  if (relevantEvents.length > 0) {
    await db.insert(icalCachedEvents).values(
      relevantEvents.map((e) => ({
        customerId,
        uid: e.uid,
        summary: e.summary,
        startAt: e.startAt,
        endAt: e.endAt,
      })),
    );
  }

  // Update last synced timestamp
  await db
    .update(customers)
    .set({ icalLastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(customers.id, customerId));

  log.info(
    { customerId, total: allEvents.length, synced: relevantEvents.length },
    'iCal sync completed',
  );

  return { total: allEvents.length, synced: relevantEvents.length };
}

// ── Query Busy Slots ─────────────────────────────────────────────

/**
 * Get iCal busy time slots for a specific date.
 * Returns array of HH:MM strings that overlap with external calendar events.
 * Used by check_availability to block slots from external calendars.
 */
export async function getIcalBusySlots(
  customerId: string,
  dateStr: string,
  timezone: string,
  slotDurationMinutes: number = 30,
): Promise<string[]> {
  // Get day boundaries in the customer's timezone
  const { getDayRangeInTimezone } = await import('./timezone.js');
  const { startDate: dayStart, endDate: dayEnd } = getDayRangeInTimezone(dateStr, timezone);

  // Query cached events that overlap with this day
  const cachedEvents = await db.query.icalCachedEvents.findMany({
    where: and(
      eq(icalCachedEvents.customerId, customerId),
      lte(icalCachedEvents.startAt, dayEnd),
      gte(icalCachedEvents.endAt, dayStart),
    ),
  });

  if (cachedEvents.length === 0) return [];

  // Convert events to busy HH:MM slots
  const busySlots = new Set<string>();

  for (const event of cachedEvents) {
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);

    // Generate all slot times that fall within this event
    // Iterate through the day in slotDurationMinutes increments
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();
    const eventStartMs = eventStart.getTime();
    const eventEndMs = eventEnd.getTime();

    for (
      let slotMs = dayStartMs;
      slotMs < dayEndMs;
      slotMs += slotDurationMinutes * 60 * 1000
    ) {
      const slotEnd = slotMs + slotDurationMinutes * 60 * 1000;

      // Check if this slot overlaps with the event
      if (slotMs < eventEndMs && slotEnd > eventStartMs) {
        // Convert slot timestamp to HH:MM in customer timezone
        const slotDate = new Date(slotMs);
        const timeStr = slotDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
          hour12: false,
        });
        busySlots.add(timeStr);
      }
    }
  }

  return Array.from(busySlots).sort();
}
