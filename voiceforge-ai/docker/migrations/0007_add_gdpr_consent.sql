-- ═══════════════════════════════════════════════════════════════════
-- Migration 0007: Add GDPR consent fields to customers table
-- GDPR Articles 6, 7 — Lawful basis & Consent recording
-- ═══════════════════════════════════════════════════════════════════

-- Consent to personal data processing (Art. 6/7 — REQUIRED)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_to_processing BOOLEAN NOT NULL DEFAULT false;

-- Consent to call recording & transcript storage (Art. 6/7 — REQUIRED)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_to_recording BOOLEAN NOT NULL DEFAULT false;

-- Consent to marketing emails (Art. 7 — OPTIONAL)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_to_marketing BOOLEAN NOT NULL DEFAULT false;

-- Timestamp when consent was given (audit trail)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;

-- IP address at time of consent (audit trail)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_ip_address TEXT;

-- Backfill existing customers as consented (they registered before this feature)
-- NOTE: In production, send a re-consent email to existing users instead
UPDATE customers SET
  consent_to_processing = true,
  consent_to_recording = true,
  consent_accepted_at = created_at
WHERE consent_accepted_at IS NULL;
