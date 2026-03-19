-- Migration: 0011_add_business_hours_text
-- Free-text business hours field injected into agent system prompt.
-- Allows each customer to describe their operating hours naturally.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_hours_text TEXT;
