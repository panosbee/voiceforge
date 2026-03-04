-- ═══════════════════════════════════════════════════════════════════
-- Migration 0005: Add customer_records table (Enterprise Feature)
-- Stores business customer records with unique customer numbers
-- for phone-based identification and document access
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Customer identification
  customer_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,

  -- Business-specific data
  category TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Document access
  document_access_level TEXT NOT NULL DEFAULT 'basic',
  pending_document_requests JSONB NOT NULL DEFAULT '[]',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique customer number per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_records_number
  ON customer_records(customer_id, customer_number);

-- Phone lookup index (for caller identification)
CREATE INDEX IF NOT EXISTS idx_customer_records_phone
  ON customer_records(customer_id, phone);

-- Active customers
CREATE INDEX IF NOT EXISTS idx_customer_records_active
  ON customer_records(customer_id, is_active);
