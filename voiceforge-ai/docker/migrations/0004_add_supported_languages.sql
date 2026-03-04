-- ═══════════════════════════════════════════════════════════════════
-- Migration 0004: Add supported_languages column to agents table
-- Stores an array of language codes the agent supports (e.g. ['el','en','de'])
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS supported_languages jsonb NOT NULL DEFAULT '["el"]';

-- Migrate existing language field value into the array
UPDATE agents
  SET supported_languages = jsonb_build_array(language)
  WHERE supported_languages = '["el"]' AND language != 'el';

-- Index for language-based queries
CREATE INDEX IF NOT EXISTS idx_agents_supported_languages
  ON agents USING gin (supported_languages);
