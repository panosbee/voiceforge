// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Registration Routes (Public + License Activation)
// PUBLIC routes (no auth required):
//   - POST /register          → Submit business registration
//   - POST /activate           → Activate account with license key
//   - GET  /plans              → Get available plans and pricing
//   - POST /check-license      → Check license key status
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { pendingRegistrations, licenseKeys, customers } from '../db/schema/index.js';
import { createLogger } from '../config/logger.js';
import { hashPassword, activateLicenseKey, validateLicenseKey } from '../services/license.js';
import { sendRegistrationNotificationEmail } from '../services/email.js';
import { createDevToken, generateDevUserId } from '../services/dev-auth.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('registration');

export const registrationRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// IBAN & Bank Account Details (displayed to customer for transfer)
// ═══════════════════════════════════════════════════════════════════

const BANK_DETAILS = {
  bankName: 'Τράπεζα Πειραιώς',
  iban: 'GR12 0172 0010 0050 1234 5678 901',
  beneficiary: 'BEELIVE ΜΟΝΟΠΡΟΣΩΠΗ ΕΠΕ',
  swift: 'PIABORAA',
  note: 'Στην αιτιολογία κατάθεσης αναγράψτε το ΑΦΜ σας και το email εγγραφής.',
};

// ═══════════════════════════════════════════════════════════════════
// Plans & Pricing
// ═══════════════════════════════════════════════════════════════════

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Για μικρές επιχειρήσεις',
    priceMonthly: 29,
    features: [
      '1 AI Agent',
      '1 Αριθμός τηλεφώνου',
      '500 λεπτά κλήσεων/μήνα',
      'Email υποστήριξη',
      'Βασικό knowledge base',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Για αναπτυσσόμενες επιχειρήσεις',
    priceMonthly: 79,
    features: [
      '3 AI Agents',
      '3 Αριθμοί τηλεφώνου',
      '2.000 λεπτά κλήσεων/μήνα',
      'Priority υποστήριξη',
      'Προηγμένο knowledge base',
      'Αναλυτικά στατιστικά',
      'Webhooks & integrations',
    ],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Για μεγάλες επιχειρήσεις',
    priceMonthly: 199,
    features: [
      '10 AI Agents',
      '10 Αριθμοί τηλεφώνου',
      '10.000 λεπτά κλήσεων/μήνα',
      'Dedicated υποστήριξη 24/7',
      'Custom knowledge base',
      'API πρόσβαση',
      'SLA εγγυημένο uptime 99.9%',
      'Custom integrations',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Εξατομικευμένη λύση',
    priceMonthly: null,
    features: [
      'Απεριόριστοι AI Agents',
      'Απεριόριστοι αριθμοί',
      'Απεριόριστα λεπτά',
      'Dedicated account manager',
      'On-premise deployment',
      'Custom development',
      'SLA εγγυημένο uptime 99.99%',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// GET /registration/plans — Available plans and pricing
// ═══════════════════════════════════════════════════════════════════

registrationRoutes.get('/plans', async (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: { plans: PLANS },
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /registration/register — Submit business registration
// Public endpoint. Stores in pending_registrations, emails admin.
// ═══════════════════════════════════════════════════════════════════

const registrationSchema = z.object({
  // Personal info
  firstName: z.string().min(2, 'Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες'),
  lastName: z.string().min(2, 'Το επώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες'),
  email: z.string().email('Μη έγκυρο email'),
  password: z.string().min(8, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες'),
  phone: z.string().min(10, 'Μη έγκυρος αριθμός τηλεφώνου'),

  // Business info
  companyName: z.string().min(2, 'Η επωνυμία πρέπει να έχει τουλάχιστον 2 χαρακτήρες'),
  afm: z.string().regex(/^\d{9}$/, 'Το ΑΦΜ πρέπει να είναι 9 ψηφία'),
  doy: z.string().min(2, 'Η ΔΟΥ είναι υποχρεωτική'),
  businessAddress: z.string().min(5, 'Η διεύθυνση είναι υποχρεωτική'),

  // Plan selection
  plan: z.enum(['starter', 'professional', 'business', 'enterprise']),
  durationMonths: z.number().int().min(1).max(12),

  // Role selection
  userRole: z.enum(['naive', 'expert']).optional().default('naive'),
});

registrationRoutes.post('/register', zValidator('json', registrationSchema), async (c) => {
  const data = c.req.valid('json');

  // Check if email already registered
  const existingRegistration = await db.query.pendingRegistrations.findFirst({
    where: eq(pendingRegistrations.email, data.email),
  });

  if (existingRegistration) {
    if (existingRegistration.status === 'pending') {
      return c.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'ALREADY_PENDING',
            message: 'Υπάρχει ήδη αίτηση εγγραφής με αυτό το email σε εκκρεμότητα. Παρακαλώ περιμένετε έγκριση.',
          },
        },
        409,
      );
    }
    if (existingRegistration.status === 'approved') {
      return c.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'ALREADY_APPROVED',
            message: 'Αυτό το email έχει ήδη εγκριθεί. Ελέγξτε το email σας για το κλειδί ενεργοποίησης.',
          },
        },
        409,
      );
    }
  }

  // Also check if a customer with this email exists
  const existingCustomer = await db.query.customers.findFirst({
    where: eq(customers.email, data.email),
  });

  if (existingCustomer) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδεθείτε ή χρησιμοποιήστε διαφορετικό email.',
        },
      },
      409,
    );
  }

  // Hash password for storage
  const passwordHashed = hashPassword(data.password);

  // Calculate total price
  const prices: Record<string, number> = { starter: 29, professional: 79, business: 199 };
  const monthlyPrice = prices[data.plan] ?? 0;
  const totalPrice = monthlyPrice * data.durationMonths;

  // Store registration
  const [registration] = await db
    .insert(pendingRegistrations)
    .values({
      email: data.email,
      passwordHash: passwordHashed,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      afm: data.afm,
      doy: data.doy,
      phone: data.phone,
      businessAddress: data.businessAddress,
      plan: data.plan,
      durationMonths: data.durationMonths,
      userRole: data.userRole,
      status: 'pending',
    })
    .returning();

  log.info(
    { registrationId: registration?.id, email: data.email, company: data.companyName, plan: data.plan },
    '📝 New business registration submitted',
  );

  // Send notification email to admin
  try {
    await sendRegistrationNotificationEmail({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      companyName: data.companyName,
      afm: data.afm,
      doy: data.doy,
      phone: data.phone,
      businessAddress: data.businessAddress,
      plan: data.plan,
      durationMonths: data.durationMonths,
    });
    log.info({ email: data.email }, '📧 Admin notification email sent');
  } catch (err) {
    log.error({ err, email: data.email }, 'Failed to send admin notification email');
    // Don't fail the registration — admin can check the panel
  }

  // Return success with bank details for transfer
  return c.json<ApiResponse>(
    {
      success: true,
      data: {
        message: 'Η εγγραφή σας υποβλήθηκε επιτυχώς!',
        registrationId: registration?.id,
        bankDetails: BANK_DETAILS,
        plan: data.plan,
        durationMonths: data.durationMonths,
        totalPrice: data.plan === 'enterprise' ? 'Κατόπιν συμφωνίας' : `€${totalPrice}`,
        nextSteps: [
          `Πραγματοποιήστε κατάθεση ${data.plan === 'enterprise' ? '' : `€${totalPrice}`} στον τραπεζικό λογαριασμό`,
          'Στην αιτιολογία αναγράψτε: ' + data.afm + ' — ' + data.email,
          'Μόλις επιβεβαιωθεί η πληρωμή, θα λάβετε email με το κλειδί ενεργοποίησης',
          'Χρησιμοποιήστε το κλειδί για να ενεργοποιήσετε τον λογαριασμό σας',
        ],
      },
    },
    201,
  );
});

// ═══════════════════════════════════════════════════════════════════
// POST /registration/activate — Activate account with license key
// Customer enters the key they received via email.
// Creates a full customer record and returns a login token.
// ═══════════════════════════════════════════════════════════════════

const activateSchema = z.object({
  licenseKey: z.string().min(1, 'Το κλειδί ενεργοποίησης είναι υποχρεωτικό'),
});

registrationRoutes.post('/activate', zValidator('json', activateSchema), async (c) => {
  const { licenseKey } = c.req.valid('json');

  // Find the license key record
  const keyRecord = await db.query.licenseKeys.findFirst({
    where: eq(licenseKeys.licenseKey, licenseKey),
  });

  if (!keyRecord) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'INVALID_KEY', message: 'Μη έγκυρο κλειδί ενεργοποίησης.' } },
      400,
    );
  }

  if (keyRecord.status !== 'pending') {
    const messages: Record<string, string> = {
      active: 'Αυτό το κλειδί έχει ήδη ενεργοποιηθεί.',
      expired: 'Αυτό το κλειδί έχει λήξει.',
      revoked: 'Αυτό το κλειδί έχει ανακληθεί.',
    };
    return c.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'KEY_NOT_ACTIVATABLE',
          message: messages[keyRecord.status] || 'Αυτό το κλειδί δεν μπορεί να ενεργοποιηθεί.',
        },
      },
      400,
    );
  }

  // Find the pending registration (linked by email)
  const registration = await db.query.pendingRegistrations.findFirst({
    where: eq(pendingRegistrations.email, keyRecord.customerEmail),
  });

  if (!registration) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'REGISTRATION_NOT_FOUND', message: 'Δεν βρέθηκε η αίτηση εγγραφής.' } },
      404,
    );
  }

  // Generate a user ID for this customer
  const userId = generateDevUserId(registration.email);

  // Check if customer already exists
  let existingCustomer = await db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });

  let customerId: string;

  if (existingCustomer) {
    // Update existing customer
    await db
      .update(customers)
      .set({
        firstName: registration.firstName,
        lastName: registration.lastName,
        companyName: registration.companyName,
        afm: registration.afm,
        doy: registration.doy,
        businessAddress: registration.businessAddress,
        plan: registration.plan as any,
        userRole: registration.userRole as any,
        registrationStatus: 'active',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existingCustomer.id));
    customerId = existingCustomer.id;
  } else {
    // Create a new full customer record
    const [newCustomer] = await db
      .insert(customers)
      .values({
        userId,
        email: registration.email,
        businessName: registration.companyName,
        ownerName: `${registration.firstName} ${registration.lastName}`,
        firstName: registration.firstName,
        lastName: registration.lastName,
        companyName: registration.companyName,
        afm: registration.afm,
        doy: registration.doy,
        businessAddress: registration.businessAddress,
        phone: registration.phone,
        industry: 'general',
        timezone: 'Europe/Athens',
        locale: 'el-GR',
        plan: registration.plan as any,
        userRole: registration.userRole as any,
        registrationStatus: 'active',
        isActive: true,
      })
      .returning();

    customerId = newCustomer!.id;
    log.info({ customerId, userId, email: registration.email }, '✅ Customer record created');
  }

  // Activate the license key
  const activation = await activateLicenseKey(licenseKey, customerId);

  if (!activation.success) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ACTIVATION_FAILED', message: activation.error! } },
      400,
    );
  }

  // Generate auth token for the newly activated user
  const token = createDevToken({
    sub: userId,
    email: registration.email,
    role: 'authenticated',
    aud: 'authenticated',
  });

  log.info(
    { customerId, licenseKey, expiresAt: activation.expiresAt },
    '🔑 Account activated with license key',
  );

  return c.json<ApiResponse>({
    success: true,
    data: {
      message: 'Ο λογαριασμός σας ενεργοποιήθηκε επιτυχώς!',
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400 * 30,
      user: {
        id: userId,
        email: registration.email,
        role: 'authenticated',
      },
      license: {
        key: licenseKey,
        plan: keyRecord.plan,
        durationMonths: keyRecord.durationMonths,
        expiresAt: activation.expiresAt,
      },
      customerId,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /registration/check-license — Check license key status
// ═══════════════════════════════════════════════════════════════════

const checkLicenseSchema = z.object({
  licenseKey: z.string().min(1),
});

registrationRoutes.post('/check-license', zValidator('json', checkLicenseSchema), async (c) => {
  const { licenseKey } = c.req.valid('json');
  const result = await validateLicenseKey(licenseKey);

  return c.json<ApiResponse>({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /registration/bank-details — Get bank transfer details
// Public: shown on registration success and info page
// ═══════════════════════════════════════════════════════════════════

registrationRoutes.get('/bank-details', async (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: { bankDetails: BANK_DETAILS },
  });
});
