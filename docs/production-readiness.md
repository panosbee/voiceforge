# Production Readiness Report

**Date:** 2026-03-18 (re-audited 2026-03-19)
**Project:** VoiceForge AI
**Assessment:** ~60% Production Ready
**Assessed by:** Senior Engineer Audit (full-stack + DevOps)
**Re-audit commit:** `554954b` (merged changes from project owner)

---

## Executive Summary

VoiceForge AI has strong security fundamentals and a clean monorepo architecture. The core design is sound — ElevenLabs handles all voice AI processing while our API handles data and tool calls. However, there are **critical data integrity gaps** under concurrent load: appointment double-bookings when multiple callers request the same slot, duplicate call records from the dual webhook system (Telnyx + ElevenLabs both fire for the same call), a Redis anti-pattern that creates a new connection per request, and no Stripe webhook idempotency. The codebase is well-organized and the fixes are surgical — this is a concurrency hardening exercise, not a rewrite.

**Verdict:** Safe for a closed beta (< 10 customers, supervised). Not safe for unsupervised production traffic. A single medium-sized customer with 20 concurrent calls will trigger the double-booking and duplicate record bugs.

**Infrastructure:** Currently hosted on a DO Basic 4 GB / 2 vCPU droplet (~$24/mo) with no database backups. Keep the droplet, offload Postgres to DO Managed Postgres + enable daily backups (~$46/mo total) for beta launch. Upgrade to 8 GB / 4 vCPU only if pre-call webhook latency is an issue under load.

### Re-Audit Summary (2026-03-19)

Merged changes from project owner (commits `4fb04dc`..`554954b`). Re-verified all findings.

**Items FIXED since original audit:**
- Email service fully implemented — welcome, call summary, payment failure, license key, appointment invite emails all working with Resend API calls (not stubs)
- Email FROM address configurable via `EMAIL_FROM` env var
- Business hours now per-agent via `businessHours` JSONB column + `parseBusinessHours()` service
- `calls.telnyxConversationId` now has `.unique()` constraint (prevents raw duplicates)
- `agents.telnyxAssistantId` now has `.unique()` constraint (acts as index)
- `appointments(customerId, scheduledAt)` now has composite index `idx_appointments_scheduled`
- Calls list endpoint now paginated (20/page default, max 100)
- Telnyx SIP IP whitelist no longer in codebase (was incorrectly reported)

**Items STILL PRESENT (no change):**
- Redis connection-per-request anti-pattern (2.1)
- Stripe webhook idempotency missing (2.2)
- Phone number purchase not atomic (2.3)
- Appointment booking race condition — no unique constraint, no transactions (2.4)
- Admin secret hardcoded with fallback (2.5)
- Caller memory race condition (2.8)
- Worker/webhook race condition — no transactions (2.6 remaining)
- No usage metering — revenue leak (2.9, NEW)
- Admin routes have no rate limiting (pre-configured limiter exists but not attached)
- GDPR routes have no rate limiting (pre-configured limiter exists but not attached)
- No CSP headers (secureHeaders sets other headers but not CSP)
- SHA-256 for password hashing (code has TODO comment: "use bcrypt or argon2")
- No error tracking (Sentry), no usage metering, no agents pagination
- Zero test coverage

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Critical Issues (Fix Before Any Production Traffic)](#2-critical-issues)
3. [Capacity Estimation: 10 / 100 / 1,000 Users](#3-capacity-estimation)
4. [Database Layer](#4-database-layer)
5. [External Service Integrations](#5-external-service-integrations)
6. [Caching Strategy (Missing)](#6-caching-strategy)
7. [Security Posture](#7-security-posture)
8. [Resilience & Error Handling](#8-resilience--error-handling)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Observability & Monitoring](#10-observability--monitoring)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [Test Coverage](#12-test-coverage)
13. [Business & Operational Readiness](#13-business--operational-readiness)
14. [Priority Roadmap](#14-priority-roadmap)
15. [Supabase Configuration Checklist](#15-supabase-configuration-checklist)
16. [Deployment Runbook (First Production Deploy)](#16-deployment-runbook)
17. [Pre-Launch Checklist](#17-pre-launch-checklist)

---

## 1. Architecture Overview

```
voiceforge-ai/
├── apps/api/        Hono.js REST API (port 3001)
├── apps/web/        Next.js 15 App Router (port 3000)
├── packages/shared/ Types, constants, industry templates
├── docker/          Dockerfiles, Nginx, SQL migrations
└── scripts/         Deployment automation
```

### Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Zustand | Dashboard, onboarding, admin |
| API | Hono.js + @hono/node-server | REST API |
| Database | PostgreSQL 16, Drizzle ORM | Primary store (12 tables) |
| Cache | Redis 7 (ioredis) | Rate limiting only (no query caching) |
| AI Voice | ElevenLabs Conversational AI | Agent orchestration, TTS, STT, KB RAG |
| Telephony | Telnyx | Greek +30 numbers, SIP trunk to ElevenLabs |
| Billing | Stripe | Subscriptions, checkout, portal |
| Email | Resend | Transactional email |
| In-app Chat | OpenAI GPT | Support chatbot |
| Auth | Supabase (prod), local JWT (dev) | Stateless JWT auth |
| Reverse Proxy | Nginx + Let's Encrypt | SSL, rate limiting, gzip |
| Process Manager | PM2 | Cluster mode (2 API + 1 worker) |
| Logging | Pino | Structured JSON, PII redaction |
| Validation | Zod | All endpoint input validation |

### Request Flow

```
Client -> Cloudflare (optional CDN) -> Nginx (SSL + rate limit)
  |-- /api/* -> Hono API (PM2 x2) -> PostgreSQL
  |-- /* -> Next.js (SSR/static)
  |-- /webhooks/* -> Hono API -> External APIs
```

### Inbound Call Flow

```
Caller -> Telnyx +30 number -> SIP trunk -> ElevenLabs agent
  -> ElevenLabs makes tool calls back to our API (/tools/*)
  -> Post-call: ElevenLabs webhook -> our /webhooks/elevenlabs/*
  -> Post-call: Telnyx webhook -> our /webhooks/telnyx/*
  -> DB updated: call record, transcript, sentiment, appointment
```

### Detailed Call Lifecycle

**Important:** Our API does NOT handle the voice conversation. ElevenLabs does. Our API's role is:
1. Provide dynamic variables before the call (pre-call webhook, must respond < 1 second)
2. Handle tool calls during the call (slot check, appointment booking)
3. Record call data after the call (transcripts, sentiment, memories)

One ElevenLabs agent CAN handle multiple concurrent conversations — each conversation is an isolated session on ElevenLabs' infrastructure. Our DB `agents` row maps 1:1 to one ElevenLabs `agentId`, and that agent can run many calls simultaneously.

**Step-by-step for a single call:**

| Step | Trigger | Endpoint | What Happens | DB Writes |
|------|---------|----------|-------------|-----------|
| 1. Phone rings | Telnyx | `POST /webhooks/telnyx/pre-call` | Agent looked up by phone number (`webhooks.ts:41-44`), dynamic variables assembled (business name, customer ID, agent ID), returned to Telnyx. **Must respond < 1 second.** | None (read-only) |
| 2. Call connects | Telnyx -> SIP -> ElevenLabs | N/A (external) | ElevenLabs agent handles the conversation using its instructions, voice, KB. **Zero load on our API.** | None |
| 3. Caller asks for appointment | ElevenLabs | `POST /webhooks/elevenlabs/server-tool` | Tool: `check_availability` — queries `appointments` table for busy slots on requested date (`elevenlabs-webhooks.ts:497-577`). Returns available time slots. | None (read-only) |
| 4. Caller confirms appointment | ElevenLabs | `POST /webhooks/elevenlabs/server-tool` | Tool: `book_appointment` — checks slot availability, inserts into `appointments` table (`elevenlabs-webhooks.ts:580-704`). | `appointments` INSERT |
| 5. Call ends | ElevenLabs | `POST /webhooks/elevenlabs/post-conversation` | Transcript, summary, sentiment (1-5), intent category extracted. Call record created or updated. Caller memory upserted. Appointment may also be created here if not done via tool. (`elevenlabs-webhooks.ts:56-469`) | `calls` INSERT/UPDATE, `caller_memories` UPSERT, `appointments` INSERT (if booked), `webhook_events` INSERT |
| 6. Telnyx post-call | Telnyx | `POST /webhooks/telnyx/post-call` | Call duration, recording URL, metadata stored. Call record created if not already exists. (`webhooks.ts:96-182`) | `calls` INSERT (if not exists), `webhook_events` INSERT |
| 7. Safety net | Worker (every 2 min) | N/A (background) | `conversation-sync.ts` polls ElevenLabs API for conversations not yet recorded. Creates call records for any missed webhooks. | `calls` INSERT, `webhook_events` INSERT |

### Data Written Per Call

| Data | Written When | Written Where | Status |
|------|-------------|--------------|--------|
| Call record (basic metadata) | Post-call webhook (step 6) | `calls` table | Works but has dedup race (see 2.6) |
| Transcript (full conversation text) | Post-conversation webhook (step 5) | `calls.transcript` | Works |
| Summary (AI-generated 2-3 sentences) | Post-conversation webhook (step 5) | `calls.summary` | Works |
| Sentiment (1-5 scale) | Post-conversation webhook (step 5) | `calls.sentiment` | Works |
| Intent category | Post-conversation webhook (step 5) | `calls.intentCategory` | Works |
| Recording URL | Post-call webhook (step 6) | `calls.recordingUrl` | Works |
| Appointment | During call (tool, step 4) or post-conversation (step 5) | `appointments` table | **Double-booking race condition** (see 2.4) |
| Caller memory (episodic) | Post-conversation webhook (step 5) | `caller_memories` table | Works (upsert by phone + customerId) |
| Google Calendar sync | **NOT IMPLEMENTED** | -- | Appointments stay local-only |

### Multi-Agent Setup

Businesses can create multiple agents (front-office, accountant, sales, manager):
- Each agent is a separate ElevenLabs agent with its own phone number
- Each agent has its own `instructions`, `voiceId`, `tools`, `knowledgeBase`
- Calls are routed by phone number: +30-xxx-1001 -> front-office, +30-xxx-1002 -> sales
- The `agent_flows` table supports handoff rules (agent A can transfer to agent B with conditions)
- Load is additive: 4 agents x 5 concurrent calls = same API load as 1 agent x 20 calls

---

## 2. Critical Issues

These must be fixed before any real customer traffic.

### 2.1 Redis Connection-Per-Request Anti-Pattern

**Location:** `middleware/rate-limit.ts:78-124`
**Severity:** CRITICAL — will crash under load

The Redis rate limiter creates a **new ioredis connection**, runs one Lua script, then `quit()`s — on **every single HTTP request**. With 100 req/s, that's 100 TCP connections opened and closed per second against Redis.

```typescript
// CURRENT (broken): new connection per request
async check(key, limit, windowMs) {
  const redis = new Redis(this.redisUrl, { ... });
  await redis.connect();
  const result = await redis.eval(luaScript, ...);
  await redis.quit();  // opens and closes on every request
}
```

**Impact:** At ~50 concurrent requests, Redis will start refusing connections. At ~200, the Node.js process will exhaust file descriptors and crash.

**Fix:** Create a single shared Redis connection at module initialization.

### 2.2 Stripe Webhook Has No Idempotency Check

**Location:** `routes/billing.ts:232-357`
**Severity:** CRITICAL — risk of duplicate charges / double state mutations

Stripe retries webhooks on timeout (up to 3 days). The handler processes events without checking if the `event.id` was already handled. The `webhook_events` table exists for idempotency tracking, but **it is never used in the billing webhook handler**.

**Impact:** Network timeout during webhook processing -> Stripe retries -> `checkout.session.completed` fires twice -> subscription activated twice, potential double email, corrupted state.

**Fix:** Check `event.id` against `webhook_events` before processing. Wrap in a transaction.

### 2.3 Phone Number Purchase Is Not Atomic

**Location:** `routes/numbers.ts:103-194`
**Severity:** CRITICAL — money spent, system inconsistent

The phone purchase is a 5-step pipeline with no transaction:
1. Purchase number on Telnyx (money charged)
2. Create SIP connection — failure here = money spent, no SIP
3. Assign number to SIP — failure here = silently swallowed
4. Import to ElevenLabs — failure here = silently swallowed
5. Update DB

Steps 3 and 4 explicitly catch-and-swallow errors (`log.warn` but continue). If step 2 fails, money is charged but the customer has a broken number with no way to recover except manual intervention.

**Fix:** Wrap steps 2-5 in a compensating transaction pattern. If ElevenLabs import fails, at minimum store the failure state and expose a "retry SIP setup" action in the admin panel.

### 2.4 Appointment Booking Race Condition

**Location:** `routes/calls.ts` (appointment creation in tool callbacks)
**Severity:** HIGH — double bookings possible

The calendar slot check and appointment insert are separate queries with no transaction or optimistic locking. Two concurrent calls can both check availability, both find the slot open, and both insert — creating a double booking.

**Fix:** Wrap in `db.transaction()` with a unique constraint on `(agentId, scheduledAt)` or use `SELECT ... FOR UPDATE`.

### 2.5 Admin Secret Hardcoded with Fallback

**Location:** `routes/admin.ts:41`
**Severity:** HIGH — anyone can access admin panel

```typescript
const adminSecret = env.ADMIN_SECRET ?? 'voiceforge-admin-2026';
```

If `ADMIN_SECRET` is not set in production, the fallback is publicly known. Combined with admin accepting `?token=` in query params (visible in Nginx logs, browser history, referer headers), this is an open door.

**Fix:** Remove the fallback. Require `ADMIN_SECRET` in production env validation. Remove query param auth.

### 2.6 Duplicate Call Records (Dual Webhook Race)

**Location:** `webhooks.ts:103-158` and `elevenlabs-webhooks.ts:68-234`
**Severity:** HIGH — duplicate/overwritten call data

Both Telnyx and ElevenLabs send post-call webhooks for the same conversation. The system has three independent writers for call records:

1. **Telnyx post-call** (`webhooks.ts:146-158`) — inserts a new `calls` row
2. **ElevenLabs post-conversation** (`elevenlabs-webhooks.ts:199-234`) — searches for a recent call (last 2 minutes by time window, not conversation ID), then updates or inserts
3. **Conversation sync worker** (`conversation-sync.ts:109-133`) — runs every 2 minutes, catches missed webhooks

**Race scenarios:**
- ~~Two Telnyx webhooks arrive for the same conversation (retry): both pass the idempotency check (`webhookEvents.findFirst` at line 103 has no transaction), both insert -> **duplicate call records**~~ **PARTIALLY FIXED:** `telnyxConversationId` now has `.unique()` constraint in schema (`calls.ts:39`), so the DB will reject true duplicates. However, the handlers still don't use `ON CONFLICT UPDATE`, meaning retries will get a DB error instead of a graceful update.
- ElevenLabs webhook searches for "recent call in last 2 minutes" — with 20 concurrent calls ending within seconds, it can match the **wrong** call record and overwrite its data
- Worker and webhook fire simultaneously for the same conversation: both pass dedup check, both insert

**Root causes:**
- ~~No unique constraint on `calls.telnyxConversationId` (it's indexed but allows duplicates)~~ **FIXED:** `.unique()` now on schema
- Idempotency check is not atomic (SELECT then INSERT without transaction)
- ElevenLabs dedup uses time-window matching instead of conversation ID matching

**Remaining fix needed:**
1. ~~Add `UNIQUE` constraint on `calls(telnyxConversationId)` with `ON CONFLICT UPDATE`~~ UNIQUE exists; add `ON CONFLICT UPDATE` to handlers
2. Wrap idempotency check + call insert in `db.transaction()`
3. Match ElevenLabs post-conversation to existing call by conversation ID, not time window

### 2.7 Appointment Double-Booking (Three Unprotected Code Paths)

**Location:** Three separate endpoints, all with the same check-then-insert race condition:
- `elevenlabs-webhooks.ts:636-689` — server tool `book_appointment` (called during live call)
- `elevenlabs-webhooks.ts:323-343` — post-conversation appointment creation
- `tools.ts:180-210` — legacy calendar book endpoint

**Severity:** HIGH — confirmed double-booking under concurrent load

With 20 concurrent calls, if 3 callers request "Tuesday at 10:00" simultaneously:
```
Call A: SELECT appointments WHERE time = 10:00 -> empty -> INSERT at 10:00 (success)
Call B: SELECT appointments WHERE time = 10:00 -> empty -> INSERT at 10:00 (success, DUPLICATE)
Call C: SELECT appointments WHERE time = 10:00 -> empty -> INSERT at 10:00 (success, TRIPLICATE)
```

No transaction, no `SELECT FOR UPDATE`, no unique constraint on `(customerId, scheduledAt)`.

The post-conversation handler (`elevenlabs-webhooks.ts:323-343`) has a "bump to next available slot" mechanism, but it also races: two webhooks can both read the same conflict set, both bump to the same new slot, and both insert.

**Fix:**
1. Add unique constraint: `UNIQUE(customer_id, scheduled_at)` on `appointments` table
2. Wrap all three booking paths in `db.transaction()` with `SELECT ... FOR UPDATE` on the conflict window
3. Use `ON CONFLICT` clause as a safety net: if unique constraint fires, return "slot taken" to caller

### 2.8 Caller Memory Update Race

**Location:** `elevenlabs-webhooks.ts:376-425`
**Severity:** MEDIUM — data loss on concurrent calls from same phone number

Caller memory is upserted by `(customerId, callerPhone)`. If the same person calls two different agents simultaneously (or hangs up and calls back quickly), both post-conversation webhooks try to update the same `caller_memories` row. Without a transaction, the second write can overwrite `callCount`, `totalDurationSeconds`, and `lastSentiment` from the first.

**Fix:** Use `db.transaction()` with `SELECT FOR UPDATE` on the caller memory row, or use SQL atomic increments (`SET call_count = call_count + 1`) instead of read-then-write.

### 2.9 No Usage Metering — Revenue Leak

**Severity:** CRITICAL — customers can exceed plan limits with zero billing consequence

Plan limits are defined in `packages/shared/src/constants.ts` (Basic: X minutes, Pro: Y minutes, Enterprise: Z minutes). Stripe subscriptions are working. But there is **no call-minute counter per billing cycle**, no Stripe Meter API reporting, and no overage enforcement.

**What's missing:**
1. No `duration_seconds` tracking aggregated per billing period
2. No `usage_records` table to track minutes consumed vs plan limits
3. No Stripe metering API integration (`stripe.billing.meterEvents.create()`)
4. No soft-limit enforcement (e.g., pause agent when quota exceeded)

**Fix:**
```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  minutes_used DECIMAL(8,2) DEFAULT 0,
  minutes_limit INTEGER,
  overage_minutes DECIMAL(8,2) DEFAULT 0,
  reported_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Backend changes:**
1. In `elevenlabs-webhooks.ts` post-conversation handler: calculate `duration_seconds`, update `calls` record
2. Create `usageService.reportUsage(customerId, minutes)` that calls `stripe.billing.meterEvents.create()`
3. Worker: nightly job to aggregate and report to Stripe
4. Soft-limit enforcement: if customer exceeds quota, pause agent via ElevenLabs API

**Estimated effort:** 5 days

---

## 3. Capacity Estimation

### Assumptions Per Customer

Based on the SaaS model (AI voice receptionist for SMEs):

| Metric | Estimate |
|--------|----------|
| Dashboard pageviews per customer/day | ~10-20 |
| API calls per dashboard load | 3-5 (parallel: agents, calls, customer profile) |
| Inbound phone calls per customer/day | 5-20 (SME business hours) |
| Webhooks per phone call | 2-3 (pre-call + post-call + insights) |
| Agent config changes per customer/day | 0-2 |
| KB uploads per customer/week | 0-3 |

### Real-World Use Case: Medium Business With 20 Concurrent Calls

A medium-sized company registers, creates 4 agents (front-office, accountant, sales, manager), each handling ~5 simultaneous calls = 20 parallel calls.

**What happens on our API during 20 parallel calls:**

| Event | Count | Our API Load | Bottleneck? |
|-------|-------|-------------|-------------|
| Pre-call webhooks (agent lookup) | 20 | 20 read queries, sub-50ms each | No — read-only, fast |
| Voice conversations | 20 | **Zero** — ElevenLabs hosts the AI | No |
| `check_availability` tool calls | ~10 | 10 read queries to `appointments` | No |
| `book_appointment` tool calls | ~5 | 5 write queries | **YES — double-booking race** (see 2.7) |
| Post-conversation webhooks | 20 | 20 call record upserts + 20 memory upserts | **YES — dedup race** (see 2.6) |
| Post-call webhooks (Telnyx) | 20 | 20 call record inserts | **YES — duplicate records** (see 2.6) |
| Conversation sync worker | 1 run | Polls ElevenLabs API for all agents | **YES — races with webhooks** (see 2.6) |
| DB connections used simultaneously | ~25-30 | Pool of 25 (prod) | **TIGHT** — may exhaust pool |
| Redis rate limit checks | ~60+ | **WILL FAIL** — connection-per-request bug (see 2.1) | **CRITICAL** |

**ElevenLabs concurrency is the external bottleneck:**
- **Scale (CURRENT): 30 concurrent, 3,600 min/mo ($330/mo), additional minutes at $0.10/min, burst at $0.20/min**
- **Business: 30 concurrent, 13,750 min/mo ($1,320/mo), additional minutes at $0.10/min, burst at $0.19/min**
- Enterprise: elevated concurrency, custom terms/DPA/SLAs, contact sales

**Verdict for 20 concurrent calls right now:** Mostly works for the call handling itself (ElevenLabs does the heavy lifting), but **data integrity is broken** — double bookings, duplicate call records, and Redis will crash under the webhook burst.

**ElevenLabs minutes are the billing bottleneck:** Scale plan includes 3,600 min/mo (~120 min/day). With 10 customers averaging 10 calls/day at 3-5 min each = 300-500 min/day — included minutes exhausted in ~1 week, then $0.10/min overage + $0.09/min hosting cost kicks in. Usage metering (Section 2.9) is critical to track consumption and pass costs through to customers.

### 10 Concurrent Users (Closed Beta)

Each user is a business with 1-3 agents. Peak concurrent calls across all users: ~10-20.

| Resource | Load | Current Capacity | Verdict |
|----------|------|------------------|---------|
| **API requests/min** | ~50-100 | 100/min rate limit, single instance handles ~1000/min | OK |
| **DB connections** | 3-5 concurrent | Pool of 20 (dev) / 25 (prod) | OK |
| **Redis** | ~50-100 ops/min | **BROKEN** — new connection per request | FAIL |
| **ElevenLabs concurrent calls** | ~10-20 | Scale plan: 30 | OK |
| **ElevenLabs minutes** | 300-500 min/day (10 customers) | Scale plan: 3,600 min/mo (~120/day) | **WILL EXHAUST in ~1 week** |
| **ElevenLabs API** | 10-30 calls/day | Per-account limits, singleton client | OK |
| **Telnyx webhooks** | 20-60/day | 500/min rate limit | OK |
| **Stripe webhooks** | 0-5/day | No idempotency | RISK |
| **Appointment booking** | Low concurrency | Race condition exists but rarely triggers | LATENT RISK |
| **PostgreSQL storage** | ~100MB/month | 10GB default | OK |
| **Memory (API)** | ~150MB | 512MB limit | OK |

**Verdict:** Works if you fix the Redis connection issue. Appointment double-booking is a latent risk that surfaces with popular time slots.

### 100 Concurrent Users (Growth Phase)

Peak concurrent calls across all users: ~50-100. Peak concurrent appointment bookings: ~5-10/min.

| Resource | Load | Capacity | Verdict |
|----------|------|----------|---------|
| **API requests/min** | 500-1,000 | Single PM2 instance: ~1,000/min | TIGHT |
| **DB connections** | 15-30 concurrent | Pool of 25 | **WILL EXHAUST** during call bursts |
| **DB query latency** | Unpaginated agent lists | Calls endpoint now paginated (20/page); agents endpoint still returns all | RISK (agents only) |
| **Redis** | 500-1,000 ops/min | BROKEN (see 2.1) | FAIL |
| **ElevenLabs concurrent calls** | 50-100 | Scale plan: 30 | **BLOCKER — need Business ($1,320/mo) or Enterprise** |
| **ElevenLabs minutes** | 3,000-5,000 min/day | Scale: 3,600/mo, Business: 13,750/mo | **BLOCKER — need Enterprise or per-customer API keys** |
| **ElevenLabs API** | 200-500 calls/day | Rate limits vary by plan | MONITOR |
| **Concurrent phone calls** | 50-100 simultaneous | Telnyx + ElevenLabs handle this | OK (with Enterprise) |
| **Appointment double-bookings** | ~5-10 concurrent bookings/min | No protection | **WILL HAPPEN** |
| **Call record duplication** | 100-200 webhook pairs/day | No unique constraint | **WILL HAPPEN** |
| **Telnyx webhooks** | 400-1,000/day | 500/min limit | OK |
| **Stripe webhooks** | 50-100/month | No idempotency | HIGH RISK |
| **PostgreSQL storage** | ~1GB/month | 10GB, needs monitoring | MONITOR |
| **Memory (API x2 PM2)** | ~300MB each | 512MB limit each | OK |
| **Worker** | 3 tasks, every 2min-24h | 256MB, single instance | OK |

**Required changes for 100 users:**
1. Fix Redis connection pooling (critical)
2. Add unique constraints + transactions for appointments and call records
3. Add Stripe webhook idempotency
4. Add pagination to agent listing
5. Scale PM2 to 4 instances (or use horizontal scaling)
6. Increase DB pool to 50 (and configure PostgreSQL `max_connections` accordingly)
7. Add response caching for common reads (agent config, voice list, customer profile)
8. Add database indexes for webhook lookup queries
9. Upgrade ElevenLabs to Business ($1,320/mo) or Enterprise plan — Scale plan's 30 concurrent calls and 3,600 min/mo is insufficient

### 1,000 Concurrent Users (Scale Phase)

Peak concurrent calls: ~200-500. Peak concurrent bookings: ~20-50/min.

| Resource | Load | Required | Current |
|----------|------|----------|---------|
| **API requests/min** | 5,000-10,000 | Load balancer + 4-8 API instances | Single droplet |
| **DB connections** | 100-200 concurrent | PgBouncer + managed Postgres | 25 pool, no PgBouncer |
| **DB read latency** | Heavy read load | Read replicas, query caching | Single primary |
| **Redis** | 5,000-10,000 ops/min | Dedicated Redis instance, connection pool | Broken + 256MB shared |
| **ElevenLabs** | 2,000-5,000 calls/day, 200-500 concurrent | Enterprise plan required, multiple API keys | Single Scale plan key (30 concurrent, 3,600 min/mo) |
| **Concurrent calls** | 200-500 simultaneous | ElevenLabs Enterprise with high concurrency | Unknown limit |
| **Appointment booking** | 20-50 concurrent/min | Transactions + unique constraints mandatory | None |
| **Stripe** | 500-1,000 events/month | Idempotency mandatory | Missing |
| **PostgreSQL** | 10GB+/month (calls, transcripts) | Partitioning, archiving, S3 for recordings | No archival strategy |
| **Search** | Full-text search on transcripts | ElasticSearch or pg_trgm | Not implemented |

**Required architecture changes for 1,000 users:**
1. All of the 100-user fixes, plus:
2. Separate API and DB to different machines
3. PgBouncer for connection multiplexing
4. Read replica for analytics/dashboard queries
5. Dedicated Redis instance (not colocated)
6. S3 or equivalent for recording URL storage (don't serve via API)
7. Background job queue (BullMQ on Redis) instead of setInterval worker
8. CDN for frontend assets
9. Horizontal API scaling behind load balancer
10. ElevenLabs Enterprise plan with negotiated concurrency limits and minute quotas
11. Circuit breakers on all external API calls
12. Table partitioning on `calls` (by month) and `webhook_events`

---

## 4. Database Layer

### Connection Pooling

**Location:** `db/connection.ts`

| Setting | Dev | Prod | Assessment |
|---------|-----|------|------------|
| Pool size | 20 | 25 | Adequate for 1 API instance. With PM2 x2, total is 50 connections. PostgreSQL default max_connections is 100 — works but little headroom. |
| Idle timeout | 20s | 30s | Fine |
| Connect timeout | 10s | 10s | Fine |
| SSL | off | on | Correct |
| `prepare: false` | yes | yes | Required for PgBouncer compatibility — good forward planning |

**Issue at scale:** Each PM2 worker gets its own pool. 4 workers x 25 = 100 connections = PostgreSQL default limit. Need PgBouncer at ~100 users.

### Missing Indexes

These columns are queried in webhook handlers. Pre-call webhook must respond **< 1 second** or the call fails.

| Table | Column | Query Location | Urgency | Fix |
|-------|--------|---------------|---------|-----|
| `agents` | `phoneNumber` | `webhooks.ts:41` (pre-call lookup) | **CRITICAL — 1s deadline** | Add index |
| `agents` | `elevenlabsAgentId` | `elevenlabs-webhooks.ts:80-83` (post-conversation lookup) | High | Add index (already has `.unique()` but check if index exists) |
| `agents` | `telnyxAssistantId` | `webhooks.ts:128` | ~~High~~ | ~~Add index~~ **FIXED:** Has `.unique()` constraint (acts as index) |
| `calls` | `telnyxConversationId` | Already indexed + unique | -- | -- |
| `appointments` | `(customerId, scheduledAt)` | `elevenlabs-webhooks.ts:636-648` (slot check during live call) | ~~**HIGH — blocks caller on the phone**~~ | ~~Add composite index~~ **FIXED:** `idx_appointments_scheduled` index exists on `(customerId, scheduledAt)` |
| `customers` | `stripeCustomerId` | `billing.ts:331` | Medium | Add index |
| `caller_memories` | `(customerId, callerPhone)` | `elevenlabs-webhooks.ts:376` (memory lookup) | Medium | Already indexed |
| `pending_registrations` | `status` | `admin.ts:84` | Low | Add index if table grows |

### Missing Pagination

| Endpoint | Location | Risk |
|----------|----------|------|
| `GET /api/agents` | `agents.ts:273-305` | Returns ALL agents for a customer. With enterprise customers creating 50+ agents, response size grows. |
| `GET /api/flows` | `flows.ts:144-146` | Same — returns all flows |
| ~~`GET /api/calls`~~ | ~~`calls.ts`~~ | **FIXED:** Now paginated with `page`/`pageSize` query params (default 20, max 100), returns `meta: { page, pageSize, total, totalPages }` |

### Missing Transactions

| Operation | Location | Risk | Concurrent Trigger |
|-----------|----------|------|-------------------|
| Phone number purchase (5-step) | `numbers.ts:103-194` | Money charged, partial setup | Low (admin action) |
| Appointment booking via server tool | `elevenlabs-webhooks.ts:636-689` | Double-booking | **High — concurrent calls book same slot** |
| Appointment booking post-conversation | `elevenlabs-webhooks.ts:323-343` | Double-booking | **High — concurrent webhooks** |
| Appointment booking legacy tool | `tools.ts:180-210` | Double-booking | Medium |
| Call record insert (Telnyx) | `webhooks.ts:103-158` | Duplicate records | **High — webhook retries** |
| Call record upsert (ElevenLabs) | `elevenlabs-webhooks.ts:199-234` | Data overwrite | **High — 20 calls ending within seconds** |
| Caller memory upsert | `elevenlabs-webhooks.ts:376-425` | Counter/sentiment overwrite | Medium — same caller, two quick calls |
| Webhook idempotency check | `webhooks.ts:103-110`, `elevenlabs-webhooks.ts:68-77` | Duplicate processing | **High — dual webhook system** |
| Worker conversation sync | `conversation-sync.ts:109-133` | Races with real-time webhooks | Medium — 2-min poll interval |
| Stripe checkout -> DB update | `billing.ts:253-266` | Double activation if webhook retried | Low-Medium |

### Missing Unique Constraints

| Table | Suggested Constraint | Purpose |
|-------|---------------------|---------|
| `calls` | ~~`UNIQUE(telnyx_conversation_id)`~~ | ~~Prevent duplicate call records from webhook retries~~ **FIXED:** `.unique()` exists on `telnyxConversationId` |
| `appointments` | `UNIQUE(customer_id, scheduled_at)` | Prevent double-bookings at same time slot |
| `webhook_events` | Already has `UNIQUE(event_id)` | Good — but check is not atomic with processing |
| `caller_memories` | `UNIQUE(customer_id, caller_phone)` | Prevent duplicate memory rows (currently no constraint) |

### N+1 Query Patterns

| Location | Pattern | Fix |
|----------|---------|-----|
| `flows.ts:220-231` | Loops KB docs to build count map after fetching agents | Use SQL `COUNT(*) GROUP BY agent_id` |

### What's Done Well

- All queries use Drizzle ORM (parameterized, no SQL injection)
- Proper `cascade` and `set null` on foreign keys
- Performance indexes on high-traffic tables (`calls`, `appointments`, `caller_memories`)
- UUID primary keys (no sequential ID leakage)
- `webhook_events` table exists for idempotency (just not used everywhere)
- Health check endpoint verifies DB connectivity with latency measurement

---

## 5. External Service Integrations

### ElevenLabs (Primary AI Platform)

**Location:** `services/elevenlabs.ts` (946 lines)

| Aspect | Status | Detail |
|--------|--------|--------|
| Client pattern | Singleton | Good — one `ElevenLabsClient` reused across requests |
| Timeout | SDK default | No explicit timeout configured. Raw `fetch()` calls at line 808 have **no timeout** |
| Retry | None at service level | SDK may have built-in retries. Manual 3-attempt retry with 4s delay exists in `calls.ts:533-556` for conversation fetching |
| Rate limit handling | None | No backoff, no queuing. Concurrent dashboard loads from 100 users could exhaust ElevenLabs rate limits |
| Circuit breaker | None | If ElevenLabs is down, every agent CRUD operation fails with 500 |
| Error handling | Catch + rethrow | Errors logged and re-thrown. No retry, no fallback |
| Concurrency | No limit | If 50 users update agents simultaneously, 50 parallel API calls to ElevenLabs |

**ElevenLabs Plan Limits (current plan: Scale):**

| | Scale (CURRENT) | Business | Enterprise |
|--|-----------------|----------|------------|
| **Price** | $330/mo | $1,320/mo | Custom |
| **Minutes included** | 3,600 | 13,750 | Custom |
| **Concurrent calls** | 30 | 30 | Elevated |
| **Additional minutes** | $0.10/min | $0.10/min | Custom |
| **Burst pricing** | $0.20/min | $0.19/min | Custom |
| **Hosting cost (calls)** | $0.09/min | $0.09/min | $0.09/min |
| **LLM tokens** | At cost | At cost | At cost |
| **Telephony provider** | At cost | At cost | At cost |
| **Workspace seats** | 3 | 5 | More |
| **DPA/SLAs** | No | No | Yes |
- Enterprise: negotiable
- API rate limits: ~100 req/min on agent management endpoints

**Recommendations:**
1. Add `AbortController` timeout (30s) to all raw `fetch()` calls
2. Add a semaphore/queue for ElevenLabs API calls (max 10 concurrent)
3. Cache agent configuration reads (agent config changes rarely, reads happen every call)
4. Add circuit breaker: after 5 consecutive failures, fast-fail for 30s

### Telnyx (Telephony)

**Location:** `services/telnyx.ts` (691 lines)

| Aspect | Status | Detail |
|--------|--------|--------|
| Client pattern | Master singleton + per-request sub-account clients | Master: good. Sub-account: creates new `Telnyx()` per request — overhead but acceptable since SDK is lightweight |
| Timeout | 30s via SDK | Good. But raw `fetch()` calls at lines 404, 427, 459 have **no timeout** |
| Retry | SDK `maxRetries: 3` | Built-in, but no exponential backoff |
| SIP connection creation | 2-step (connection + FQDN) | **Not atomic** — if FQDN call fails, orphaned connection. Line 427: second `fetch()` result is not checked |
| Sub-account client | Decrypts API key per request | Acceptable — `decrypt()` is fast (AES-GCM). But client is not cached. |

**Recommendations:**
1. Add timeout to raw `fetch()` calls
2. Add error handling for FQDN assignment (line 427-438)
3. Cache sub-account clients by customer ID (LRU, 5-min TTL)

### Stripe (Billing)

**Location:** `services/stripe.ts` + `routes/billing.ts`

| Aspect | Status | Detail |
|--------|--------|--------|
| Webhook signature | HMAC-SHA256 via SDK | Good |
| Idempotency keys on mutations | **Missing** | `stripe.customers.create()`, `stripe.checkout.sessions.create()` — no idempotency key |
| Webhook idempotency | **Missing** | `event.id` not checked against DB (see 2.2) |
| Payment failure handling | Email notification | One-shot attempt, no retry if email fails |
| Subscription state machine | Handles active/past_due/canceled/unpaid | Good coverage |

**Recommendations:**
1. Add `idempotencyKey` to all Stripe mutation calls
2. Check `event.id` in `webhook_events` table before processing
3. Add retry for payment failure email (or use Resend's built-in retry)

### Resend (Email)

**Location:** `services/email.ts` (557+ lines)

| Aspect | Status | Detail |
|--------|--------|--------|
| Graceful degradation | Good | Missing API key returns 'skipped' via `isEmailConfigured()` check |
| HTML sanitization | Good | `escapeHtml()` for user-provided content |
| Retry | Handled by Resend | Resend retries failed deliveries automatically for up to 72 hours (soft bounces, transient server issues). Our code does not need retry logic. |
| Delivery tracking | **MISSING** | Resend returns a message ID per send, but we don't store it. No way to know if a call summary email was delivered, bounced, or failed. |
| Resend webhooks | **MISSING** | Resend can POST delivery events (`delivered`, `bounced`, `complained`) to our API. Not configured. |
| Template management | Inline HTML | Acceptable for current scale |
| Welcome email | **FIXED** (since last audit) | Sent on onboarding completion (`customers.ts:230`) |
| Call summary email | **FIXED** (since last audit) | `notifyCallCompleted()` called in both `elevenlabs-webhooks.ts:292` and `conversation-sync.ts:305` |
| Payment failure email | **FIXED** (since last audit) | `sendPaymentFailedEmail()` on `invoice.payment_failed` Stripe event (`billing.ts:335`) |
| License key email | Working | Sends with .ics calendar invite support |
| Appointment invite email | **FIXED** (since last audit) | `sendAppointmentInviteEmail()` with .ics attachment |
| FROM address | **FIXED** (since last audit) | Now configurable via `EMAIL_FROM` env var (`env.ts:85`) |

---

## 6. Caching Strategy

### Current State: No Application-Level Caching

Redis is configured and running, but **only used for rate limiting**. Every API request hits PostgreSQL directly.

| Data | Access Pattern | Cache Candidate? | Recommended TTL |
|------|---------------|-------------------|----------------|
| Customer profile | Every authenticated request (auth -> DB lookup) | **YES** (highest impact) | 5 min |
| Agent configuration | Every incoming call (webhook lookup) | **YES** | 2 min (invalidate on update) |
| Voice list | Dashboard load, agent creation | **YES** (already has HTTP cache header) | 1 hour |
| Call history | Dashboard load, paginated | Maybe (stale-while-revalidate) | 30 sec |
| KB documents list | Dashboard, agent edit | Low priority | -- |

### HTTP Caching

| Route | Current | Recommended |
|-------|---------|-------------|
| `GET /api/voices` | `Cache-Control: public, max-age=3600` | -- (already good) |
| `GET /widget/:agentId/embed.js` | `Cache-Control: public, max-age=300` | -- (already good) |
| `GET /api/agents` | None | `Cache-Control: private, max-age=60` |
| `GET /api/calls` | None | `Cache-Control: private, max-age=30` |
| `GET /api/customers/me` | None | `Cache-Control: private, max-age=300` |
| ETag support | None anywhere | Add for agent config (save bandwidth on mobile) |

### Recommended Caching Architecture

```
Request -> Rate Limiter (Redis) -> Auth Check
  -> Redis Cache Check (GET only)
    -> HIT: return cached response
    -> MISS: query PostgreSQL -> store in Redis -> return

Agent/Customer UPDATE -> invalidate Redis cache keys
```

**Implementation priority:** Cache the customer profile lookup that happens on every authenticated request. This alone eliminates ~50% of DB queries.

---

## 7. Security Posture

### What's Strong

| Feature | Implementation | Assessment |
|---------|---------------|------------|
| Encryption at rest | AES-256-GCM, random IV per operation, auth tag | Industry standard |
| Webhook verification | Ed25519 (Telnyx) + HMAC-SHA256 (Stripe) + 5-min replay protection | Excellent |
| Auth | Stateless JWT, local HS256 verification, no HTTP round-trip in prod | Fast + secure |
| Rate limiting | Redis-backed sliding window with Lua atomic ops, plan-based tiers | Well-designed (fix connection issue) |
| Input validation | Zod on all endpoints | Comprehensive |
| PII handling | Pino redaction of email, phone, auth headers in production | GDPR compliant |
| Security headers | HSTS (2yr), X-Frame-Options DENY, nosniff, referrer-policy | Strong |
| GDPR | Data export, selective deletion, full deletion, audit trail | 306-line implementation |
| Data retention | Auto-anonymization (365d calls), webhook cleanup (90d), audit pruning (2yr) | Automated |
| Body limits | 512KB API, 2MB webhooks | Protects against payload attacks |
| SSL/TLS | TLSv1.2+, ECDHE ciphers, HSTS preload-ready | Production grade |
| Docker | Non-root user, localhost-only ports, resource limits | Hardened |

### Issues to Fix

| Severity | Issue | Location | Fix |
|----------|-------|----------|-----|
| **Critical** | Admin fallback secret: `'voiceforge-admin-2026'` | `admin.ts:41,62` | Remove fallback, require env var |
| **Critical** | Admin accepts `?token=` query param | `admin.ts:40` | Header only (`X-Admin-Token`) |
| **High** | No rate limiting on admin routes | `admin.ts`, `index.ts:124` | Pre-configured `authRateLimiter` (10/min) exists but is NOT attached to admin routes |
| **High** | No rate limiting on GDPR routes | `gdpr.ts`, `index.ts:141` | Pre-configured `gdprRateLimiter` (5/min) exists but is NOT attached to GDPR routes |
| **High** | Hardcoded IBAN | `registration.ts:30-36` | Env var |
| **High** | No CSP header | `index.ts`, `nginx/` | `secureHeaders()` sets HSTS/X-Frame/nosniff/referrer but NO CSP |
| **Medium** | Rate limiter fails open on Redis failure | `rate-limit.ts:137` | Fail-closed for auth endpoints |
| **Medium** | SHA-256 for password hashing (registrations) | `license.ts:50-54` | Uses `createHash('sha256')` — code even has comment: "In production, use bcrypt or argon2" |
| **Medium** | No encryption key rotation mechanism | `encryption.ts` | Single static key, no versioning. Rotation requires re-encrypting all stored secrets + app restart |
| **Low** | Widget CORS `origin: *` | `index.ts:115` | Intentional, but document it |
| **Low** | No Supabase RLS (Row Level Security) | DB schema | App verifies ownership in code (`customer.id` check per query). Acceptable, but if Supabase is ever exposed directly (Realtime subscriptions, direct client queries), RLS must be added as defense-in-depth. |

---

## 8. Resilience & Error Handling

### Current Patterns

| Pattern | Status | Detail |
|---------|--------|--------|
| Global error handler | Done | `index.ts:146-166` — catches HTTPException + unhandled errors, returns structured JSON |
| 404 handler | Done | `index.ts:169-177` |
| Graceful shutdown | Done | SIGTERM/SIGINT with 10s force timeout |
| Worker error isolation | Done | Each task try-caught, failure doesn't stop scheduler |
| Webhook signature failure | Done | 401 with no information leakage |
| Auth failure | Done | Generic messages, no token/key leakage |

### Missing Resilience Patterns

| Pattern | Impact | Effort |
|---------|--------|--------|
| **Retry with backoff** (ElevenLabs, Resend) | Transient failures = silent data loss | 1 day |
| **Circuit breaker** (all external APIs) | One down service cascades to all operations | 2 days |
| **Idempotency keys** (Stripe mutations) | Network retries create duplicate resources | Half day |
| **Request timeout** (raw fetch calls) | Hung requests consume connection pool | Half day |
| **Dead letter queue** | Failed webhook events are lost on process restart | 1-2 days |
| **Outbox pattern** | Webhook processing not durable across restarts | 2-3 days |
| **Bulkhead isolation** | One slow external API blocks all requests | 2 days |

### Error Handling Gaps

| Location | Issue |
|----------|-------|
| `numbers.ts:132-138` | SIP assignment failure silently swallowed — customer sees "success" but SIP is broken |
| `numbers.ts:152-154` | ElevenLabs import failure silently swallowed — same issue |
| `flows.ts:634-646` | Deployment errors in loop only logged as warn, continue deploying |
| `billing.ts:341-343` | Payment failure email error caught but not retried |
| `telnyx.ts:427-438` | FQDN assignment after SIP creation — second call has no error check at all |

---

## 9. Frontend Architecture

### Strengths

| Area | Detail |
|------|--------|
| Auth | Supabase `onAuthStateChange` listener, proper cleanup on unmount |
| State management | Zustand with minimal surface (auth store only), no stale state issues |
| Route protection | Next.js middleware checks protected prefixes, redirects to `/login` |
| API client | Token provider pattern with fresh token per request |
| Parallel loading | Dashboard uses `Promise.all` for concurrent data fetching |

### Issues

| Issue | Location | Impact |
|-------|----------|--------|
| **No retry logic** in API client | `api-client.ts` | Network blip = white screen / stale data |
| **No request deduplication** | `api-client.ts` | Rapid clicks fire duplicate requests |
| **All pages are client-side** | `'use client'` on every page | No SSR benefit — slower initial load, poor SEO (acceptable for dashboard SaaS) |
| **No loading states on errors** | Various dashboard pages | Errors caught silently with `.catch(() => null)` — user sees empty data, no error message |
| **Timer cleanup** | `support-chatbot.tsx`, `agent-test-widget.tsx` | `setTimeout` without cleanup in unmount — minor |

### Recommendations

1. Add retry (1 retry with 1s delay) to API client for GET requests
2. Add global error boundary with user-friendly error state
3. Show toast on API errors instead of silently swallowing
4. Consider SWR or TanStack Query for cache + dedup + retry (replaces manual useState/useEffect fetch patterns)

---

## 10. Observability & Monitoring

### What Exists

| Feature | Implementation |
|---------|---------------|
| Structured JSON logging | Pino with service/env context |
| PII redaction | Email, phone, auth headers stripped in production |
| Request ID tracing | Hono `requestId()` middleware |
| Request timing | `timing()` middleware |
| Health check | `/health` with DB latency |
| Container health checks | All Docker services have HEALTHCHECK |
| Log rotation | Docker json-file with max-size/max-file |
| Nginx access logs | Custom format with `request_time`, `upstream_response_time` |

### What's Missing

| Gap | Impact | Recommended Tool | Effort |
|-----|--------|-----------------|--------|
| **Error tracking** | Won't know about runtime exceptions until users report | Sentry (free: 5K events/mo) | 1 hour |
| **Uptime monitoring** | Won't know when site goes down | UptimeRobot (free) | 30 min |
| **APM / tracing** | Can't trace requests across API -> DB -> external APIs | OpenTelemetry | 1-2 days |
| **Metrics endpoint** | No Prometheus scraping, no dashboards | `/metrics` endpoint | 1 day |
| **Log aggregation** | Logs in Docker volumes, not searchable | Loki + Grafana or Axiom | 1 day |
| **Alert rules** | No automated alerts on errors/latency spikes | PagerDuty/OpsGenie | Half day |
| **External API monitoring** | No visibility into ElevenLabs/Telnyx success rates | Custom Pino metrics | Half day |

### Recommended Stack: $0/mo, ~2 hours setup

For a single-droplet SaaS at our scale, three free tools cover everything:

| Tool | Free Tier | What It Gives You | Setup |
|------|-----------|-------------------|-------|
| **Sentry** | 5K errors/mo | Error tracking with stack traces, release tracking, alert on new errors | `npm install @sentry/node`, init in `index.ts` — 1 hour |
| **UptimeRobot** | 50 monitors, 5-min interval | Pings `/api/health`, email/Slack alert on downtime | Web config only — 30 min |
| **Grafana Cloud** | 10K metrics, 50GB logs/mo | Prometheus metrics + Loki log aggregation + dashboards + alerting — all in one | ~1 hour |

**Grafana Cloud replaces 3 separate tools:**
- **Metrics:** Add `@hono/prometheus` middleware (one-liner: `app.use('*', prometheus())`) → exposes `/metrics` → Grafana scrapes it → request latency, error rates, DB query times
- **Logs:** Grafana Alloy agent ships existing Pino JSON logs to Loki → searchable, filterable (PII redaction already in place)
- **Alerting:** Grafana alert rules → Slack/email when error rate spikes or p95 latency exceeds 1s

**What NOT to use yet:**
- ~~Datadog~~ — $15/host/mo for the same thing Grafana Cloud gives you free
- ~~PagerDuty/OpsGenie~~ — Slack alerts from Grafana + UptimeRobot email is enough until you have an on-call rotation
- ~~OpenTelemetry distributed tracing~~ — single API server, not microservices. Prometheus metrics + Sentry error traces give the same visibility at 10% of the setup effort

---

## 11. Deployment & Infrastructure

### Current Demo Infrastructure

**Provider:** DigitalOcean Droplet (FRA1 — Frankfurt)
**Domain:** voiceforge.salimov.ai (subdomain routing via Nginx)

| Spec | Value |
|------|-------|
| Plan | Basic (shared CPU) |
| vCPUs | 2 (shared with other DO tenants) |
| RAM | 4 GB |
| Disk | 80 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Price | ~$24/mo |
| Firewall | DO Cloud Firewall (network-level, free) |
| SSL | Configured via Nginx + Let's Encrypt |
| Co-hosted | Previously shared with another app (now down, cleanup needed) |
| DB backups | **None** |
| Monitoring | **None** |

### Docker Compose Resource Allocation vs Available Resources

| Container | Memory Limit | CPU Limit |
|-----------|-------------|-----------|
| PostgreSQL 16 | 1 GB | 0.5 CPU |
| Redis 7 | 512 MB | 0.25 CPU |
| Hono API | 512 MB | 0.5 CPU |
| Next.js | 512 MB | 0.5 CPU |
| Nginx | ~50 MB | minimal |
| Worker | 256 MB | 0.25 CPU |
| **Total allocated** | **~2.85 GB** | **2.0 CPU** |
| **Available on droplet** | 4 GB | 2 shared vCPUs |
| **Remaining for OS + Docker** | ~1.15 GB | 0 headroom |

### Demo Droplet Assessment: Can It Run Production?

**For 10 customers (closed beta): Barely, after code fixes and a droplet upgrade.**
**For 20 concurrent calls (single medium business): No.**

| Concern | Assessment |
|---------|-----------|
| **RAM (4 GB)** | Docker containers allocate 2.85 GB. OS + Docker daemon need ~500 MB-1 GB. Under webhook burst (20 calls ending simultaneously), Node.js heap grows temporarily. System will hit swap, which kills latency — the pre-call webhook has a **1-second deadline** or the call fails. |
| **CPU (2 shared vCPUs)** | "Shared" means your CPU is shared with other tenants on the physical host. During a webhook burst, PostgreSQL, API, and Redis all spike simultaneously. No guarantee of processing time under contention. |
| **PostgreSQL on same machine** | The biggest constraint. DB and API compete for the same 2 CPUs and 4 GB RAM. Under concurrent call load, the API serves webhook handlers while PostgreSQL handles 20+ concurrent queries — they starve each other. |
| **No database backups** | If the Docker volume corrupts or the droplet dies, **all customer data is permanently lost**. This is the #1 operational risk. |
| **No monitoring** | You won't know if the service is down, if calls are failing, or if data integrity issues are occurring. |
| **Disk (80 GB)** | Fine for now. Transcripts + call metadata grow ~1 GB/month per 100 active customers. Recording URLs point to Telnyx/ElevenLabs storage, not local disk. |
| **Co-hosted artifacts** | Old app's containers, volumes, Nginx configs, and user accounts may still be on the droplet. Must clean up to reclaim resources and reduce attack surface. |

### Nginx Rate Limiting (Layer 7)

Already configured:

| Zone | Rate | Burst | Routes |
|------|------|-------|--------|
| `api_limit` | 30 req/s | 50 | `/api/` |
| `webhook_limit` | 50 req/s | 100 | `/webhooks/` |
| `general_limit` | 10 req/s | 30 | `/`, `/auth/` |

### Known Deployment Issues

| Issue | Detail |
|-------|--------|
| **No CI/CD** | No GitHub Actions, no automated tests/lint before deploy. See recommended pipeline below. |
| **No rollback strategy** | Failed deploy requires manual recovery |
| **No blue-green** | Zero-downtime deploys not possible |
| **`drizzle-kit push` in production** | Schema changes applied directly, no staging validation |
| **No secrets management** | All secrets in `.env` file on server |
| **No centralized logging** | Logs in Docker volumes only |
| **No database backups** | Data loss = game over |
| **PM2 in Docker Compose** | PM2 inside Docker is redundant (Docker handles restarts). PM2 cluster mode is useful for multi-core, but `docker compose` replicas would be cleaner |

### Recommended Deployment Architecture: Fully Dockerized

**Decision:** Dockerize all services (API, web, worker, Redis, Nginx). Same `docker compose` for dev, staging, and production — only the `.env` file and compose override differ.

**Why:**
- Single `docker compose up` deploys the entire stack — no Node/pnpm/PM2 installation on the server
- Reproducible: dev/staging/production run identical images
- Spinning up staging = install Docker on a new droplet + `docker compose up`
- Container restart policies (`restart: unless-stopped`) replace `pm2 startup`
- Eliminates the PM2-inside-Docker redundancy

**Compose structure:**
```
docker-compose.yml              # Base: all services, shared config
docker-compose.dev.yml          # Override: hot reload, debug ports, relaxed limits
docker-compose.staging.yml      # Override: production images, staging resource limits
docker-compose.production.yml   # Override: production images, strict resource limits, restart policies
```

**Usage:**
```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Staging
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

**Environment-aware configuration:**
All app configuration must branch on `NODE_ENV` (`development` / `staging` / `production`). Each environment uses its own `.env` file with the appropriate keys:
- **Development:** Local Supabase (or dev JWT), Stripe test keys, ElevenLabs free-tier, Resend sandbox
- **Staging:** Separate Supabase project, Stripe test keys, ElevenLabs free-tier, Resend with staging domain
- **Production:** Production Supabase, Stripe live keys, ElevenLabs paid plan, Resend with verified production domain

The `.env` file at the monorepo root determines which environment runs. Symlinks from `apps/api/.env` and `apps/web/.env` point to it (same pattern as current dev setup). Never commit `.env` files — only `.env.example`.

### Recommended CI/CD Pipeline

**On PR to `main` (GitHub Actions):**
1. `pnpm lint` + `pnpm typecheck` + `pnpm build` + `pnpm test` (when Vitest is set up)
2. Branch protection: can't merge if any step fails

**On merge to `main` (auto-deploy to staging):**
1. SSH into staging droplet, `git pull`, `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build`
2. Containers start via entrypoint script: `pnpm install --frozen-lockfile` → `pnpm db:migrate` → `pnpm start`
3. Run smoke tests from CI against staging URL (health check, auth, basic CRUD) — these are CI steps, not in Docker Compose
4. Manual approval gate (GitHub environment protection rule) to promote to production

**On approval (auto-deploy to production):**
1. SSH into production droplet, `git pull`, `docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build`
2. Same entrypoint: install → migrate → start

**API container entrypoint script (`docker/entrypoint.sh`):**
```bash
#!/bin/sh
set -e
pnpm install --frozen-lockfile
pnpm db:migrate
exec pnpm start
```

**Staging environment:**
- Separate DO droplet (4 GB / 2 vCPU is enough)
- Separate `.env.staging`: Telnyx dev account, ElevenLabs free-tier key, Stripe test-mode keys, separate Supabase project
- Separate subdomain (e.g., `staging.voiceforge.salimov.ai`)
- DB seed script (run once on initial setup, re-run manually to reset): creates realistic data — customers, agents, call history with transcripts/sentiment, appointments, caller memories
- On deploy, only run migrations — don't re-seed. Staging should accumulate real-looking state to catch migration bugs against existing data.

**GitHub secrets needed:** `DROPLET_IP`, `STAGING_IP`, `DEPLOY_USER`, `DEPLOY_KEY`. Enable branch protection on `main` requiring CI to pass.

### Recommended Infrastructure: Phase A (Beta Launch, 1-10 Customers)

Keep the current droplet, offload PostgreSQL to a managed service.

| Component | Change | Cost |
|-----------|--------|------|
| **Droplet** | Keep current Basic 4 GB / 2 vCPU | ~$24/mo |
| **DO Daily Backups** | Enable automatic daily droplet backups (30% of droplet price) | ~$7/mo |
| **DO Managed Postgres** | 1 GB single node — auto daily backups, point-in-time recovery, SSL enforced | $15/mo |
| **Total** | | **~$46/mo** |

**Why this works:**
- Removing PostgreSQL from Docker frees ~1.5 GB RAM and 0.5 CPU
- Remaining containers use ~1.85 GB (API 512 MB + Next.js 512 MB + Redis 512 MB + Worker 256 MB + Nginx 50 MB), leaving ~2.15 GB for OS + Docker — comfortable for beta
- Managed Postgres gives you automatic daily backups and point-in-time recovery with no cron setup
- Daily droplet backups protect Nginx config, Docker Compose, `.env`, and Redis data
- If pre-call webhook latency exceeds 1s under load (the hard deadline), upgrade to 8 GB / 4 vCPU (~$48/mo) — no data loss, just a brief restart

**Migration steps:**
1. Provision DO Managed Postgres (FRA1, same datacenter as droplet for low latency)
2. `pg_dump` existing Docker Postgres -> `psql` into managed instance
3. Update `DATABASE_URL` in `.env.production` to point to managed Postgres
4. Remove `postgres` service from `docker-compose.production.yml`
5. Remove `pgdata` volume
6. Set `ssl: { rejectUnauthorized: true }` in `db/connection.ts` (already conditional on production)

### Recommended Infrastructure: Phase B (Growth, 10-100 Customers)

When handling 50+ concurrent calls across all customers:

| Component | Spec | Cost |
|-----------|------|------|
| **Droplet** | Basic 16 GB / 4 vCPU (or Dedicated 8 GB / 4 vCPU) | ~$68-96/mo |
| **DO Managed Postgres** | 2 GB / 1 vCPU with HA standby | ~$60/mo |
| **DO Managed Redis** | Offload Redis from droplet (or keep on-droplet if headroom allows) | $0-15/mo |
| **DO Spaces** | S3-compatible object storage for recordings/exports | ~$5/mo |
| **DO Droplet Backups** | Daily | ~$20-29/mo |
| **Total** | | **~$155-205/mo** |

### Recommended Infrastructure: Phase C (Scale, 100-1000 Customers)

| Component | Spec | Cost |
|-----------|------|------|
| **DO Load Balancer** | Distributes across multiple API droplets | $12/mo |
| **API Droplets (x2-4)** | Basic 8 GB / 4 vCPU each | ~$96-192/mo |
| **DO Managed Postgres** | 4 GB / 2 vCPU, HA standby, read replica | ~$120+/mo |
| **DO Managed Redis** | Dedicated instance | $15/mo |
| **DO Spaces** | Recordings, GDPR exports | ~$5-10/mo |
| **Total** | | **~$400-600/mo** |

*All estimates exclude ElevenLabs, Telnyx, Stripe, OpenAI usage costs (billed per customer separately).*

### Security Hardening Checklist (Current Droplet)

| Item | Current Status | Required Action |
|------|---------------|----------------|
| **DO Cloud Firewall** | Enabled | Verify rules: allow **only** ports 22 (SSH), 80 (HTTP), 443 (HTTPS) inbound. Block all other ports. PostgreSQL (5432) and Redis (6379) must NOT be exposed — they already bind to 127.0.0.1 in Docker but the firewall is defense-in-depth. |
| **SSH key-only auth** | Unknown | Disable password auth: set `PasswordAuthentication no` in `/etc/ssh/sshd_config`, restart sshd. |
| **Fail2ban** | Probably not installed | Install: `apt install fail2ban` — blocks brute-force SSH attempts after repeated failures. |
| **Unattended security upgrades** | Probably not enabled | Install: `apt install unattended-upgrades` — auto-patches security vulnerabilities in Ubuntu packages. |
| **Docker ports localhost-only** | Done (in compose) | Already correct — all services bind to `127.0.0.1`. |
| **`.env.production` file permissions** | Unknown | Set `chmod 600 .env.production` — only root/deploy user can read secrets. |
| **Docker socket access** | Unknown | Only the deploy user should be in the `docker` group. Run `getent group docker` to verify. |
| **Remove old co-hosted app** | App is down but artifacts may remain | Clean up: remove old containers (`docker ps -a`), old images (`docker image prune`), old volumes (`docker volume ls`), old Nginx server blocks in `/etc/nginx/sites-enabled/` or `/etc/nginx/conf.d/`, and any leftover user accounts. |
| **Nginx — old subdomain cleanup** | Unknown | Remove any Nginx server blocks that aren't for `voiceforge.salimov.ai`. Stale configs can expose unexpected endpoints. |
| **SSH port** | Probably default 22 | Consider changing to a non-standard port (e.g., 2222) in sshd_config + firewall rules to reduce automated scan noise. Optional but reduces log spam. |
| **Docker image updates** | No automated process | Periodically rebuild images to pick up base image security patches. Add to deploy script or CI. |

### Immediate Infrastructure Actions (Ordered)

1. **Fix the code issues** from Phase 0 of the roadmap — before any real traffic
2. **Provision DO Managed Postgres** ($15/mo), migrate data, remove Postgres from Docker Compose
3. **Enable DO daily backups** on the droplet (~$7/mo)
5. **Harden SSH** — key-only auth, fail2ban, unattended-upgrades
6. **Clean up old co-hosted app** — containers, volumes, Nginx configs, user accounts
7. **Verify firewall rules** — only 22/80/443 inbound
8. **Set `.env.production` permissions** to 600

---

## 12. Test Coverage

**Current state: Zero tests.** No test files, no test framework configured.

### Recommended Framework

**Vitest** — native ESM/TypeScript, fast, Hono `app.request()` for route testing.

### Priority Test Cases (ordered by risk reduction)

| Priority | Test | Type | What It Prevents |
|----------|------|------|-----------------|
| P0 | Stripe webhook idempotency | Integration | Duplicate charges |
| P0 | Auth middleware — valid/invalid/expired JWT | Unit | Auth bypass |
| P0 | Webhook signature verification | Unit | Webhook spoofing |
| P0 | Encryption round-trip (encrypt then decrypt) | Unit | Data loss |
| P1 | Rate limit — exceeded returns 429 | Unit | Abuse |
| P1 | Agent CRUD lifecycle | Integration | Data corruption |
| P1 | GDPR export/delete | Integration | Compliance violation |
| P1 | Registration validation | Integration | Bad data in DB |
| P2 | Appointment booking (concurrent) | Integration | Double bookings |
| P2 | Phone number purchase (failure scenarios) | Integration | Money charged, no service |
| P2 | Health check with DB down | Smoke | False positives |

---

## 13. Business & Operational Readiness

Beyond code and infrastructure, a production SaaS targeting SMEs needs legal, operational, and go-to-market foundations.

### Legal & Compliance (Required Before Accepting Payments)

| Item | Status | Detail |
|------|--------|--------|
| **Terms of Service page** | **MISSING** | No `/terms` route. Required before accepting payments or storing customer data. Must cover: service description, liability limits, acceptable use, termination, Greek/EU law jurisdiction. |
| **Privacy Policy page** | **MISSING** | No `/privacy` route. Required by GDPR (Article 13/14) before collecting any personal data. Must cover: data controller identity, data processed, retention periods, third-party processors (ElevenLabs, Telnyx, Stripe, Supabase, OpenAI, Resend), data subject rights, DPO contact. |
| **Cookie Consent Banner** | **MISSING** | If analytics are added, EU ePrivacy Directive requires consent before setting non-essential cookies. Not needed if no analytics/tracking cookies. |
| **DPA (Data Processing Agreement)** | **MISSING** | GDPR requires a DPA with each sub-processor. You need DPAs on file with ElevenLabs, Telnyx, Stripe, Supabase, Resend, OpenAI, DigitalOcean. Most provide standard DPAs — download and sign them. |
| **GDPR data deletion** | Done | Full account deletion (`DELETE /gdpr/delete-account`) and selective call data deletion (`DELETE /gdpr/delete-calls`) implemented in `routes/gdpr.ts`. |
| **GDPR data export** | Done | `GET /gdpr/export` returns all customer data (profile, agents, calls, appointments, audit logs). |
| **Audit logging** | Done | `audit_logs` table tracks data access, deletion, settings changes. |
| **Data retention policy** | Done | Auto-anonymization: calls after 365 days, webhooks after 90 days, audit logs after 2 years. Needs to be documented in the Privacy Policy. |

### Analytics & Metrics (Required for Business Decisions)

| Item | Status | Recommendation |
|------|--------|---------------|
| **Product analytics** | **MISSING** — no tracking at all | Add Plausible (privacy-friendly, EU-hosted, no cookie consent needed) or PostHog (self-hostable). Track: signups, onboarding completion, first call, agent creation, churn. |
| **Marketing attribution** | **MISSING** | Add UTM tracking on landing page CTAs. Track which channel (Google, social, referral) drives signups. |
| **Business KPIs dashboard** | **MISSING** | Admin panel has basic stats (customer count, license counts). Missing: MRR, churn rate, calls/customer, avg call duration, NPS. |
| **Revenue tracking** | Partially done | Stripe handles billing, but no internal revenue dashboard or MRR calculation. |

### SEO & Social (Required for Organic Growth)

| Item | Status | Location | Fix |
|------|--------|----------|-----|
| **Page title + description** | Done | `apps/web/src/app/layout.tsx` | Metadata set |
| **OpenGraph tags** | **MISSING** | `layout.tsx` | Add `og:title`, `og:description`, `og:image`, `og:url`. Without these, links shared on social media/WhatsApp/LinkedIn show no preview. |
| **Twitter Card tags** | **MISSING** | `layout.tsx` | Add `twitter:card`, `twitter:title`, `twitter:image` |
| **robots.txt** | **MISSING** | Should be at `apps/web/public/robots.txt` | Create with `Allow: /` and `Sitemap:` directive |
| **sitemap.xml** | **MISSING** | Should be at `apps/web/public/sitemap.xml` or generated by Next.js | Create for landing page, login, registration routes |
| **Favicon / app icons** | Unknown | `apps/web/public/` | Verify favicon.ico, apple-touch-icon, and manifest.json exist |
| **Structured data (JSON-LD)** | **MISSING** | Landing page | Add `Organization` and `SoftwareApplication` schema for rich Google results |

### Error & Edge Case UX

| Item | Status | Detail |
|------|--------|--------|
| **404 page** | Done | `apps/web/src/app/not-found.tsx` |
| **Global error boundary** | Done | `apps/web/src/app/error.tsx` and `apps/web/src/app/dashboard/error.tsx` |
| **Rate limit UX** | **MISSING** | API returns HTTP 429 with `Retry-After` header, but the frontend has no handler — user sees a silent failure or white screen. |
| **Payment failure UX** | Partially done | Email sent on payment failure. No in-app banner warning users their subscription is at risk. |
| **Offline/network error UX** | **MISSING** | No retry, no toast, no offline indicator. Network blip = silent data loss in UI. |
| **Empty states** | Unknown | Verify dashboard pages show helpful empty states (no calls yet, no agents yet) instead of blank space. |

### Onboarding & Customer Success

| Item | Status | Detail |
|------|--------|--------|
| **Onboarding flow** | Done | Multi-step onboarding in `apps/web/src/app/onboarding/` |
| **Welcome email** | Done | Single email after onboarding completion |
| **Onboarding email sequence** | **MISSING** | No drip campaign. Day 1: welcome. Day 3: "set up your first agent". Day 7: "upload your knowledge base". Would reduce churn. |
| **In-app help / tooltips** | **MISSING** | No contextual help, guided tours, or tooltip overlays. |
| **Documentation / help center** | **MISSING** | No user-facing docs, FAQ, or help center. SME users will need guidance on setup. |
| **Feedback collection** | **MISSING** | No NPS survey, feedback form, or in-app feedback widget. |

### Admin Panel Completeness

| Feature | Status | Detail |
|---------|--------|--------|
| List customers | Done | Shows all customers with key fields |
| Dashboard stats | Done | Pending/approved registrations, license counts, active customers |
| Manage registrations | Done | Approve, reject, view details |
| Generate license keys | Done | With email notification to customer |
| Revoke licenses | Done | With automatic customer deactivation |
| **Edit customer details** | **MISSING** | Cannot modify customer profile, plan, or settings from admin |
| **Suspend/unsuspend customer** | **MISSING** | No way to temporarily disable a customer without revoking their license |
| **Extend license expiry** | **MISSING** | Cannot extend a customer's license without generating a new key |
| **View customer's calls/agents** | **MISSING** | Admin cannot see a customer's call history or agent configuration |
| **Manual billing actions** | **MISSING** | Cannot record manual payments, issue credits, or adjust invoices |
| **System health dashboard** | **MISSING** | No view of ElevenLabs/Telnyx/Stripe status, error rates, or system metrics in admin |

### External Service Account Setup

Before production, these accounts need to be on production-ready plans:

| Service | Current Status | Production Requirement |
|---------|---------------|----------------------|
| **ElevenLabs** | Scale plan ($330/mo) — 30 concurrent, 3,600 min/mo, overage at $0.10/min | Sufficient concurrency for beta (30 calls). **Minutes are the bottleneck:** 10 active customers will exhaust 3,600 min/mo in ~1 week. Overage charges apply at $0.10/min. Upgrade to Business ($1,320/mo, 13,750 min) when minute spend exceeds ~$1,000/mo in overages. |
| **Telnyx** | Unknown (demo API key) | Production account with Greek +30 number inventory. Verify Telnyx SIP trunk supports required concurrent call volume. |
| **Stripe** | Unknown (test/live mode?) | Switch from test mode to live mode. Verify webhook endpoints point to production URL. |
| **Supabase** | Unknown | Production project with proper JWT secret. Verify Row-Level Security policies if applicable. |
| **Resend** | Unknown | Verify domain is authenticated (SPF/DKIM/DMARC) for `noreply@salimov.ai` to avoid spam folder. |
| **Domain DNS** | voiceforge.salimov.ai | Verify SPF, DKIM, DMARC records for email deliverability. Add CAA record for Let's Encrypt. |

### Operational Runbooks (Missing)

For a production service, you need documented procedures for:

| Runbook | Why |
|---------|-----|
| **Incident response** | What to do when the service goes down. Who gets paged, escalation path, communication template. |
| **Database restore** | Step-by-step: how to restore from DO Managed Postgres backup or point-in-time recovery. |
| **Secret rotation** | How to rotate ENCRYPTION_KEY, ADMIN_SECRET, API keys without downtime. Especially important: ENCRYPTION_KEY rotation requires re-encrypting all stored Telnyx/Google OAuth tokens. |
| **Customer data deletion** | GDPR requires response within 30 days. Document the full process: verify identity, trigger API, verify deletion, respond to customer. |
| **Deploy rollback** | How to roll back a bad deploy. Currently: manual Docker image revert. Should be documented. |
| **ElevenLabs outage** | What happens to callers if ElevenLabs is down. Currently: calls fail silently. Should have a fallback message or voicemail. |

---

## 14. Priority Roadmap

### Phase 0: Emergency Fixes (Before Any Production Traffic)

**Estimated effort: 7-9 days (code) + 2-3 days (infrastructure) + 1-2 days (legal/business)**

**Code fixes:**
- [ ] **Fix Redis connection pooling** — create singleton connection, reuse across requests (`rate-limit.ts`) — [#1](https://github.com/Salimov-AI/voicecall/issues/1)
- [ ] **Fix appointment double-booking** — add `UNIQUE(customer_id, scheduled_at)` constraint on `appointments` table, wrap all 3 booking paths in `db.transaction()` with `ON CONFLICT` handling (`elevenlabs-webhooks.ts:636-689`, `elevenlabs-webhooks.ts:323-343`, `tools.ts:180-210`) — [#2](https://github.com/Salimov-AI/voicecall/issues/2)
- [ ] **Fix call record duplication** — ~~add `UNIQUE` on `calls(telnyxConversationId)`~~ (done), still need `ON CONFLICT UPDATE` in both Telnyx and ElevenLabs webhook handlers + wrap idempotency check + insert in transaction (`webhooks.ts:103-158`, `elevenlabs-webhooks.ts:199-234`) — [#3](https://github.com/Salimov-AI/voicecall/issues/3)
- [ ] **Add Stripe webhook idempotency** — check `event.id` in `webhook_events` table before processing (`billing.ts`) — [#4](https://github.com/Salimov-AI/voicecall/issues/4)
- [ ] **Implement usage metering** — `usage_records` table, Stripe Meter API integration, nightly aggregation worker, soft-limit enforcement (see Section 2.9) — [#5](https://github.com/Salimov-AI/voicecall/issues/5)
- [ ] **Remove admin secret fallback** — require `ADMIN_SECRET` env var, remove `?token=` query param auth (`admin.ts`) — [#6](https://github.com/Salimov-AI/voicecall/issues/6)
- [ ] **Add rate limiting to admin + GDPR routes** — pre-configured limiters exist but are NOT attached (`admin.ts`, `gdpr.ts`, `index.ts`) — [#7](https://github.com/Salimov-AI/voicecall/issues/7)
- [ ] **Fix phone number purchase atomicity** — 5-step pipeline with no transaction; money charged on step 1, steps 3-4 silently swallow errors. Add compensating transaction pattern: if later steps fail, store failure state and expose "retry SIP setup" in admin (`numbers.ts:103-194`) — [#21](https://github.com/Salimov-AI/voicecall/issues/21)
- [ ] **Add missing DB indexes** — `agents.phoneNumber` (pre-call 1s deadline) [#8](https://github.com/Salimov-AI/voicecall/issues/8), `agents.elevenlabsAgentId` (verify index exists despite `.unique()`) [#22](https://github.com/Salimov-AI/voicecall/issues/22)
- [ ] **Add missing DB constraints** — `UNIQUE(customer_id, caller_phone)` on `caller_memories` to prevent duplicate memory rows — [#23](https://github.com/Salimov-AI/voicecall/issues/23)
- [ ] **Move IBAN to env var** (`registration.ts`) — [#9](https://github.com/Salimov-AI/voicecall/issues/9)

**Infrastructure (see Section 11 for details):**
- [ ] **Provision DO Managed Postgres** ($15/mo), migrate data with `pg_dump`/`psql`, remove Postgres from Docker Compose, update `DATABASE_URL` — [#10](https://github.com/Salimov-AI/voicecall/issues/10)
- [ ] **Enable DO daily backups** on droplet (~$7/mo) — [#11](https://github.com/Salimov-AI/voicecall/issues/11)
- [ ] **Harden SSH** — disable password auth, install fail2ban, enable unattended-upgrades — [#12](https://github.com/Salimov-AI/voicecall/issues/12)
- [ ] **Clean up old co-hosted app** — remove stale containers, volumes, Nginx configs — [#13](https://github.com/Salimov-AI/voicecall/issues/13)
- [ ] **Verify DO Cloud Firewall** — only ports 22, 80, 443 inbound — [#14](https://github.com/Salimov-AI/voicecall/issues/14)
- [ ] **Set `.env.production` permissions** to `chmod 600` — [#15](https://github.com/Salimov-AI/voicecall/issues/15)
- [ ] **Set up Docker Compose environment overrides** — create `docker-compose.yml` (base), `docker-compose.dev.yml`, `docker-compose.staging.yml`, `docker-compose.production.yml` with environment-specific resource limits and configs (see Section 11) — [#24](https://github.com/Salimov-AI/voicecall/issues/24)
- [ ] **Set up staging environment** — separate DO droplet (4 GB / 2 vCPU), separate `.env.staging` (Telnyx dev account, ElevenLabs free-tier, Stripe test keys, separate Supabase project), staging subdomain (e.g. `staging.voiceforge.salimov.ai`), DB seed script for realistic test data — [#25](https://github.com/Salimov-AI/voicecall/issues/25)

**Legal & Business (see Section 13 for details):**
- [ ] **Create Terms of Service page** — `/terms` route, covering service description, liability, acceptable use, EU jurisdiction — [#16](https://github.com/Salimov-AI/voicecall/issues/16)
- [ ] **Create Privacy Policy page** — `/privacy` route, listing all sub-processors (ElevenLabs, Telnyx, Stripe, Supabase, Resend, OpenAI, DigitalOcean), data retention periods, GDPR rights — [#17](https://github.com/Salimov-AI/voicecall/issues/17)
- [ ] **Collect DPAs** from each sub-processor (ElevenLabs, Telnyx, Stripe, Supabase, Resend, OpenAI, DO) — most offer standard DPAs to download and countersign — [#18](https://github.com/Salimov-AI/voicecall/issues/18)
- [ ] **Set up Stripe account and configure billing** — no Stripe account exists yet. Create account, configure products/plans (Basic €200, Pro €400, Enterprise €999), set up test mode keys for development, register webhook endpoints, switch to live mode keys before launch — [#19](https://github.com/Salimov-AI/voicecall/issues/19)
- [ ] **Verify email deliverability** — SPF, DKIM, DMARC records for `salimov.ai` domain — [#20](https://github.com/Salimov-AI/voicecall/issues/20)
- [x] **ElevenLabs plan verified** — Scale: 30 concurrent (sufficient for beta), 3,600 min/mo included + $0.10/min overage. Usage metering critical to track consumption.

### Phase 1: Production Hardening (First 2 Weeks)

**Estimated effort: 5-7 days**

- [ ] **Fix caller memory race** — use SQL atomic increments (`call_count = call_count + 1`) instead of read-then-write in `elevenlabs-webhooks.ts:376-425` — [#26](https://github.com/Salimov-AI/voicecall/issues/26)
- [ ] **Fix worker/webhook race** — wrap conversation-sync dedup check in transaction, match by conversation ID not time window (`conversation-sync.ts:109-133`) — [#27](https://github.com/Salimov-AI/voicecall/issues/27)
- [ ] **Add DB transactions** for Stripe checkout — [#28](https://github.com/Salimov-AI/voicecall/issues/28)
- [ ] **Add timeouts** to all raw `fetch()` calls (ElevenLabs TTS at `elevenlabs.ts:808`, Telnyx SIP at `telnyx.ts:404,427,459`) — [#29](https://github.com/Salimov-AI/voicecall/issues/29)
- [ ] **Add remaining DB indexes** (`customers.stripeCustomerId`) — ~~`agents.telnyxAssistantId`~~ already has `.unique()`, ~~`agents.elevenlabsAgentId`~~ moved to Phase 0 — [#30](https://github.com/Salimov-AI/voicecall/issues/30)
- [ ] **Bump DB pool** from 25 to 50 for production (and set PostgreSQL `max_connections = 200`) — [#31](https://github.com/Salimov-AI/voicecall/issues/31)
- [ ] **Add Sentry error tracking** — [#32](https://github.com/Salimov-AI/voicecall/issues/32)
- [ ] **Add UptimeRobot monitoring** — [#33](https://github.com/Salimov-AI/voicecall/issues/33)
- [ ] **Implement Redis caching** for customer profile and agent config lookups — [#34](https://github.com/Salimov-AI/voicecall/issues/34)
- [ ] **Add retry logic** for ElevenLabs and Resend API calls (1-2 retries with exponential backoff) — [#35](https://github.com/Salimov-AI/voicecall/issues/35)
- [ ] **Add API client retry** in frontend (1 retry for GET requests) — [#36](https://github.com/Salimov-AI/voicecall/issues/36)
- [ ] **Add global error boundary** in frontend with user-friendly error messages — [#37](https://github.com/Salimov-AI/voicecall/issues/37)
- [ ] **Use bcrypt** for registration password hashing — [#38](https://github.com/Salimov-AI/voicecall/issues/38)
- [ ] **Add OpenGraph + Twitter Card meta tags** to `layout.tsx` (links shared on social/WhatsApp won't preview without these) — [#39](https://github.com/Salimov-AI/voicecall/issues/39)
- [ ] **Add robots.txt + sitemap.xml** to `apps/web/public/` — [#40](https://github.com/Salimov-AI/voicecall/issues/40)
- [ ] **Add product analytics** — Plausible (EU-hosted, no cookie consent needed) or PostHog — [#41](https://github.com/Salimov-AI/voicecall/issues/41)
- [ ] **Add rate-limit error handling in frontend** — show toast when API returns 429 — [#42](https://github.com/Salimov-AI/voicecall/issues/42)
- [ ] **Add payment failure in-app banner** — warn users when subscription is at risk (not just email) — [#43](https://github.com/Salimov-AI/voicecall/issues/43)
- [ ] **Add email delivery tracking** — store Resend message ID per email sent, configure Resend webhooks (`delivered`/`bounced`/`complained`), show delivery status badge on call summaries in dashboard — [#44](https://github.com/Salimov-AI/voicecall/issues/44)

### Phase 2: Testing & CI (First Month)

**Estimated effort: 5-8 days**

- [ ] Set up Vitest
- [ ] Write P0 tests (auth, webhooks, encryption, Stripe idempotency)
- [ ] Write P1 tests (agent CRUD, GDPR, rate limiting)
- [ ] Set up GitHub Actions CI (lint + typecheck + tests on PR)
- [ ] Add CSP headers
- [ ] Add pagination to agent and flow listing endpoints
- ~~[ ] Move business hours to per-agent DB config~~ **FIXED:** Now per-agent via `businessHours` JSONB column
- [ ] Add Stripe idempotency keys to mutation operations
- [ ] **Load test with k6 or Artillery** — simulate 20 concurrent calls (single medium business scenario): verify appointment booking under contention, call record dedup, Redis connection stability, pre-call webhook < 1s latency. Then scale to 100 concurrent users to find the breaking point. Run against staging, not production.

### Phase 3: Scale Preparation (First Quarter)

**Engineering:**
- [ ] Add circuit breaker pattern for external APIs
- [ ] Implement PgBouncer for connection multiplexing
- [ ] Add Prometheus `/metrics` endpoint
- [ ] Set up centralized log aggregation
- [ ] Implement background job queue (BullMQ) to replace setInterval worker
- [ ] Database migration safety (staging env, dry-run)
- [ ] Blue-green deployment strategy
- [ ] Secrets management (Vault, Doppler, or cloud-native)

**Operational:**
- [ ] Write operational runbooks (incident response, DB restore, secret rotation, deploy rollback)
- [ ] Add admin features: edit customer details, suspend/unsuspend, extend license, view customer calls
- [ ] Add onboarding email drip sequence (day 1, 3, 7)
- [ ] Add user-facing help center or FAQ
- [ ] Add public status page (statuspage.io or self-hosted)
- [ ] Add business KPI dashboard in admin (MRR, churn, calls/customer, avg call duration)
- [ ] Add cookie consent banner (if analytics cookies are in use)
- [ ] Document ElevenLabs outage fallback procedure (voicemail or recorded message)

**Feature completeness:**
- [ ] Google Calendar write-back — `createGoogleCalendarEvent()` using Calendar API v3 (OAuth tokens already stored)
- [ ] Push notifications — web-push service, service worker registration, new `push_subscriptions` table (per-user subscription storage), send on call/appointment events
- [ ] SMS appointment confirmations — `telnyx.messages.create()` after booking (Telnyx SMS already configured)
- [ ] Advanced analytics — call volume time-series, peak call hours heatmap, appointment conversion by agent
- [ ] Multi-agent flows visual editor — drag-and-drop routing builder (React Flow), `agent_flows` table and API routes exist
- [ ] Dark mode toggle — Tailwind `dark:` classes partially present, needs theme toggle
- [ ] Landing page builder — Pro/Enterprise plans include "1 annual landing page", not yet built

---

## 15. Supabase Configuration Checklist

The app uses Supabase for production auth (JWT). These settings must be verified before launch.

### Dashboard Settings

- [ ] **Authentication > Email**: Confirm email template matches VoiceForge branding
- [ ] **Authentication > Email**: Set `Site URL` to production URL (e.g., `https://voiceforge.salimov.ai`)
- [ ] **Authentication > Redirect URLs**: Add `https://voiceforge.salimov.ai/**`
- [ ] **Authentication > Providers**: Enable Email+Password (or Magic Link)
- [ ] **Authentication > SMTP**: Configure custom SMTP (Resend integration or raw SMTP) so auth emails come from your domain, not `@supabase.io`
- [ ] **API > JWT Secret**: Copy value to `SUPABASE_JWT_SECRET` in API env
- [ ] **Database > Extensions**: Enable `uuid-ossp`, `pgcrypto` (if using Supabase-managed DB)
- [ ] **Database > SSL**: Enforce SSL for all connections
- [ ] **Point-in-Time Recovery**: Enable if on Pro plan ($25/mo) — alternative to manual `pg_dump` backups

### Row Level Security (RLS)

Currently NOT using Supabase RLS — the API verifies ownership in application code (checking `customer.id` in every query). This is acceptable. However, if Supabase is ever exposed directly to the client (Realtime subscriptions, direct Supabase client queries), add RLS:

```sql
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_calls" ON calls
  FOR ALL USING (
    customer_id = (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );
```

---

## 16. Deployment Runbook (First Production Deploy)

Step-by-step sequence. Assumes current DO droplet at `voiceforge.salimov.ai` with Nginx + SSL already configured.

```
Step 1: Prepare Server
  └── Keep current droplet (4 GB / 2 vCPU). Upgrade to 8 GB only if latency issues appear.
  └── Only requirement: Docker + Docker Compose installed (no Node/pnpm/PM2 needed)
  └── Harden SSH (key-only, fail2ban, unattended-upgrades)
  └── Verify firewall: only 22, 80, 443 inbound
  └── Clean up old co-hosted app artifacts

Step 2: Provision Managed Postgres
  └── DO Managed Postgres (FRA1, same datacenter) — $15/mo
  └── pg_dump existing Docker Postgres
  └── psql into managed instance
  └── Update DATABASE_URL in .env.production
  └── Remove postgres service from docker-compose.production.yml
  └── Enable DO daily backups on droplet (~$7/mo)

Step 3: Set Environment Variables
  └── Create single .env.production at monorepo root (voiceforge-ai/.env.production)
  └── Symlink from each app (same pattern as dev):
        cd apps/api && ln -s ../../.env.production .env
        cd apps/web && ln -s ../../.env.production .env
  └── chmod 600 .env.production
  └── Set NODE_ENV=production in .env.production
  └── Verify: no secrets in git, no fallback values
  └── Note: Next.js reads NEXT_PUBLIC_* at build time (during docker build).
        The .env must be present when building images on the droplet.
        If CI builds are introduced later, the web app will need its own .env.

Step 4: Configure External Services
  └── Supabase: Set Site URL + Redirect URLs (see Section 15)
  └── Stripe: Switch to live mode, set webhook endpoint to production URL
  └── Telnyx: Set webhook endpoints (pre-call + post-call)
  └── ElevenLabs: Set webhook endpoint, verify plan concurrency
  └── Resend: Verify domain auth (SPF/DKIM/DMARC for salimov.ai)

Step 5: Build & Deploy
  └── git pull origin main
  └── docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
  └── Entrypoint handles: pnpm install → pnpm db:migrate → pnpm start
  └── Container restart policy (restart: unless-stopped) handles auto-start on reboot

Step 6: Verify
  └── curl https://voiceforge.salimov.ai/api/health
  └── docker compose ps (all containers healthy)
  └── Open dashboard, login, create agent
  └── Test phone call end-to-end
  └── Verify Stripe webhook receiving events
  └── Verify emails arriving (check spam folder)

Step 7: Monitoring
  └── Register UptimeRobot on /api/health endpoint
  └── Set up Sentry error tracking
  └── Set up Grafana Cloud (metrics + logs)
  └── Verify data retention worker is running: docker compose logs worker
```

### Backup Strategy

**Primary:** DO Managed Postgres includes automatic daily backups with point-in-time recovery.

**Fallback** (if using Docker Postgres or as additional safety):
```bash
#!/bin/bash
# Cron: 0 2 * * * /opt/scripts/backup-db.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="voiceforge_$TIMESTAMP.sql.gz"
pg_dump $DATABASE_URL | gzip > /backups/$BACKUP_FILE
# Upload to DO Spaces ($5/mo)
s3cmd put /backups/$BACKUP_FILE s3://voiceforge-backups/daily/$BACKUP_FILE
# Keep last 7 days locally
find /backups -name "*.sql.gz" -mtime +7 -delete
```

Retention: daily for 30 days, weekly for 1 year. Test restore monthly.

---

## 17. Pre-Launch Checklist

### Security
- [ ] `ADMIN_SECRET` is random, min 32 chars, not in git, no fallback
- [ ] `ENCRYPTION_KEY` is 64 hex chars, backed up securely offline
- [ ] All `.env` files excluded from git (verify `.gitignore`)
- [ ] All API keys rotated (fresh production keys, not demo/dev keys)
- [ ] Stripe in live mode (not test mode)
- [ ] ElevenLabs webhook secret configured
- [ ] Telnyx webhook secret configured
- [ ] `.env.production` permissions set to `chmod 600`

### Features
- [ ] New user registration -> welcome email received
- [ ] Appointment booking -> confirmation email sent with .ics
- [ ] Stripe payment -> subscription activated correctly
- [ ] Call completed -> transcript + sentiment saved
- [ ] Call completed -> call summary email sent
- [ ] iCal sync working (test with real Google Calendar / iCal URL)
- [ ] Phone number purchase -> agent rings on test call
- [ ] SSL certificate valid and auto-renewing (Let's Encrypt + Certbot)
- [ ] Admin panel accessible (license generation, registration approval)
- [ ] Widget embeddable on third-party site

### Data Integrity
- [ ] Appointment double-booking fix deployed (unique constraint + transactions)
- [ ] Call record dedup fix deployed (ON CONFLICT UPDATE)
- [ ] Stripe webhook idempotency deployed (event.id check)
- [ ] Redis singleton connection deployed (not per-request)
- [ ] Load test passed on staging (20 concurrent calls, no double-bookings, no duplicate records, pre-call < 1s)

### Operational
- [ ] `/api/health` returns `{"status":"ok","db":"connected"}`
- [ ] All Docker containers healthy for 24 hours (`docker compose ps`)
- [ ] Database backup runs and a backup file exists
- [ ] Uptime monitor alerting configured and tested
- [ ] Stripe webhook receiving and processing events
- [ ] Data retention worker scheduled and running (`docker compose logs worker`)

### Legal / GDPR
- [ ] Privacy Policy accessible at `/privacy`
- [ ] Terms of Service accessible at `/terms`
- [ ] GDPR data export works end-to-end
- [ ] GDPR account deletion works end-to-end
- [ ] DPAs collected from sub-processors (ElevenLabs, Telnyx, Stripe, Supabase, Resend, OpenAI, DO)

---

## Appendix A: Database Schema Quick Reference

| Table | Primary Use | Key Relations |
|-------|------------|---------------|
| `customers` | Business accounts, encrypted API keys, billing | has many: agents, calls, appointments |
| `agents` | AI voice assistants, ElevenLabs config, widget settings | belongs to: customer; has many: calls |
| `calls` | Call records, transcripts, sentiment, recordings | belongs to: customer, agent; has many: appointments |
| `appointments` | Bookings made during calls | belongs to: customer, agent, call |
| `knowledge_base_documents` | KB files tracked locally (ElevenLabs handles RAG) | belongs to: customer, agent |
| `caller_memories` | Episodic memory per caller phone | belongs to: customer, agent |
| `agent_flows` | Multi-agent routing rules (Expert mode) | belongs to: customer |
| `webhook_events` | Idempotency tracking for webhooks | standalone |
| `audit_logs` | GDPR Article 30 compliance trail | standalone |
| `license_keys` | B2B license management | belongs to: customer |
| `pending_registrations` | B2B registration queue | standalone |

## Appendix B: External Service Rate Limits Reference

| Service | Endpoint Type | Approximate Limit | Impact if Hit |
|---------|--------------|-------------------|---------------|
| ElevenLabs | Agent management API | ~100 req/min | Agent CRUD fails |
| ElevenLabs | Concurrent conversations | 30 (Scale/Business) | Callers get busy signal beyond 30 |
| ElevenLabs | Monthly minutes included | Scale: 3,600, Business: 13,750 | Overage at $0.10/min (Scale) or $0.10/min (Business). Calls continue but cost increases. |
| ElevenLabs | Hosting cost (calls) | $0.09/min | Per-minute cost on top of plan — applies to all calls |
| ElevenLabs | TTS generation | ~100 req/min | Voice preview fails |
| Telnyx | API calls | ~100 req/min | Phone operations fail |
| Telnyx | Concurrent calls | Plan-dependent | Callers get busy signal |
| Stripe | API calls | 100 req/s (standard) | Billing operations fail |
| Resend | Emails | 100/day (free), 50K/mo (paid) | Emails silently dropped |
| OpenAI | Chat completions | 500 req/min (GPT-4o-mini) | Support chat fails |

## Appendix C: Hardcoded Values That Should Be Configurable

| Value | Location | Current | Should Be |
|-------|----------|---------|-----------|
| Admin secret fallback | `routes/admin.ts:41,62` | `'voiceforge-admin-2026'` | Required env var (no fallback) |
| IBAN | `routes/registration.ts:30-36` | Hardcoded bank details | Env var |
| ~~Email FROM address~~ | ~~`services/email.ts:12`~~ | ~~`'VoiceForge AI <noreply@salimov.ai>'`~~ | ~~Env var~~ **FIXED:** Now uses `env.EMAIL_FROM` |
| Plan pricing in email | `services/email.ts` | Fixed EUR values | DB or env var |
| ~~Business hours~~ | ~~`routes/elevenlabs-webhooks.ts`~~ | ~~09:00-17:00 hardcoded~~ | ~~Per-agent DB config~~ **FIXED:** Now per-agent via `businessHours` JSONB column + `parseBusinessHours()` service |
| ElevenLabs SIP endpoint | `services/telnyx.ts:435` | `sip.rtc.elevenlabs.io` | Env var |
| ~~Telnyx SIP IP whitelist~~ | ~~`services/telnyx.ts:869-874`~~ | ~~Hardcoded IPs~~ | **N/A:** No SIP IP whitelist found in current codebase (file is ~507 lines) |
| TTS API endpoint | `services/elevenlabs.ts:808` | `api.elevenlabs.io` | SDK constant or env var |

## Appendix D: Known TODOs in Codebase

| Location | TODO | Severity |
|----------|------|----------|
| `routes/agents.ts:300` | `totalCalls: 0` hardcoded — should be COUNT(*) from calls table | Medium |
| ~~`routes/elevenlabs-webhooks.ts`~~ | ~~Business hours hardcoded in multiple places~~ **FIXED:** Now per-agent via `businessHours` JSONB column | ~~Medium~~ |
| `routes/tools.ts:99` | Query Google Calendar API if connected | Low (MVP works without) |
| `routes/tools.ts:212` | Sync bookings to Google Calendar | Low (MVP works without) |
| `routes/tools.ts:213` | Send push notification to customer | Low |

---

*Last updated: 2026-03-19 (re-audit). Original audit: 2026-03-18. Capacity estimates based on real-world use case: medium business with 4 agents handling 20 concurrent calls. Infrastructure recommendations based on current DO Basic 4 GB / 2 vCPU droplet (FRA1) running demo at voiceforge.salimov.ai.*