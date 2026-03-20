// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Email Service (Resend) — Bilingual (el/en)
// Transactional emails: welcome, call summary, payment alerts,
// task notifications, appointment invites, B2B licensing.
// ═══════════════════════════════════════════════════════════════════

import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('email');

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = env.EMAIL_FROM;

// ── Locale helper ────────────────────────────────────────────────

type EmailLocale = 'el' | 'en';

/** Normalize DB locale (el-GR, en-US, etc.) to our simple el/en key */
function toEmailLocale(locale?: string | null): EmailLocale {
  if (!locale) return 'el';
  return locale.startsWith('en') ? 'en' : 'el';
}

// ── Email i18n strings ───────────────────────────────────────────

const i18n = {
  el: {
    // Common
    needHelp: 'Αν χρειάζεστε βοήθεια, απαντήστε σε αυτό το email.',
    goToDashboard: 'Μπείτε στο Dashboard →',
    viewDetails: 'Δείτε λεπτομέρειες →',
    viewInDashboard: 'Προβολή στο Dashboard →',
    // Welcome
    welcomeTitle: 'Καλώς ήρθατε!',
    welcomeSubject: (name: string) => `Καλώς ήρθατε στο VoiceForge AI, ${name}!`,
    welcomeGreeting: (name: string) => `Γεια σας <strong>${name}</strong>,`,
    welcomeReady: (agentName: string, bizName: string) =>
      `Ο AI βοηθός <strong>"${agentName}"</strong> για το <strong>"${bizName}"</strong> είναι έτοιμος!`,
    welcomePhone: 'Αριθμός τηλεφώνου',
    welcomeDesc: 'Ο βοηθός σας θα απαντά στις κλήσεις 24/7, θα κλείνει ραντεβού, και θα σας στέλνει περιλήψεις κάθε κλήσης.',
    welcomeText: (agent: string, biz: string) =>
      `Καλώς ήρθατε στο VoiceForge AI! Ο βοηθός "${agent}" για το "${biz}" είναι έτοιμος.`,
    // Call summary
    callSubject: (phone: string, dur: string) => `Νέα κλήση: ${phone} · ${dur} λεπτά`,
    callTitle: 'Νέα Κλήση',
    callAnswered: (agentName: string) => `Ο βοηθός <strong>${agentName}</strong> απάντησε`,
    callCaller: 'Καλών',
    callDuration: 'Διάρκεια',
    callSummaryLabel: 'Περίληψη:',
    callAppointment: '📅 Κλείστηκε ραντεβού',
    callNoSummary: 'Δεν υπάρχει διαθέσιμη περίληψη.',
    callText: (phone: string, dur: string, summary: string) =>
      `Νέα κλήση από ${phone} (${dur}). Περίληψη: ${summary}`,
    // Payment failed
    paymentSubject: '⚠️ Αποτυχία πληρωμής — VoiceForge AI',
    paymentTitle: '⚠️ Αποτυχία Πληρωμής',
    paymentGreeting: (name: string) => `Γεια σας <strong>${name}</strong>,`,
    paymentBody: 'Η τελευταία πληρωμή για τη συνδρομή σας στο VoiceForge AI δεν ολοκληρώθηκε. Παρακαλούμε ελέγξτε τα στοιχεία πληρωμής σας.',
    paymentCta: 'Ενημέρωση Πληρωμής →',
    paymentWarning: 'Αν η πληρωμή δεν ολοκληρωθεί εντός 7 ημερών, ο AI βοηθός σας θα σταματήσει να δέχεται κλήσεις.',
    paymentText: 'Η πληρωμή για τη συνδρομή σας στο VoiceForge AI δεν ολοκληρώθηκε. Ελέγξτε τα στοιχεία πληρωμής στις ρυθμίσεις.',
    // Registration (admin email — always Greek)
    regSubject: (company: string, plan: string) => `🆕 Νέα Εγγραφή: ${company} — ${plan}`,
    regTitle: '🆕 Νέα Εγγραφή Πελάτη',
    regName: 'Ονοματεπώνυμο',
    regCompany: 'Επωνυμία',
    regAfm: 'ΑΦΜ',
    regDoy: 'ΔΟΥ',
    regPhone: 'Τηλέφωνο',
    regAddress: 'Διεύθυνση',
    regPlan: 'Πακέτο',
    regDuration: 'Διάρκεια',
    regDurationUnit: 'μήνες',
    regTotal: 'Σύνολο',
    regPendingTitle: '⏳ Αναμονή πληρωμής μέσω τραπεζικής κατάθεσης',
    regPendingBody: (total: string) =>
      `Ελέγξτε αν η κατάθεση ${total} έχει πιστωθεί στον λογαριασμό. Μετά εγκρίνετε και στείλτε κλειδί.`,
    regAdminCta: 'Μετάβαση στο Admin Panel →',
    // License key
    licenseSubject: (company: string) => `🔑 Το κλειδί ενεργοποίησης για ${company} — VoiceForge AI`,
    licenseTitle: 'Κλειδί Ενεργοποίησης',
    licenseGreeting: (name: string) => `Γεια σας <strong>${name}</strong>,`,
    licenseBody: 'Η πληρωμή σας επιβεβαιώθηκε! Χρησιμοποιήστε το παρακάτω κλειδί για να ενεργοποιήσετε τον λογαριασμό σας στο VoiceForge AI:',
    licenseKeyLabel: 'Το κλειδί σας:',
    licensePlan: 'Πακέτο',
    licenseDuration: 'Διάρκεια',
    licenseDurationUnit: 'μήνες',
    licenseExpiry: 'Ισχύει μέχρι',
    licenseCta: 'Ενεργοποίηση Λογαριασμού →',
    licenseSteps: '<strong>Βήματα ενεργοποίησης:</strong><br/>1. Κάντε κλικ στο κουμπί «Ενεργοποίηση Λογαριασμού»<br/>2. Εισάγετε το κλειδί σας<br/>3. Ο λογαριασμός σας ενεργοποιείται αμέσως!',
    // Appointment invite
    aptSubject: (name: string, date: string, time: string) =>
      `📅 Νέο Ραντεβού: ${name} — ${date} ${time}`,
    aptTitle: 'Νέο Ραντεβού',
    aptBody: (bizName: string) =>
      `Κλείστηκε ραντεβού μέσω του AI βοηθού <strong>${bizName}</strong>.`,
    aptClient: 'Πελάτης',
    aptDate: 'Ημερομηνία',
    aptTime: 'Ώρα',
    aptService: 'Υπηρεσία',
    aptNotes: 'Σημειώσεις',
    aptIcsTitle: '📎 Συνημμένο αρχείο .ics',
    aptIcsBody: 'Ανοίξτε το συνημμένο αρχείο invite.ics για να προσθέσετε το ραντεβού στο ημερολόγιό σας αυτόματα.',
    aptText: (name: string, date: string, time: string, svc?: string) =>
      `Νέο ραντεβού: ${name} — ${date} ${time}${svc ? ` (${svc})` : ''}. Ανοίξτε το .ics αρχείο για να το προσθέσετε στο ημερολόγιό σας.`,
    // Task notification
    taskSubject: (title: string, agent: string) => `📋 Νέο Task: ${title} — ${agent}`,
    taskTitle: 'Νέο Task',
    taskActionRequired: 'Απαιτούμενη ενέργεια:',
    taskClient: 'Πελάτης',
    taskPhone: 'Τηλέφωνο',
    taskEmail: 'Email Πελάτη',
    taskAgent: 'AI Βοηθός',
    taskTranscript: '🎙️ Απομαγνητοφώνηση Συνομιλίας',
    taskConfirmBtn: '✅ Ολοκληρώθηκε',
    taskConfirmHint: 'Πατήστε όταν ολοκληρωθεί η ενέργεια',
    taskText: (title: string, desc: string, action: string) =>
      `Νέο Task: ${title}\n${desc}\nΕνέργεια: ${action}`,
    priorityLabels: { urgent: '🔴 Επείγον', high: '🟡 Υψηλή', normal: '🔵 Κανονική', low: '⚪ Χαμηλή' } as Record<string, string>,
    // Task reminder
    reminderSubject: (title: string, hours: number) =>
      `⏰ Υπενθύμιση: ${title} — Εκκρεμεί ${hours}+ ώρες`,
    reminderTitle: (hours: number) => `Εκκρεμές Task — ${hours} ώρες`,
    reminderBody: (title: string, agent: string, hours: number) =>
      `Το task <strong>"${title}"</strong> από τον βοηθό <strong>${agent}</strong> παραμένει σε αναμονή εδώ και <strong>${hours} ώρες</strong>.`,
    reminderNumber: (n: number) => `Υπενθύμιση #${n}`,
    reminderText: (title: string, hours: number) =>
      `Υπενθύμιση: Task "${title}" εκκρεμεί ${hours}+ ώρες.`,
  },
  en: {
    // Common
    needHelp: 'If you need help, reply to this email.',
    goToDashboard: 'Go to Dashboard →',
    viewDetails: 'View details →',
    viewInDashboard: 'View in Dashboard →',
    // Welcome
    welcomeTitle: 'Welcome!',
    welcomeSubject: (name: string) => `Welcome to VoiceForge AI, ${name}!`,
    welcomeGreeting: (name: string) => `Hello <strong>${name}</strong>,`,
    welcomeReady: (agentName: string, bizName: string) =>
      `Your AI assistant <strong>"${agentName}"</strong> for <strong>"${bizName}"</strong> is ready!`,
    welcomePhone: 'Phone number',
    welcomeDesc: 'Your assistant will answer calls 24/7, book appointments, and send you a summary of every call.',
    welcomeText: (agent: string, biz: string) =>
      `Welcome to VoiceForge AI! Your assistant "${agent}" for "${biz}" is ready.`,
    // Call summary
    callSubject: (phone: string, dur: string) => `New call: ${phone} · ${dur} min`,
    callTitle: 'New Call',
    callAnswered: (agentName: string) => `Assistant <strong>${agentName}</strong> answered`,
    callCaller: 'Caller',
    callDuration: 'Duration',
    callSummaryLabel: 'Summary:',
    callAppointment: '📅 Appointment booked',
    callNoSummary: 'No summary available.',
    callText: (phone: string, dur: string, summary: string) =>
      `New call from ${phone} (${dur}). Summary: ${summary}`,
    // Payment failed
    paymentSubject: '⚠️ Payment failed — VoiceForge AI',
    paymentTitle: '⚠️ Payment Failed',
    paymentGreeting: (name: string) => `Hello <strong>${name}</strong>,`,
    paymentBody: 'Your latest subscription payment for VoiceForge AI was not completed. Please check your payment details.',
    paymentCta: 'Update Payment →',
    paymentWarning: 'If payment is not completed within 7 days, your AI assistant will stop receiving calls.',
    paymentText: 'Your VoiceForge AI subscription payment was not completed. Check your payment details in settings.',
    // Registration (admin email — always Greek, but defining for completeness)
    regSubject: (company: string, plan: string) => `🆕 New Registration: ${company} — ${plan}`,
    regTitle: '🆕 New Customer Registration',
    regName: 'Full Name',
    regCompany: 'Company',
    regAfm: 'Tax ID',
    regDoy: 'Tax Office',
    regPhone: 'Phone',
    regAddress: 'Address',
    regPlan: 'Plan',
    regDuration: 'Duration',
    regDurationUnit: 'months',
    regTotal: 'Total',
    regPendingTitle: '⏳ Awaiting bank transfer payment',
    regPendingBody: (total: string) =>
      `Check if the ${total} deposit has been credited. Then approve and send the key.`,
    regAdminCta: 'Go to Admin Panel →',
    // License key
    licenseSubject: (company: string) => `🔑 Your activation key for ${company} — VoiceForge AI`,
    licenseTitle: 'Activation Key',
    licenseGreeting: (name: string) => `Hello <strong>${name}</strong>,`,
    licenseBody: 'Your payment has been confirmed! Use the key below to activate your VoiceForge AI account:',
    licenseKeyLabel: 'Your key:',
    licensePlan: 'Plan',
    licenseDuration: 'Duration',
    licenseDurationUnit: 'months',
    licenseExpiry: 'Valid until',
    licenseCta: 'Activate Account →',
    licenseSteps: '<strong>Activation steps:</strong><br/>1. Click the "Activate Account" button<br/>2. Enter your key<br/>3. Your account is activated immediately!',
    // Appointment invite
    aptSubject: (name: string, date: string, time: string) =>
      `📅 New Appointment: ${name} — ${date} ${time}`,
    aptTitle: 'New Appointment',
    aptBody: (bizName: string) =>
      `An appointment was booked via the AI assistant of <strong>${bizName}</strong>.`,
    aptClient: 'Client',
    aptDate: 'Date',
    aptTime: 'Time',
    aptService: 'Service',
    aptNotes: 'Notes',
    aptIcsTitle: '📎 Attached .ics file',
    aptIcsBody: 'Open the attached invite.ics file to add the appointment to your calendar automatically.',
    aptText: (name: string, date: string, time: string, svc?: string) =>
      `New appointment: ${name} — ${date} ${time}${svc ? ` (${svc})` : ''}. Open the .ics file to add it to your calendar.`,
    // Task notification
    taskSubject: (title: string, agent: string) => `📋 New Task: ${title} — ${agent}`,
    taskTitle: 'New Task',
    taskActionRequired: 'Action required:',
    taskClient: 'Client',
    taskPhone: 'Phone',
    taskEmail: 'Client Email',
    taskAgent: 'AI Assistant',
    taskTranscript: '🎙️ Conversation Transcript',
    taskConfirmBtn: '✅ Completed',
    taskConfirmHint: 'Click when the action is completed',
    taskText: (title: string, desc: string, action: string) =>
      `New Task: ${title}\n${desc}\nAction: ${action}`,
    priorityLabels: { urgent: '🔴 Urgent', high: '🟡 High', normal: '🔵 Normal', low: '⚪ Low' } as Record<string, string>,
    // Task reminder
    reminderSubject: (title: string, hours: number) =>
      `⏰ Reminder: ${title} — Pending ${hours}+ hours`,
    reminderTitle: (hours: number) => `Pending Task — ${hours} hours`,
    reminderBody: (title: string, agent: string, hours: number) =>
      `The task <strong>"${title}"</strong> from assistant <strong>${agent}</strong> has been pending for <strong>${hours} hours</strong>.`,
    reminderNumber: (n: number) => `Reminder #${n}`,
    reminderText: (title: string, hours: number) =>
      `Reminder: Task "${title}" pending ${hours}+ hours.`,
  },
} as const;

/** Get translations for a locale */
function t(locale?: string | null) {
  return i18n[toEmailLocale(locale)];
}

// ── HTML Sanitization — prevents XSS in transactional emails ─────

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Check if email service is configured */
export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

// ── Core Send Function ───────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string }>; // content = base64
}

async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  if (!env.RESEND_API_KEY) {
    log.warn('RESEND_API_KEY not configured — skipping email');
    return { id: 'skipped' };
  }

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  };

  // Resend API supports attachments as [{filename, content (base64)}]
  if (params.attachments && params.attachments.length > 0) {
    body.attachments = params.attachments;
  }

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text();
    log.error({ status: response.status, body }, 'Email send failed');
    throw new Error(`Email send failed: ${response.status} ${body}`);
  }

  const result = (await response.json()) as { id: string };
  log.info({ emailId: result.id, to: params.to, subject: params.subject }, 'Email sent');
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Pre-built Email Templates (Bilingual el/en)
// ═══════════════════════════════════════════════════════════════════

/**
 * Welcome email — sent after onboarding completion.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  ownerName: string;
  businessName: string;
  agentName: string;
  phoneNumber?: string;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const phoneSection = params.phoneNumber
    ? `<p style="font-size:16px;color:#333;">📞 ${s.welcomePhone}: <strong>${escapeHtml(params.phoneNumber)}</strong></p>`
    : '';

  await sendEmail({
    to: params.to,
    subject: s.welcomeSubject(escapeHtml(params.ownerName)),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">🎙️</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">${s.welcomeTitle}</h1>
          </div>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.welcomeGreeting(escapeHtml(params.ownerName))}</p>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.welcomeReady(escapeHtml(params.agentName), escapeHtml(params.businessName))}</p>
          ${phoneSection}
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.welcomeDesc}</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/dashboard" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${s.goToDashboard}</a>
          </div>
          <p style="font-size:14px;color:#64748b;line-height:1.6;">${s.needHelp}</p>
        </div>
      </body></html>`,
    text: s.welcomeText(params.agentName, params.businessName),
  });
}

/**
 * Call summary email — sent after each completed call.
 */
export async function sendCallSummaryEmail(params: {
  to: string;
  ownerName: string;
  callerPhone: string;
  agentName: string;
  durationSeconds: number;
  summary: string;
  sentiment?: number;
  appointmentBooked: boolean;
  callId: string;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const minutes = Math.floor(params.durationSeconds / 60);
  const seconds = params.durationSeconds % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const sentimentEmoji = params.sentiment
    ? params.sentiment >= 4 ? '😊' : params.sentiment >= 3 ? '😐' : '😟'
    : '';
  const appointmentBadge = params.appointmentBooked
    ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:13px;">${s.callAppointment}</span>`
    : '';

  await sendEmail({
    to: params.to,
    subject: s.callSubject(params.callerPhone, duration),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px;color:#1e293b;margin-bottom:4px;">📞 ${s.callTitle}</h2>
          <p style="font-size:14px;color:#64748b;margin-top:0;">${s.callAnswered(escapeHtml(params.agentName))}</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">${s.callCaller}</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerPhone)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">${s.callDuration}</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${duration}</td>
            </tr>
            ${params.sentiment ? `<tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Sentiment</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${sentimentEmoji} ${params.sentiment}/5</td>
            </tr>` : ''}
          </table>
          ${appointmentBadge ? `<div style="margin-bottom:16px;">${appointmentBadge}</div>` : ''}
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;font-weight:600;">${s.callSummaryLabel}</p>
            <p style="font-size:14px;color:#334155;line-height:1.6;margin:0;">${escapeHtml(params.summary)}</p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/dashboard/calls/${params.callId}" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">${s.viewDetails}</a>
          </div>
        </div>
      </body></html>`,
    text: s.callText(escapeHtml(params.callerPhone), duration, escapeHtml(params.summary)),
  });
}

/**
 * Payment failure notification email.
 */
export async function sendPaymentFailedEmail(params: {
  to: string;
  ownerName: string;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);

  await sendEmail({
    to: params.to,
    subject: s.paymentSubject,
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px;color:#dc2626;">${s.paymentTitle}</h2>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.paymentGreeting(escapeHtml(params.ownerName))}</p>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.paymentBody}</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/dashboard/settings" style="background:#dc2626;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${s.paymentCta}</a>
          </div>
          <p style="font-size:14px;color:#64748b;">${s.paymentWarning}</p>
        </div>
      </body></html>`,
    text: s.paymentText,
  });
}

// ═══════════════════════════════════════════════════════════════════
// B2B Licensing Emails
// ═══════════════════════════════════════════════════════════════════

/**
 * Send notification to admin about a new business registration.
 * NOTE: Admin emails always use Greek locale.
 */
export async function sendRegistrationNotificationEmail(params: {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  afm: string;
  doy: string;
  phone: string;
  businessAddress: string;
  plan: string;
  durationMonths: number;
}): Promise<void> {
  const s = t('el'); // Admin email — always Greek

  const planLabels: Record<string, string> = {
    basic: 'Basic — €200/μήνα',
    pro: 'Pro — €400/μήνα',
    enterprise: 'Enterprise — €999/μήνα',
  };

  const totalPrice = `€${(
        { basic: 200, pro: 400, enterprise: 999 }[params.plan] ?? 0
      ) * params.durationMonths}`;

  const adminEmail = env.ADMIN_EMAIL;

  await sendEmail({
    to: adminEmail,
    subject: s.regSubject(escapeHtml(params.companyName), planLabels[params.plan] || params.plan),
    html: `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="font-size:22px;color:#1e293b;margin-bottom:24px;">${s.regTitle}</h1>
          <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;width:140px;">${s.regName}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(params.firstName)} ${escapeHtml(params.lastName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Email</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.email)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regCompany}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(params.companyName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regAfm}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.afm)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regDoy}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.doy)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regPhone}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.phone)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regAddress}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.businessAddress)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regPlan}</td>
              <td style="padding:10px 0;color:#2563eb;font-size:14px;font-weight:600;">${planLabels[params.plan] || escapeHtml(params.plan)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regDuration}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${params.durationMonths} ${s.regDurationUnit}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.regTotal}</td>
              <td style="padding:10px 0;color:#16a34a;font-size:16px;font-weight:700;">${totalPrice}</td>
            </tr>
          </table>
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-top:24px;">
            <p style="font-size:14px;color:#92400e;margin:0;font-weight:600;">${s.regPendingTitle}</p>
            <p style="font-size:13px;color:#92400e;margin:8px 0 0 0;">${s.regPendingBody(totalPrice)}</p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/admin" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${s.regAdminCta}</a>
          </div>
        </div>
      </body></html>`,
    text: `New registration: ${params.companyName} (${params.firstName} ${params.lastName}) — ${planLabels[params.plan] || params.plan}, ${params.durationMonths} months, Total: ${totalPrice}`,
  });
}

/**
 * Send license key to customer after admin approval.
 */
export async function sendLicenseKeyEmail(params: {
  to: string;
  firstName: string;
  companyName: string;
  licenseKey: string;
  plan: string;
  durationMonths: number;
  expiresAt: Date;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const planLabels: Record<string, string> = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
  const dateLocale = lang === 'el' ? 'el-GR' : 'en-US';
  const formattedExpiry = params.expiresAt.toLocaleDateString(dateLocale, {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  await sendEmail({
    to: params.to,
    subject: s.licenseSubject(escapeHtml(params.companyName)),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">🔑</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">${s.licenseTitle}</h1>
          </div>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.licenseGreeting(escapeHtml(params.firstName))}</p>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.licenseBody}</p>
          <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:2px dashed #2563eb;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;">${s.licenseKeyLabel}</p>
            <p style="font-size:28px;color:#1e293b;font-weight:800;letter-spacing:3px;margin:0;font-family:monospace;">${escapeHtml(params.licenseKey)}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">${s.licensePlan}</td>
              <td style="padding:8px 0;color:#2563eb;font-size:14px;font-weight:600;text-align:right;">${planLabels[params.plan] || escapeHtml(params.plan)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">${s.licenseDuration}</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${params.durationMonths} ${s.licenseDurationUnit}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">${s.licenseExpiry}</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${formattedExpiry}</td>
            </tr>
          </table>
          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/activate" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${s.licenseCta}</a>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:16px;">
            <p style="font-size:13px;color:#64748b;margin:0;line-height:1.6;">${s.licenseSteps}</p>
          </div>
          <p style="font-size:14px;color:#64748b;line-height:1.6;margin-top:24px;">${s.needHelp}</p>
        </div>
      </body></html>`,
    text: `${s.licenseTitle}: ${params.licenseKey} — ${planLabels[params.plan] || params.plan}, ${params.durationMonths} ${s.licenseDurationUnit}, ${s.licenseExpiry}: ${formattedExpiry}`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// Appointment Invite Email (with .ics attachment)
// ═══════════════════════════════════════════════════════════════════

export async function sendAppointmentInviteEmail(params: {
  to: string;
  businessName: string;
  callerName: string;
  date: string;
  time: string;
  serviceType?: string;
  notes?: string;
  icsContent: string;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const icsBase64 = Buffer.from(params.icsContent, 'utf-8').toString('base64');

  await sendEmail({
    to: params.to,
    subject: s.aptSubject(escapeHtml(params.callerName), params.date, params.time),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">📅</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">${s.aptTitle}</h1>
          </div>
          <p style="font-size:16px;color:#333;line-height:1.6;">${s.aptBody(escapeHtml(params.businessName))}</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.aptClient}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.aptDate}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.date)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.aptTime}</td>
              <td style="padding:10px 0;color:#2563eb;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(params.time)}</td>
            </tr>
            ${params.serviceType ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.aptService}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.serviceType)}</td>
            </tr>` : ''}
            ${params.notes ? `<tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.aptNotes}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.notes)}</td>
            </tr>` : ''}
          </table>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="font-size:14px;color:#1d4ed8;margin:0;font-weight:600;">${s.aptIcsTitle}</p>
            <p style="font-size:13px;color:#3b82f6;margin:8px 0 0 0;">${s.aptIcsBody}</p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/dashboard/calendar" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">${s.viewInDashboard}</a>
          </div>
        </div>
      </body></html>`,
    text: s.aptText(params.callerName, params.date, params.time, params.serviceType),
    attachments: [{ filename: 'invite.ics', content: icsBase64 }],
  });
}

// ═══════════════════════════════════════════════════════════════════
// Unified Call Notification
// ═══════════════════════════════════════════════════════════════════

export async function notifyCallCompleted(params: {
  callId: string;
  customerEmail: string;
  ownerName: string;
  callerPhone: string;
  agentName: string;
  durationSeconds: number;
  summary: string | null;
  sentiment: number | null;
  appointmentBooked: boolean;
  locale?: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  const s = t(params.locale);
  try {
    await sendCallSummaryEmail({
      to: params.customerEmail,
      ownerName: params.ownerName,
      callerPhone: params.callerPhone,
      agentName: params.agentName,
      durationSeconds: params.durationSeconds,
      summary: params.summary ?? s.callNoSummary,
      sentiment: params.sentiment ?? undefined,
      appointmentBooked: params.appointmentBooked,
      callId: params.callId,
      locale: params.locale,
    });
    log.info({ callId: params.callId, to: params.customerEmail }, 'Call summary email sent');
  } catch (err) {
    log.error({ error: err, callId: params.callId }, 'Failed to send call summary email');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Post-Call Task Notification Email
// ═══════════════════════════════════════════════════════════════════

export async function sendTaskNotificationEmail(params: {
  to: string;
  taskTitle: string;
  taskDescription: string;
  actionRequired: string;
  priority: string;
  callerName: string | null;
  callerPhone: string | null;
  callerEmail: string | null;
  agentName: string;
  confirmUrl: string;
  transcript?: string | null;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const priorityColors: Record<string, string> = {
    urgent: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#6b7280',
  };
  const pColor = priorityColors[params.priority] || '#3b82f6';
  const pLabel = s.priorityLabels[params.priority] || params.priority;

  await sendEmail({
    to: params.to,
    subject: s.taskSubject(params.taskTitle, params.agentName),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">📋</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">${s.taskTitle}</h1>
            <span style="display:inline-block;background:${pColor}15;color:${pColor};font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-top:8px;">${pLabel}</span>
          </div>
          <h2 style="font-size:18px;color:#1e293b;margin:0 0 12px 0;">${escapeHtml(params.taskTitle)}</h2>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 20px 0;">${escapeHtml(params.taskDescription)}</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 4px 0;font-weight:600;">${s.taskActionRequired}</p>
            <p style="font-size:14px;color:#1e293b;margin:0;">${escapeHtml(params.actionRequired)}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            ${params.callerName ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.taskClient}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerName)}</td>
            </tr>` : ''}
            ${params.callerPhone ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.taskPhone}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerPhone)}</td>
            </tr>` : ''}
            ${params.callerEmail ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.taskEmail}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;"><a href="mailto:${escapeHtml(params.callerEmail)}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(params.callerEmail)}</a></td>
            </tr>` : ''}
            <tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">${s.taskAgent}</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.agentName)}</td>
            </tr>
          </table>
          ${params.transcript ? `<div style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:#f1f5f9;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${s.taskTranscript}</p>
            </div>
            <div style="padding:16px;max-height:400px;overflow-y:auto;background:#fafafa;">
              <pre style="font-family:Inter,system-ui,sans-serif;font-size:13px;color:#334155;line-height:1.8;margin:0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(params.transcript)}</pre>
            </div>
          </div>` : ''}
          <div style="text-align:center;margin-top:32px;">
            <a href="${params.confirmUrl}" style="display:inline-block;background:#10b981;color:white;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">${s.taskConfirmBtn}</a>
            <p style="font-size:12px;color:#94a3b8;margin-top:12px;">${s.taskConfirmHint}</p>
          </div>
        </div>
      </body></html>`,
    text: s.taskText(params.taskTitle, params.taskDescription, params.actionRequired) + (params.transcript ? `\n\nTranscript:\n${params.transcript}\n` : '') + `\n${params.confirmUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// Task Reminder Email
// ═══════════════════════════════════════════════════════════════════

export async function sendTaskReminderEmail(params: {
  to: string;
  taskTitle: string;
  hoursElapsed: number;
  reminderNumber: number;
  confirmUrl: string;
  agentName: string;
  locale?: string;
}): Promise<void> {
  const s = t(params.locale);
  const lang = toEmailLocale(params.locale);
  const hours = Math.round(params.hoursElapsed);

  await sendEmail({
    to: params.to,
    subject: s.reminderSubject(params.taskTitle, hours),
    html: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:48px;">⏰</span>
            <h1 style="font-size:22px;color:#f59e0b;margin-top:12px;">${s.reminderTitle(hours)}</h1>
          </div>
          <p style="font-size:15px;color:#475569;line-height:1.6;text-align:center;">
            ${s.reminderBody(escapeHtml(params.taskTitle), escapeHtml(params.agentName), hours)}
          </p>
          <p style="font-size:13px;color:#94a3b8;text-align:center;margin:4px 0 24px 0;">${s.reminderNumber(params.reminderNumber)}</p>
          <div style="text-align:center;">
            <a href="${params.confirmUrl}" style="display:inline-block;background:#10b981;color:white;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">${s.taskConfirmBtn}</a>
          </div>
        </div>
      </body></html>`,
    text: s.reminderText(params.taskTitle, hours) + ` ${params.confirmUrl}`,
  });
}
