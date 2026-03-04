**INTERNAL TECHNICAL DOCUMENT — CONFIDENTIAL**

**VoiceForge AI**

**Complete Technical Architecture & Implementation Guide**

Full-Stack Telnyx-Powered White-Label AI Voice SaaS

Author: Panos Skouras

Version: 1.0 — February 2026

**DO NOT SHARE OUTSIDE THE FOUNDING TEAM**

# **1\. STRATEGIC FOUNDATION — THE SINGLE-PROVIDER MOAT**

The entire VoiceForge AI platform runs on a single infrastructure provider: Telnyx. This is not a technical constraint — it is a deliberate strategic decision that creates our moat. Our customers see a beautifully designed SaaS product. We operate with the simplicity of one API, one invoice, one integration to maintain.

## **1.1 Why Telnyx and Nothing Else**

Telnyx is a carrier-grade communications infrastructure company that owns its own network (they are an MVNO — Mobile Virtual Network Operator). This is critical because it means:

- No middlemen: Telnyx IS the carrier. No Twilio markup, no ElevenLabs platform fee layered on top
- One API covers everything: phone numbers, voice calls, AI assistants, STT, TTS, LLM orchestration
- Sub-500ms latency: Telnyx colocates AI inference GPUs at their own network edge PoPs
- Managed Accounts: Native multi-tenant architecture built for resellers and MSPs
- EU data residency: Full GDPR compliance, European PoPs for Greek market
- BYO model keys: Customers can bring their own OpenAI/ElevenLabs keys — we charge zero inference cost

## **1.2 What Telnyx Replaces**

| **Traditional Stack Component** | **Cost/Complexity** | **Telnyx Equivalent** |
| --- | --- | --- |
| Twilio (telephony) | High — $0.085/min + setup | Telnyx Voice API — included |
| ElevenLabs Platform | $0.04+/min TTS fee | Telnyx TTS (Azure/EL via key) |
| Vapi / LiveKit (orchestration) | $0.05/min + complex setup | Telnyx AI Assistants — native |
| Custom STT pipeline | Engineering weeks | Telnyx STT (Deepgram/Whisper) |
| Sub-account management | Build from scratch | Telnyx Managed Accounts API |
| Phone number provisioning | Twilio API + country regulations | Telnyx Numbers API (Greece ✓) |
| Post-call webhooks/analytics | Custom build | Telnyx Insights API — native |

# **2\. CRITICAL FIRST STEP: TELNYX MANAGED ACCOUNTS**

This step is the most important action item before any development begins. Without Managed Accounts access, the multi-tenant architecture does not work. This must be requested from Telnyx proactively — it is a business qualification, not automatic.

## **2.1 What Managed Accounts Enable**

Telnyx Managed Accounts is a feature designed explicitly for resellers, MSPs, and white-label SaaS platforms. With it:

- You (the Manager Account) control up to 1,000 sub-accounts via API
- Each customer gets their own isolated Telnyx sub-account — their numbers, agents, and data are siloed
- You control pricing: sub-accounts inherit YOUR negotiated rates, but never see what you pay
- You can programmatically create, fund, and manage all sub-accounts from your master API key
- One invoice for you — the platform — not individual bills per customer

## **2.2 How to Request Managed Accounts Access**

1.  Sign up at telnyx.com with a business email (use a company domain, not Gmail)
2.  Add a payment method and fund the account with at least €100 initial credit
3.  Complete Level 2 Verification (required for Managed Accounts): submit business registration documents
4.  Contact Telnyx support: explain you are building a white-label AI voice SaaS for SMEs in Greece
5.  Reference that you need Managed Accounts for a multi-tenant reseller platform (up to 1,000 sub-accounts)
6.  Typical approval: 2-5 business days after Level 2 verification

## **2.3 The API Call to Create a Sub-Account (What You Do Per New Customer)**

When a new customer registers on VoiceForge AI, your backend makes this single API call to create their Telnyx sub-account:

POST https://api.telnyx.com/v2/managed_accounts

Authorization: Bearer YOUR_MASTER_TELNYX_API_KEY

Content-Type: application/json

{

"business_name": "Law Office Papadopoulos"

}

// Response includes: managed_account_id, api_key for that sub-account

// Store both in your database — the api_key controls everything for that customer

From this point, all subsequent API calls for that customer use THEIR sub-account API key (not yours). This ensures complete isolation.

## **2.4 Cost Structure with Managed Accounts**

Critically: you negotiate a committed-use rate with Telnyx. Sub-accounts inherit this rate automatically. Your margin is the difference between what you pay (at volume pricing) and what you charge customers.

| **Cost Item** | **Your Telnyx Cost** | **Customer Price** | **Your Margin** |
| --- | --- | --- | --- |
| Voice minute (AI call) | ~€0.010-0.015/min | €0.05/min (overage) | 70-80% |
| Greek phone number | ~€1.00/mo | €2.00/mo (built into plan) | 50% |
| LLM inference (if you host) | ~€0.002-0.005/min | €0.01/min | 50-75% |
| LLM (BYO key — customer pays) | €0  | €0 (included in plan) | 100% |
| Platform subscription | €0  | €49-299/mo | ~75% gross margin |

# **3\. TELNYX API: COMPLETE INTEGRATION MAP**

## **3.1 All APIs We Use — Full List**

| **Telnyx API Endpoint** | **What We Use It For** | **When Called** |
| --- | --- | --- |
| POST /v2/managed_accounts | Create customer sub-account | User registration |
| POST /v2/integration_secrets | Store customer OpenAI/EL keys | User adds BYO key |
| GET /v2/available_phone_numbers?filter\[country_code\]=GR | Show available Greek numbers | Step 4 of wizard |
| POST /v2/number_orders | Purchase Greek +30 number | User selects number |
| POST /v2/ai/assistants | Create AI agent for customer | Wizard Step 2-3 |
| PATCH /v2/ai/assistants/{id} | Update agent configuration | User edits agent |
| POST /v2/ai/assistants/clone | Clone from industry template | Template selection |
| GET /v2/ai/assistants/{id}/conversations | Fetch call transcripts | Dashboard / history |
| GET /v2/ai/assistants — Insights webhook | Post-call analytics data | After every call |
| POST /v2/phone_number_assignments | Assign number to agent | Wizard completion |
| GET /v2/usage_reports | Customer billing data | Billing cycle / dashboard |

## **3.2 Create Assistant API — Full Payload**

This is the core API call that creates a customer's AI agent. Every field maps to a UI element in our wizard:

POST https://api.telnyx.com/v2/ai/assistants

Authorization: Bearer {customer_sub_account_api_key}

{

"name": "Sofia - Law Office Papadopoulos",

"model": "openai/gpt-4o", // or "deepseek/deepseek-chat" (cheaper)

"llm_api_key_ref": "secret_abc123", // customer BYO key ref (optional)

"instructions": "You are Sofia, the AI receptionist of {{var_office_name}}...",

"greeting": "Γεια σας! Μιλάτε με το γραφείο {{var_office_name}}. Πώς μπορώ να σας βοηθήσω;",

"voice_settings": {

"voice": "el-GR-AthinaNeural", // Azure Greek TTS

"api_key_ref": "secret_azure_key" // or ElevenLabs key ref

},

"transcription": {

"model": "deepgram/nova-3",

"language": "el", // Greek

"settings": {

"smart_format": true,

"eot_timeout_ms": 700 // End-of-turn detection tuning

}

},

"enabled_features": \["telephony"\],

"dynamic_variables_webhook_url": "https://api.voiceforge.ai/telnyx/pre-call",

"tools": \[

{

"type": "webhook",

"webhook": {

"name": "check_availability",

"description": "Check the calendar for available appointment slots",

"url": "https://api.voiceforge.ai/tools/calendar/check",

"method": "POST",

"body_parameters": {

"properties": {

"requested_date": {"type": "string", "description": "Date in YYYY-MM-DD"},

"service_type": {"type": "string", "description": "Type of appointment"}

},

"required": \["requested_date"\]

}

}

},

{

"type": "webhook",

"webhook": {

"name": "book_appointment",

"description": "Book an appointment in the calendar",

"url": "https://api.voiceforge.ai/tools/calendar/book",

"method": "POST",

"body_parameters": {

"properties": {

"date": {"type": "string"},

"time": {"type": "string"},

"caller_name": {"type": "string"},

"caller_phone": {"type": "string"},

"notes": {"type": "string"}

},

"required": \["date", "time", "caller_name"\]

}

}

},

{ "type": "hangup" }

\],

"telephony_settings": {

"noise_suppression": "krisp",

"time_limit_secs": 1800,

"voicemail_detection": {

"on_voicemail_detected": {

"action": "stop_assistant"

}

}

},

"insight_settings": {

"insight_group_id": "default_voice_insights"

}

}

# **4\. FULL PLATFORM ARCHITECTURE**

## **4.1 System Overview**

Everything below the VoiceForge UI is invisible to customers. They interact only with our beautiful dashboard. All complexity is abstracted away.

┌─────────────────────────────────────────────────────────────────┐

│ VOICEFORGE AI PLATFORM │

│ https://voiceforge.ai (React + Vite PWA) │

└────────────────────────┬────────────────────────────────────────┘

│ REST API calls

▼

┌─────────────────────────────────────────────────────────────────┐

│ VOICEFORGE BACKEND (FastAPI Python) │

│ /auth /agents /tools /webhooks /billing /dashboard │

└──────┬──────────────────┬───────────────┬───────────────────────┘

│ │ │

▼ ▼ ▼

┌────────────┐ ┌─────────────────┐ ┌─────────────────┐

│ Supabase │ │ Telnyx API │ │ Stripe │

│ (Auth + DB)│ │ Manager Acct │ │ (Billing) │

│ EU Region │ │ All-in-one │ │ │

└────────────┘ └────────┬────────┘ └─────────────────┘

│

┌───────────────┼───────────────┐

│ │ │

▼ ▼ ▼

┌──────────────┐ ┌──────────────┐ ┌──────────────┐

│ Sub-Account │ │ Sub-Account │ │ Sub-Account │

│ Customer A │ │ Customer B │ │ Customer C │

│ +30 number │ │ +30 number │ │ +30 number │

│ AI Agent │ │ AI Agent │ │ AI Agent │

└──────────────┘ └──────────────┘ └──────────────┘

↑ Caller dials the +30 number

Telnyx routes to AI Agent

Agent calls our /tools webhooks (calendar check/book)

Post-call: Telnyx sends transcript + insights to /webhooks/post-call

We store, summarize, send push notification to customer

## **4.2 Complete Tech Stack**

| **Layer** | **Technology** | **Provider** | **Notes** |
| --- | --- | --- | --- |
| Frontend | React + Vite | Self-hosted / Vercel | PWA, installable mobile |
| Backend API | FastAPI Python 3.12 | Railway / Render | Async, EU region |
| Database | PostgreSQL | Supabase EU (Frankfurt) | GDPR compliant |
| Authentication | Supabase Auth | Supabase EU | JWT, social login |
| Telephony | Telnyx Voice API | Telnyx (EU PoPs) | Carrier-grade, owns network |
| AI Assistants | Telnyx AI Assistants | Telnyx + colocated GPU | Full orchestration |
| STT | Deepgram Nova-3 / Whisper | Via Telnyx | Greek language support |
| TTS (default) | Azure AthinaNeural | Via Telnyx | Best Greek voice available |
| TTS (premium) | ElevenLabs (BYO key) | Via Telnyx bridge | Customer brings own key |
| LLM (default) | Telnyx hosted models | Telnyx inference | Free with platform |
| LLM (premium) | OpenAI / DeepSeek (BYO) | Via Telnyx integration_secrets | Customer brings own key |
| Calendar | Google Calendar API | Google Cloud | OAuth2 per customer |
| Billing | Stripe | Stripe EU | Subscriptions + usage billing |
| Push Notifications | Web Push API | Self-hosted (vapid keys) | No app store needed |
| Email | Resend.com | Resend EU | Transactional email |

# **5\. PROJECT FILE STRUCTURE**

voiceforge-ai/

├── backend/ # FastAPI Python

│ ├── main.py # App entry point, CORS, startup

│ ├── config.py # Settings (env vars)

│ ├── database.py # SQLAlchemy + Supabase

│ ├── routers/

│ │ ├── auth.py # Register, login, JWT

│ │ ├── agents.py # CRUD: create/edit/delete AI agents

│ │ ├── numbers.py # Browse + purchase +30 numbers

│ │ ├── tools.py # Telnyx webhook tools (calendar check/book)

│ │ ├── webhooks.py # Telnyx pre-call + post-call webhooks

│ │ ├── billing.py # Stripe webhooks + subscription mgmt

│ │ ├── calendar.py # Google Calendar OAuth + read/write

│ │ ├── calls.py # Call history, transcripts, analytics

│ │ └── notifications.py # Web Push subscription mgmt

│ ├── services/

│ │ ├── telnyx.py # Telnyx SDK wrapper (all API calls)

│ │ ├── telnyx_managed.py # Sub-account creation + management

│ │ ├── calendar_service.py # Google Calendar operations

│ │ ├── push_service.py # Web Push notification sender

│ │ ├── billing_service.py # Stripe subscription operations

│ │ ├── llm_summary.py # Post-call AI summary generation

│ │ └── email_service.py # Transactional emails (Resend)

│ └── models/

│ ├── user.py # User model (maps to Supabase auth)

│ ├── customer.py # Customer profile + Telnyx sub-account

│ ├── agent.py # AI agent config (mirrors Telnyx)

│ ├── call.py # Call record + transcript + insights

│ └── appointment.py # Booked appointments

├── frontend/ # React + Vite PWA

│ ├── public/

│ │ ├── manifest.json # PWA manifest

│ │ └── sw.js # Service Worker (offline, push)

│ ├── src/

│ │ ├── pages/

│ │ │ ├── Onboarding/ # 5-step wizard (the core product UX)

│ │ │ │ ├── Step1_Industry.jsx # Template selection

│ │ │ │ ├── Step2_Customize.jsx # Agent name, personality, instructions

│ │ │ │ ├── Step3_Voice.jsx # Voice preview + selection

│ │ │ │ ├── Step4_Number.jsx # Browse + pick Greek +30 number

│ │ │ │ └── Step5_Launch.jsx # Call forwarding instructions + go live

│ │ │ ├── Dashboard.jsx # Main dashboard (calls, stats, recent activity)

│ │ │ ├── CallDetail.jsx # Single call: transcript + AI summary

│ │ │ ├── Calendar.jsx # Upcoming appointments view

│ │ │ ├── AgentEditor.jsx # Edit agent config after launch

│ │ │ ├── Analytics.jsx # Call volume, booking rate, charts

│ │ │ ├── Billing.jsx # Plan management + usage

│ │ │ └── Settings.jsx # Profile, integrations, notifications

│ │ ├── components/

│ │ │ ├── ui/ # shadcn/ui components

│ │ │ ├── VoicePreview.jsx # Play voice sample before selecting

│ │ │ ├── NumberPicker.jsx # Greek number search + selection UI

│ │ │ └── CallCard.jsx # Single call summary card

│ │ └── services/

│ │ ├── api.js # Axios client (auto-auth headers)

│ │ ├── push.js # Register Web Push subscription

│ │ └── realtime.js # Supabase realtime for live dashboard

│ └── vite.config.js

├── docker-compose.yml # Local dev environment

├── .env.example # All required env variables documented

└── README.md

# **6\. WEBHOOK FLOWS — THE GLUE**

## **6.1 Pre-Call Webhook (Dynamic Variables)**

When a call starts, Telnyx calls our pre-call webhook to load the lawyer's profile and inject dynamic variables into the agent's system prompt. This is how one Telnyx agent template serves all customers.

\# Telnyx sends to: POST https://api.voiceforge.ai/telnyx/pre-call

\# Payload:

{

"telnyx_agent_target": "+302101234567", // The called Telnyx number

"telnyx_end_user_target": "+306901234567", // The caller

"conversation_id": "xxx"

}

\# Our response (injected into agent system prompt & greeting):

{

"dynamic_variables": {

"var_office_name": "Δικηγορικό Γραφείο Παπαδόπουλου",

"var_specialty": "οικογενειακό δίκαιο",

"var_hours": "Δευτέρα-Παρασκευή 9:00-17:00",

"var_calendar_id": "primary@papadopoulos.gr",

"var_customer_id": "cust_abc123" // For tool auth

}

}

## **6.2 Post-Call Webhook (Analytics + Notifications)**

After every call ends, Telnyx sends a POST to our post-call webhook with the full transcript, duration, and AI insights. We process this automatically:

\# Telnyx sends to: POST https://api.voiceforge.ai/telnyx/post-call

\# Contains:

{

"conversation_id": "xxx",

"duration_seconds": 127,

"transcript": "Καλημέρα, θα ήθελα να κλείσω ραντεβού...",

"insights": {

"sentiment": "positive",

"intent": "book_appointment",

"appointment_booked": true

}

}

\# Our backend does in sequence:

\# 1. Store call record in PostgreSQL

\# 2. Generate AI summary via LLM (1-3 sentences)

\# 3. Push notification to customer PWA:

\# "New call from +306901234567: Appointment booked for Thursday 14:00"

\# 4. Email summary if enabled

\# 5. Update usage meters (for billing)

## **6.3 Tool Webhooks (Real-Time During Call)**

When the AI agent needs to check or book the calendar, it calls our tool webhook in real-time during the conversation:

\# Agent calls: POST https://api.voiceforge.ai/tools/calendar/check

{

"requested_date": "2026-03-05",

"customer_id": "cust_abc123" // From dynamic variable

}

\# We query Google Calendar using customer's stored OAuth token

\# Return available slots:

{

"available_slots": \["10:00", "11:30", "15:00", "16:30"\],

"message": "Available on Thursday March 5th: 10:00, 11:30, 15:00, 16:30"

}

\# Agent reads this to caller naturally in Greek

# **7\. CUSTOMER ONBOARDING — FULL TECHNICAL FLOW**

This is what happens technically during the 5-step wizard:

| **#** | **Customer Sees** | **Our Backend Does** | **Telnyx API Called** |
| --- | --- | --- | --- |
| 1   | Selects "Law Office" template | Loads template config from DB | None (local operation) |
| 2   | Types office name, edits greeting | Stores locally in session | None yet |
| 3   | Plays voice previews, selects voice | Calls Telnyx TTS preview endpoint | GET /v2/ai/tts/preview |
| 4   | Picks Greek +30 number from list | Shows available numbers from Telnyx | GET /v2/available_phone_numbers?GR |
| 5a  | Clicks "Launch My Agent" | Creates Telnyx sub-account | POST /v2/managed_accounts |
| 5b  | Sees loading animation | Creates AI assistant | POST /v2/ai/assistants |
| 5c  | Sees loading animation | Purchases phone number | POST /v2/number_orders |
| 5d  | Sees loading animation | Assigns number to agent | POST /v2/phone_number_assignments |
| 5e  | Agent is LIVE! | Sends welcome email + push notification | None |

Total time from "Launch My Agent" click to live answering calls: under 30 seconds. All 4 Telnyx API calls are made in parallel where possible.

# **8\. DEVELOPMENT TIMELINE & PRIORITIES**

## **Phase 1: Infrastructure (Week 1-2)**

- **Telnyx account setup + request Managed Accounts activation**
- FastAPI project scaffold + Supabase database schema
- Telnyx Python SDK integration — test create assistant, buy number
- Basic auth (Supabase Auth) + customer model with telnyx_account_id
- ngrok tunnel for webhook testing in development

## **Phase 2: Core Engine (Week 3-5)**

- Pre-call webhook + dynamic variables (the multi-tenant magic)
- Google Calendar OAuth integration + check/book tool webhooks
- Post-call webhook + transcript storage + push notification
- Telnyx managed account creation per user (registration flow)
- Greek phone number purchase flow (browse + buy API)

## **Phase 3: Frontend Wizard (Week 6-8)**

- 5-step onboarding wizard with smooth animations
- Voice preview player (call Telnyx TTS endpoint, play audio in browser)
- Number picker with Greek +30 area code filter and search
- Launch sequence with real-time progress indicator
- Dashboard: call history, transcripts, appointment list

## **Phase 4: Billing & Polish (Week 9-10)**

- Stripe subscription integration (monthly plans + overage metering)
- PWA manifest + service worker + push notification opt-in
- Agent editor page (post-launch modifications)
- Analytics charts (call volume, booking rate, peak hours)
- Beta testing with 10 real Greek law offices

## **Key Risks & Mitigations**

| **Risk** | **Probability** | **Mitigation** |
| --- | --- | --- |
| Managed Accounts not approved quickly | Low-Medium | Apply immediately at signup; single-account testing while waiting |
| Greek TTS quality not satisfactory | Low | Test Azure AthinaNeural + ElevenLabs during week 1; fallback options exist |
| Telnyx pricing increases | Low | Negotiate committed-use contract; architecture is provider-agnostic at API layer |
| Google Calendar OAuth complexity | Medium | Use off-the-shelf Python library; documented integration |
| Slow customer acquisition | Medium | Panos network in Crete + law associations; beta users provide testimonials |

# **9\. ENVIRONMENT VARIABLES REFERENCE**

Complete list of all environment variables required to run the platform:

\# ─── TELNYX (Master Account) ───────────────────────────────────

TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxx

TELNYX_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx

\# ─── DATABASE ────────────────────────────────────────────────────

DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres

SUPABASE_URL=https://xxx.supabase.co

SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx

\# ─── GOOGLE CALENDAR ─────────────────────────────────────────────

GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx

GOOGLE_REDIRECT_URI=https://api.voiceforge.ai/calendar/callback

\# ─── STRIPE ──────────────────────────────────────────────────────

STRIPE_SECRET_KEY=sk_live_xxxxxxxxxx

STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx

STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxx

STRIPE_PRO_PRICE_ID=price_xxxxxxxxxx

STRIPE_BUSINESS_PRICE_ID=price_xxxxxxxxxx

\# ─── WEB PUSH ────────────────────────────────────────────────────

VAPID_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx

VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx

VAPID_EMAIL=admin@voiceforge.ai

\# ─── APP ─────────────────────────────────────────────────────────

SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx # JWT signing

FRONTEND_URL=https://voiceforge.ai

API_BASE_URL=https://api.voiceforge.ai

ENVIRONMENT=production

# **10\. IMMEDIATE NEXT ACTIONS (IN ORDER)**

**CRITICAL:** Do these BEFORE writing any code. The Telnyx activation is on the critical path.

| **#** | **Action** | **Owner** | **Deadline** |
| --- | --- | --- | --- |
| 1   | Sign up at telnyx.com (business email, company name) | Panos | Day 1 |
| 2   | Add payment method + fund with €100 test credits | Panos/Wlad | Day 1 |
| 3   | Submit Level 2 Verification (business documents) | Panos | Day 1-2 |
| 4   | Contact Telnyx support: request Managed Accounts feature activation | Panos | Day 2 |
| 5   | Buy one Greek +30 test number (~€1) | Panos | Day 2 |
| 6   | Create test AI assistant in Telnyx portal with Azure Greek voice | Panos | Day 2-3 |
| 7   | Call the test number and evaluate Greek voice quality | Panos | Day 3 |
| 8   | Set up FastAPI scaffold + Supabase project | Panos | Week 1 |
| 9   | Implement pre-call webhook + test with ngrok | Panos | Week 2 |
| 10  | First end-to-end test: real call + calendar booking + push notification | Panos | Week 3 |

**MILESTONE:** Once Step 10 works end-to-end, the core platform is proven. Everything after that is UI, billing, and marketing.

|     |     |
| --- | --- |
| **VoiceForge AI — Internal Technical Spec**<br><br>Version 1.0 \| February 2026 \| CONFIDENTIAL | **DO NOT DISTRIBUTE**<br><br>Panos Skouras, Founder |