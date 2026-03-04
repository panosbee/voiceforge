// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Tool Webhook Routes (LEGACY)
// NOTE: These routes were originally designed for Telnyx AI Assistant.
// In the ElevenLabs architecture, all tool callbacks are routed through
// /elevenlabs-webhooks/server-tool which resolves customer context
// automatically via agent_id. These routes remain as direct-call fallbacks.
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, appointments, customers } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import {
  getDayRangeInTimezone,
  parseDateTimeInTimezone,
  formatTimeInTimezone,
  formatGreekDate,
  getCurrentDateTime,
} from '../services/timezone.js';
import type {
  CalendarCheckPayload,
  CalendarCheckResponse,
  AppointmentBookPayload,
  AppointmentBookResponse,
} from '@voiceforge/shared';

const log = createLogger('tools');

export const toolRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// CALENDAR CHECK — Called during live call
// The AI agent asks: "Let me check what's available..."
// We query the DB (or Google Calendar) and return available slots.
// ═══════════════════════════════════════════════════════════════════

toolRoutes.post('/calendar/check', async (c) => {
  const startTime = Date.now();

  try {
    const payload = await c.req.json<CalendarCheckPayload>();
    const { requested_date, service_type, customer_id } = payload;
    const callControlId = c.req.header('x-telnyx-call-control-id');

    log.info(
      { requestedDate: requested_date, serviceType: service_type, customerId: customer_id, callControlId },
      'Calendar check tool called',
    );

    if (!customer_id) {
      return c.json<CalendarCheckResponse>({
        available_slots: [],
        message: 'Δεν μπορώ να ελέγξω το ημερολόγιο αυτή τη στιγμή.',
      });
    }

    // Resolve customer timezone
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customer_id),
    });
    const customerTz = customer?.timezone || 'Europe/Athens';

    // Parse the requested date in the customer's timezone
    const { startDate: dateStart, endDate: dateEnd } = getDayRangeInTimezone(requested_date, customerTz);

    if (isNaN(dateStart.getTime())) {
      return c.json<CalendarCheckResponse>({
        available_slots: [],
        message: 'Η ημερομηνία δεν είναι έγκυρη. Παρακαλώ δοκιμάστε ξανά.',
      });
    }

    // Get existing appointments for that date
    const existingAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.customerId, customer_id),
        gte(appointments.scheduledAt, dateStart),
        lt(appointments.scheduledAt, dateEnd),
        eq(appointments.status, 'confirmed'),
      ),
    });

    const bookedTimes = new Set(
      existingAppointments.map((apt) => formatTimeInTimezone(new Date(apt.scheduledAt), customerTz)),
    );

    // Generate available slots (9:00-17:00, every 30 minutes) in customer timezone
    const allSlots: string[] = [];
    for (let hour = 9; hour < 17; hour++) {
      for (const minute of [0, 30]) {
        const slot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        if (!bookedTimes.has(slot)) {
          allSlots.push(slot);
        }
      }
    }

    // TODO: If Google Calendar is connected, query Google Calendar API instead

    // Format response for the AI agent using customer's timezone
    const dayName = formatGreekDate(dateStart, customerTz);

    const message =
      allSlots.length > 0
        ? `Διαθέσιμες ώρες για ${dayName}: ${allSlots.join(', ')}`
        : `Δεν υπάρχουν διαθέσιμες ώρες για ${dayName}. Προτείνετε άλλη ημερομηνία.`;

    const elapsed = Date.now() - startTime;
    log.info({ elapsed, slotsFound: allSlots.length }, 'Calendar check completed');

    return c.json<CalendarCheckResponse>({
      available_slots: allSlots,
      message,
    });
  } catch (error) {
    log.error({ error }, 'Calendar check error');
    return c.json<CalendarCheckResponse>({
      available_slots: [],
      message: 'Υπήρξε πρόβλημα με τον έλεγχο του ημερολογίου. Παρακαλώ δοκιμάστε αργότερα.',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// APPOINTMENT BOOK — Called during live call
// The AI agent confirms: "I'll book that for you..."
// We create the appointment record and optionally sync to Google Cal.
// ═══════════════════════════════════════════════════════════════════

toolRoutes.post('/calendar/book', async (c) => {
  try {
    const payload = await c.req.json<AppointmentBookPayload>();
    const { date, time, caller_name, caller_phone, service_type, notes, customer_id } = payload;
    const callControlId = c.req.header('x-telnyx-call-control-id');

    log.info(
      { date, time, callerName: caller_name, customerId: customer_id, callControlId },
      'Appointment booking tool called',
    );

    if (!customer_id) {
      return c.json<AppointmentBookResponse>({
        success: false,
        message: 'Δεν μπορώ να κλείσω ραντεβού αυτή τη στιγμή.',
        confirmation: '',
      });
    }

    // Resolve customer timezone
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customer_id),
    });
    const customerTz = customer?.timezone || 'Europe/Athens';

    // Parse date and time in the customer's timezone → store as UTC
    const scheduledAt = parseDateTimeInTimezone(date, time, customerTz);
    if (isNaN(scheduledAt.getTime())) {
      return c.json<AppointmentBookResponse>({
        success: false,
        message: 'Η ημερομηνία ή η ώρα δεν είναι έγκυρη.',
        confirmation: '',
      });
    }

    // Find the default agent for this customer
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.customerId, customer_id), eq(agents.isDefault, true)),
    });

    if (!agent) {
      return c.json<AppointmentBookResponse>({
        success: false,
        message: 'Δεν βρέθηκε ο βοηθός. Παρακαλώ δοκιμάστε αργότερα.',
        confirmation: '',
      });
    }

    // Check for double-booking
    const existingAtTime = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.customerId, customer_id),
        eq(appointments.scheduledAt, scheduledAt),
        eq(appointments.status, 'confirmed'),
      ),
    });

    if (existingAtTime) {
      return c.json<AppointmentBookResponse>({
        success: false,
        message: `Η ώρα ${time} είναι ήδη κρατημένη. Παρακαλώ επιλέξτε άλλη ώρα.`,
        confirmation: '',
      });
    }

    // Create the appointment
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        customerId: customer_id,
        agentId: agent.id,
        callerName: caller_name,
        callerPhone: caller_phone,
        serviceType: service_type ?? null,
        scheduledAt,
        durationMinutes: 30,
        status: 'confirmed',
        notes: notes ?? null,
      })
      .returning();

    // TODO: Sync to Google Calendar if connected
    // TODO: Send push notification to customer

    const formattedDate = formatGreekDate(scheduledAt, customerTz);

    const confirmation = `Ραντεβού για ${caller_name}, ${formattedDate} στις ${time}`;

    log.info(
      { appointmentId: newAppointment?.id, scheduledAt },
      'Appointment booked successfully',
    );

    return c.json<AppointmentBookResponse>({
      success: true,
      appointment_id: newAppointment?.id,
      message: `Το ραντεβού κλείστηκε επιτυχώς για ${formattedDate} στις ${time}.`,
      confirmation,
    });
  } catch (error) {
    log.error({ error }, 'Appointment booking error');
    return c.json<AppointmentBookResponse>({
      success: false,
      message: 'Υπήρξε πρόβλημα με την κράτηση. Παρακαλώ δοκιμάστε αργότερα.',
      confirmation: '',
    });
  }
});
