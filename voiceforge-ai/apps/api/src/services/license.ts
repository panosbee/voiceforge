// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — License Service
// Generates unique license keys, validates them, and handles
// password hashing for the B2B registration flow.
// ═══════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'crypto';
import { db } from '../db/connection.js';
import { licenseKeys, customers } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../config/logger.js';

const log = createLogger('license');

// ═══════════════════════════════════════════════════════════════════
// License Key Generation
// Format: VF-XXXX-XXXX-XXXX (where X = alphanumeric uppercase)
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a unique license key in the format VF-XXXX-XXXX-XXXX.
 * Uses crypto.randomBytes for security.
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 (avoid confusion)
  const segments: string[] = [];

  for (let s = 0; s < 3; s++) {
    let segment = '';
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i++) {
      segment += chars[bytes[i]! % chars.length];
    }
    segments.push(segment);
  }

  return `VF-${segments.join('-')}`;
}

// ═══════════════════════════════════════════════════════════════════
// Password Hashing (for pending registrations)
// Uses SHA-256 with salt — simple but secure enough for this flow.
// In production, use bcrypt or argon2.
// ═══════════════════════════════════════════════════════════════════

/**
 * Hash a password with a random salt.
 * Returns: "salt:hash" format.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return computed === hash;
}

// ═══════════════════════════════════════════════════════════════════
// License Key Validation
// ═══════════════════════════════════════════════════════════════════

export interface LicenseValidationResult {
  valid: boolean;
  reason?: string;
  licenseKey?: string;
  plan?: string;
  expiresAt?: Date;
  daysRemaining?: number;
}

/**
 * Validate a license key and return its status.
 */
export async function validateLicenseKey(key: string): Promise<LicenseValidationResult> {
  const record = await db.query.licenseKeys.findFirst({
    where: eq(licenseKeys.licenseKey, key),
  });

  if (!record) {
    return { valid: false, reason: 'Μη έγκυρο κλειδί. Παρακαλώ ελέγξτε και δοκιμάστε ξανά.' };
  }

  if (record.status === 'revoked') {
    return { valid: false, reason: 'Αυτό το κλειδί έχει ανακληθεί. Επικοινωνήστε με τον διαχειριστή.' };
  }

  if (record.status === 'expired') {
    return { valid: false, reason: 'Αυτό το κλειδί έχει λήξει. Παρακαλώ ανανεώστε τη συνδρομή σας.' };
  }

  if (record.status === 'active' && record.expiresAt) {
    const now = new Date();
    if (now > record.expiresAt) {
      // Mark as expired
      await db
        .update(licenseKeys)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(licenseKeys.id, record.id));
      return { valid: false, reason: 'Αυτό το κλειδί έχει λήξει. Παρακαλώ ανανεώστε τη συνδρομή σας.' };
    }

    const daysRemaining = Math.ceil((record.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      valid: true,
      licenseKey: record.licenseKey,
      plan: record.plan,
      expiresAt: record.expiresAt,
      daysRemaining,
    };
  }

  // Status is 'pending' — key issued but not yet activated
  return {
    valid: true,
    licenseKey: record.licenseKey,
    plan: record.plan,
    reason: 'pending_activation',
  };
}

/**
 * Activate a license key for a customer.
 * Sets activatedAt to now, expiresAt to now + durationMonths.
 */
export async function activateLicenseKey(
  key: string,
  customerId: string,
): Promise<{ success: boolean; expiresAt?: Date; error?: string }> {
  const record = await db.query.licenseKeys.findFirst({
    where: eq(licenseKeys.licenseKey, key),
  });

  if (!record) {
    return { success: false, error: 'Μη έγκυρο κλειδί.' };
  }

  if (record.status !== 'pending') {
    return { success: false, error: `Αυτό το κλειδί δεν μπορεί να ενεργοποιηθεί (κατάσταση: ${record.status}).` };
  }

  // Calculate expiry date
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + record.durationMonths);

  // Activate the license key
  await db
    .update(licenseKeys)
    .set({
      status: 'active',
      customerId,
      activatedAt: now,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(licenseKeys.id, record.id));

  // Update customer record
  await db
    .update(customers)
    .set({
      licenseKey: key,
      licenseExpiresAt: expiresAt,
      registrationStatus: 'active',
      isActive: true,
      plan: record.plan as any, // Cast to plan enum
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  log.info({ customerId, key, expiresAt }, 'License key activated');
  return { success: true, expiresAt };
}

/**
 * Check and expire all overdue license keys.
 * Called periodically (e.g., once per day by a worker/cron).
 */
export async function expireOverdueKeys(): Promise<number> {
  const now = new Date();
  const activeKeys = await db.query.licenseKeys.findMany({
    where: and(eq(licenseKeys.status, 'active')),
  });

  let expiredCount = 0;
  for (const key of activeKeys) {
    if (key.expiresAt && now > key.expiresAt) {
      await db
        .update(licenseKeys)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(licenseKeys.id, key.id));

      // Deactivate customer
      if (key.customerId) {
        await db
          .update(customers)
          .set({ isActive: false, registrationStatus: 'suspended', updatedAt: new Date() })
          .where(eq(customers.id, key.customerId));
      }

      expiredCount++;
      log.info({ keyId: key.id, customerId: key.customerId }, 'License expired');
    }
  }

  return expiredCount;
}
