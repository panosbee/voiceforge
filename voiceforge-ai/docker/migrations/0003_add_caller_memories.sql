-- ═══════════════════════════════════════════════════════════════════
-- VoiceForge AI — Migration: Add Caller Memories (Episodic Memory)
-- Stores per-caller conversation summaries for AI memory recall
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS caller_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Which business this memory belongs to
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Which agent handled the calls (nullable — memory spans all agents)
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    -- Caller identification
    caller_phone TEXT NOT NULL,
    caller_name TEXT,
    
    -- Memory content
    summary TEXT NOT NULL,
    key_facts JSONB NOT NULL DEFAULT '[]',
    
    -- Extracted structured data
    preferences JSONB NOT NULL DEFAULT '{}',
    
    -- Sentiment tracking
    overall_sentiment INTEGER,
    last_sentiment INTEGER,
    
    -- Interaction stats
    call_count INTEGER NOT NULL DEFAULT 1,
    total_duration_seconds INTEGER NOT NULL DEFAULT 0,
    appointments_booked INTEGER NOT NULL DEFAULT 0,
    
    -- Last interaction tracking
    last_call_id UUID,
    last_call_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_call_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_memories_customer_phone ON caller_memories(customer_id, caller_phone);
CREATE INDEX IF NOT EXISTS idx_memories_caller_phone ON caller_memories(caller_phone);
CREATE INDEX IF NOT EXISTS idx_memories_last_call ON caller_memories(last_call_at);

-- Unique constraint: one memory per caller per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_unique_caller ON caller_memories(customer_id, caller_phone);

COMMENT ON TABLE caller_memories IS 'Episodic memory: per-caller conversation summaries for AI recall';
COMMENT ON COLUMN caller_memories.summary IS 'Condensed memory of all interactions with this caller';
COMMENT ON COLUMN caller_memories.key_facts IS 'JSON array of important facts learned about the caller';
COMMENT ON COLUMN caller_memories.preferences IS 'JSON object of caller preferences (time, language, service interests)';
