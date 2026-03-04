-- ═══════════════════════════════════════════════════════════════════
-- VoiceForge AI — Add user_role to customers table
-- Migration: 0002_add_user_role.sql
-- Adds naive/expert role distinction for dashboard complexity
-- ═══════════════════════════════════════════════════════════════════

-- Create the user_role enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('naive', 'expert');
  END IF;
END
$$;

-- Add user_role column to customers with default 'naive'
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS user_role user_role NOT NULL DEFAULT 'naive';

-- Update existing customers to 'naive' (safety — already default)
UPDATE customers SET user_role = 'naive' WHERE user_role IS NULL;
