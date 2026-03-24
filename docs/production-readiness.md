# Production Readiness Report

**Date:** 2026-03-18 (re-audited 2026-03-19)
**Project:** VoiceForge AI
**Assessment:** ~60% Production Ready
**Assessed by:** Senior Engineer Audit (full-stack + DevOps)
**Re-audit commit:** `554954b` (merged changes from project owner)

### Scope Change (2026-03-23, updated 2026-03-24)

Code-level issues (race conditions, idempotency, atomicity, missing indexes/constraints, frontend bugs, caching, resilience patterns, test coverage) have been **removed** from this document. They are tracked as GitHub Issues on the project board. This report now covers exclusively **DevOps, infrastructure, deployment, and operational readiness**.

### Infrastructure Decisions (2026-03-24)

Key decisions from DevOps planning session:
- **Blue-green deploys moved to Phase 0** — Nginx on-box + dual Docker Compose stacks (no DO Load Balancer at beta scale)
- **Secrets management decided** — GitHub Actions secrets + `.env` on server (`chmod 600`); Vault/Doppler deferred
- **Staging** — repurpose existing POC droplet with self-hosted Postgres in Docker (no managed DB)
- **Container registry** — GHCR (free for GitHub org, native Actions integration)
- **Production domain** — new `<domain>` setup added to Phase 0 (demo domain is `voiceforge.salimov.ai`)
- **CI exists** — `.github/workflows/ci.yml` covers lint/typecheck/test/build/Docker; CD pipeline remaining
- **Phase 0 roadmap split into parallel tracks** — DevOps, Developer, and Legal tracks run simultaneously (1-2 week target with 2 beta customers)

**Consolidated from:** `voiceforge-ai/PRODUCTION_READINESS_PLAN.md` (Greek-language process/governance doc) has been absorbed into this file. This is now the single source of truth for production readiness.

**Stripe removal:** The Stripe billing integration is legacy code from a previous implementation. This project will not use Stripe. All Stripe-related sections, tasks, and references are struck through. The `stripe` dependency, `services/stripe.ts`, `routes/billing.ts`, related DB columns (`stripeCustomerId`, `stripeSubscriptionId`), shared types (`types/billing.ts`), and env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_PRICE_ID`) should be removed from the codebase in a future cleanup pass.

---

## Executive Summary

VoiceForge AI has strong security fundamentals and a clean monorepo architecture. ElevenLabs handles all voice AI processing while our API handles data and tool calls. Code-level issues (data integrity, concurrency, test coverage) are tracked in GitHub Issues.

**Infrastructure verdict:** Safe for a closed beta (< 10 customers, supervised) once infrastructure is provisioned. Production droplet + DO Managed Postgres + daily backups (~$46-77/mo total) for beta launch. Upgrade to 8 GB / 4 vCPU only if pre-call webhook latency is an issue under load.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Capacity Estimation: 10 / 100 / 1,000 Users](#2-capacity-estimation)
3. [Security Posture](#3-security-posture)
4. [Observability & Monitoring](#4-observability--monitoring)
5. [Deployment & Infrastructure](#5-deployment--infrastructure)
6. [Business & Operational Readiness](#6-business--operational-readiness)
7. [Priority Roadmap](#7-priority-roadmap)
8. [Supabase Configuration Checklist](#8-supabase-configuration-checklist)
9. [Deployment Runbook (First Production Deploy)](#9-deployment-runbook)
10. [Hypercare Plan (First 72 Hours Post-Launch)](#10-hypercare-plan)
11. [Pre-Launch Checklist](#11-pre-launch-checklist)
- [Appendix A: Database Schema Quick Reference](#appendix-a-database-schema-quick-reference)
- [Appendix B: External Service Rate Limits Reference](#appendix-b-external-service-rate-limits-reference)

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
| ~~Billing~~ | ~~Stripe~~ | ~~Subscriptions, checkout, portal~~ *(legacy — to be removed)* |
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
| Call record (basic metadata) | Post-call webhook (step 6) | `calls` table | Works (dedup fix tracked in GH Issues) |
| Transcript (full conversation text) | Post-conversation webhook (step 5) | `calls.transcript` | Works |
| Summary (AI-generated 2-3 sentences) | Post-conversation webhook (step 5) | `calls.summary` | Works |
| Sentiment (1-5 scale) | Post-conversation webhook (step 5) | `calls.sentiment` | Works |
| Intent category | Post-conversation webhook (step 5) | `calls.intentCategory` | Works |
| Recording URL | Post-call webhook (step 6) | `calls.recordingUrl` | Works |
| Appointment | During call (tool, step 4) or post-conversation (step 5) | `appointments` table | Race condition fix tracked in GH Issues |
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

## 2. Capacity Estimation

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
| `book_appointment` tool calls | ~5 | 5 write queries | **YES — requires code fixes (GH Issues)** |
| Post-conversation webhooks | 20 | 20 call record upserts + 20 memory upserts | **YES — requires code fixes (GH Issues)** |
| Post-call webhooks (Telnyx) | 20 | 20 call record inserts | **YES — requires code fixes (GH Issues)** |
| Conversation sync worker | 1 run | Polls ElevenLabs API for all agents | **YES — requires code fixes (GH Issues)** |
| DB connections used simultaneously | ~25-30 | Pool of 25 (prod) | **TIGHT** — may exhaust pool |
| Redis rate limit checks | ~60+ | **WILL FAIL** — requires code fix (GH Issues) | **CRITICAL** |

**ElevenLabs concurrency is the external bottleneck:**
- **Scale (CURRENT): 30 concurrent, 3,600 min/mo ($330/mo), additional minutes at $0.10/min, burst at $0.20/min**
- **Business: 30 concurrent, 13,750 min/mo ($1,320/mo), additional minutes at $0.10/min, burst at $0.19/min**
- Enterprise: elevated concurrency, custom terms/DPA/SLAs, contact sales

**Verdict for 20 concurrent calls right now:** Mostly works for the call handling itself (ElevenLabs does the heavy lifting), but **data integrity requires code fixes** tracked in GitHub Issues.

**ElevenLabs minutes are the billing bottleneck:** Scale plan includes 3,600 min/mo (~120 min/day). With 10 customers averaging 10 calls/day at 3-5 min each = 300-500 min/day — included minutes exhausted in ~1 week, then $0.10/min overage + $0.09/min hosting cost kicks in. Usage metering is critical to track consumption and pass costs through to customers.

### 10 Concurrent Users (Closed Beta)

Each user is a business with 1-3 agents. Peak concurrent calls across all users: ~10-20.

| Resource | Load | Current Capacity | Verdict |
|----------|------|------------------|---------|
| **API requests/min** | ~50-100 | 100/min rate limit, single instance handles ~1000/min | OK |
| **DB connections** | 3-5 concurrent | Pool of 20 (dev) / 25 (prod) | OK |
| **Redis** | ~50-100 ops/min | Requires code fix (GH Issues) | FAIL |
| **ElevenLabs concurrent calls** | ~10-20 | Scale plan: 30 | OK |
| **ElevenLabs minutes** | 300-500 min/day (10 customers) | Scale plan: 3,600 min/mo (~120/day) | **WILL EXHAUST in ~1 week** |
| **ElevenLabs API** | 10-30 calls/day | Per-account limits, singleton client | OK |
| **Telnyx webhooks** | 20-60/day | 500/min rate limit | OK |
| ~~**Stripe webhooks**~~ | ~~0-5/day~~ | ~~No idempotency~~ | ~~RISK~~  *(Stripe removed)* |
| **Appointment booking** | Low concurrency | Race condition exists but rarely triggers | LATENT RISK |
| **PostgreSQL storage** | ~100MB/month | 10GB default | OK |
| **Memory (API)** | ~150MB | 512MB limit | OK |

**Verdict:** Works once code fixes in GitHub Issues are deployed (Redis connection, appointment booking). Infrastructure is adequate at this tier.

### 100 Concurrent Users (Growth Phase)

Peak concurrent calls across all users: ~50-100. Peak concurrent appointment bookings: ~5-10/min.

| Resource | Load | Capacity | Verdict |
|----------|------|----------|---------|
| **API requests/min** | 500-1,000 | Single PM2 instance: ~1,000/min | TIGHT |
| **DB connections** | 15-30 concurrent | Pool of 25 | **WILL EXHAUST** during call bursts |
| **DB query latency** | Unpaginated agent lists | Calls endpoint now paginated (20/page); agents endpoint still returns all | RISK (agents only) |
| **Redis** | 500-1,000 ops/min | Requires code fix (GH Issues) | FAIL |
| **ElevenLabs concurrent calls** | 50-100 | Scale plan: 30 | **BLOCKER — need Business ($1,320/mo) or Enterprise** |
| **ElevenLabs minutes** | 3,000-5,000 min/day | Scale: 3,600/mo, Business: 13,750/mo | **BLOCKER — need Enterprise or per-customer API keys** |
| **ElevenLabs API** | 200-500 calls/day | Rate limits vary by plan | MONITOR |
| **Concurrent phone calls** | 50-100 simultaneous | Telnyx + ElevenLabs handle this | OK (with Enterprise) |
| **Appointment double-bookings** | ~5-10 concurrent bookings/min | No protection | **WILL HAPPEN** |
| **Call record duplication** | 100-200 webhook pairs/day | No unique constraint | **WILL HAPPEN** |
| **Telnyx webhooks** | 400-1,000/day | 500/min limit | OK |
| ~~**Stripe webhooks**~~ | ~~50-100/month~~ | ~~No idempotency~~ | ~~HIGH RISK~~ *(Stripe removed)* |
| **PostgreSQL storage** | ~1GB/month | 10GB, needs monitoring | MONITOR |
| **Memory (API x2 PM2)** | ~300MB each | 512MB limit each | OK |
| **Worker** | 3 tasks, every 2min-24h | 256MB, single instance | OK |

**Required changes for 100 users:**
1. Fix Redis connection pooling (critical)
2. Add unique constraints + transactions for appointments and call records
3. ~~Add Stripe webhook idempotency~~ *(Stripe removed)*
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
| ~~**Stripe**~~ | ~~500-1,000 events/month~~ | ~~Idempotency mandatory~~ | ~~Missing~~ *(Stripe removed)* |
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

## 3. Security Posture

### What's Strong

| Feature | Implementation | Assessment |
|---------|---------------|------------|
| Encryption at rest | AES-256-GCM, random IV per operation, auth tag | Industry standard |
| Webhook verification | Ed25519 (Telnyx) + 5-min replay protection | Excellent |
| Auth | Stateless JWT, local HS256 verification, no HTTP round-trip in prod | Fast + secure |
| Rate limiting | Redis-backed sliding window with Lua atomic ops, plan-based tiers | Well-designed |
| Input validation | Zod on all endpoints | Comprehensive |
| PII handling | Pino redaction of email, phone, auth headers in production | GDPR compliant |
| Security headers | HSTS (2yr), X-Frame-Options DENY, nosniff, referrer-policy | Strong |
| GDPR | Data export, selective deletion, full deletion, audit trail | 306-line implementation |
| Data retention | Auto-anonymization (365d calls), webhook cleanup (90d), audit pruning (2yr) | Automated |
| Body limits | 512KB API, 2MB webhooks | Protects against payload attacks |
| SSL/TLS | TLSv1.2+, ECDHE ciphers, HSTS preload-ready | Production grade |
| Docker | Non-root user, localhost-only ports, resource limits | Hardened |

Security issues to fix (admin secret fallback, CSP headers, rate limiter gaps, password hashing) are tracked in GitHub Issues.

---

## 4. Observability & Monitoring

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

## 5. Deployment & Infrastructure

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
| **CI exists, CD missing** | CI workflow (`.github/workflows/ci.yml`) runs lint, typecheck, test, build, Docker image verification on PRs to `staging`/`production`. CD pipeline (auto-deploy, smoke tests, promotion) not yet built. |
| **No rollback strategy** | Failed deploy requires manual recovery |
| **No blue-green** | Zero-downtime deploys not possible — **Phase 0 priority** (Nginx + dual Docker Compose stacks on single droplet, see Blue-Green subsection below) |
| **`drizzle-kit push` in production** | Schema changes applied directly, no staging validation |
| **Secrets management decided** | GitHub Actions secrets for CI/CD + `.env` files on server (`chmod 600`). Vault/Doppler deferred until team grows or compliance requires it. |
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
- **Development:** Local Supabase (or dev JWT), ElevenLabs free-tier, Resend sandbox
- **Staging:** Separate Supabase project, ElevenLabs free-tier, Resend with staging domain
- **Production:** Production Supabase, ElevenLabs paid plan, Resend with verified production domain

The `.env` file at the monorepo root determines which environment runs. Symlinks from `apps/api/.env` and `apps/web/.env` point to it (same pattern as current dev setup). Never commit `.env` files — only `.env.example`.

### Blue-Green Deployment Strategy (Phase 0)

**Decision:** Nginx reverse proxy on the box + two Docker Compose stacks (blue/green as container sets on a single production droplet). No DO Load Balancer needed at this stage.

**Why this approach:**
- At 2 beta customers on a single droplet, a DO Load Balancer ($12/mo) adds cost without benefit — Nginx on-box does the same job
- Docker images stay the same when scaling later to DO Load Balancer + multiple droplets or DOKS
- Zero-downtime deploys from day 1

**How it works:**

```
1. "Blue" stack running (current production)
     Nginx upstream -> blue containers (api:3001, web:3000)

2. Deploy: start "Green" stack alongside Blue
     docker compose -f docker-compose.yml -f docker-compose.production.yml \
       -p voiceforge-green up -d

3. Health-check Green
     curl -f http://localhost:3011/api/health  (green API on offset port)

4. Swap Nginx upstream -> green containers
     cp nginx/green.conf nginx/active.conf && nginx -s reload

5. Tear down Blue
     docker compose -p voiceforge-blue down

6. Green becomes the new Blue for next deploy
```

**Implementation:**
- Two Compose project names: `voiceforge-blue` and `voiceforge-green`
- Port offset for green stack (e.g., API 3011, web 3010) so both can run simultaneously
- Deploy script (`scripts/deploy-blue-green.sh`): determines which color is active, starts the other, health-checks, swaps Nginx, tears down old
- Nginx config uses an `upstream` block that the deploy script rewrites
- Rollback: if green health check fails, tear down green, blue stays untouched

**Scale path:** When traffic exceeds single-droplet capacity, replace on-box Nginx with DO Load Balancer ($12/mo) distributing across multiple droplets. The Docker images and health check pattern remain identical.

### Recommended CI/CD Pipeline

**CI (done — `.github/workflows/ci.yml`):**
Runs on PRs to `staging` and `production` branches: `pnpm install --frozen-lockfile` → lint → typecheck → test → build → Docker image build verification (api + web). Branch protection requires all checks to pass before merge.

**CD (remaining work):**

**On merge to `staging` (auto-deploy to staging):**
1. CI builds Docker images for `api`, `web`, `worker`, tags with commit SHA + `latest`, pushes to GHCR
2. SSH into staging droplet, pull images from GHCR, `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d` (no `--build` on server)
3. Run smoke tests from CI against staging URL (health check, auth, basic CRUD) — these are CI steps, not in Docker Compose

**On merge to `production` (auto-deploy to production with blue-green):**
1. Manual approval gate (GitHub environment protection rule)
2. SSH into production droplet, pull the same images that passed staging from GHCR
3. Run blue-green deploy script (`scripts/deploy-blue-green.sh`) — starts green stack, health-checks, swaps Nginx upstream, tears down old stack
4. Post-deploy smoke test from CI

**API container entrypoint script (`docker/entrypoint.sh`):**
```bash
#!/bin/sh
set -e
pnpm install --frozen-lockfile
pnpm db:migrate
exec pnpm start
```

**Container registry:** GHCR (GitHub Container Registry) — free for private repos in GitHub org, native integration with GitHub Actions. Image tagging: `ghcr.io/<org>/voiceforge-api:sha-<commit>` + `ghcr.io/<org>/voiceforge-api:latest`.

**Staging environment:**
- Repurpose existing POC droplet (4 GB / 2 vCPU) — no new droplet needed
- Self-hosted Postgres in Docker alongside the app (no managed DB cost for staging)
- Separate `.env.staging`: Telnyx dev account, ElevenLabs free-tier key, separate Supabase project
- Separate subdomain (e.g., `staging.<domain>`)
- DB seed script (run once on initial setup, re-run manually to reset): creates realistic data — customers, agents, call history with transcripts/sentiment, appointments, caller memories
- On deploy, only run migrations — don't re-seed. Staging should accumulate real-looking state to catch migration bugs against existing data
- Staging backups are not required — disposable environment, can be rebuilt from seed

**GitHub secrets needed:** `PRODUCTION_IP`, `STAGING_IP`, `DEPLOY_USER`, `DEPLOY_KEY`, `GHCR_TOKEN` (or use `GITHUB_TOKEN` default). Enable branch protection on `staging` and `production` requiring CI to pass.

### Recommended Infrastructure: Phase A (Beta Launch, 1-10 Customers)

**Production:** New DO droplet + DO Managed Postgres. **Staging:** Repurpose existing POC droplet with self-hosted Postgres in Docker.

| Component | Environment | Change | Cost |
|-----------|-------------|--------|------|
| **Production Droplet** | Production | New Basic 4 GB / 2 vCPU (or 8 GB if pre-call latency is an issue) | ~$24-48/mo |
| **DO Daily Backups** | Production | Enable automatic daily droplet backups (30% of droplet price) | ~$7-14/mo |
| **DO Managed Postgres** | Production | 1 GB single node — auto daily backups, point-in-time recovery, SSL enforced | $15/mo |
| **Staging Droplet** | Staging | Repurpose existing POC droplet (4 GB / 2 vCPU) — already provisioned | $0 (existing) |
| **Staging Postgres** | Staging | Self-hosted in Docker alongside app — no managed DB needed | $0 |
| **GHCR** | Both | GitHub Container Registry — free for private repos in GitHub org | $0 |
| **Total** | | | **~$46-77/mo** |

**Why this works:**
- Removing PostgreSQL from production Docker frees ~1.5 GB RAM and 0.5 CPU
- Remaining containers use ~1.85 GB (API 512 MB + Next.js 512 MB + Redis 512 MB + Worker 256 MB + Nginx 50 MB), leaving ~2.15 GB for OS + Docker — comfortable for beta
- Managed Postgres gives you automatic daily backups and point-in-time recovery with no cron setup
- Daily droplet backups protect Nginx config, Docker Compose, `.env`, and Redis data
- Staging uses self-hosted Postgres (no managed DB cost) — it's a disposable environment that can be rebuilt from seed
- If pre-call webhook latency exceeds 1s under load (the hard deadline), upgrade to 8 GB / 4 vCPU (~$48/mo) — no data loss, just a brief restart

**Production DB migration steps:**
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

*All estimates exclude ElevenLabs, Telnyx, OpenAI usage costs (billed per customer separately).*

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

## 6. Business & Operational Readiness

Beyond code and infrastructure, a production SaaS targeting SMEs needs legal, operational, and go-to-market foundations.

### Legal & Compliance (Required Before Accepting Payments)

| Item | Status | Detail |
|------|--------|--------|
| **Terms of Service page** | **MISSING** | No `/terms` route. Required before accepting payments or storing customer data. Must cover: service description, liability limits, acceptable use, termination, Greek/EU law jurisdiction. |
| **Privacy Policy page** | **MISSING** | No `/privacy` route. Required by GDPR (Article 13/14) before collecting any personal data. Must cover: data controller identity, data processed, retention periods, third-party processors (ElevenLabs, Telnyx, Supabase, OpenAI, Resend), data subject rights, DPO contact. |
| **Cookie Consent Banner** | **MISSING** | If analytics are added, EU ePrivacy Directive requires consent before setting non-essential cookies. Not needed if no analytics/tracking cookies. |
| **DPA (Data Processing Agreement)** | **MISSING** | GDPR requires a DPA with each sub-processor. You need DPAs on file with ElevenLabs, Telnyx, Supabase, Resend, OpenAI, DigitalOcean. Most provide standard DPAs — download and sign them. |
| **GDPR data deletion** | Done | Full account deletion (`DELETE /gdpr/delete-account`) and selective call data deletion (`DELETE /gdpr/delete-calls`) implemented in `routes/gdpr.ts`. |
| **GDPR data export** | Done | `GET /gdpr/export` returns all customer data (profile, agents, calls, appointments, audit logs). |
| **Audit logging** | Done | `audit_logs` table tracks data access, deletion, settings changes. |
| **Data retention policy** | Done | Auto-anonymization: calls after 365 days, webhooks after 90 days, audit logs after 2 years. Needs to be documented in the Privacy Policy. |

### External Service Account Setup

Before production, these accounts need to be on production-ready plans:

| Service | Current Status | Production Requirement |
|---------|---------------|----------------------|
| **ElevenLabs** | Scale plan ($330/mo) — 30 concurrent, 3,600 min/mo, overage at $0.10/min | Sufficient concurrency for beta (30 calls). **Minutes are the bottleneck:** 10 active customers will exhaust 3,600 min/mo in ~1 week. Overage charges apply at $0.10/min. Upgrade to Business ($1,320/mo, 13,750 min) when minute spend exceeds ~$1,000/mo in overages. |
| **Telnyx** | Account approved, Greek +30 numbers acquired | Production account active. SIP trunk integration untested E2E — must verify on staging before launch. |
| **Supabase** | Paid tier (cloud) | Production project with proper JWT secret. Verify settings in Section 8 checklist. |
| **Resend** | Configured with demo domain | Reconfigure for production domain (`<domain>`). Verify SPF/DKIM/DMARC. |
| **Domain DNS** | `voiceforge.salimov.ai` (demo) | Set up production domain `<domain>` — A records, SSL, email DNS (SPF/DKIM/DMARC), CAA record for Let's Encrypt. |

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

## 7. Priority Roadmap

### Phase 0: Emergency Fixes (Before Any Production Traffic)

**Estimated effort: 7-9 days (code) + 2-3 days (infrastructure) + 1-2 days (legal/business)**
**Target: 1-2 weeks. The DevOps and Developer tracks run in parallel.**

#### DevOps Track (Infrastructure Engineer)

Server & network:
- [ ] **Provision new production DO droplet** — Basic 4 GB / 2 vCPU (or 8 GB if pre-call latency is an issue), FRA1 datacenter
- [ ] **Provision DO Managed Postgres** ($15/mo) for production, migrate data with `pg_dump`/`psql`, remove Postgres from `docker-compose.production.yml`, update `DATABASE_URL`
- [ ] **Enable DO daily backups** on production droplet (~$7/mo)
- [ ] **Harden SSH** — disable password auth, install fail2ban, enable unattended-upgrades
- [ ] **Verify DO Cloud Firewall** — only ports 22, 80, 443 inbound
- [ ] **Set `.env.production` permissions** to `chmod 600`
- [ ] **Set up production domain** (`<domain>`) — A records pointing to production droplet, Nginx server blocks, Let's Encrypt SSL via Certbot, email DNS (SPF/DKIM/DMARC) for Resend deliverability. Current `voiceforge.salimov.ai` is demo domain only.

Staging:
- [ ] **Set up staging environment** — repurpose existing POC droplet (4 GB / 2 vCPU), self-hosted Postgres in Docker (no managed DB), separate `.env.staging` (Telnyx dev account, ElevenLabs free-tier, separate Supabase project), staging subdomain (e.g. `staging.<domain>`), DB seed script for realistic test data
- [ ] **Clean up old co-hosted app** on POC droplet — remove stale containers, volumes, Nginx configs before repurposing for staging

Deployment pipeline:
- [x] **CI pipeline done** — `.github/workflows/ci.yml` runs lint, typecheck, test, build, Docker image verification on PRs to `staging`/`production`
- [ ] **Set up GHCR container registry** — configure GitHub Actions to build + push `api`, `web`, `worker` images tagged `sha-<commit>` + `latest` to `ghcr.io/<org>/`
- [ ] **Build CD pipeline** — auto-deploy to staging on merge to `staging` branch, manual approval gate for production promotion, smoke tests post-deploy
- [ ] **Set up blue-green deployment** — Nginx reverse proxy + dual Docker Compose stacks (blue/green container sets on single droplet), deploy script (`scripts/deploy-blue-green.sh`) with health check and upstream swap (see Blue-Green subsection in Section 5)
- [ ] **Set up Docker Compose environment overrides** — create `docker-compose.yml` (base), `docker-compose.dev.yml`, `docker-compose.staging.yml`, `docker-compose.production.yml` with environment-specific resource limits and configs (see Section 5)
- [x] **Secrets management decided** — GitHub Actions secrets for CI/CD + `.env` files on server (`chmod 600`). Vault/Doppler deferred until team grows or compliance requires it.

Validation:
- [ ] **Verify reproducible Linux build** — web build (Next.js standalone) not yet confirmed on Linux; must pass cleanly in Docker/CI Linux builder before any production deploy
- [ ] **Telnyx end-to-end test** — Telnyx account approved and numbers acquired but integration is untested. Test full inbound call flow on staging: Telnyx SIP → ElevenLabs agent → tool call webhooks → post-call webhooks → DB records. Verify pre-call webhook responds < 1 second.
- [ ] **Verify email deliverability** — SPF, DKIM, DMARC records for production domain (reconfigure Resend from demo domain to `<domain>`)

#### Developer Track (Code Fixes)

Code-level fixes (Redis singleton, appointment race condition, call dedup, admin secret, versioned migrations, env contract, lint gate) are tracked as GitHub Issues on the project board. Both tracks must complete before production launch.

#### Legal & Business Track (Shared)

- [ ] **Create Terms of Service page** — `/terms` route, covering service description, liability, acceptable use, EU jurisdiction
- [ ] **Create Privacy Policy page** — `/privacy` route, listing all sub-processors (ElevenLabs, Telnyx, Supabase, Resend, OpenAI, DigitalOcean), data retention periods, GDPR rights
- [ ] **Collect DPAs** from each sub-processor (ElevenLabs, Telnyx, Supabase, Resend, OpenAI, DO) — most offer standard DPAs to download and countersign
- [ ] **Supabase production config** — verify all items in Section 8 checklist (Site URL, redirect URLs, SMTP, JWT secret)
- ~~[ ] **Set up Stripe account and configure billing** — no Stripe account exists yet. Create account, configure products/plans (Basic €200, Pro €400, Enterprise €999), set up test mode keys for development, register webhook endpoints, switch to live mode keys before launch~~ *(Stripe removed)*
- [x] **ElevenLabs plan verified** — Scale: 30 concurrent (sufficient for beta), 3,600 min/mo included + $0.10/min overage. Usage metering critical to track consumption.

### Phase 1: Production Hardening (First 2 Weeks)

**Estimated effort: 5-7 days**

- [ ] **Bump DB pool** from 25 to 50 for production (and set PostgreSQL `max_connections = 200`)
- [ ] **Add Sentry error tracking**
- [ ] **Add UptimeRobot monitoring**
- [ ] **Add container readiness/liveness probes** — health endpoints for Docker HEALTHCHECK and potential orchestrator use; currently only `/health` checks DB, should also verify Redis connectivity
- [ ] **SSL renewal monitoring** — make Let's Encrypt auto-renewal observable; alert if renewal fails (certbot cron + monitoring check)
- [ ] **DB backup restore drill** — execute a full restore from DO Managed Postgres backup to a clean environment; document the steps and time-to-recovery
- [ ] **Secret rotation runbook** — document how to rotate ENCRYPTION_KEY (requires re-encrypting stored Telnyx/OAuth tokens), ADMIN_SECRET, and all API keys without downtime

### Phase 2: Testing & CI (First Month)

**Estimated effort: 5-8 days**

- [ ] Set up Vitest
- [ ] Write P0 tests (auth, webhooks, encryption)
- [ ] Write P1 tests (agent CRUD, GDPR, rate limiting)
- [x] ~~Set up GitHub Actions CI (lint + typecheck + tests on PR)~~ **Done:** `.github/workflows/ci.yml` covers lint, typecheck, test, build, Docker image verification
- [ ] Add CSP headers
- [ ] Add pagination to agent and flow listing endpoints
- ~~[ ] Move business hours to per-agent DB config~~ **FIXED:** Now per-agent via `businessHours` JSONB column
- ~~[ ] Add Stripe idempotency keys to mutation operations~~ *(Stripe removed)*
- [ ] **Load test with k6 or Artillery** — simulate 20 concurrent calls (single medium business scenario): verify appointment booking under contention, call record dedup, Redis connection stability, pre-call webhook < 1s latency. Then scale to 100 concurrent users to find the breaking point. Run against staging, not production.

**Recommended test layers:**
- **Unit tests** — pure services and validation (auth middleware, encryption round-trip, env validation, business-hours logic)
- **Integration tests** — against real Postgres (agent CRUD, GDPR export/delete, registration + license flow, caller memory flow, data-retention worker)
- **Contract tests** — saved Telnyx, ElevenLabs webhook payload fixtures to catch upstream API changes
- **E2E tests** — Playwright for core web flows (onboarding, agent creation, dashboard)
- **Load tests** — webhook burst handling and concurrent call ingestion on staging

### Phase 3: Scale Preparation (First Quarter)

**Engineering:**
- [ ] Add circuit breaker pattern for external APIs
- [ ] Implement PgBouncer for connection multiplexing
- [ ] Add Prometheus `/metrics` endpoint
- [ ] Set up centralized log aggregation
- [ ] Implement background job queue (BullMQ) to replace setInterval worker
- [ ] Database migration safety (staging env, dry-run)
- ~~[ ] Blue-green deployment strategy~~ **Moved to Phase 0** (Nginx + dual Docker Compose stacks)
- ~~[ ] Secrets management (Vault, Doppler, or cloud-native)~~ **Decided in Phase 0:** GitHub Actions secrets + `.env` on server. Vault/Doppler deferred until team grows or compliance requires it.

**Operational:**
- [ ] Write operational runbooks (incident response, DB restore, secret rotation, deploy rollback)
- [ ] Add admin features: edit customer details, suspend/unsuspend, extend license, view customer calls
- [ ] Add onboarding email drip sequence (day 1, 3, 7)
- [ ] Add user-facing help center or FAQ
- [ ] Add public status page (statuspage.io or self-hosted)
- [ ] Add business KPI dashboard in admin (MRR, churn, calls/customer, avg call duration)
- [ ] Add cookie consent banner (if analytics cookies are in use)
- [ ] Document ElevenLabs outage fallback procedure (voicemail or recorded message)

**Feature completeness (each item needs explicit decision: ship / hide in beta / defer to post-launch):**
- [ ] Google Calendar write-back — `createGoogleCalendarEvent()` using Calendar API v3 (OAuth tokens already stored)
- [ ] Push notifications — web-push service, service worker registration, new `push_subscriptions` table (per-user subscription storage), send on call/appointment events
- [ ] SMS appointment confirmations — `telnyx.messages.create()` after booking (Telnyx SMS already configured)
- [ ] Advanced analytics — call volume time-series, peak call hours heatmap, appointment conversion by agent
- [ ] Multi-agent flows visual editor — drag-and-drop routing builder (React Flow), `agent_flows` table and API routes exist
- [ ] Dark mode toggle — Tailwind `dark:` classes partially present, needs theme toggle
- [ ] Landing page builder — Pro/Enterprise plans include "1 annual landing page", not yet built

---

## 8. Supabase Configuration Checklist

The app uses Supabase for production auth (JWT). These settings must be verified before launch.

### Dashboard Settings

- [ ] **Authentication > Email**: Confirm email template matches VoiceForge branding
- [ ] **Authentication > Email**: Set `Site URL` to production URL (e.g., `https://<domain>`)
- [ ] **Authentication > Redirect URLs**: Add `https://<domain>/**`
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

## 9. Deployment Runbook (First Production Deploy)

Step-by-step sequence. Assumes new production DO droplet with Nginx + SSL configured for `<domain>`.

```
Step 1: Prepare Server
  └── Provision new production droplet (4 GB / 2 vCPU, FRA1). Upgrade to 8 GB only if latency issues appear.
  └── Only requirement: Docker + Docker Compose installed (no Node/pnpm/PM2 needed)
  └── Harden SSH (key-only, fail2ban, unattended-upgrades)
  └── Verify firewall: only 22, 80, 443 inbound
  └── Set up production domain (<domain>) — A records, Nginx, Let's Encrypt SSL

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
  └── Supabase: Set Site URL + Redirect URLs (see Section 8)
  └── ~~Stripe: Switch to live mode, set webhook endpoint to production URL~~ (Stripe removed)
  └── Telnyx: Set webhook endpoints (pre-call + post-call)
  └── ElevenLabs: Set webhook endpoint, verify plan concurrency
  └── Resend: Verify domain auth (SPF/DKIM/DMARC for <domain>)

Step 5: Build & Deploy
  └── git pull origin main
  └── docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
  └── Entrypoint handles: pnpm install → pnpm db:migrate → pnpm start
  └── Container restart policy (restart: unless-stopped) handles auto-start on reboot

Step 6: Verify
  └── curl https://<domain>/api/health
  └── docker compose ps (all containers healthy)
  └── Open dashboard, login, create agent
  └── Test phone call end-to-end
  └── ~~Verify Stripe webhook receiving events~~ (Stripe removed)
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

## 10. Hypercare Plan (First 72 Hours Post-Launch)

- Continuous monitoring: error rate, latency, webhook failures, DB health, worker health
- Log review after each deploy and after first real customer calls
- Online rollback owner available throughout the launch window
- Launch log: timestamp, impact, fix, and follow-up owner for every issue
- Post-launch review at 24 hours and 72 hours
- Designated owners for: deploy, rollback, communication, and hypercare monitoring

---

## 11. Pre-Launch Checklist

### Security
- [ ] `ADMIN_SECRET` is random, min 32 chars, not in git, no fallback
- [ ] `ENCRYPTION_KEY` is 64 hex chars, backed up securely offline
- [ ] All `.env` files excluded from git (verify `.gitignore`)
- [ ] All API keys rotated (fresh production keys, not demo/dev keys)
- ~~[ ] Stripe in live mode (not test mode)~~ *(Stripe removed)*
- [ ] ElevenLabs webhook secret configured
- [ ] Telnyx webhook secret configured
- [ ] `.env.production` permissions set to `chmod 600`

Feature verification and data integrity checks are tracked in GitHub Issues.

### Operational
- [ ] `/api/health` returns `{"status":"ok","db":"connected"}`
- [ ] All Docker containers healthy for 24 hours (`docker compose ps`)
- [ ] Database backup runs and a backup file exists
- [ ] Uptime monitor alerting configured and tested
- ~~[ ] Stripe webhook receiving and processing events~~ *(Stripe removed)*
- [ ] Data retention worker scheduled and running (`docker compose logs worker`)

### Legal / GDPR
- [ ] Privacy Policy accessible at `/privacy`
- [ ] Terms of Service accessible at `/terms`
- [ ] GDPR data export works end-to-end
- [ ] GDPR account deletion works end-to-end
- [ ] DPAs collected from sub-processors (ElevenLabs, Telnyx, Supabase, Resend, OpenAI, DO)

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
| ~~Stripe~~ | ~~API calls~~ | ~~100 req/s (standard)~~ | ~~Billing operations fail~~ *(Stripe removed)* |
| Resend | Emails | 100/day (free), 50K/mo (paid) | Emails silently dropped |
| OpenAI | Chat completions | 500 req/min (GPT-4o-mini) | Support chat fails |

---

*Last updated: 2026-03-24. Original audit: 2026-03-18. Code-level issues tracked in GitHub Issues. This document covers DevOps, infrastructure, and operational readiness only. Infrastructure recommendations based on DigitalOcean (FRA1 datacenter).*