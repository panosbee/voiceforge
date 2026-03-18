# VoiceForge AI Backend API - Thorough Exploration Report

## I. ENTRY POINT & GLOBAL MIDDLEWARE

### Server Setup
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/index.ts` (lines 1-220)

#### Key Findings:
1. **Framework:** Hono.js (lightweight, edge-computing optimized)
2. **Port:** Configurable via `PORT` env var (default 3001)
3. **Graceful Shutdown:** Implements SIGTERM/SIGINT handlers with 10-second timeout (lines 200-217)

#### Global Middleware Stack (in order):
1. **Request ID** (line 49) - Unique per request for tracing
2. **Body Limit** (lines 52-53):
   - `/api/*`: 512KB limit
   - `/webhooks/*`: 2MB limit
3. **CORS** (lines 56-65):
   - Production: Only `FRONTEND_URL`
   - Development: `localhost:3000` + `FRONTEND_URL`
   - Excludes `/widget/*` (cross-origin access for embedded content)
4. **Security Headers** (lines 69-78):
   - HSTS: 2 years, includeSubDomains, preload
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - COEP: disabled for widgets
5. **Request Timing** (line 81) - Server timing metrics
6. **HTTP Logging** (line 85) - Dev only, uses Hono's logger
7. **Rate Limiting** (lines 90-91):
   - `/api/*`: 100 req/min per IP
   - `/webhooks/*`: 500 req/min per IP

#### Route Protection:
- **Auth required:** `/api/*` routes use `authMiddleware`
- **Public routes:** `/health`, `/registration`, `/widget`, `/webhooks`, `/tools`
- **Admin-protected:** `/admin` with `ADMIN_SECRET` header

#### Global Error Handling (lines 146-177):
- HTTPException: Returns with original status
- Unhandled errors: 500 with generic message
- 404: Returns `NOT_FOUND` error

---

## II. AUTHENTICATION MIDDLEWARE

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/middleware/auth.ts` (lines 1-184)

### JWT Verification Strategy:

1. **Development Mode** (lines 112-131):
   - Uses dev-auth service for local JWT generation
   - No HTTP round-trip to Supabase

2. **Production Mode** (lines 133-144):
   - **Preferred:** Local HS256 verification with `SUPABASE_JWT_SECRET`
   - **Fallback:** HTTP call to `SUPABASE_URL/auth/v1/user` (slower, use JWT_SECRET in prod)

### JWT Claims Extracted (lines 17-23):
- `sub`: User ID
- `email`: User email
- `role`: User role
- `aud`: Audience
- `exp`: Expiration timestamp (validated)

### Security Implementation:
- ✅ Base64URL encoding/decoding (lines 27-33)
- ✅ HMAC-SHA256 signature verification (lines 54-62)
- ✅ Algorithm validation: Only HS256 allowed (lines 48-51)
- ✅ Expiry validation (lines 73-77)
- ✅ All crypto errors return null (no information leakage)

**Critical:** Header must be `Authorization: Bearer <token>` (line 104)

---

## III. RATE LIMITING MIDDLEWARE

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/middleware/rate-limit.ts` (lines 1-221)

### Store Implementations:

1. **In-Memory Store** (lines 22-63):
   - Sliding window algorithm
   - Auto-cleanup every 60 seconds (line 27-37)
   - Suitable for single-instance development

2. **Redis Store** (lines 67-142):
   - Lua script for atomic operations (lines 95-121)
   - Production distributed rate limiting
   - Graceful degradation: Allows request on Redis failure (line 139)

### Pre-configured Limiters (lines 196-206):
- **API:** 100 req/min per IP
- **Auth:** 10 req/min per IP
- **Webhooks:** 500 req/min per IP
- **GDPR:** 5 req/min per IP (prevent abuse)
- **Plan-based:** Starter=30, Pro=100, Business=300 req/min

### Rate Limit Headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (on 429)

---

## IV. WEBHOOK SIGNATURE VERIFICATION

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/middleware/webhook-verify.ts` (lines 1-78)

### Telnyx Webhook Verification:
- **Algorithm:** Ed25519 signatures
- **Headers Required:**
  - `telnyx-signature-ed25519`: Base64-encoded signature
  - `telnyx-timestamp`: Unix timestamp (seconds)
- **Signed Payload:** `{timestamp}|{rawBody}`
- **Replay Protection:** Max age 5 minutes (line 15)

### Implementation Details:
- Uses Node.js `crypto.verify()` with public key (lines 50-58)
- Raw body extraction before JSON parsing (line 44)
- Stores parsed body in context for route handlers (line 67)

---

## V. ROUTE ANALYSIS

### A. AGENTS ROUTES
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/agents.ts` (lines 1-612)

#### Endpoints:
1. **POST `/agents/test-preview`** (lines 182-245):
   - Creates temporary ElevenLabs agent for browser testing
   - No DB record, no customer required
   - Dev bypass returns fake ID

2. **GET `/agents`** (lines 251-283):
   - Lists all agents for authenticated customer
   - ⚠️ **TODO (line 278):** `totalCalls` hardcoded to 0 (should compute from calls table)

3. **GET `/agents/:id`** (lines 289-307):
   - Gets single agent with ownership verification

4. **POST `/agents`** (lines 313-460):
   - Creates new agent with ElevenLabs sync
   - Handles KB doc IDs attachment (lines 442-450)
   - Dev bypass generates fake agent ID

5. **PATCH `/agents/:id`** (lines 466-570):
   - Updates agent and syncs to ElevenLabs
   - Rebuilds enhanced instructions

6. **DELETE `/agents/:id`** (lines 576-611):
   - Deletes from ElevenLabs + DB (cascades to calls)

#### Key Security Patterns:
- ✅ Customer ownership verification on all routes
- ✅ Dev bypass mode for testing without ElevenLabs
- ✅ Client tools built dynamically per language
- ✅ Encryption of API keys (via services)

---

### B. CUSTOMERS ROUTES
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/customers.ts` (lines 1-243)

#### Endpoints:
1. **GET `/customers/me`** (lines 58-102):
   - Returns sanitized customer profile
   - Counts agents, checks ElevenLabs integration status

2. **POST `/customers/register`** (lines 109-173):
   - Onboarding Step 1: Creates customer record
   - Validates unique user ID
   - No Telnyx account auto-created

3. **PATCH `/customers/me`** (lines 179-200):
   - Updates profile (name, phone, timezone)

4. **POST `/customers/complete-onboarding`** (lines 207-242):
   - Marks onboarding complete
   - Sends welcome email (if configured)

#### Security:
- ✅ All routes protected by authMiddleware
- ✅ User-to-customer mapping via `userId` (not trusted)

---

### C. CALLS ROUTES
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/calls.ts` (lines 1-805)

#### Key Endpoints:
1. **GET `/calls`** (lines 47-105):
   - Lists calls with pagination & filtering
   - Filters: agentId, date range

2. **GET `/calls/analytics/summary`** (lines 111-153):
   - 30-day KPIs (total calls, minutes, sentiment, appointments)
   - Uses SQL aggregates

3. **GET `/calls/calendar/month`** (lines 165-215):
   - Calendar view for month
   - Timezone-aware date ranges

4. **GET `/calls/calendar/appointments`** (lines 227-272):
   - Appointments for month (on scheduled date)

5. **DELETE `/calls/calendar/appointments/:appointmentId`** (lines 278-304):
   - Deletes single appointment
   - Ownership verification

6. **GET `/calls/:id`** (lines 311-336):
   - Full call detail with transcript
   - ⚠️ **Route ordering critical** (line 308) - Must come after static routes

7. **POST `/calls/record-conversation`** (lines 504-804):
   - Records ElevenLabs widget conversation
   - Complex workflow: Fetch → Parse → Extract → Create appointment
   - Handles AI data collection + fallback parsing

#### Important Details:
- **Test call cleanup** (lines 352-490):
  - DELETE `/calls/e2e-test/:id`: Single test call
  - DELETE `/calls/e2e-test`: All test calls for customer
  - Safety check: Only deletes calls with `isE2ETest` or `isWidgetTest` metadata

#### SQL Queries:
- ✅ All use Drizzle parameterized queries
- Uses `sql\`...\`` with field references (e.g., line 427)
- JSON operators (`->>'key'`) are parameterized

---

### D. WEBHOOKS ROUTES (Telnyx)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/webhooks.ts` (lines 1-200+)

#### Endpoints:
1. **POST `/webhooks/telnyx/pre-call`** (lines 28-89):
   - Called at conversation start
   - Returns dynamic variables (customer name, timezone, etc.)
   - Must respond within 1 second
   - Fallback to empty dict on error

2. **POST `/webhooks/telnyx/post-call`** (lines 96-182):
   - Called when conversation ends
   - Idempotency: Checks if event already processed
   - Creates call record in DB
   - ⚠️ **TODOs** (lines 173-174): Push notifications, email summary

3. **POST `/webhooks/telnyx/insights`** (lines 189+):
   - Post-call analytics (sentiment, summary)

#### Security:
- ✅ Signature verification via middleware
- ✅ Idempotency check prevents duplicates (line 103)
- ✅ Graceful error handling returns 200 to prevent retries

---

### E. BILLING ROUTES
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/billing.ts` (lines 1-150+)

#### Endpoints:
1. **GET `/billing/subscription`** (lines 50-91):
   - Current subscription status
   - Fetches from Stripe if exists

2. **POST `/billing/checkout`** (lines 95-138):
   - Creates Stripe checkout session
   - Auto-creates Stripe customer if needed

3. **POST `/billing/portal`** (lines 142-150+):
   - Creates Stripe billing portal session

#### Security:
- ✅ All routes protected by authMiddleware
- ✅ Stripe secret key stored in env
- ✅ Customer verification before operations

---

### F. ADMIN ROUTES (Protected)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/admin.ts` (lines 1-100+)

#### Authentication:
- **Header:** `X-Admin-Token` or query param `token`
- **Secret:** `ADMIN_SECRET` env var (default: 'voiceforge-admin-2026')
- ⚠️ **SECURITY ISSUE (line 41):** Default secret in code + fallback

#### Endpoints:
1. **POST `/admin/login`** (lines 60-75):
   - Returns token if secret matches
   - No auth required for this endpoint

2. **GET `/admin/registrations`** (lines 81-100+):
   - Lists pending registrations
   - Filterable by status

#### Critical Issues:
- ⚠️ Simple string comparison for auth (line 43)
- ⚠️ Token can be passed in query params (vulnerable to XSS/logging)
- ⚠️ Default secret should NOT be in code (line 41)

---

### G. DEV AUTH ROUTES (Development Only)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/dev-auth.ts` (lines 1-221)

#### Guard:
- Only available in development mode (lines 23-28)
- Checks `isDevAuthMode()` which validates:
  - NODE_ENV === 'development'
  - Supabase not configured

#### Endpoints:
1. **POST `/auth/dev/login`** (lines 51-86):
   - Email + password login (any password works)
   - Creates user "on the fly" if not exists
   - Returns JWT token with 30-day expiry

2. **POST `/auth/dev/register`** (lines 92-163):
   - Registers with business info
   - Auto-creates customer record

3. **GET `/auth/dev/me`** (lines 169-209):
   - Returns current dev user + profile

4. **GET `/auth/dev/status`** (lines 215-220):
   - Confirms dev auth is active

#### Security:
- ✅ Properly guarded to development only
- ✅ Returns error 403 if not in dev mode
- ✅ JWT uses ENCRYPTION_KEY as signing secret

---

### H. REGISTRATION ROUTES (Public)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/registration.ts` (lines 1-150+)

#### Bank Details (Hardcoded):
- IBAN: `GR12 0172 0010 0050 1234 5678 901` (line 32)
- Bank: Τράπεζα Πειραιώς
- SWIFT: PIABORAA

#### Endpoints:
1. **GET `/registration/plans`** (lines 98-103):
   - Returns 3 plans (Basic, Pro, Enterprise)
   - Pricing hardcoded in PLANS array (lines 42-92)

2. **POST `/registration/register`** (lines 132-150+):
   - Submits business registration
   - Validates: Name, email, phone, company, AFM (9 digits), DOY

#### Validation Schema:
- Email validation ✅
- AFM: Must be 9 digits (line 120)
- Password: Min 8 characters (line 115)
- Phone: Min 10 characters

---

### I. WIDGET ROUTES (Public, No Auth)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/widget.ts` (lines 1-100+)

#### Endpoints:
1. **GET `/widget/:agentId/config`** (lines 21-72):
   - Returns widget config for agent
   - Checks: widgetEnabled flag
   - Origin validation if allowedOrigins configured (lines 41-49)

2. **POST `/widget/:agentId/record`** (lines 79-100+):
   - Triggers recording of widget conversation
   - No auth needed (public)
   - Validates: widgetEnabled + elevenlabsAgentId

#### Security:
- ✅ Origin validation checks host against allowedOrigins
- ✅ Wildcard `*` supported for open CORS
- ⚠️ Public access to agent config (expected for embedded widgets)

---

### J. TOOLS ROUTES (Legacy Telnyx)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/tools.ts` (lines 1-239)

#### Endpoints:
1. **POST `/tools/calendar/check`** (lines 38-123):
   - Called during live call
   - Checks calendar availability
   - Returns available slots (9-17:00, 30-min intervals)
   - ⚠️ **TODO (line 99):** Google Calendar integration missing

2. **POST `/tools/calendar/book`** (lines 131-238):
   - Books appointment during call
   - Checks double-booking (line 180-186)
   - Creates appointment record
   - ⚠️ **TODOs** (lines 212-213):
     - Google Calendar sync
     - Push notification to customer

#### Security:
- ✅ Customer ID validation (lines 51, 142)
- ✅ Timezone-aware date parsing
- ✅ No SQL injection (using Drizzle)

---

### K. KNOWLEDGE BASE ROUTES
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/knowledge-base.ts` (lines 1-150+)

#### File Upload Restrictions (lines 23-35):
- **Allowed types:** PDF, TXT, MD, CSV, HTML, DOCX, DOC, EPUB
- **Max size:** 25MB
- **MIME type validation** (line 118)

#### Endpoints:
1. **POST `/knowledge-base/upload-file`** (lines 87-150+):
   - Multipart form-data: file + name + agentId
   - File type + size validation
   - Agent ownership verification (if agentId provided)

#### Security:
- ✅ File type whitelist
- ✅ File size limit
- ✅ Ownership verification for agent attachment

---

### L. GDPR ROUTES (Compliance)
**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/routes/gdpr.ts` (lines 1-150+)

#### Endpoints:
1. **GET `/gdpr/export`** (lines 26-138):
   - Article 20: Right to Data Portability
   - Returns all user data (customer, agents, calls, appointments, audit logs)
   - Logs export event in audit trail

2. **DELETE `/gdpr/delete-account`** (lines 145-150+):
   - Article 17: Right to Erasure
   - Permanent data deletion (irreversible)

#### Security:
- ✅ Audit logging of exports
- ✅ IP + User-Agent captured
- ✅ No PII in response metadata

---

## VI. ENVIRONMENT CONFIGURATION

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/config/env.ts` (lines 1-154)

### Env Var Validation:
- ✅ Uses Zod schema for parsing + validation
- ✅ Production enforcement (lines 110-145)
- Exits process if invalid (lines 104, 143)

### Critical Secrets Required:
1. **ENCRYPTION_KEY** (line 31):
   - Must be 64 hex chars (32 bytes for AES-256)
   - Used for encrypting stored API keys

2. **SUPABASE_JWT_SECRET** (line 34):
   - Optional in dev (falls back to HTTP verification)
   - Required in production (line 125)

3. **TELNYX_PUBLIC_KEY** (line 128):
   - Required for webhook signature verification

### Encryption:
- Algorithm: AES-256-GCM (line 12)
- IV length: 16 bytes (line 13)
- Auth tag: 16 bytes (line 14)

### Database:
- **DATABASE_URL**: Required Supabase PostgreSQL
- Connection pooling:
  - Dev: 20 connections, 20s idle timeout
  - Prod: 25 connections, 30s idle timeout
- SSL required in production (line 24)

---

## VII. ENCRYPTION SERVICE

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/services/encryption.ts` (lines 1-88)

### Implementation:
- Algorithm: AES-256-GCM
- Format: `base64(iv):base64(authTag):base64(ciphertext)`
- Random IV per encryption (line 27)
- Auth tag for AEAD (line 33)

### Functions:
- `encrypt(plaintext)` → string
- `decrypt(encryptedData)` → string
- `encryptOptional()` / `decryptOptional()` → null-safe wrappers

#### Security:
- ✅ Random IV per message
- ✅ Authenticated encryption (GCM)
- ✅ Error handling (throw on failure)
- Used for: Telnyx API keys, Google OAuth tokens

---

## VIII. DATABASE SCHEMA OVERVIEW

### Core Tables:
1. **customers**: Business accounts + Supabase auth link
2. **agents**: AI agents (ElevenLabs or Telnyx)
3. **calls**: Call records with transcript + insights
4. **appointments**: Calendar appointments
5. **knowledge_base_documents**: KB files attached to agents
6. **webhook_events**: Idempotency tracking
7. **pending_registrations**: B2B registration queue
8. **license_keys**: License management
9. **audit_logs**: GDPR compliance tracking

### Important Fields:

**Customers (customers.ts, lines 30-81):**
- `telnyxApiKeyEncrypted`: Encrypted API key
- `googleOauthTokenEncrypted`: Encrypted OAuth token
- `licenseKey`: Active license
- `registrationStatus`: pending | active | suspended

**Agents (agents.ts, lines 19-100+):**
- `elevenlabsAgentId`: Primary AI provider
- `telnyxAssistantId`: Legacy Telnyx ID
- `voiceId`: ElevenLabs voice
- `tools`: JSONB array of client tools
- `dynamicVariables`: JSONB customer-specific vars
- `widgetEnabled`: Public embed flag
- `widgetAllowedOrigins`: JSONB origin whitelist

**Calls (calls table):**
- `telnyxConversationId`: Dedup key
- `transcript`: Full conversation text
- `summary`: AI-generated summary
- `sentiment`: 1-5 score
- `metadata`: JSONB (isE2ETest, isWidgetTest, etc.)
- `insightsRaw`: Full analysis object

---

## IX. LOGGING & MONITORING

**File:** `/home/thomas/repos/voicecall/voiceforge-ai/apps/api/src/config/logger.ts` (lines 1-67)

### PII Redaction (Production):
- Paths redacted (lines 13-28):
  - email, phone
  - callerNumber, callerPhone
  - ownerName, businessName
  - Authorization headers
  - Cookies

### Log Levels:
- Environment variable: `LOG_LEVEL`
- Options: fatal, error, warn, info, debug, trace
- Default: info

### Output:
- Dev: Pretty-printed with colors + timestamps
- Prod: JSON format with ISO timestamps

### Serializers:
- Standard Pino serializers for err, req, res

---

## X. KEY SECURITY PATTERNS & ISSUES

### ✅ STRENGTHS:

1. **JWT Verification:**
   - Local HS256 verification in production (no HTTP roundtrip)
   - Proper expiry validation
   - Algorithm enforcement

2. **Webhook Security:**
   - Ed25519 signature verification for Telnyx
   - Replay attack prevention (5-minute timestamp check)
   - Idempotency tracking with webhook events table

3. **SQL Injection Prevention:**
   - All queries use Drizzle ORM with parameterization
   - No string interpolation in queries

4. **Encryption:**
   - AES-256-GCM for stored secrets
   - Random IV per message
   - Authenticated encryption

5. **CORS:**
   - Proper origin restriction in production
   - Special handling for widgets (cross-origin)

6. **Rate Limiting:**
   - Distributed support via Redis
   - Multiple tiers (API, auth, webhook, GDPR)
   - Graceful degradation on Redis failure

7. **GDPR Compliance:**
   - Data export & deletion endpoints
   - Audit logging with IP + user agent
   - PII redaction in production logs

---

### ⚠️ ISSUES & FINDINGS:

#### 1. **CRITICAL: Admin Authentication (admin.ts:41)**
```typescript
const expectedSecret = env.ADMIN_SECRET || 'voiceforge-admin-2026';
```
- Default fallback secret hardcoded in code
- **Fix:** Remove fallback, require env var in production
- **Severity:** CRITICAL - Exposes admin panel to default credentials

#### 2. **CRITICAL: Admin Token in Query Params (admin.ts:40)**
```typescript
const adminToken = c.req.header('X-Admin-Token') || c.req.query('token');
```
- Allows token in query string (visible in logs, browser history)
- **Fix:** Only accept header, not query param
- **Severity:** CRITICAL

#### 3. **HIGH: Development Auth Routes Exposed in Production**
- Routes are gated by `isDevAuthMode()` (lines 23-28 of dev-auth.ts)
- But fallback check may have gaps if Supabase is partially configured
- **Fix:** Ensure NODE_ENV === 'development' is primary check

#### 4. **MEDIUM: Incomplete Error Handling on Webhook Routes**
- Webhooks return 200 on error to prevent retries (index.ts:179)
- But errors are logged - may expose sensitive info on connection failures
- **Fix:** Sanitize error messages before logging in webhook context

#### 5. **MEDIUM: Hardcoded IBAN in Registration (registration.ts:32)**
```typescript
iban: 'GR12 0172 0010 0050 1234 5678 901'
```
- Potentially real bank account exposed
- **Fix:** Verify if this is test/dummy account, or move to env var

#### 6. **MEDIUM: Widget Allow-all Origins (widget.ts:44)**
```typescript
const allowed = allowedOrigins.some(o => o === '*' || ...)
```
- Wildcard origin support allows embedding from anywhere
- **Fix:** Warn if '*' is used, enforce domain whitelist in production

#### 7. **MEDIUM: Missing Admin Rate Limiting**
- `/admin/*` routes not wrapped with rate limiting middleware
- Brute force possible on admin login endpoint
- **Fix:** Add `authRateLimiter` to admin routes

#### 8. **LOW: Incomplete Feature TODOs**
- `/agents` GET: `totalCalls` hardcoded to 0 (agents.ts:278)
- `/webhooks` POST-CALL: Push notifications missing (webhooks.ts:173-174)
- `/tools/calendar/check`: Google Calendar integration missing (tools.ts:99)
- `/tools/calendar/book`: Google Calendar sync missing (tools.ts:212-213)

#### 9. **LOW: Test Data Cleanup Routes**
- DELETE endpoints allow deletion of test calls by customers
- Routes check for `isE2ETest` or `isWidgetTest` metadata
- ✅ Properly gated - not a security issue, but needs documentation

#### 10. **LOW: Rate Limiter Redis Failure Mode**
- On Redis failure, request is allowed (fail-open) (rate-limit.ts:139)
- Graceful degradation but may mask deployment issues
- **Fix:** Log warning + alert operator on Redis unavailability

---

## XI. DEPENDENCY ANALYSIS

### Critical Dependencies:
- **Hono:** Web framework
- **Drizzle ORM:** Type-safe database access
- **Stripe:** Payment processing
- **ElevenLabs SDK:** AI voice agent
- **Telnyx SDK:** Phone numbers & webhooks
- **Pino:** Structured logging
- **Zod:** Schema validation

### No Known Vulnerable Patterns:
- ✅ No `eval()` or dynamic code execution
- ✅ No unsafe file operations
- ✅ No command injection vectors

---

## XII. DEPLOYMENT CONSIDERATIONS

### Environment Validation:
- Startup fails if required env vars missing (config/env.ts:104)
- Production mode enforces:
  - Real API keys (no 'dev-placeholder')
  - SUPABASE_JWT_SECRET set
  - TELNYX_PUBLIC_KEY present
  - No localhost URLs

### Connection Pooling:
- Development: 20 connections, 20s idle
- Production: 25 connections, 30s idle
- PgBouncer compatibility: `prepare: false`

### Graceful Shutdown:
- 10-second timeout (index.ts:213)
- Closes DB connections
- Process exit code 1 on timeout

---

## XIII. SUMMARY TABLE

| Component | Status | Issues |
|-----------|--------|--------|
| Auth Middleware | ✅ Secure | None |
| Rate Limiting | ✅ Secure | Need admin rate limiting |
| Webhook Verification | ✅ Secure | None |
| Database Access | ✅ Safe | No SQL injection |
| Encryption | ✅ Strong | Good AES-256-GCM usage |
| Logging | ✅ Compliant | PII redaction in prod |
| Admin Routes | ⚠️ CRITICAL | Default secret + query token param |
| CORS | ✅ Proper | Wildcard ok for widgets |
| Dev Routes | ✅ Guarded | Double-check guard logic |
| Error Handling | ✅ Good | Generic messages in prod |
| GDPR | ✅ Compliant | Export + deletion implemented |

---

## RECOMMENDATIONS

### Priority 1 (Critical):
1. Remove default admin secret fallback
2. Accept admin token only in headers, not query params
3. Add rate limiting to admin routes

### Priority 2 (High):
1. Move hardcoded IBAN to environment variable
2. Document dev auth mode guards
3. Add admin authentication audit logging

### Priority 3 (Medium):
1. Complete Google Calendar integration
2. Implement push notifications
3. Compute totalCalls properly (not hardcoded)
4. Add Redis failure alerting

### Priority 4 (Low):
1. Document widget allow-all origins behavior
2. Test failure modes (Redis, Stripe, ElevenLabs)
3. Consider IP rate limiting for registration endpoint

