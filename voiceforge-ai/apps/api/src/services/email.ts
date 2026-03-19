// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Email Service (Resend)
// Transactional emails: welcome, call summary, payment alerts.
// ═══════════════════════════════════════════════════════════════════

import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('email');

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = env.EMAIL_FROM;

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
// Pre-built Email Templates
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
}): Promise<void> {
  const phoneSection = params.phoneNumber
    ? `<p style="font-size:16px;color:#333;">
        📞 Αριθμός τηλεφώνου: <strong>${escapeHtml(params.phoneNumber)}</strong>
       </p>`
    : '';

  await sendEmail({
    to: params.to,
    subject: `Καλώς ήρθατε στο VoiceForge AI, ${escapeHtml(params.ownerName)}!`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">🎙️</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">Καλώς ήρθατε!</h1>
          </div>

          <p style="font-size:16px;color:#333;line-height:1.6;">
            Γεια σας <strong>${escapeHtml(params.ownerName)}</strong>,
          </p>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Ο AI βοηθός <strong>“${escapeHtml(params.agentName)}”</strong> για το
            <strong>“${escapeHtml(params.businessName)}”</strong> είναι έτοιμος!
          </p>
          ${phoneSection}
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Ο βοηθός σας θα απαντά στις κλήσεις 24/7, θα κλείνει ραντεβού,
            και θα σας στέλνει περιλήψεις κάθε κλήσης.
          </p>

          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/dashboard" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
              Μπείτε στο Dashboard →
            </a>
          </div>

          <p style="font-size:14px;color:#64748b;line-height:1.6;">
            Αν χρειάζεστε βοήθεια, απαντήστε σε αυτό το email.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Καλώς ήρθατε στο VoiceForge AI! Ο βοηθός "${params.agentName}" για το "${params.businessName}" είναι έτοιμος.`,
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
}): Promise<void> {
  const minutes = Math.floor(params.durationSeconds / 60);
  const seconds = params.durationSeconds % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const sentimentEmoji = params.sentiment
    ? params.sentiment >= 4 ? '😊' : params.sentiment >= 3 ? '😐' : '😟'
    : '';

  const appointmentBadge = params.appointmentBooked
    ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:13px;">📅 Κλείστηκε ραντεβού</span>'
    : '';

  await sendEmail({
    to: params.to,
    subject: `Νέα κλήση: ${params.callerPhone} · ${duration} λεπτά`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px;color:#1e293b;margin-bottom:4px;">📞 Νέα Κλήση</h2>
          <p style="font-size:14px;color:#64748b;margin-top:0;">
            Ο βοηθός <strong>${escapeHtml(params.agentName)}</strong> απάντησε
          </p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Καλών</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerPhone)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Διάρκεια</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${duration}</td>
            </tr>
            ${params.sentiment ? `
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Sentiment</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${sentimentEmoji} ${params.sentiment}/5</td>
            </tr>` : ''}
          </table>

          ${appointmentBadge ? `<div style="margin-bottom:16px;">${appointmentBadge}</div>` : ''}

          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;font-weight:600;">Περίληψη:</p>
            <p style="font-size:14px;color:#334155;line-height:1.6;margin:0;">${escapeHtml(params.summary)}</p>
          </div>

          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/dashboard/calls/${params.callId}" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">
              Δείτε λεπτομέρειες →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Νέα κλήση από ${escapeHtml(params.callerPhone)} (${duration}). Περίληψη: ${escapeHtml(params.summary)}`,
  });
}

/**
 * Payment failure notification email.
 */
export async function sendPaymentFailedEmail(params: {
  to: string;
  ownerName: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: '⚠️ Αποτυχία πληρωμής — VoiceForge AI',
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px;color:#dc2626;">⚠️ Αποτυχία Πληρωμής</h2>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Γεια σας <strong>${escapeHtml(params.ownerName)}</strong>,
          </p>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Η τελευταία πληρωμή για τη συνδρομή σας στο VoiceForge AI δεν ολοκληρώθηκε.
            Παρακαλούμε ελέγξτε τα στοιχεία πληρωμής σας.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/dashboard/settings" style="background:#dc2626;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
              Ενημέρωση Πληρωμής →
            </a>
          </div>
          <p style="font-size:14px;color:#64748b;">
            Αν η πληρωμή δεν ολοκληρωθεί εντός 7 ημερών, ο AI βοηθός σας θα σταματήσει να δέχεται κλήσεις.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Η πληρωμή για τη συνδρομή σας στο VoiceForge AI δεν ολοκληρώθηκε. Ελέγξτε τα στοιχεία πληρωμής στις ρυθμίσεις.`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// B2B Licensing Emails
// ═══════════════════════════════════════════════════════════════════

/**
 * Send notification to admin about a new business registration.
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
  const planLabels: Record<string, string> = {
    basic: 'Basic — €200/μήνα',
    pro: 'Pro — €400/μήνα',
    enterprise: 'Enterprise — €999/μήνα',
  };

  const totalPrice = `€${(
        { basic: 200, pro: 400, enterprise: 999 }[params.plan] ?? 0
      ) * params.durationMonths}`;

  // Admin email — in production, set this via env var
  const adminEmail = env.ADMIN_EMAIL;

  await sendEmail({
    to: adminEmail,
    subject: `🆕 Νέα Εγγραφή: ${escapeHtml(params.companyName)} — ${planLabels[params.plan] || params.plan}`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="font-size:22px;color:#1e293b;margin-bottom:24px;">🆕 Νέα Εγγραφή Πελάτη</h1>

          <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;width:140px;">Ονοματεπώνυμο</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(params.firstName)} ${escapeHtml(params.lastName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Email</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.email)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Επωνυμία</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(params.companyName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">ΑΦΜ</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.afm)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">ΔΟΥ</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.doy)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Τηλέφωνο</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.phone)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Διεύθυνση</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${escapeHtml(params.businessAddress)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Πακέτο</td>
              <td style="padding:10px 0;color:#2563eb;font-size:14px;font-weight:600;">${planLabels[params.plan] || escapeHtml(params.plan)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Διάρκεια</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;">${params.durationMonths} μήνες</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Σύνολο</td>
              <td style="padding:10px 0;color:#16a34a;font-size:16px;font-weight:700;">${totalPrice}</td>
            </tr>
          </table>

          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-top:24px;">
            <p style="font-size:14px;color:#92400e;margin:0;font-weight:600;">
              ⏳ Αναμονή πληρωμής μέσω τραπεζικής κατάθεσης
            </p>
            <p style="font-size:13px;color:#92400e;margin:8px 0 0 0;">
              Ελέγξτε αν η κατάθεση ${totalPrice} έχει πιστωθεί στον λογαριασμό. Μετά εγκρίνετε και στείλτε κλειδί.
            </p>
          </div>

          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/admin" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
              Μετάβαση στο Admin Panel →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Νέα εγγραφή: ${params.companyName} (${params.firstName} ${params.lastName}) — ${planLabels[params.plan] || params.plan}, ${params.durationMonths} μήνες, Σύνολο: ${totalPrice}`,
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
}): Promise<void> {
  const planLabels: Record<string, string> = {
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  const formattedExpiry = params.expiresAt.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  await sendEmail({
    to: params.to,
    subject: `🔑 Το κλειδί ενεργοποίησης για ${escapeHtml(params.companyName)} — VoiceForge AI`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">🔑</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">Κλειδί Ενεργοποίησης</h1>
          </div>

          <p style="font-size:16px;color:#333;line-height:1.6;">
            Γεια σας <strong>${escapeHtml(params.firstName)}</strong>,
          </p>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Η πληρωμή σας επιβεβαιώθηκε! Χρησιμοποιήστε το παρακάτω κλειδί για να ενεργοποιήσετε
            τον λογαριασμό σας στο VoiceForge AI:
          </p>

          <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:2px dashed #2563eb;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;">Το κλειδί σας:</p>
            <p style="font-size:28px;color:#1e293b;font-weight:800;letter-spacing:3px;margin:0;font-family:monospace;">
              ${escapeHtml(params.licenseKey)}
            </p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Πακέτο</td>
              <td style="padding:8px 0;color:#2563eb;font-size:14px;font-weight:600;text-align:right;">${planLabels[params.plan] || escapeHtml(params.plan)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Διάρκεια</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;text-align:right;">${params.durationMonths} μήνες</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">Ισχύει μέχρι</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${formattedExpiry}</td>
            </tr>
          </table>

          <div style="text-align:center;margin:32px 0;">
            <a href="${env.FRONTEND_URL}/activate" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
              Ενεργοποίηση Λογαριασμού →
            </a>
          </div>

          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:16px;">
            <p style="font-size:13px;color:#64748b;margin:0;line-height:1.6;">
              <strong>Βήματα ενεργοποίησης:</strong><br/>
              1. Κάντε κλικ στο κουμπί «Ενεργοποίηση Λογαριασμού»<br/>
              2. Εισάγετε το κλειδί σας<br/>
              3. Ο λογαριασμός σας ενεργοποιείται αμέσως!
            </p>
          </div>

          <p style="font-size:14px;color:#64748b;line-height:1.6;margin-top:24px;">
            Αν χρειάζεστε βοήθεια, απαντήστε σε αυτό το email.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Κλειδί ενεργοποίησης VoiceForge AI: ${params.licenseKey} — Πακέτο: ${planLabels[params.plan] || params.plan}, Διάρκεια: ${params.durationMonths} μήνες, Ισχύει μέχρι: ${formattedExpiry}. Ενεργοποιήστε στο: ${env.FRONTEND_URL}/activate`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// Appointment Invite Email (with .ics attachment)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send appointment confirmation email with .ics calendar invite attachment.
 * The .ics file is auto-accepted by most calendar apps (Google, Outlook, Apple).
 */
export async function sendAppointmentInviteEmail(params: {
  to: string;
  businessName: string;
  callerName: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  serviceType?: string;
  notes?: string;
  icsContent: string; // Generated .ics file content
}): Promise<void> {
  const icsBase64 = Buffer.from(params.icsContent, 'utf-8').toString('base64');

  await sendEmail({
    to: params.to,
    subject: `📅 Νέο Ραντεβού: ${escapeHtml(params.callerName)} — ${params.date} ${params.time}`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">📅</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">Νέο Ραντεβού</h1>
          </div>

          <p style="font-size:16px;color:#333;line-height:1.6;">
            Κλείστηκε ραντεβού μέσω του AI βοηθού <strong>${escapeHtml(params.businessName)}</strong>.
          </p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Πελάτης</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Ημερομηνία</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.date)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Ώρα</td>
              <td style="padding:10px 0;color:#2563eb;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(params.time)}</td>
            </tr>
            ${params.serviceType ? `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Υπηρεσία</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.serviceType)}</td>
            </tr>` : ''}
            ${params.notes ? `
            <tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Σημειώσεις</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.notes)}</td>
            </tr>` : ''}
          </table>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="font-size:14px;color:#1d4ed8;margin:0;font-weight:600;">
              📎 Συνημμένο αρχείο .ics
            </p>
            <p style="font-size:13px;color:#3b82f6;margin:8px 0 0 0;">
              Ανοίξτε το συνημμένο αρχείο invite.ics για να προσθέσετε το ραντεβού στο ημερολόγιό σας αυτόματα.
            </p>
          </div>

          <div style="text-align:center;margin-top:24px;">
            <a href="${env.FRONTEND_URL}/dashboard/calendar" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">
              Προβολή στο Dashboard →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Νέο ραντεβού: ${params.callerName} — ${params.date} ${params.time}${params.serviceType ? ` (${params.serviceType})` : ''}. Ανοίξτε το .ics αρχείο για να το προσθέσετε στο ημερολόγιό σας.`,
    attachments: [
      {
        filename: 'invite.ics',
        content: icsBase64,
      },
    ],
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
}): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    await sendCallSummaryEmail({
      to: params.customerEmail,
      ownerName: params.ownerName,
      callerPhone: params.callerPhone,
      agentName: params.agentName,
      durationSeconds: params.durationSeconds,
      summary: params.summary ?? 'Δεν υπάρχει διαθέσιμη περίληψη.',
      sentiment: params.sentiment ?? undefined,
      appointmentBooked: params.appointmentBooked,
      callId: params.callId,
    });
    log.info({ callId: params.callId, to: params.customerEmail }, 'Call summary email sent');
  } catch (err) {
    log.error({ error: err, callId: params.callId }, 'Failed to send call summary email');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Post-Call Task Notification Email
// Sent to department email with confirm link
// ═══════════════════════════════════════════════════════════════════

export async function sendTaskNotificationEmail(params: {
  to: string;
  taskTitle: string;
  taskDescription: string;
  actionRequired: string;
  priority: string;
  callerName: string | null;
  callerPhone: string | null;
  agentName: string;
  confirmUrl: string;
}): Promise<void> {
  const priorityColors: Record<string, string> = {
    urgent: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#6b7280',
  };
  const priorityLabels: Record<string, string> = {
    urgent: '🔴 Επείγον', high: '🟡 Υψηλή', normal: '🔵 Κανονική', low: '⚪ Χαμηλή',
  };
  const pColor = priorityColors[params.priority] || '#3b82f6';
  const pLabel = priorityLabels[params.priority] || params.priority;

  await sendEmail({
    to: params.to,
    subject: `📋 Νέο Task: ${params.taskTitle} — ${params.agentName}`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:24px;color:white;">📋</span>
            </div>
            <h1 style="font-size:24px;color:#1e293b;margin-top:16px;">Νέο Task</h1>
            <span style="display:inline-block;background:${pColor}15;color:${pColor};font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-top:8px;">
              ${pLabel}
            </span>
          </div>

          <h2 style="font-size:18px;color:#1e293b;margin:0 0 12px 0;">${escapeHtml(params.taskTitle)}</h2>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 20px 0;">${escapeHtml(params.taskDescription)}</p>

          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="font-size:13px;color:#64748b;margin:0 0 4px 0;font-weight:600;">Απαιτούμενη ενέργεια:</p>
            <p style="font-size:14px;color:#1e293b;margin:0;">${escapeHtml(params.actionRequired)}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            ${params.callerName ? `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Πελάτης</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerName)}</td>
            </tr>` : ''}
            ${params.callerPhone ? `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 0;color:#64748b;font-size:14px;">Τηλέφωνο</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.callerPhone)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:10px 0;color:#64748b;font-size:14px;">AI Βοηθός</td>
              <td style="padding:10px 0;color:#1e293b;font-size:14px;text-align:right;">${escapeHtml(params.agentName)}</td>
            </tr>
          </table>

          <div style="text-align:center;margin-top:32px;">
            <a href="${params.confirmUrl}" style="display:inline-block;background:#10b981;color:white;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
              ✅ Ολοκληρώθηκε
            </a>
            <p style="font-size:12px;color:#94a3b8;margin-top:12px;">
              Πατήστε όταν ολοκληρωθεί η ενέργεια
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Νέο Task: ${params.taskTitle}\n${params.taskDescription}\nΕνέργεια: ${params.actionRequired}\nΕπιβεβαίωση: ${params.confirmUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// Task Reminder Email
// Sent when a task is still pending after X hours
// ═══════════════════════════════════════════════════════════════════

export async function sendTaskReminderEmail(params: {
  to: string;
  taskTitle: string;
  hoursElapsed: number;
  reminderNumber: number;
  confirmUrl: string;
  agentName: string;
}): Promise<void> {
  const hours = Math.round(params.hoursElapsed);

  await sendEmail({
    to: params.to,
    subject: `⏰ Υπενθύμιση: ${params.taskTitle} — Εκκρεμεί ${hours}+ ώρες`,
    html: `
      <!DOCTYPE html>
      <html lang="el">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 20px;">
        <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:48px;">⏰</span>
            <h1 style="font-size:22px;color:#f59e0b;margin-top:12px;">Εκκρεμές Task — ${hours} ώρες</h1>
          </div>

          <p style="font-size:15px;color:#475569;line-height:1.6;text-align:center;">
            Το task <strong>"${escapeHtml(params.taskTitle)}"</strong> από τον βοηθό <strong>${escapeHtml(params.agentName)}</strong>
            παραμένει σε αναμονή εδώ και <strong>${hours} ώρες</strong>.
          </p>

          <p style="font-size:13px;color:#94a3b8;text-align:center;margin:4px 0 24px 0;">
            Υπενθύμιση #${params.reminderNumber}
          </p>

          <div style="text-align:center;">
            <a href="${params.confirmUrl}" style="display:inline-block;background:#10b981;color:white;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
              ✅ Ολοκληρώθηκε
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Υπενθύμιση: Task "${params.taskTitle}" εκκρεμεί ${hours}+ ώρες. Επιβεβαίωση: ${params.confirmUrl}`,
  });
}
