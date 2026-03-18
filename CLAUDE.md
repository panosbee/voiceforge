# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceForge AI — white-label AI voice receptionist SaaS for Greek SMEs. Monorepo using pnpm workspaces under `voiceforge-ai/`.

**Stack:** Hono.js API (port 3001) + Next.js 15 frontend (port 3000) + PostgreSQL 16 + Drizzle ORM. Integrates ElevenLabs (voice AI), Telnyx (telephony), Stripe (billing), Resend (email), OpenAI (support chat), Supabase (auth in production).

## Commands

All commands run from `voiceforge-ai/` directory:

```bash
pnpm dev          # API server (port 3001, tsx watch)
pnpm dev:web      # Next.js frontend (port 3000)
pnpm dev:all      # Both in parallel
pnpm build        # Build all packages
pnpm lint         # ESLint all packages
pnpm typecheck    # TypeScript check all packages
pnpm db:push      # Push Drizzle schema to DB
pnpm db:migrate   # Run Drizzle migrations
pnpm db:studio    # Visual DB browser
pnpm clean        # Remove node_modules/dist/.next
```

Local dev database: `docker compose up -d postgres` (from `voiceforge-ai/`)

## Architecture

```
voiceforge-ai/
├── apps/api/        @voiceforge/api  — Hono REST API
├── apps/web/        @voiceforge/web  — Next.js 15 App Router frontend
├── packages/shared/ @voiceforge/shared — Shared types, constants, industry templates
├── docker/          Dockerfiles, SQL migrations, Nginx config
└── scripts/         Deployment scripts
```

### API (`apps/api/src/`)
- **Entry:** `index.ts` (Hono server) and `worker.ts` (background data-retention worker)
- **Routes:** 18 route files in `routes/` — agents, calls, billing, webhooks, admin, widget, GDPR, etc.
- **Services:** `services/` — ElevenLabs, Telnyx, Stripe, email (Resend), encryption (AES-256-GCM)
- **Middleware chain (order matters):** requestId → bodyLimit → CORS → secureHeaders → timing → httpLogger → rateLimiting
- **Auth:** Dev mode uses JWT signed with `ENCRYPTION_KEY`. Production uses Supabase JWT (HS256 local verification with `SUPABASE_JWT_SECRET`). Admin routes use `ADMIN_SECRET` header comparison.
- **Rate limiting:** In-memory (dev) or Redis (production). Pre-configured limiters: API (100/min), Auth (10/min), Webhooks (500/min), GDPR (5/min), plus plan-based limits.
- **Database:** Drizzle ORM with PostgreSQL. Schema in `db/schema/` (12 tables). Connection pooling in `db/connection.ts`.
- **Env validation:** Zod schema in `config/env.ts`. Loads `.env` from monorepo root. Required: `ENCRYPTION_KEY` (64 hex chars), `DATABASE_URL`.
- **Build:** `tsup` (ESM bundle). Dev: `tsx watch`.

### Frontend (`apps/web/src/`)
- **Framework:** Next.js 15 App Router, React 19, Tailwind CSS 4
- **State:** Zustand stores in `stores/`
- **API client:** Fetch-based in `lib/api-client.ts`
- **Auth:** Supabase (production) or dev JWT (development)
- **i18n:** Greek + English translations in `lib/i18n/`
- **Output:** Standalone mode (Docker-friendly)

### Shared Package (`packages/shared/src/`)
- Types for customer, agent, call, appointment, billing, webhook, knowledge-base, flow
- Constants: 8 industry verticals, 3 pricing plans (Basic €200, Pro €400, Enterprise €999), 24+ languages, voice configs, LLM models
- Industry templates: pre-made configs for law, medical, dental, real estate, beauty, accounting, veterinary, general

## Key Conventions

- **ESM only** — all packages use `"type": "module"` with `.js` extensions in imports
- **Zod validation** on all API endpoints
- **Pino** structured JSON logging with PII redaction in production
- **Drizzle ORM** — never raw SQL; use parameterized queries
- **Path aliases:** `@/*` maps to `src/*` in both API and web apps; `@voiceforge/*` for workspace packages
- **No test framework** — zero test coverage currently exists
- **No CI/CD pipeline** — deployments are manual via `scripts/deploy.sh` and Docker Compose
