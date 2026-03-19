-- ═══════════════════════════════════════════════════════════════════
-- Migration: Post-Call Task System
-- Creates agent_task_emails + tasks tables for AI-driven task routing
-- ═══════════════════════════════════════════════════════════════════

-- Enums
CREATE TYPE task_status AS ENUM ('pending', 'confirmed', 'expired');
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Agent Task Email Recipients
-- Each agent has multiple notification emails with role labels
CREATE TABLE IF NOT EXISTS agent_task_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_label TEXT NOT NULL,
  role_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_task_emails_agent_id ON agent_task_emails(agent_id);

-- Post-Call Tasks
-- AI-extracted tasks from call transcripts, tracked with email confirmation
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  task_email_id UUID REFERENCES agent_task_emails(id) ON DELETE SET NULL,

  -- Task content
  title TEXT NOT NULL,
  description TEXT,
  action_required TEXT,

  -- Routing
  assigned_email TEXT NOT NULL,
  assigned_role TEXT NOT NULL,

  -- Status
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'normal',

  -- Confirmation
  confirm_token TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,

  -- Reminders
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  -- Caller info
  caller_name TEXT,
  caller_phone TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_call_id ON tasks(call_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_confirm_token ON tasks(confirm_token);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
