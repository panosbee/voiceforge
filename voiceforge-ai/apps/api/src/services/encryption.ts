// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — AES-256-GCM Encryption Service
// Used to encrypt/decrypt stored API keys (Telnyx, Google OAuth)
// ═══════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/** Derive the encryption key from the hex env var */
function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  try {
    const iv = randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    log.error({ error }, 'Encryption failed');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivB64, authTagB64, ciphertext] = parts as [string, string, string];
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const key = getKey();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    log.error({ error }, 'Decryption failed');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt if value is provided, return null if not.
 * Convenience wrapper for optional fields.
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Decrypt if value is provided, return null if not.
 */
export function decryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return decrypt(value);
}
