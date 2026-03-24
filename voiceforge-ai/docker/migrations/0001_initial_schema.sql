CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
DO $$ BEGIN
CREATE TYPE public.agent_status AS ENUM (
    'draft',
    'active',
    'paused',
    'error'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.ai_provider AS ENUM (
    'elevenlabs',
    'telnyx'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.appointment_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed',
    'no_show'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.audit_action AS ENUM (
    'data_export',
    'data_deletion',
    'login',
    'password_change',
    'settings_update',
    'agent_create',
    'agent_update',
    'agent_delete',
    'call_access',
    'recording_access',
    'transcript_access',
    'admin_action'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.call_direction AS ENUM (
    'inbound',
    'outbound'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.call_status AS ENUM (
    'ringing',
    'in_progress',
    'completed',
    'missed',
    'voicemail',
    'failed'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.industry AS ENUM (
    'law_office',
    'medical_practice',
    'dental_clinic',
    'real_estate',
    'beauty_salon',
    'accounting',
    'veterinary',
    'general'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.kb_doc_source AS ENUM (
    'file',
    'url',
    'text'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.kb_doc_status AS ENUM (
    'uploading',
    'ready',
    'failed',
    'deleting'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.license_status AS ENUM (
    'pending',
    'active',
    'expired',
    'revoked'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.plan AS ENUM (
    'basic',
    'pro',
    'enterprise'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.task_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.task_status AS ENUM (
    'pending',
    'confirmed',
    'expired'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
CREATE TYPE public.user_role AS ENUM (
    'naive',
    'expert'
);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS public.agent_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    entry_agent_id uuid,
    is_active boolean DEFAULT false NOT NULL,
    agent_order jsonb DEFAULT '[]'::jsonb NOT NULL,
    routing_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    max_agents integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.agent_task_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    email text NOT NULL,
    role_label text NOT NULL,
    role_description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    ai_provider public.ai_provider DEFAULT 'elevenlabs'::public.ai_provider NOT NULL,
    elevenlabs_agent_id text,
    telnyx_assistant_id text,
    telnyx_number_order_id text,
    elevenlabs_phone_number_id text,
    telnyx_connection_id text,
    name text NOT NULL,
    industry text DEFAULT 'general'::text NOT NULL,
    status public.agent_status DEFAULT 'draft'::public.agent_status NOT NULL,
    llm_model text DEFAULT 'gpt-4o-mini'::text NOT NULL,
    model text DEFAULT 'eleven_v3_conversational'::text NOT NULL,
    instructions text NOT NULL,
    greeting text NOT NULL,
    llm_api_key_ref text,
    voice_id text DEFAULT 'aTP4J5SJLQl74WTSRXKW'::text NOT NULL,
    voice_speed real DEFAULT 0.95 NOT NULL,
    voice_stability real DEFAULT 0.75 NOT NULL,
    voice_similarity real DEFAULT 0.85 NOT NULL,
    voice_api_key_ref text,
    phone_number text,
    forward_phone_number text,
    language text DEFAULT 'el'::text NOT NULL,
    supported_languages jsonb DEFAULT '["el"]'::jsonb NOT NULL,
    tools jsonb DEFAULT '[]'::jsonb NOT NULL,
    dynamic_variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    business_hours_text text,
    business_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    noise_suppression text DEFAULT 'krisp'::text NOT NULL,
    time_limit_secs integer DEFAULT 1800 NOT NULL,
    user_idle_timeout_secs integer DEFAULT 7215 NOT NULL,
    voicemail_detection boolean DEFAULT true NOT NULL,
    recording_enabled boolean DEFAULT true NOT NULL,
    recording_format text DEFAULT 'mp3'::text NOT NULL,
    stt_model text DEFAULT 'deepgram/nova-3'::text NOT NULL,
    stt_region text DEFAULT 'eu'::text NOT NULL,
    eot_timeout_ms integer DEFAULT 700 NOT NULL,
    eot_threshold integer DEFAULT 50 NOT NULL,
    eager_eot_threshold integer DEFAULT 30 NOT NULL,
    insight_group_id text,
    widget_enabled boolean DEFAULT false NOT NULL,
    widget_color text DEFAULT '#6366f1'::text NOT NULL,
    widget_position text DEFAULT 'bottom-right'::text NOT NULL,
    widget_button_text text DEFAULT 'Talk to us'::text NOT NULL,
    widget_icon_type text DEFAULT 'phone'::text NOT NULL,
    widget_allowed_origins jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    call_id uuid,
    caller_name text NOT NULL,
    caller_phone text NOT NULL,
    service_type text,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    status public.appointment_status DEFAULT 'pending'::public.appointment_status NOT NULL,
    notes text,
    google_event_id text,
    reminder_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    user_id uuid NOT NULL,
    action public.audit_action NOT NULL,
    resource text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.caller_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid,
    caller_phone text NOT NULL,
    caller_name text,
    summary text NOT NULL,
    key_facts jsonb DEFAULT '[]'::jsonb NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    overall_sentiment integer,
    last_sentiment integer,
    call_count integer DEFAULT 1 NOT NULL,
    total_duration_seconds integer DEFAULT 0 NOT NULL,
    appointments_booked integer DEFAULT 0 NOT NULL,
    last_call_id uuid,
    last_call_at timestamp with time zone DEFAULT now() NOT NULL,
    first_call_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    telnyx_conversation_id text,
    telnyx_call_control_id text,
    caller_number text NOT NULL,
    agent_number text NOT NULL,
    direction public.call_direction DEFAULT 'inbound'::public.call_direction NOT NULL,
    status public.call_status DEFAULT 'ringing'::public.call_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_seconds integer,
    transcript text,
    summary text,
    sentiment integer,
    intent_category text,
    appointment_booked boolean DEFAULT false NOT NULL,
    insights_raw jsonb,
    recording_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    telnyx_event_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_name text NOT NULL,
    industry public.industry DEFAULT 'general'::public.industry NOT NULL,
    owner_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    plan public.plan DEFAULT 'basic'::public.plan NOT NULL,
    user_role public.user_role DEFAULT 'naive'::public.user_role NOT NULL,
    telnyx_account_id text,
    telnyx_api_key_encrypted text,
    telnyx_api_token text,
    telnyx_connection_id text,
    stripe_customer_id text,
    stripe_subscription_id text,
    google_calendar_connected boolean DEFAULT false NOT NULL,
    google_oauth_token_encrypted text,
    google_calendar_id text,
    ical_feed_url text,
    ical_last_synced_at timestamp with time zone,
    timezone text DEFAULT 'Europe/Athens'::text NOT NULL,
    locale text DEFAULT 'el-GR'::text NOT NULL,
    webhook_url text,
    consent_to_processing boolean DEFAULT false NOT NULL,
    consent_to_recording boolean DEFAULT false NOT NULL,
    consent_to_marketing boolean DEFAULT false NOT NULL,
    consent_accepted_at timestamp with time zone,
    consent_ip_address text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    afm text,
    doy text,
    business_address text,
    company_name text,
    first_name text,
    last_name text,
    license_key text,
    license_expires_at timestamp with time zone,
    registration_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ical_cached_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    uid text NOT NULL,
    summary text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid,
    elevenlabs_doc_id text NOT NULL,
    name text NOT NULL,
    source public.kb_doc_source DEFAULT 'file'::public.kb_doc_source NOT NULL,
    source_url text,
    mime_type text,
    file_size integer,
    status public.kb_doc_status DEFAULT 'uploading'::public.kb_doc_status NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.license_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_key text NOT NULL,
    plan text NOT NULL,
    duration_months integer NOT NULL,
    price_paid integer,
    customer_id uuid,
    customer_email text NOT NULL,
    customer_name text NOT NULL,
    company_name text NOT NULL,
    status public.license_status DEFAULT 'pending'::public.license_status NOT NULL,
    activated_at timestamp with time zone,
    expires_at timestamp with time zone,
    generated_by text DEFAULT 'admin'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.pending_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    company_name text NOT NULL,
    afm text NOT NULL,
    doy text NOT NULL,
    phone text NOT NULL,
    business_address text NOT NULL,
    plan text NOT NULL,
    duration_months integer NOT NULL,
    user_role text DEFAULT 'naive'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    call_id uuid,
    task_email_id uuid,
    title text NOT NULL,
    description text,
    action_required text,
    assigned_email text NOT NULL,
    assigned_role text NOT NULL,
    status public.task_status DEFAULT 'pending'::public.task_status NOT NULL,
    priority public.task_priority DEFAULT 'normal'::public.task_priority NOT NULL,
    confirm_token text NOT NULL,
    confirmed_at timestamp with time zone,
    reminder_count integer DEFAULT 0 NOT NULL,
    last_reminder_at timestamp with time zone,
    caller_name text,
    caller_phone text,
    caller_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    source text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    error text
);
DO $$ BEGIN
ALTER TABLE ONLY public.agent_flows
    ADD CONSTRAINT agent_flows_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agent_task_emails
    ADD CONSTRAINT agent_task_emails_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_elevenlabs_agent_id_unique UNIQUE (elevenlabs_agent_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_telnyx_assistant_id_unique UNIQUE (telnyx_assistant_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.caller_memories
    ADD CONSTRAINT caller_memories_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_telnyx_conversation_id_unique UNIQUE (telnyx_conversation_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_telnyx_event_id_unique UNIQUE (telnyx_event_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.ical_cached_events
    ADD CONSTRAINT ical_cached_events_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_elevenlabs_doc_id_unique UNIQUE (elevenlabs_doc_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_license_key_unique UNIQUE (license_key);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT uq_appointments_customer_time UNIQUE (customer_id, scheduled_at);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_event_id_unique UNIQUE (event_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS idx_appointments_caller_phone ON public.appointments USING btree (caller_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.appointments USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer ON public.audit_logs USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON public.calls USING btree (agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller_number ON public.calls USING btree (caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON public.calls USING btree (telnyx_conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_customer ON public.calls USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls USING btree (started_at);
CREATE INDEX IF NOT EXISTS idx_ical_events_customer ON public.ical_cached_events USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_ical_events_customer_uid ON public.ical_cached_events USING btree (customer_id, uid);
CREATE INDEX IF NOT EXISTS idx_ical_events_start ON public.ical_cached_events USING btree (start_at);
CREATE INDEX IF NOT EXISTS idx_memories_caller_phone ON public.caller_memories USING btree (caller_phone);
CREATE INDEX IF NOT EXISTS idx_memories_customer_phone ON public.caller_memories USING btree (customer_id, caller_phone);
CREATE INDEX IF NOT EXISTS idx_memories_last_call ON public.caller_memories USING btree (last_call_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.webhook_events USING btree (processed_at);
DO $$ BEGIN
ALTER TABLE ONLY public.agent_flows
    ADD CONSTRAINT agent_flows_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agent_task_emails
    ADD CONSTRAINT agent_task_emails_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_call_id_calls_id_fk FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.caller_memories
    ADD CONSTRAINT caller_memories_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.caller_memories
    ADD CONSTRAINT caller_memories_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.ical_cached_events
    ADD CONSTRAINT ical_cached_events_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_agent_id_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_call_id_calls_id_fk FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_task_email_id_agent_task_emails_id_fk FOREIGN KEY (task_email_id) REFERENCES public.agent_task_emails(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
