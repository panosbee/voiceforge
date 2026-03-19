-- ═══════════════════════════════════════════════════════════════════
-- Migration 0008: Update voice defaults for consistency
-- Bug fix: voice_stability 0.6 → 0.75, voice_similarity 0.8 → 0.85
-- Prevents noticeable voice quality change at call start
-- ═══════════════════════════════════════════════════════════════════

-- Update agents that still have the old defaults (only if unchanged by user)
UPDATE agents
SET voice_stability = 0.75
WHERE voice_stability = 0.6;

UPDATE agents
SET voice_similarity = 0.85
WHERE voice_similarity = 0.8;

-- Update column defaults for new agents
ALTER TABLE agents ALTER COLUMN voice_stability SET DEFAULT 0.75;
ALTER TABLE agents ALTER COLUMN voice_similarity SET DEFAULT 0.85;
