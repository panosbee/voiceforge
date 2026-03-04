# VoiceForge AI

**White-label AI Voice Receptionist SaaS for Greek SMEs**

AI-powered phone receptionist that answers calls 24/7 in natural Greek (and 24+ languages), books appointments, answers customer questions via Knowledge Base (RAG), and remembers returning callers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Backend API** | Hono.js + @hono/node-server (TypeScript), port 3001 |
| **Database** | PostgreSQL 16 (Docker), Drizzle ORM |
| **AI Voice** | ElevenLabs (Conversational AI agents, KB, TTS, STT, handoff) |
| **Telephony** | Telnyx (Greek +30 numbers, SIP trunk → ElevenLabs) |
| **Billing** | Stripe (subscriptions, checkout, customer portal) |
| **Email** | Resend (transactional emails) |
| **AI Chat** | OpenAI GPT-5.2 (in-app support chatbot) |
| **Security** | AES-256-GCM encryption, JWT auth, rate limiting, Ed25519 webhook verification |
| **i18n** | Greek + English (full translation) |

## Project Structure

```
voiceforge-ai/
├── apps/
│   ├── api/                 # @voiceforge/api — Hono REST API (port 3001)
│   │   └── src/
│   │       ├── config/      # env, logger
│   │       ├── db/          # Drizzle connection + schema (12 tables)
│   │       ├── middleware/   # auth, rate-limit, webhook-verify
│   │       ├── routes/      # 17 route files (agents, calls, billing, etc.)
│   │       ├── services/    # ElevenLabs, Telnyx, Stripe, Email, Encryption
│   │       └── workers/     # data-retention worker
│   └── web/                 # @voiceforge/web — Next.js 15 frontend (port 3000)
│       └── src/
│           ├── app/         # Pages: dashboard, onboarding, admin, auth
│           ├── components/  # UI components, layout, providers
│           ├── hooks/       # Custom hooks
│           ├── lib/         # API client, auth, i18n, utils
│           └── stores/      # Zustand stores
├── packages/
│   └── shared/              # @voiceforge/shared — Types, constants, templates
├── docker/                  # Dockerfiles, Nginx, SQL migrations
│   ├── init.sql             # PostgreSQL init (extensions)
│   ├── migrations/          # SQL migration files
│   └── nginx/               # Production nginx config
├── scripts/                 # Deployment scripts
├── docker-compose.yml       # Local development (PostgreSQL + pgAdmin)
├── docker-compose.production.yml  # Production config
├── start-dev.ps1            # One-click dev startup script (Windows)
└── ecosystem.config.cjs     # PM2 production config
```

## Prerequisites

- **Node.js** 20+ ([nodejs.org](https://nodejs.org))
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker Desktop** ([docker.com](https://www.docker.com/products/docker-desktop/)) — must be **running**
- **Git** ([git-scm.com](https://git-scm.com))

## Quick Start (One-Click)

> **Windows PowerShell** — Make sure Docker Desktop is running first!

```powershell
# Clone the repo
git clone https://github.com/panosbee/voicecall.git
cd voicecall/voiceforge-ai

# Run the startup script (does everything automatically)
.\start-dev.ps1
```

The script will:
1. Check prerequisites (Node.js, pnpm, Docker)
2. Create `.env` from `.env.example` if missing
3. Install dependencies (`pnpm install`)
4. Start PostgreSQL via Docker
5. Push database schema (Drizzle)
6. Run SQL migrations
7. Start API server (port 3001) + Web frontend (port 3000)
8. Open browser at `http://localhost:3000`

## Manual Setup (Step by Step)

### Step 1: Install Dependencies

```bash
pnpm install
```

### Step 2: Configure Environment

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env` and set these **required** values:

```bash
# Generate an encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the result as ENCRYPTION_KEY

# For local dev, these are pre-configured:
# DATABASE_URL=postgresql://voiceforge:voiceforge_dev_2024@localhost:5432/voiceforge
# NEXT_PUBLIC_DEV_AUTH=true (uses JWT dev auth, no Supabase needed)
```

Optional API keys (features work without them but with limited functionality):
- `TELNYX_API_KEY` — for phone number management
- `ELEVENLABS_API_KEY` — for AI voice agents
- `OPENAI_API_KEY` — for support chatbot
- `STRIPE_SECRET_KEY` — for billing
- `RESEND_API_KEY` — for transactional emails

### Step 3: Start PostgreSQL

```bash
docker compose up -d postgres
```

Wait for it to be healthy:
```bash
docker exec voiceforge-postgres pg_isready -U voiceforge -d voiceforge
```

### Step 4: Push Database Schema

```bash
pnpm db:push
```

### Step 5: Run Migrations

```bash
# Run each migration in order
docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge < docker/migrations/0002_add_user_role.sql
docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge < docker/migrations/0003_add_caller_memories.sql
docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge < docker/migrations/0003_add_license_keys.sql
docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge < docker/migrations/0004_add_supported_languages.sql
docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge < docker/migrations/0005_add_customer_records.sql
```

### Step 6: Start Development Servers

```bash
# Option A: Both API + Frontend in parallel
pnpm dev:all

# Option B: Separately
pnpm dev        # API only (port 3001)
pnpm dev:web    # Frontend only (port 3000)
```

### Step 7: Open the App

- **Frontend:** http://localhost:3000
- **API Health:** http://localhost:3001/health
- **Admin Panel:** http://localhost:3000/admin (password: `voiceforge-admin-2026`)
- **pgAdmin:** http://localhost:5050 (run `docker compose up -d pgadmin` first)
- **Drizzle Studio:** `pnpm db:studio`

## Development Auth

In development mode (`NEXT_PUBLIC_DEV_AUTH=true`), the app uses JWT-based auth instead of Supabase. You can register and login at:
- http://localhost:3000/login
- http://localhost:3000/register

## Database Schema (12 Tables)

| Table | Purpose |
|-------|---------|
| `customers` | Users/businesses — profile, plan, industry, API keys |
| `agents` | AI voice assistants — config, voice, LLM, system prompt |
| `calls` | Call history — transcript, summary, sentiment, recording |
| `appointments` | Booked appointments — status, datetime, service type |
| `knowledge_base_documents` | KB files — ElevenLabs doc IDs, source type |
| `agent_flows` | Expert mode — multi-agent routing rules |
| `customer_records` | Enterprise — customer directory per business |
| `webhook_events` | Webhook deduplication (idempotency) |
| `audit_logs` | GDPR audit trail |
| `caller_memories` | Episodic memory — remembers returning callers |
| `license_keys` | B2B licensing — keys, plans, activation |
| `pending_registrations` | B2B registration queue — admin approval |

## API Routes

| Route File | Path Prefix | Purpose |
|------------|-------------|---------|
| health.ts | `/health` | Health check |
| agents.ts | `/api/agents` | CRUD AI assistants |
| calls.ts | `/api/calls` | Call history, analytics |
| billing.ts | `/api/billing` | Stripe subscriptions |
| customers.ts | `/api/customers` | Profile management |
| numbers.ts | `/api/numbers` | Greek phone numbers (Telnyx) |
| knowledge-base.ts | `/api/knowledge-base` | KB upload, manage |
| flows.ts | `/api/flows` | Expert mode flows |
| voices.ts | `/api/voices` | ElevenLabs voice list |
| tools.ts | `/tools/calendar/*` | Calendar check/book (in-call) |
| webhooks.ts | `/webhooks/telnyx/*` | Telnyx webhooks (pre/post call) |
| elevenlabs-webhooks.ts | `/webhooks/elevenlabs/*` | ElevenLabs events |
| gdpr.ts | `/api/gdpr` | GDPR data export/delete |
| dev-auth.ts | `/auth/dev/*` | Dev JWT auth |
| registration.ts | `/registration/*` | B2B registration |
| admin.ts | `/admin/*` | Admin panel API |

## Pricing (as per business plan)

| Plan | Price/month | Minutes | Agents | Languages |
|------|-------------|---------|--------|-----------|
| **Basic** | €200 | 400 | 1 | Greek |
| **Pro** | €400 | 800 | 3 | EL + EN + DE |
| **Enterprise** | €999 | 2,000 | 10 | 14+ languages |

## Key Features

- **8 Industry Templates**: Law office, Medical, Dental, Real estate, Beauty salon, Accounting, Veterinary, General
- **Knowledge Base (RAG)**: Upload files, URL scraping, or AI-guided wizard (10 questions)
- **Episodic Memory**: Remembers callers by phone number across sessions
- **Multilingual**: 24+ languages with automatic language detection
- **AI Support Chatbot**: In-app GPT-5.2 powered help
- **GDPR Compliant**: Articles 15, 17, 20 — data export, deletion, portability
- **B2B Licensing**: Admin panel for key generation, registration approval
- **Expert Mode**: Multi-agent flows with handoff routing

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API server (port 3001) |
| `pnpm dev:web` | Start Next.js frontend (port 3000) |
| `pnpm dev:all` | Start both in parallel |
| `pnpm build` | Build all packages |
| `pnpm db:push` | Push Drizzle schema to DB |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Remove node_modules, dist, .next |

## Security

- **AES-256-GCM** encryption for stored API keys
- **Ed25519** webhook signature verification (Telnyx)
- **JWT authentication** with dual mode (Supabase + Dev)
- **Rate limiting** — sliding window, per-plan limits
- **CORS** — restricted to frontend origin
- **Zod** input validation on every endpoint
- **Audit logging** for GDPR compliance

## License

UNLICENSED — Proprietary. All rights reserved.
Beelive Μονοπρόσωπη ΕΠΕ © 2026
