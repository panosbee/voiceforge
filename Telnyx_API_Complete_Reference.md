# Telnyx API — Complete Reference for VoiceForge AI
**Version 1.0 | February 2026 | INTERNAL — DO NOT DISTRIBUTE**

> Master reference document gathered from official Telnyx docs.
> Serves as the single source of truth across all dev sessions.
> Covers every API we need for VoiceForge AI end-to-end.

---

## TABLE OF CONTENTS

1. [Authentication & SDK Setup](#1-authentication--sdk-setup)
2. [Managed Accounts (Multi-Tenant)](#2-managed-accounts-multi-tenant)
3. [AI Assistants — CRUD](#3-ai-assistants--crud)
4. [Dynamic Variables](#4-dynamic-variables)
5. [Memory (Cross-Conversation Context)](#5-memory-cross-conversation-context)
6. [Voice & Transcription Settings](#6-voice--transcription-settings)
7. [Telephony Settings](#7-telephony-settings)
8. [Tools — Webhooks, Handoff, Transfer, DTMF](#8-tools--webhooks-handoff-transfer-dtmf)
9. [Async Tools & Add Messages API](#9-async-tools--add-messages-api)
10. [Phone Numbers — Search & Order](#10-phone-numbers--search--order)
11. [Integration Secrets (BYO Keys)](#11-integration-secrets-byo-keys)
12. [Conversations API](#12-conversations-api)
13. [AI Insights (Post-Call Analytics)](#13-ai-insights-post-call-analytics)
14. [Webhook Fundamentals & Security](#14-webhook-fundamentals--security)
15. [Outbound Calls](#15-outbound-calls)
16. [Start AI Assistant (Call Control)](#16-start-ai-assistant-call-control)
17. [Agent Handoff](#17-agent-handoff)
18. [Embeddable Widget](#18-embeddable-widget)
19. [Knowledge Bases (RAG)](#19-knowledge-bases-rag)
20. [Node.js SDK Reference](#20-nodejs-sdk-reference)
21. [Key Limits, Timeouts & Gotchas](#21-key-limits-timeouts--gotchas)

---

## 1. AUTHENTICATION & SDK SETUP

### Base URL
```
https://api.telnyx.com/v2
```

### Authentication
All API requests use Bearer token authentication:
```
Authorization: Bearer <TELNYX_API_KEY>
```

API keys are generated at: `https://portal.telnyx.com/#/api-keys`

Public key (for webhook verification) is at: `https://portal.telnyx.com/#/api-keys/public-key`

### Node.js SDK Install
```bash
npm install telnyx
```

### SDK Initialization
```typescript
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // default, can be omitted if env var is set
});
```

### SDK Version
- Package: `telnyx` on npm
- Current version: `5.37.x`
- TypeScript-first, built-in type declarations
- Supports: Node.js 20+, Bun 1.0+, Deno 1.28+, Cloudflare Workers, Vercel Edge Runtime
- Auto-pagination, auto-retries (2 by default), 1-minute default timeout

### SDK Error Handling
```typescript
try {
  const result = await client.numberOrders.create({
    phone_numbers: [{ phone_number: '+302101234567' }]
  });
} catch (err) {
  if (err instanceof Telnyx.APIError) {
    console.log(err.status);  // 400, 401, 403, 404, 422, 429, 500+
    console.log(err.name);    // BadRequestError, AuthenticationError, etc.
  }
}
```

| Status | Error Class |
|--------|------------|
| 400 | `BadRequestError` |
| 401 | `AuthenticationError` |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 422 | `UnprocessableEntityError` |
| 429 | `RateLimitError` |
| >=500 | `InternalServerError` |
| Network | `APIConnectionError` |

### SDK Retry Config
```typescript
const client = new Telnyx({
  maxRetries: 3, // default is 2
  timeout: 30_000, // default is 60_000 (1 min)
});
```
Retries cover: connection errors, 408, 409, 429, and >=500 errors.

---

## 2. MANAGED ACCOUNTS (MULTI-TENANT)

> **CRITICAL FOR VOICEFORGE**: This is the core multi-tenant feature. Each customer gets an isolated Telnyx sub-account.
> Must be explicitly approved by Telnyx support. Not auto-enabled.

### Create a Managed Account
```
POST /v2/managed_accounts
```

**SDK:**
```typescript
const managedAccount = await client.managedAccounts.create({
  business_name: "Law Office Papadopoulos",
  // email: optional — auto-generated from manager account if omitted
  // password: optional — no direct login if omitted
  // managed_account_allow_custom_pricing: false (default) — uses manager pricing
  // rollup_billing: false (default) — separate balance per sub-account
});

console.log(managedAccount.data);
// {
//   record_type: "managed_account",
//   id: "f65ceda4-6522-4ad6-aede-98de83385123",
//   email: "user@example.com",
//   api_key: "KEY01236170692E74656C6E79782E636F6D_...",
//   api_user: "managed_account@example.com",
//   api_token: "x6oexQNHTs-fZ7-QsDMOeg",
//   manager_account_id: "...",
//   organization_name: "Law Office Papadopoulos",
//   balance: { balance: "300.00", credit_limit: "100.00", ... },
//   managed_account_allow_custom_pricing: false,
//   rollup_billing: false,
//   created_at: "...",
//   updated_at: "..."
// }
```

**Key fields returned:**
| Field | What it is | Usage |
|-------|-----------|-------|
| `id` | Sub-account UUID | Store in our DB as `telnyx_account_id` |
| `api_key` | Sub-account API key | Use for **all subsequent API calls for this customer** |
| `api_token` | Alternative auth token | Can also be used for auth |
| `rollup_billing` | Whether billing rolls up to manager | **Cannot change after creation without Telnyx support** |

**Important parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `business_name` | string | **required** | Used as organization name |
| `email` | string | optional | Auto-generated if omitted |
| `password` | string | optional | No direct login if omitted |
| `managed_account_allow_custom_pricing` | boolean | `false` | If false, inherits manager pricing |
| `rollup_billing` | boolean | `false` | **IRREVERSIBLE without Telnyx support.** If true, sub-account shares manager balance |

### List Managed Accounts
```
GET /v2/managed_accounts
```

**SDK (auto-paginated):**
```typescript
for await (const account of client.managedAccounts.list()) {
  console.log(account.id, account.organization_name);
}
```

**Filter/Sort options:**
- `filter[email][contains]`, `filter[email][eq]`
- `filter[organization_name][contains]`, `filter[organization_name][eq]`
- `sort`: `created_at` or `email` (prefix `-` for desc)
- `include_cancelled_accounts`: boolean (default: false)
- `page[number]`, `page[size]`

### Retrieve a Managed Account
```
GET /v2/managed_accounts/{id}
```

### Disable a Managed Account
```
POST /v2/managed_accounts/{id}/actions/disable
```

### VoiceForge Flow
1. Customer registers → we call `POST /managed_accounts` with their business name
2. We store `id` and `api_key` in our database (encrypted!)
3. All subsequent Telnyx calls for that customer use **their** `api_key`
4. Complete isolation: their numbers, agents, conversations are siloed

---

## 3. AI ASSISTANTS — CRUD

> The heart of the platform. Each customer's AI phone agent is a Telnyx AI Assistant.

### Create an Assistant
```
POST /v2/ai/assistants
```

**SDK:**
```typescript
const assistant = await client.ai.assistants.create({
  name: "Sofia - Law Office Papadopoulos",
  model: "meta-llama/Meta-Llama-3.1-70B-Instruct", // or "openai/gpt-4o"
  instructions: "You are Sofia, the AI receptionist of {{var_office_name}}...",
  greeting: "Γεια σας! Μιλάτε με {{var_office_name}}. Πώς μπορώ να σας βοηθήσω;",
  // See full field reference below
});

console.log(assistant.id); // "assistant-xxxx-xxxx-xxxx"
```

**Full request body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Display name |
| `model` | string | ✅ | LLM model ID. Use `GET /v2/ai/models` to list available |
| `instructions` | string | ✅ | System prompt. Supports `{{dynamic_variables}}` |
| `description` | string | ❌ | Internal description |
| `greeting` | string | ❌ | Opening text. Supports `{{variables}}`. Empty string = wait for user. Special: `<assistant-speaks-first-with-model-generated-message>` |
| `tools` | array | ❌ | Array of tool objects (webhook, hangup, handoff, transfer, etc.) |
| `llm_api_key_ref` | string | ❌ | Integration secret identifier for BYO LLM key (e.g., OpenAI) |
| `voice_settings` | object | ❌ | TTS configuration (see Section 6) |
| `transcription` | object | ❌ | STT configuration (see Section 6) |
| `telephony_settings` | object | ❌ | Noise suppression, time limits, voicemail detection (see Section 7) |
| `messaging_settings` | object | ❌ | SMS/MMS settings |
| `enabled_features` | string[] | ❌ | `["telephony"]`, `["messaging"]`, or both |
| `insight_settings` | object | ❌ | `{ insight_group_id: "..." }` |
| `privacy_settings` | object | ❌ | `{ data_retention: true }` |
| `dynamic_variables_webhook_url` | string | ❌ | URL called at start of each conversation |
| `dynamic_variables` | object | ❌ | Default values for variables |
| `widget_settings` | object | ❌ | Embeddable web widget config |

### List Assistants
```
GET /v2/ai/assistants
```

### Get an Assistant
```
GET /v2/ai/assistants/{assistant_id}
```

### Update an Assistant
```
POST /v2/ai/assistants/{assistant_id}
```
**SDK:**
```typescript
const updated = await client.ai.assistants.update('assistant-xxxx', {
  instructions: "Updated instructions...",
  greeting: "Νέος χαιρετισμός...",
  promote_to_main: true, // default: true — promotes to main version
});
```
**Note:** `promote_to_main` (default `true`) — controls versioning. Set to `false` for A/B testing.

### Delete an Assistant
```
DELETE /v2/ai/assistants/{assistant_id}
```

---

## 4. DYNAMIC VARIABLES

> This is THE multi-tenant magic. One assistant template → personalized for every customer at call time.

### Syntax
```
{{variable_name}}
```
Used in: `instructions`, `greeting`, `tools` (descriptions, URLs, parameters)

### Telnyx System Variables (auto-populated)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{telnyx_current_time}}` | UTC date/time | Monday, February 24 2025 04:04:15 PM UTC |
| `{{telnyx_conversation_channel}}` | Channel type | `phone_call`, `web_call`, `sms_chat` |
| `{{telnyx_agent_target}}` | Agent's phone/SIP | `+302101234567` |
| `{{telnyx_end_user_target}}` | Caller's phone/SIP | `+306901234567` |
| `{{call_control_id}}` | Call control ID | `v3:u5OAKGEPT3Dx8SZSSDRWEMdNH2OripQhO` |
| `{{telnyx_sip_header_diversion}}` | SIP Diversion header | `<sip:bob@example.com>;reason=user-busy` |
| `{{telnyx_sip_header_user_to_user}}` | SIP User-to-User header | base64 encoded |

### Resolution Order (precedence high → low)
1. **Outbound API call** — `AIAssistantDynamicVariables` parameter
2. **Custom SIP Headers** — `X-` prefix headers map to variables (e.g., `X-Full-Name` → `{{full_name}}`)
3. **Dynamic Variables Webhook** — `dynamic_variables_webhook_url` called at conversation start
4. **Default values** — set in assistant builder/API
5. **Unresolved** — remains as raw `{{variable_name}}` text

### Dynamic Variables Webhook

When `dynamic_variables_webhook_url` is set, Telnyx POSTs this at conversation start:

**Telnyx sends:**
```json
{
  "data": {
    "record_type": "event",
    "id": "event_12345678-90ab-cdef-1234-567890abcdef",
    "event_type": "assistant.initialization",
    "occurred_at": "2025-04-07T10:00:00Z",
    "payload": {
      "telnyx_conversation_channel": "phone_call",
      "telnyx_agent_target": "+302101234567",
      "telnyx_end_user_target": "+306901234567",
      "telnyx_end_user_target_verified": false,
      "call_control_id": "v3:...",
      "assistant_id": "assistant_12345678-..."
    }
  }
}
```

> **`telnyx_end_user_target_verified`** = `true` if inbound call has Full (A) STIR/SHAKEN attestation

**Our response (MUST return within 1 second):**
```json
{
  "dynamic_variables": {
    "var_office_name": "Δικηγορικό Γραφείο Παπαδόπουλου",
    "var_specialty": "οικογενειακό δίκαιο",
    "var_hours": "Δευτέρα-Παρασκευή 9:00-17:00",
    "var_customer_id": "cust_abc123"
  },
  "memory": {
    "conversation_query": "metadata->telnyx_end_user_target=eq.+306901234567&limit=5&order=last_message_at.desc"
  },
  "conversation": {
    "metadata": {
      "customer_tier": "premium",
      "preferred_language": "el",
      "timezone": "Europe/Athens"
    }
  }
}
```

All three fields (`dynamic_variables`, `memory`, `conversation`) are **optional**.

> **⚠️ CRITICAL**: Webhook is **signed by Telnyx** — verify signature! (See Section 14)
> **⚠️ TIMEOUT**: Must respond within **1 second** or call proceeds with fallback/defaults.

### Best Practices
- Use `snake_case` for variable names
- **Never** use `telnyx_` prefix (reserved)
- Always set default values as fallback
- Keep webhook response fast (cache data, optimize DB queries)
- Sanitize variable values (no XSS, no SQL injection)

---

## 5. MEMORY (Cross-Conversation Context)

> Allows the assistant to recall past conversations with the same caller.

### How It Works
Memory is configured via the Dynamic Variables Webhook response. The `memory` field specifies which past conversations to include:

```json
{
  "memory": {
    "conversation_query": "metadata->telnyx_end_user_target=eq.+306901234567&limit=5&order=last_message_at.desc",
    "insight_query": "insight_ids=123,456"
  }
}
```

### Query Syntax
Uses PostgREST-style filters (same as the Conversations API):
- `metadata->field_name=eq.value` — exact match
- `metadata->field_name=like.value%` — pattern match
- `limit=5` — max conversations to include
- `order=last_message_at.desc` — sort order

### Insight-Based Memory
Only include specific insight results from past conversations:
```json
{
  "memory": {
    "conversation_query": "metadata->telnyx_end_user_target=eq.+306901234567&limit=5",
    "insight_query": "insight_ids=cfcc865c-d3d4-4823-8a4b-f0df57d9f56f"
  }
}
```

### Custom Metadata
Attach custom metadata to conversations for future filtering:
```json
{
  "conversation": {
    "metadata": {
      "customer_id": "cust_abc123",
      "business_type": "law_office",
      "region": "crete"
    }
  }
}
```
Then query later: `metadata->customer_id=eq.cust_abc123`

### VoiceForge Usage
- Store `customer_id` in conversation metadata
- On each call, query last 5 conversations for that customer's phone number
- Include conversation summary insights for context

---

## 6. VOICE & TRANSCRIPTION SETTINGS

### Voice Settings (TTS)

```json
{
  "voice_settings": {
    "voice": "Azure.el-GR-AthinaNeural",
    "voice_speed": 1,
    "api_key_ref": "my_elevenlabs_key",
    "temperature": 0.5,
    "similarity_boost": 0.75,
    "use_speaker_boost": true,
    "style": 0,
    "speed": 1,
    "language_boost": null,
    "background_audio": {
      "type": "predefined_media",
      "value": "silence"
    }
  }
}
```

**Supported TTS Providers:**

| Provider | Voice Format | Notes |
|----------|-------------|-------|
| **Telnyx** (default) | `Telnyx.KokoroTTS.af` | No extra cost, runs on Telnyx GPUs |
| **AWS Polly** | `AWS.Polly.Joanna` or `AWS.Polly.Joanna-Neural` | Neural for realistic speech |
| **Azure** | `Azure.el-GR-AthinaNeural` | **Best Greek voice available** ← our default |
| **ElevenLabs** | `ElevenLabs.BaseModel.VoiceId` | Requires BYO API key via integration secret. Paid plans only |
| **Vapi** | Vapi provider selection | Requires BYO API key |

**Greek Voices:**
- `Azure.el-GR-AthinaNeural` — Female, Greek (our primary)
- `Azure.el-GR-NestorasNeural` — Male, Greek (alternative)

**Background Audio:**
- Play ambient noise during pauses for natural feel
- Options: `"silence"`, predefined media options, or custom public URL

### Transcription Settings (STT)

```json
{
  "transcription": {
    "model": "deepgram/flux",
    "language": "el",
    "region": "eu",
    "settings": {
      "smart_format": true,
      "numerals": true,
      "eot_threshold": 0.5,
      "eot_timeout_ms": 700,
      "eager_eot_threshold": 0.3
    }
  }
}
```

**Supported STT Models:**

| Model | Notes |
|-------|-------|
| `deepgram/flux` | Default model |
| `deepgram/nova-3` | Latest Deepgram, excellent Greek support |
| `openai/whisper-large-v3-turbo` | Best for multi-lingual |
| `telnyx/whisper` | Telnyx-hosted Whisper |
| Azure STT | Via Azure integration |

**Speaking Plan (End-of-Turn Detection):**

| Setting | Description | Recommended for Greek |
|---------|-------------|---------------------|
| `eot_timeout_ms` | Baseline silence before agent responds | 700ms |
| `eot_threshold` | Confidence threshold for end-of-turn | 0.5 |
| `eager_eot_threshold` | For obvious endpoints (periods, question marks) | 0.3 |
| `smart_format` | Auto-format numbers, dates, etc. | `true` |
| `numerals` | Convert spoken numbers to digits | `true` |

**Speaking Plan Pause Types (Portal only):**
1. **Wait seconds** — baseline response delay (0.3 for snappy, 1.5 for IVR systems)
2. **On punctuation seconds** — after period/question mark (keep low: 0.1)
3. **On no punctuation seconds** — mid-sentence pause (higher: 1.5 to avoid interrupting)
4. **On number seconds** — during digit sequences (1.0 to avoid cutting off)

---

## 7. TELEPHONY SETTINGS

```json
{
  "telephony_settings": {
    "default_texml_app_id": "texml-app-xxx",
    "supports_unauthenticated_web_calls": true,
    "noise_suppression": "krisp",
    "noise_suppression_config": {
      "attenuation_limit": 100,
      "mode": "advanced"
    },
    "time_limit_secs": 1800,
    "user_idle_timeout_secs": 7215,
    "voicemail_detection": {
      "on_voicemail_detected": {
        "action": "stop_assistant",
        "voicemail_message": {
          "type": "prompt",
          "prompt": "Leave a brief message after the beep",
          "message": "Specific voicemail text"
        }
      }
    },
    "recording_settings": {
      "channels": "dual",
      "format": "mp3"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `default_texml_app_id` | string | TeXML app for outbound calls |
| `supports_unauthenticated_web_calls` | boolean | Allow web widget calls without auth |
| `noise_suppression` | `"krisp"` | Krisp AI noise cancellation |
| `time_limit_secs` | integer | Max call duration (default: 1800 = 30 min) |
| `user_idle_timeout_secs` | integer | Hang up if user is idle (default: 7215 = ~2hr) |
| `voicemail_detection` | object | Action when voicemail detected on outbound |
| `recording_settings` | object | `dual` channels, `mp3` format |

**Voicemail Detection Actions:**
- `stop_assistant` — stop the assistant (normal behavior)
- With `voicemail_message` — leave a message before stopping

---

## 8. TOOLS — Webhooks, Handoff, Transfer, DTMF

### Available Tool Types

| Type | Purpose |
|------|---------|
| `webhook` | Call external API during conversation |
| `hangup` | End the call |
| `handoff` | Transfer to another AI assistant |
| `transfer` | Transfer call to phone number |
| `sip_refer` | Transfer via SIP REFER |
| `dtmf` | Send touch-tone signals (for IVR navigation) |
| `send_message` | Send SMS/MMS during call |
| `skip_turn` | Skip assistant's turn to speak |
| `retrieval` | Query knowledge base |

### Webhook Tool (Our Primary Tool)

```json
{
  "type": "webhook",
  "webhook": {
    "name": "check_availability",
    "description": "Ελέγχει διαθέσιμα ραντεβού στο ημερολόγιο",
    "url": "https://api.voiceforge.ai/tools/calendar/check",
    "method": "POST",
    "headers": [
      { "name": "Authorization", "value": "Bearer {{api_secret}}" }
    ],
    "body_parameters": {
      "type": "object",
      "properties": {
        "requested_date": {
          "type": "string",
          "description": "Ημερομηνία σε μορφή YYYY-MM-DD"
        },
        "service_type": {
          "type": "string",
          "description": "Τύπος ραντεβού"
        }
      },
      "required": ["requested_date"]
    },
    "path_parameters": {
      "properties": { "id": { "type": "string" } },
      "required": ["id"]
    },
    "query_parameters": {
      "properties": { "page": { "type": "integer" } }
    },
    "async": false,
    "timeout_ms": 5250
  }
}
```

**Key fields:**
| Field | Default | Notes |
|-------|---------|-------|
| `async` | `false` | If `true`, assistant doesn't wait for response (see Section 9) |
| `timeout_ms` | `5250` | Max wait time for webhook response |
| `method` | `"POST"` | HTTP method |
| `headers` | [] | Can include dynamic variables! |

> **Dynamic variables work in webhook URLs, descriptions, and header values!**

### Transfer Tool
```json
{
  "type": "transfer",
  "transfer": {
    "targets": [
      { "name": "Reception", "number": "+302101234567" },
      { "name": "Emergency", "number": "+306901234567" }
    ]
  }
}
```

### Hangup Tool
```json
{ "type": "hangup" }
```
Always include this — lets the agent end calls naturally.

---

## 9. ASYNC TOOLS & ADD MESSAGES API

> **Game-changer**: Agent continues talking while slow operations (DB queries, external APIs) run in background.

### Async Webhook
Set `"async": true` in webhook config:
```json
{
  "type": "webhook",
  "webhook": {
    "name": "lookup_order_status",
    "description": "Async order lookup. Results delivered automatically.",
    "url": "https://api.voiceforge.ai/tools/order/lookup",
    "method": "POST",
    "async": true,
    "body_parameters": { ... }
  }
}
```

**What your backend receives:**
```
POST /tools/order/lookup HTTP/1.1
Content-Type: application/json
x-telnyx-call-control-id: v3:abc123def456...   ← CRITICAL: needed to inject results

{ "order_id": "ORD-12345" }
```

### Add Messages API (Inject Context Mid-Call)

```
POST /v2/calls/{call_control_id}/actions/ai_assistant_add_messages
```

```typescript
// After your slow operation completes:
await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/ai_assistant_add_messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TELNYX_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: '[CALENDAR CHECK COMPLETE]\nAvailable slots for 2026-03-05: 10:00, 11:30, 15:00\nShare this with the caller.'
      }
    ]
  })
});
```

**Message roles:**
| Role | Use |
|------|-----|
| `system` | Instructions/context (recommended for async results) |
| `user` | Simulate user input |
| `assistant` | Inject assistant responses |

**Standalone use cases (without async webhooks):**
- Supervisor intervention during difficult call
- Scheduled reminders to active call
- CRM/ticketing system pushes updates
- Monitoring system detects frustration → injects de-escalation guidance

### Combined Pattern
1. Agent triggers async webhook → continues chatting
2. Backend processes (5-30 seconds)
3. Backend calls Add Messages API with results
4. Agent naturally incorporates: *"Βρήκα τα αποτελέσματα!"*

**Multiple parallel lookups work!** Each completes independently.

---

## 10. PHONE NUMBERS — SEARCH & ORDER

### Search Available Numbers
```
GET /v2/available_phone_numbers
```

**SDK:**
```typescript
const numbers = await client.availablePhoneNumbers.list({
  'filter[country_code]': 'GR',
  'filter[features][]': 'voice',
  'filter[phone_number_type]': 'local',
  'filter[limit]': 20
});

console.log(numbers.data);
// [{
//   record_type: "available_phone_number",
//   phone_number: "+302101234567",
//   best_effort: false,
//   quickship: true,
//   reservable: true,
//   region_information: [{ region_type: "country_code", region_name: "GR" }],
//   cost_information: { upfront_cost: "3.21", monthly_cost: "6.54", currency: "USD" },
//   features: [{ name: "voice" }]
// }]
```

**Filter parameters:**
| Filter | Description |
|--------|-------------|
| `filter[country_code]` | `GR` for Greece |
| `filter[phone_number_type]` | `local`, `toll_free`, `national` |
| `filter[features][]` | `voice`, `sms`, `mms` |
| `filter[locality]` | City name |
| `filter[national_destination_code]` | Area code (e.g., `210` for Athens) |
| `filter[phone_number]` | Specific number pattern |
| `filter[limit]` | Results per page |
| `filter[best_effort]` | Include best-effort numbers |
| `filter[quickship]` | Only fast-activation numbers |
| `filter[reservable]` | Only reservable numbers |

### Create a Number Order (Purchase)
```
POST /v2/number_orders
```

**SDK:**
```typescript
const order = await client.numberOrders.create({
  phone_numbers: [{ phone_number: '+302101234567' }],
  connection_id: 'texml-app-id', // Optional: assign to connection immediately
});

console.log(order.data);
// {
//   id: "12ade33a-...",
//   status: "pending" | "success",
//   phone_numbers: [{
//     phone_number: "+302101234567",
//     status: "success",
//     requirements_met: true
//   }]
// }
```

**Order Statuses:**
| Status | Meaning |
|--------|---------|
| `pending` | Being processed, numbers not yet active |
| `success` | Completed, numbers active |
| `failure` | Issue with order |
| `cancelled` | Cancelled by user or Telnyx |

### Greek Numbers — Regulatory Requirements
> ⚠️ Greek numbers may have **regulatory requirements** (address, business registration).
> These are handled via sub-number orders and the requirement groups API.
> Check `requirements_met` in order response — if `false`, additional docs needed.

### Assign Number to Assistant
Numbers are assigned to assistants via the assistant's telephony configuration in the portal, or by setting the `connection_id` when ordering.

---

## 11. INTEGRATION SECRETS (BYO Keys)

> Securely store third-party API keys (OpenAI, ElevenLabs) for use in assistants.

### Create a Secret
```
POST /v2/integration_secrets
```

**SDK:**
```typescript
const secret = await client.integrationSecrets.create({
  identifier: 'customer_openai_key',  // memorable name
  type: 'bearer',                     // 'bearer' or 'basic'
  token: 'sk-proj-...',              // the actual API key
});

console.log(secret.data);
// { id: "...", identifier: "customer_openai_key", created_at: "..." }
```

**Types:**
| Type | Fields | Use Case |
|------|--------|----------|
| `bearer` | `token` | OpenAI, ElevenLabs, Vapi API keys |
| `basic` | `username`, `password` | Basic auth integrations |

### Usage in Assistant
Reference by `identifier`:
```json
{
  "llm_api_key_ref": "customer_openai_key",
  "voice_settings": {
    "api_key_ref": "customer_elevenlabs_key"
  }
}
```

### List Secrets
```
GET /v2/integration_secrets
```

### Delete a Secret
```
DELETE /v2/integration_secrets/{id}
```

> ⚠️ **Cannot read back secret values** — only identifiers are returned after creation.

---

## 12. CONVERSATIONS API

> Retrieve conversation history, transcripts, and metadata.

### List Conversations
```
GET /v2/ai/conversations
```

**SDK:**
```typescript
const conversations = await client.ai.conversations.list({
  'metadata->assistant_id': 'eq.assistant-123',
  'metadata->telnyx_end_user_target': 'eq.+306901234567',
  'limit': 10,
  'order': 'last_message_at.desc'
});
```

**Filter parameters (PostgREST syntax):**
| Filter | Example |
|--------|---------|
| `id` | `id=eq.conversation-123` |
| `name` | `name=like.Voice%` |
| `created_at` | `created_at=gte.2025-01-01` |
| `last_message_at` | `last_message_at=lte.2025-06-01` |
| `metadata->assistant_id` | `metadata->assistant_id=eq.assistant-123` |
| `metadata->call_control_id` | `metadata->call_control_id=eq.v3:123` |
| `metadata->telnyx_agent_target` | `metadata->telnyx_agent_target=eq.+302101234567` |
| `metadata->telnyx_end_user_target` | `metadata->telnyx_end_user_target=eq.+306901234567` |
| `metadata->telnyx_conversation_channel` | `metadata->telnyx_conversation_channel=eq.phone_call` |
| `limit` | `limit=10` |
| `order` | `order=created_at.desc` or `order=last_message_at.asc` |
| `or` | `or=(created_at.gte.2025-04-01,last_message_at.gte.2025-04-01)` |

**Response:**
```json
{
  "data": [{
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "created_at": "2025-04-15T13:07:28.764Z",
    "metadata": {
      "telnyx_conversation_channel": "phone_call",
      "telnyx_agent_target": "+302101234567",
      "telnyx_end_user_target": "+306901234567",
      "assistant_id": "assistant-123"
    },
    "last_message_at": "2025-04-15T13:07:28.764Z",
    "name": ""
  }]
}
```

> **Custom metadata filtering**: You can filter on ANY custom metadata field:
> `metadata->customer_id=eq.cust_abc123`

### Create a Conversation
```
POST /v2/ai/conversations
```

---

## 13. AI INSIGHTS (Post-Call Analytics)

> Automatically analyze every conversation after it ends. Sentiment, summaries, categorization.

### Architecture
1. **Insights** — Individual analysis prompts (e.g., "Summarize the call", "Rate sentiment 1-5")
2. **Insight Groups** — Collections of insights assigned to assistants
3. **Webhook Delivery** — Results POSTed to your URL after generation

### Creating Insights (Portal)
Navigate to: `portal.telnyx.com` → AI → AI Insights

**Example Instructions:**

**Conversation Summary:**
```
Summarize the conversation for use as future context. Include:
- Key facts mentioned
- Decisions made
- User preferences expressed
- Action items or follow-ups needed
Keep the summary concise (2-3 sentences).
```

**Sentiment Analysis:**
```
Measure the positivity & negativity of the call and rate it from 1-5.
Positivity: (1=very negative, 5=very positive)
Negativity: (1=no negativity, 5=very negative)
Provide ratings and a brief explanation.
```

**Issue Categorization:**
```
Categorize into: Technical Support, Billing Question, Feature Request, General Inquiry, Complaint, Other.
Provide a brief description of the specific issue.
```

### Structured Insights (JSON Schema)
Can define structured output schemas for consistent data extraction.
See: `developers.telnyx.com/docs/inference/ai-insights/structured-insights`

### Configuring Webhook Delivery
1. Create an Insight Group with a webhook URL
2. Assign the group to your assistant's `insight_settings`

```json
{
  "insight_settings": {
    "insight_group_id": "group-xxx"
  }
}
```

Webhook URL set on the Insight Group (or per-assistant override).

### Variables in Insights
Can use `{{telnyx_current_time}}`, `{{telnyx_conversation_channel}}`, `{{telnyx_end_user_target}}`, and custom dynamic variables.

### VoiceForge Usage
- Create insight group: "VoiceForge Default"
  - Insight 1: Call Summary (2-3 sentences, Greek)
  - Insight 2: Sentiment Score (1-5)
  - Insight 3: Appointment Booked (yes/no + details)
  - Insight 4: Issue Category
- Webhook delivers to our `/webhooks/telnyx/insights` endpoint
- We store, notify customer, update dashboard

---

## 14. WEBHOOK FUNDAMENTALS & SECURITY

### Universal Behavior
- Webhooks delivered to primary URL, fallback to failover URL
- Must return **2xx** status code to acknowledge
- **2-second timeout** — then retry with exponential backoff
- **No guaranteed order** — events may arrive out of sequence
- **Possible duplicates** — implement idempotency

### Webhook Signing
Telnyx signs all webhooks using **Ed25519 public key encryption**.

**Headers sent:**
| Header | Content |
|--------|---------|
| `telnyx-signature-ed25519` | Base64-encoded signature |
| `telnyx-timestamp` | Unix timestamp |

**Signature calculation:**
```
signature = Base64.encode(sign(privateKey, "${timestamp}|${jsonPayload}"))
```

**Verification:**
1. Get public key from `portal.telnyx.com/#/api-keys/public-key`
2. Reconstruct signed string: `${telnyx-timestamp}|${rawBody}`
3. Verify Ed25519 signature using public key
4. Check timestamp is recent (prevent replay attacks)

**The Node.js SDK provides webhook verification utilities.**

### Webhook Payload Structure

**AI Assistant events (dynamic variables webhook):**
```json
{
  "data": {
    "record_type": "event",
    "id": "event_xxx",
    "event_type": "assistant.initialization",
    "occurred_at": "2025-04-07T10:00:00Z",
    "payload": { ... }
  }
}
```

**Voice API events:**
```json
{
  "call_leg_id": "...",
  "call_session_id": "...",
  "event_timestamp": "...",
  "metadata": {
    "event": {
      "event_type": "call.answered",
      "id": "...",
      "payload": { ... }
    }
  },
  "name": "call.answered"
}
```

### Expected Webhook Events for AI Assistants
| Event | When |
|-------|------|
| `assistant.initialization` | Call starts → dynamic variables webhook |
| `call.conversation.ended` | Conversation ends |
| `call.conversation_insights.generated` | Insights ready after call |

### Best Practices
- Return 2xx immediately, process async
- Implement idempotency (track processed event IDs)
- Verify webhook signatures
- Log all events for debugging
- Handle duplicates gracefully

---

## 15. OUTBOUND CALLS

### Via TeXML AI Calls Endpoint
```
POST /v2/texml/ai_calls/{texml_app_id}
```

```bash
curl --request POST \
  --url "https://api.telnyx.com/v2/texml/ai_calls/${TEXML_APP_ID}" \
  --header "Authorization: Bearer $TELNYX_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "From": "+302101234567",
    "To": "+306901234567",
    "AIAssistantId": "assistant-6207ab25-b185-478f-b2ef-85159e226727",
    "AIAssistantDynamicVariables": {
      "full_name": "Γιώργος Παπαδόπουλος",
      "appointment_date": "2026-03-05"
    }
  }'
```

**With Voicemail Detection (AMD):**
```json
{
  "From": "+302101234567",
  "To": "+306901234567",
  "AIAssistantId": "assistant-xxx",
  "MachineDetection": "Enable",
  "AsyncAmd": true,
  "DetectionMode": "Premium"
}
```

---

## 16. START AI ASSISTANT (Call Control)

> For programmatic voice applications — start an AI assistant on an existing call.

```
POST /v2/calls/{call_control_id}/actions/ai_assistant_start
```

**SDK:**
```typescript
const response = await client.calls.actions.startAIAssistant('call_control_id', {
  assistant: {
    // inline assistant config or reference
  },
  voice: "Azure.el-GR-AthinaNeural",
  greeting: "Γεια σας! Πώς μπορώ να σας βοηθήσω;",
  transcription: {
    model: "deepgram/nova-3",
    language: "el"
  },
  command_id: "891510ac-f3e4-11e8-af5b-de00688a4901" // idempotency
});

console.log(response.data);
// { result: "ok", conversation_id: "d7e9c1d4-..." }
```

**Expected webhooks after:**
- `call.conversation.ended`
- `call.conversation_insights.generated`

### Stop AI Assistant
```
POST /v2/calls/{call_control_id}/actions/ai_assistant_stop
```

---

## 17. AGENT HANDOFF

> Transfer between specialized AI assistants while preserving full context.

### Two Modes

| Mode | Experience | Use Case |
|------|-----------|----------|
| **Unified** (default) | Same voice, seamless transition | Consistent brand experience |
| **Distinct** | Different voices, explicit transfer | Highlight specialist expertise |

### Configuration via API
```json
{
  "tools": [{
    "type": "handoff",
    "handoff": {
      "voice_mode": "unified",
      "ai_assistants": [
        { "name": "Technical Support", "id": "asst_tech_abc123" },
        { "name": "Billing Support", "id": "asst_billing_def456" }
      ]
    }
  }]
}
```

### Best Practices
- Define clear responsibility boundaries
- Limit handoff depth (max 3-4 in chain)
- Test for handoff loops
- Use dynamic variables to pass context
- Configure memory for all agents in chain

### Agent Handoff is Model-Agnostic
Works with any model: OpenAI GPT, Meta Llama, Anthropic Claude, Qwen, DeepSeek, etc. Each agent in the chain can use a **different** model.

---

## 18. EMBEDDABLE WIDGET

Web-based voice/chat widget for customer websites.

Configured via `widget_settings`:
```json
{
  "widget_settings": {
    "theme": "light",
    "audio_visualizer_config": {
      "color": "verdant",
      "preset": "default"
    },
    "start_call_text": "Κάλεσε τον βοηθό",
    "default_state": "expanded",
    "position": "fixed",
    "logo_icon_url": "https://voiceforge.ai/logo.png"
  }
}
```

Embeddable via code snippet from the portal's Widget tab.

---

## 19. KNOWLEDGE BASES (RAG)

> Upload documents or provide URLs for the assistant to retrieve context from.

### Via Portal
1. Navigate to AI Assistants → Knowledge Bases tab
2. Create a knowledge base with a name
3. Upload files (PDF, docs) or provide URLs
4. Assign to assistant

### Via API
Use the `retrieval` tool type:
```json
{
  "type": "retrieval",
  "retrieval": {
    "knowledge_base_ids": ["kb-xxx"]
  }
}
```

---

## 20. NODE.JS SDK REFERENCE

### Key Methods We Use

```typescript
import Telnyx from 'telnyx';
const client = new Telnyx({ apiKey: process.env.TELNYX_API_KEY });

// ── MANAGED ACCOUNTS ──────────────────────────────────────
await client.managedAccounts.create({ business_name: "..." });
await client.managedAccounts.list();
// Note: For sub-account operations, create a NEW client with sub-account API key:
const subClient = new Telnyx({ apiKey: subAccountApiKey });

// ── AI ASSISTANTS ─────────────────────────────────────────
await client.ai.assistants.create({ name, model, instructions, ... });
await client.ai.assistants.list();
await client.ai.assistants.retrieve('assistant-id');
await client.ai.assistants.update('assistant-id', { ... });
await client.ai.assistants.delete('assistant-id');

// ── PHONE NUMBERS ─────────────────────────────────────────
await client.availablePhoneNumbers.list({ 'filter[country_code]': 'GR' });
await client.numberOrders.create({ phone_numbers: [{ phone_number: '+30...' }] });

// ── INTEGRATION SECRETS ───────────────────────────────────
await client.integrationSecrets.create({ identifier: 'key', type: 'bearer', token: '...' });
await client.integrationSecrets.list();
await client.integrationSecrets.delete('secret-id');

// ── CONVERSATIONS ─────────────────────────────────────────
await client.ai.conversations.list({ 'metadata->assistant_id': 'eq.asst-123' });

// ── CALL COMMANDS ─────────────────────────────────────────
await client.calls.actions.startAIAssistant('call_control_id', { ... });
// Note: Add Messages is raw HTTP (not yet in SDK as of v5.37):
// POST /v2/calls/{id}/actions/ai_assistant_add_messages
```

### Auto-Pagination
```typescript
for await (const account of client.managedAccounts.list()) {
  console.log(account.id);
}
```

### Raw Response Access
```typescript
const { data, response: raw } = await client.ai.assistants.create({ ... }).withResponse();
console.log(raw.headers.get('X-Request-Id'));
```

---

## 21. KEY LIMITS, TIMEOUTS & GOTCHAS

### Hard Limits
| Item | Limit | Notes |
|------|-------|-------|
| Dynamic variables webhook timeout | **1 second** | If exceeded, call proceeds with defaults |
| Sync webhook tool timeout | **5250ms** (configurable via `timeout_ms`) | Agent waits, then proceeds |
| Webhook response acknowledgment | **2 seconds** | Must return 2xx |
| Max call duration | 1800 seconds (30 min, configurable) | `telephony_settings.time_limit_secs` |
| Managed accounts | Up to 1000 | Per manager account |
| Greeting character limit | 3000 chars | For `Start AI Assistant` command |
| Number order deadline | Auto-cancellation | If regulatory docs not provided in time |

### Critical Gotchas

1. **`rollup_billing` is IRREVERSIBLE** — Cannot change after managed account creation without Telnyx support
2. **Managed Accounts must be approved** — Not automatic, requires Telnyx support request + Level 2 verification
3. **Free-tier LLM/TTS keys don't work** — ElevenLabs and OpenAI require paid plans for integration
4. **Greek number regulatory requirements** — May need business registration docs for +30 numbers
5. **Webhook signature verification is CRITICAL** — Dynamic variables webhook is signed by Telnyx, always verify
6. **Sub-account API key isolation** — Each CRUD operation for a customer must use THEIR api_key, not the master
7. **Memory requires conversation metadata** — Set metadata in dynamic variables webhook for future querying
8. **STT model for multi-lingual** — Use `openai/whisper-large-v3-turbo` for best multi-lingual support
9. **`promote_to_main` default is true** — Every update creates a new version, promoted by default
10. **Events may be duplicated** — Implement idempotency for all webhook handlers

### Rate Limits
Not explicitly documented per endpoint. SDK auto-retries on 429 (rate limit). Use `maxRetries` config.

---

## API ENDPOINTS CHEAT SHEET

| Action | Method | Endpoint |
|--------|--------|----------|
| Create managed account | POST | `/v2/managed_accounts` |
| List managed accounts | GET | `/v2/managed_accounts` |
| Create assistant | POST | `/v2/ai/assistants` |
| List assistants | GET | `/v2/ai/assistants` |
| Get assistant | GET | `/v2/ai/assistants/{id}` |
| Update assistant | POST | `/v2/ai/assistants/{id}` |
| Delete assistant | DELETE | `/v2/ai/assistants/{id}` |
| Search available numbers | GET | `/v2/available_phone_numbers` |
| Create number order | POST | `/v2/number_orders` |
| List conversations | GET | `/v2/ai/conversations` |
| Create integration secret | POST | `/v2/integration_secrets` |
| List integration secrets | GET | `/v2/integration_secrets` |
| Start AI assistant on call | POST | `/v2/calls/{id}/actions/ai_assistant_start` |
| Stop AI assistant | POST | `/v2/calls/{id}/actions/ai_assistant_stop` |
| Add messages to call | POST | `/v2/calls/{id}/actions/ai_assistant_add_messages` |
| Outbound AI call | POST | `/v2/texml/ai_calls/{app_id}` |

---

## VOICEFORGE-SPECIFIC FLOW SUMMARY

```
1. Customer registers on VoiceForge
   └─→ POST /v2/managed_accounts → store id + api_key (encrypted)

2. Customer completes wizard (selects industry, voice, number)
   └─→ Using sub-account api_key:
       ├─→ POST /v2/integration_secrets (if BYO OpenAI/ElevenLabs key)
       ├─→ POST /v2/ai/assistants (create agent with tools + dynamic vars webhook)
       ├─→ POST /v2/number_orders (purchase +30 Greek number)
       └─→ Assign number to assistant (via portal config or connection_id)

3. Inbound call to +30 number
   └─→ Telnyx routes to AI Assistant
       ├─→ Telnyx POSTs to our dynamic_variables_webhook_url
       │   └─→ We return: office_name, hours, customer_id, memory query
       ├─→ Agent answers in Greek with personalized greeting
       ├─→ Agent uses webhook tools (check calendar, book appointment)
       └─→ Agent hangs up

4. Post-call
   └─→ Telnyx generates insights (summary, sentiment, booking status)
       └─→ Insight webhook → our /webhooks/telnyx/insights
           ├─→ Store call record + transcript
           ├─→ Push notification to customer
           └─→ Update dashboard
```

---

*Telnyx API Complete Reference — VoiceForge AI | Panos Skouras | Feb 2026*
*Sources: developers.telnyx.com, npmjs.com/package/telnyx*
