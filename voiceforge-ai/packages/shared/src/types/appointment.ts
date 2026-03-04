import type { AppointmentStatus } from '../constants';

/** Appointment booked via AI agent */
export interface Appointment {
  id: string;
  customerId: string;
  agentId: string;
  callId: string | null; // Linked call that created this appointment
  callerName: string;
  callerPhone: string;
  serviceType: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  googleEventId: string | null; // Synced Google Calendar event
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload for creating an appointment (from AI tool webhook) */
export interface CreateAppointmentInput {
  callerName: string;
  callerPhone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  serviceType?: string;
  durationMinutes?: number;
  notes?: string;
}

/** Available time slot */
export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
}

/** Appointment summary for list views */
export interface AppointmentSummary {
  id: string;
  callerName: string;
  callerPhone: string;
  serviceType: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  agentName: string;
}
