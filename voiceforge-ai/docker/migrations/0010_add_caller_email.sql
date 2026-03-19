-- Migration: 0010_add_caller_email
-- Add caller_email column to tasks table for capturing email addresses
-- mentioned by callers during phone conversations.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS caller_email TEXT;
