-- ═══════════════════════════════════════════════════════════════════
-- VoiceForge AI — PostgreSQL Init Script
-- Creates necessary extensions for Supabase compatibility
-- ═══════════════════════════════════════════════════════════════════

-- UUID generation (used as default for all primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search (for future transcript search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
