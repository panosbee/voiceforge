-- ═══════════════════════════════════════════════════════════════════
-- VoiceForge AI — License Keys + Business Registration Fields
-- B2B licensing system: admin generates time-bound keys
-- ═══════════════════════════════════════════════════════════════════

-- License status enum
DO $$ BEGIN
  CREATE TYPE license_status AS ENUM ('pending', 'active', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- License keys table
CREATE TABLE IF NOT EXISTS license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price_paid INTEGER,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  status license_status NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  generated_by TEXT NOT NULL DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast license key lookups
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_customer ON license_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_email ON license_keys(customer_email);

-- Add business registration fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS afm TEXT;              -- ΑΦΜ (Tax ID)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS doy TEXT;              -- ΔΟΥ (Tax Office)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_address TEXT; -- Επαγγελματική διεύθυνση
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;     -- Επωνυμία εταιρίας
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;       -- Όνομα
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;        -- Επώνυμο
ALTER TABLE customers ADD COLUMN IF NOT EXISTS license_key TEXT;      -- Active license key
ALTER TABLE customers ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ; -- When license expires
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'pending'; 
  -- pending = waiting for payment, active = paid + activated, suspended = expired

-- Pending registrations table (before payment/activation)
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  afm TEXT NOT NULL,
  doy TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_address TEXT NOT NULL,
  plan TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'naive',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON pending_registrations(status);
