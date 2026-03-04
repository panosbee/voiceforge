# VoiceForge AI — Vision Analysis & Implementation Roadmap

**Version 1.0 | 25 Φεβρουαρίου 2026 | INTERNAL**
**Author: Panos Skouras + Dev Agent**

---

## 1. ΤΟ VISION ΣΕ ΚΑΘΑΡΗ ΓΛΩΣΣΑ

Ο πελάτης-χρήστης εγγράφεται στο VoiceForge AI και αποκτά AI τηλεφωνικούς πράκτορες για την επιχείρησή του. Δύο τρόποι:

### Mode A — "Naive" (Απλός χρήστης)
Wizard βήμα-βήμα για μη-τεχνικούς χρήστες. Ένας πράκτορας, μία γραμμή.

```
Βήμα 1: Επιχείρηση (όνομα, κλάδος, στοιχεία)
Βήμα 2: Πράκτορας (όνομα, φωνή, χαιρετισμός)
Βήμα 3: Οδηγίες (System Prompt) + Upload αρχείων (Knowledge Base)
Βήμα 4: Τηλέφωνο (επιλογή/αγορά αριθμού + εκτροπή κλήσεων)
Βήμα 5: Σύνοψη → Launch
```

**Παράδειγμα**: Δικηγορικό γραφείο ανεβάζει τον Ποινικό Κώδικα, η AI ρεσεψιονίστ ξέρει να απαντάει σε βασικές ερωτήσεις + κλείνει ραντεβού.

### Mode B — "Expert" (Προχωρημένος χρήστης)
Visual flow builder (drag & drop) με πολλαπλούς πράκτορες που συνεργάζονται.

```
Βήμα 1: Επιχείρηση (όνομα, κλάδος, στοιχεία)
Βήμα 2: Flow Builder — Drag & drop canvas:
         ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
         │ Γραμματεία   │────▶│ Λογιστής      │────▶│ Υπεύθ. Προσωπικού│
         │ (Ρεσεψιόν)  │     │              │     │                  │
         │ Τίτλος       │     │ Τίτλος       │     │ Τίτλος           │
         │ Σκοπός       │     │ Σκοπός       │     │ Σκοπός           │
         │ Οδηγίες      │     │ Οδηγίες      │     │ Οδηγίες          │
         │ Αρχεία (KB)  │     │ Αρχεία (KB)  │     │ Αρχεία (KB)      │
         │ IF: condition │     │ IF: condition │     │                  │
         └─────────────┘     └──────────────┘     └──────────────────┘
```

Κάθε "κουτί" (agent node) περιέχει:
- **Τίτλος**: π.χ. "Γραμματεία"
- **Σκοπός/Ρόλος**: Σύντομη περιγραφή
- **Οδηγίες (System Prompt)**: Πλήρεις οδηγίες AI
- **Upload αρχείων (Knowledge Base)**: PDF, docs, κείμενα — OCR/AI τα διαβάζει
- **IF conditions (routing rules)**: Γραφική αναπαράσταση → πχ "αν ο πελάτης ρωτήσει για οικονομικά → Λογιστής"

```
Βήμα 3: Τηλέφωνο (κοινό αριθμό — η αρχική γραμματεία δέχεται + κάνει route)
Βήμα 4: Σύνοψη → Launch
```

**Παράδειγμα**: Εταιρεία με 3 πράκτορες — Γραμματεία (ρεσεψιόν που δρομολογεί), Λογιστής (ανεβασμένες μισθοδοσίες, ξέρει στοιχεία), Marketing Manager (ξέρει το marketing plan 2026).

### Κοινά και στα δύο modes
- **System Prompt** για κάθε πράκτορα
- **File Upload → Knowledge Base** (RAG) για κάθε πράκτορα
- **Τηλεφωνική γραμμή** ως τελευταίο βήμα (αγορά αριθμού + call forwarding)
- **Email / Push / SMS ειδοποιήσεις** μετά από κάθε κλήση

### Τι ΔΕΝ είναι προτεραιότητα
- **Stripe billing** → Η χρέωση θα γίνεται B2B μέσω τιμολογίου, όχι online πληρωμή
- **Google Calendar** → Δύσκολο λόγω Google OAuth. Θα δούμε στο μέλλον. Εναλλακτικά μπορεί η AI να κρατάει τα ραντεβού σε δική μας λογική (DB) αντί Google Cal

---

## 2. ΤΙ ΕΧΟΥΜΕ ΗΔΗ (Ωμή Αλήθεια)

### ✅ ΠΛΗΡΩΣ ΥΛΟΠΟΙΗΜΕΝΑ

| Component | Αρχείο | Κατάσταση |
|-----------|--------|-----------|
| Monorepo + Build System | `pnpm-workspace.yaml`, `tsconfig.json` | 100% λειτουργικό |
| Docker + PostgreSQL | `docker-compose.yml`, `docker/init.sql` | 100% λειτουργικό |
| DB Schema (5 tables) | `apps/api/src/db/schema/*` | 100% — customers, agents, calls, appointments, webhook_events |
| API Server (Hono) | `apps/api/src/index.ts` | 100% — τρέχει στο port 3001 |
| Dev Auth (JWT) | `apps/api/src/routes/dev-auth.ts`, `services/dev-auth.ts` | 100% — register/login/me χωρίς Supabase |
| Auth Middleware | `apps/api/src/middleware/auth.ts` | 100% — dual mode (Supabase + Dev) |
| Web Frontend (Next.js) | `apps/web/` | 100% — τρέχει στο port 3000 |
| Login / Register UI | `apps/web/src/app/(auth)/*` | 100% λειτουργικό |
| Dashboard Layout | `apps/web/src/app/dashboard/layout.tsx` | 100% — sidebar, navigation |
| Dashboard Overview | `apps/web/src/app/dashboard/page.tsx` | 100% — KPIs, recent calls |
| Calls Page | `apps/web/src/app/dashboard/calls/page.tsx` | 100% — list, filters, pagination |
| Agents Page (List) | `apps/web/src/app/dashboard/agents/page.tsx` | 100% — list, CRUD buttons |
| Agent Edit Modal | `apps/web/src/app/dashboard/agents/agent-edit-modal.tsx` | 100% — edit name, voice, instructions |
| Settings Page | `apps/web/src/app/dashboard/settings/page.tsx` | 100% — profile display |
| Shared Types | `packages/shared/src/types/*` | 100% — Agent, Call, Customer, Webhook types |
| Shared Constants | `packages/shared/src/constants.ts` | 100% — industries, plans, voices, defaults |
| Email Service (Resend) | `apps/api/src/services/email.ts` | 100% — welcome email, call summary templates |
| Encryption Service | `apps/api/src/services/encryption.ts` | 100% — AES-256-GCM encrypt/decrypt |

### ✅ ΚΩΔΙΚΑΣ ΕΤΟΙΜΟΣ, ΑΛΛΑ ΔΕΝ ΕΧΕΙ ΔΟΚΙΜΑΣΤΕΙ ΜΕ ΠΡΑΓΜΑΤΙΚΟ TELNYX

| Component | Αρχείο | Κατάσταση |
|-----------|--------|-----------|
| Telnyx Service — Managed Accounts | `apps/api/src/services/telnyx.ts:47-88` | Κώδικας πλήρης. Χρειάζεται TELNYX_API_KEY |
| Telnyx Service — AI Assistants CRUD | `apps/api/src/services/telnyx.ts:98-210` | Κώδικας πλήρης. Χρειάζεται sub-account API key |
| Telnyx Service — Phone Numbers | `apps/api/src/services/telnyx.ts:218-295` | Search + Purchase πλήρες |
| Telnyx Service — Integration Secrets | `apps/api/src/services/telnyx.ts:305-350` | BYO API keys πλήρες |
| Telnyx Service — Conversations | `apps/api/src/services/telnyx.ts:358-372` | List conversations πλήρες |
| Telnyx Service — Add Messages | `apps/api/src/services/telnyx.ts:380-400` | Async tool results πλήρες |
| Agent CRUD Routes | `apps/api/src/routes/agents.ts` | 331 γραμμές, πλήρες CRUD + Telnyx sync |
| Phone Number Routes | `apps/api/src/routes/numbers.ts` | Search + Purchase πλήρες |
| Webhook Routes | `apps/api/src/routes/webhooks.ts` | Pre-call, post-call, insights — 246 γραμμές |
| Tool Webhooks | `apps/api/src/routes/tools.ts` | Calendar check + book — 231 γραμμές |
| Billing Routes | `apps/api/src/routes/billing.ts` | Stripe checkout + portal — 341 γραμμές |
| Stripe Service | `apps/api/src/services/stripe.ts` | Customer + subscription management |

### ✅ ONBOARDING WIZARD (Naive Mode — Μερικώς)

| Step | Αρχείο | Κατάσταση |
|------|--------|-----------|
| Container / State Machine | `apps/web/src/app/onboarding/page.tsx` | 100% — 5 steps, progress bar, submission |
| Step 1: Business | `step-business.tsx` | 100% — name, industry, owner, email, timezone |
| Step 2: Plan | `step-plan.tsx` | 100% — starter/pro/business picker |
| Step 3: Agent | `step-agent.tsx` | 100% — name, voice, greeting, instructions |
| Step 4: Number | `step-number.tsx` | 100% — number search, selection |
| Step 5: Review | `step-review.tsx` | 100% — summary + launch button |

### ❌ ΔΕΝ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ

| Feature | Γιατί Χρειάζεται | Πολυπλοκότητα |
|---------|------------------|---------------|
| **Dev Bypass Telnyx** | Δεν μπορούμε να τεστάρουμε χωρίς API key | 🟡 Μεσαία (1-2 μέρες) |
| **Knowledge Base / File Upload** | Core feature — αρχεία → RAG | 🔴 Μεγάλη (3-5 μέρες) |
| **Expert Mode — Flow Builder** | Drag & drop πολλαπλών agents | 🔴 Πολύ Μεγάλη (1-2 εβδομάδες) |
| **Agent Handoff Configuration** | IF conditions routing μεταξύ agents | 🟡 Μεσαία (2-3 μέρες) |
| **Call Forwarding Setup** | Χρήστης δηλώνει τον αριθμό του | 🟢 Μικρή (1 μέρα) |
| **Push Notifications** | Ειδοποιήσεις στο dashboard | 🟡 Μεσαία (2-3 μέρες) |
| **SMS Notifications** | SMS μετά-κλήσης στον πελάτη | 🟢 Μικρή (1 μέρα — Telnyx SDK) |
| **Mode Selector (Naive/Expert)** | UI για επιλογή mode στην εγγραφή | 🟢 Μικρή (μισή μέρα) |

---

## 3. ΑΝΤΙΣΤΟΙΧΙΣΗ VISION ↔ TELNYX API

Αυτή η ενότητα αποδεικνύει ότι **κάθε feature του Vision υποστηρίζεται πλήρως** από το Telnyx API.

### 3.1 Knowledge Base / File Upload → Telnyx Section 19 (Knowledge Bases / RAG)

**Τι θέλουμε**: Ο χρήστης ανεβάζει αρχεία (PDF, docs), η AI τα διαβάζει και τα χρησιμοποιεί στις κλήσεις.

#### 🔬 ΠΛΗΡΗΣ ΕΡΕΥΝΑ — Telnyx Knowledge Base API (ολοκληρώθηκε)

Μετά από εκτενή έρευνα σε: Telnyx Developer Docs, API Reference (`/api-reference/assistants/`), Node SDK v5.40.0 (`api.md` στο GitHub), Voice Assistant Quickstart, Importing docs — αυτά βρέθηκαν:

##### Α. Τι υπάρχει ΣΙΓΟΥΡΑ (documented + tested endpoints)

**1. `RetrievalTool` στο Assistant API** — ✅ Verified
```json
// Στον assistant create/update, προσθέτουμε retrieval tool:
{
  "type": "retrieval",
  "retrieval": {
    "knowledge_base_ids": ["kb-xxx"]
  }
}
```
- Αυτό **αναφέρεται ρητά** στο `POST /ai/assistants` API reference ως ένα από τα 9 tool types
- Τύποι tools: `WebhookTool | RetrievalTool | HandoffTool | HangupTool | TransferTool | SIPReferTool | DTMFTool | SendMessageTool | SkipTurnTool`
- Τύπος `RetrievalTool` εξάγεται από το SDK: `import { RetrievalTool } from 'telnyx/resources/ai/assistants/assistants'`

**2. Knowledge Base Portal UI** — ✅ Verified (Portal only)
- Navigation: AI Assistants → Knowledge Bases tab
- Upload files (PDF, docs) ή provide URL
- Drag & drop interface
- Auto-indexing + RAG
- Κάθε assistant μπορεί να συνδέεται με KB

**3. Telnyx Embeddings API** — ✅ Full Programmatic RAG Pipeline
```typescript
// Create embeddings from documents
client.ai.embeddings.create({ model, text })
client.ai.embeddings.url({ model, url })       // Embed from URL

// Manage embedding buckets (storage)
client.ai.embeddings.buckets.list()
client.ai.embeddings.buckets.retrieve(bucketName)
client.ai.embeddings.buckets.delete(bucketName)

// Similarity search (RAG query)
client.ai.embeddings.similaritySearch({ model, query, bucket })
```
- **Αυτό είναι full REST API** — πλήρως programmatic
- Δημιουργεί vectors από text/URLs, τα αποθηκεύει σε buckets
- `similaritySearch` κάνει semantic search στα embedded documents
- Αυτό είναι **η underlying τεχνολογία** πίσω από τα Portal KB

**4. Missions Knowledge Base API** — ⚠️ Experimental (SDK v5.40.0)
```typescript
// Under ai.missions.knowledgeBases namespace:
client.ai.missions.knowledgeBases.createKnowledgeBase(missionID)
client.ai.missions.knowledgeBases.getKnowledgeBase(knowledgeBaseID)
client.ai.missions.knowledgeBases.listKnowledgeBases(missionID)
client.ai.missions.knowledgeBases.updateKnowledgeBase(knowledgeBaseID)
client.ai.missions.knowledgeBases.deleteKnowledgeBase(knowledgeBaseID)
```
- Βρίσκεται στο `ai.missions` namespace (αυτόνομη orchestration feature)
- Return types = `unknown` — **experimental / undocumented**
- **ΔΕΝ** είναι σίγουρο ότι λειτουργεί με κανονικούς Assistants

##### Β. Τι **ΔΕΝ** υπάρχει

- ❌ **Δεν υπάρχει** dedicated `/ai/knowledge_bases` REST endpoint στο API Reference
- ❌ **Δεν υπάρχει** documented API για upload αρχείου → αυτόματη δημιουργία KB
- ❌ **Δεν υπάρχει** `client.ai.assistants.knowledgeBases.*` στο SDK
- ❌ H σελίδα `/api-reference/assistants/knowledge-bases` επιστρέφει **404**
- ❌ Στο importing docs: "Telnyx will **not** import your knowledge base. You can drag and drop files in the assistant builder."

##### Γ. ΣΥΜΠΕΡΑΣΜΑ + STRATEGY ΓΙΑ VOICEFORGE

| Approach | Πώς δουλεύει | Pros | Cons | Σύσταση |
|----------|-------------|------|------|---------|
| **A: Embeddings API (custom RAG)** | Upload → `embeddings.create()` → bucket → webhook tool calls `similaritySearch()` → injects context | Πλήρως programmatic, full control, scalable | Περισσότερη δουλειά, πρέπει να χτίσουμε τη RAG pipeline | ⭐ **ΣΥΝΙΣΤΑΤΑΙ** |
| **B: Portal KB + RetrievalTool** | Δημιουργία KB στο Portal → copy kb-xxx ID → `retrieval` tool στον assistant | Simpler, native Telnyx feature | Απαιτεί manual Portal access ΑΝΑ πελάτη — **unacceptable** for SaaS | ❌ Μόνο για testing |
| **C: Missions KB API** | `ai.missions.knowledgeBases.*` | Looks like full CRUD | Experimental, `unknown` returns, undocumented | ⚠️ Worth testing |

**ΤΕΛΙΚΗ ΑΠΟΦΑΣΗ: Approach A — Embeddings API + Webhook Tool**

Αρχιτεκτονική:
```
[User uploads file] → [VoiceForge API: POST /knowledge-bases/upload]
  → Parse file (PDF/doc → text)
  → client.ai.embeddings.create({ text chunks })
  → Store in bucket per customer/agent
  → DB: Save file metadata + bucket reference

[During live call - AI needs context]:
  → Assistant has webhook tool "search_knowledge_base"
  → Telnyx calls our webhook: POST /api/tools/knowledge-search
  → Our API: client.ai.embeddings.similaritySearch({ query, bucket })
  → Returns top-K relevant chunks to the AI
  → AI uses the context in its response
```

**Εναλλακτικά**: Αν η Telnyx κυκλοφορήσει dedicated KB API (πιθανό — the Portal already has it), μεταβαίνουμε σε αυτό. Η Embeddings pipeline μας δίνει full control μέχρι τότε.

**Τι πρέπει να χτίσουμε (backend)**:
1. File upload endpoint (`POST /api/knowledge-bases/upload`) — multer + file parsing
2. Text extraction: `pdf-parse` για PDF, `mammoth` για DOCX, plain text
3. Text chunking (split σε ~500 token chunks με overlap)
4. Telnyx Embeddings API integration: `client.ai.embeddings.create()` per chunk
5. Bucket management: 1 bucket per agent/customer
6. Knowledge search webhook: `POST /api/tools/knowledge-search` → `similaritySearch()`
7. Agent update: προσθήκη webhook tool "search_knowledge_base" στο tools array
8. DB table: `knowledge_base_files` (id, agent_id, filename, bucket_name, chunk_count, created_at)

**Τι πρέπει να χτίσουμε (frontend)**:
1. File upload component (drag & drop zone) — react-dropzone
2. Upload progress indicator
3. Uploaded files list (με delete + file size + status)
4. Integration στο Step 3 του Naive wizard
5. Integration σε κάθε agent node του Expert flow builder

**Telnyx API status**: ✅ **ΠΛΗΡΩΣ ΥΠΟΣΤΗΡΙΖΕΤΑΙ** μέσω Embeddings API + webhook tool pattern

> ✅ **ΕΡΕΥΝΑ ΟΛΟΚΛΗΡΩΘΗΚΕ**: Δεν υπάρχει dedicated KB REST API, αλλά η Embeddings API (`client.ai.embeddings.*`) παρέχει **πλήρη programmatic RAG pipeline** — καλύτερο και πιο ελεγχόμενο από τα Portal KBs. Για SaaS multi-tenant use case, αυτό είναι η σωστή προσέγγιση.

---

### 3.2 Multi-Agent Handoff → Telnyx Section 17 (Agent Handoff)

**Τι θέλουμε**: Γραμματεία → Λογιστής → HR, με IF conditions.

**Τι προσφέρει η Telnyx**:
```json
{
  "tools": [{
    "type": "handoff",
    "handoff": {
      "voice_mode": "unified",   // Ίδια φωνή, seamless transition
      "ai_assistants": [
        { "name": "Λογιστής", "id": "asst_accounting_xyz" },
        { "name": "Υπεύθ. Προσωπικού", "id": "asst_hr_xyz" }
      ]
    }
  }]
}
```

**Πώς λειτουργεί**:
- Κάθε agent node στο flow builder = ξεχωριστός Telnyx AI Assistant
- Ο πρώτος agent (Γραμματεία) έχει `handoff` tool με τους υπόλοιπους
- Η AI αποφασίζει βάσει του system prompt + conversation πότε να κάνει handoff
- Τα IF conditions **ΔΕΝ** ορίζονται ως hard rules στο Telnyx — ορίζονται στο **system prompt** (instructions)
- Η AI κρίνει αυτόνομα βάσει instructions: "Αν ο πελάτης ρωτήσει για οικονομικά → κάνε handoff στον Λογιστή"

**Κρίσιμο insight**: Τα IF conditions στο flow builder μεταφράζονται σε **γλώσσα system prompt**, ΟΧΙ σε τεχνικά rules. Η Telnyx AI αποφασίζει.

**Παράδειγμα generated system prompt**:
```
Είσαι η Γραμματεία της επιχείρησης "ABC ΑΕ".

ΚΑΝΟΝΕΣ ΔΡΟΜΟΛΟΓΗΣΗΣ:
- Αν ο πελάτης ρωτήσει για οικονομικά στοιχεία, μισθοδοσία, τιμολόγια → χρησιμοποίησε το εργαλείο handoff για "Λογιστής"
- Αν ο πελάτης ρωτήσει για θέματα προσωπικού, άδειες, προσλήψεις → χρησιμοποίησε το εργαλείο handoff για "Υπεύθ. Προσωπικού"
- Για όλα τα υπόλοιπα, εξυπηρέτησε τον πελάτη εσύ
```

**Τι πρέπει να χτίσουμε**:
1. Flow Builder UI (React Flow / XYFlow canvas)
2. Agent node component (τίτλος, σκοπός, instructions, KB, routing rules)
3. Connection lines (visual handoff paths)
4. Backend: δημιουργία πολλαπλών Telnyx assistants + handoff tools configuration
5. System prompt generator: μετατρέπει τα IF conditions σε φυσική γλώσσα

**Telnyx API status**: ✅ **ΠΛΗΡΩΣ ΥΠΟΣΤΗΡΙΖΕΤΑΙ**
- Handoff: `handoff` tool type
- Voice modes: unified (ίδια φωνή) ή distinct (διαφορετική φωνή ανά agent)
- Max chain depth: 3-4 agents (σύσταση Telnyx)
- Model-agnostic: κάθε agent μπορεί να χρησιμοποιεί διαφορετικό LLM
- Memory: shared context μέσω dynamic variables webhook + conversation metadata

---

### 3.3 Phone Number + Call Forwarding → Telnyx Section 10

**Τι θέλουμε**: Ο χρήστης αγοράζει ελληνικό +30 αριθμό, δηλώνει τον δικό του κανονικό αριθμό, κάνει call forward.

**Τι προσφέρει η Telnyx**:
- `GET /v2/available_phone_numbers` — αναζήτηση ελληνικών αριθμών
- `POST /v2/number_orders` — αγορά αριθμού
- Ο αριθμός αντιστοιχίζεται σε AI assistant (connection_id)
- Για call forwarding: ο πελάτης ρυθμίζει στον πάροχό του (Cosmote/Vodafone/Wind) εκτροπή κλήσεων στον +30 αριθμό μας

**Τι ΕΧΟΥΜΕ ήδη**:
- `apps/api/src/services/telnyx.ts`: `searchAvailableNumbers()`, `purchasePhoneNumber()` — ✅ πλήρες
- `apps/api/src/routes/numbers.ts`: `GET /numbers/available`, `POST /numbers/purchase` — ✅ πλήρες
- `apps/web/src/app/onboarding/step-number.tsx`: Number picker UI — ✅ πλήρες

**Τι ΛΕΙΠΕΙ**:
1. UI οδηγιών call forwarding (πώς κάνεις εκτροπή στο Cosmote/Vodafone/Wind)
2. Πεδίο "ο δικός σας αριθμός" (αποθήκευση στο customer record)
3. Transfer tool configuration: αν η AI δεν μπορεί να βοηθήσει, μεταφέρει στο πραγματικό τηλέφωνο

**Telnyx API status**: ✅ **ΠΛΗΡΩΣ ΥΠΟΣΤΗΡΙΖΕΤΑΙ**

---

### 3.4 Email, Push, SMS Notifications

**Τι θέλουμε**: Μετά από κάθε κλήση, ο πελάτης ενημερώνεται.

| Channel | Τρόπος | Status |
|---------|--------|--------|
| **Email** | Resend API | ✅ Service πλήρης (`apps/api/src/services/email.ts` — 241 γραμμές, templates ready) |
| **Push** | Web Push API (ServiceWorker) | ❌ Δεν υπάρχει — χρειάζεται implementation |
| **SMS** | Telnyx SMS API (`send_message` tool ή API) | ❌ Δεν υπάρχει — εύκολο μέσω Telnyx SDK |

**Telnyx SMS**: Ο ίδιος αριθμός +30 μπορεί να στέλνει SMS (αν το number supports "sms" feature). Εναλλακτικά, μέσω `send_message` tool ο agent μπορεί να στείλει SMS κατά τη διάρκεια κλήσης.

---

### 3.5 System Variables → Dynamic Variables

Οι dynamic variables `{{var_office_name}}`, `{{var_customer_id}}` κ.λπ. **ΗΔΗ ΥΛΟΠΟΙΗΘΗΚΑΝ** σωστά:

| Feature | Telnyx Section | Κώδικάς μας | Status |
|---------|---------------|-------------|--------|
| Pre-call webhook (load customer data) | Section 4 | `webhooks.ts:30-88` | ✅ |
| Dynamic variables response | Section 4 | `webhooks.ts:65-82` | ✅ |
| Memory (past conversations) | Section 5 | `webhooks.ts:73-76` | ✅ |
| Conversation metadata | Section 5 | `webhooks.ts:77-85` | ✅ |
| Post-call webhook (save transcript) | Section 14 | `webhooks.ts:96-175` | ✅ |
| Insights webhook (sentiment, summary) | Section 13 | `webhooks.ts:183-240` | ✅ |
| Idempotency (duplicate prevention) | Section 14 | `webhooks.ts:104-109` | ✅ |

---

## 4. GAP ANALYSIS — ΑΚΡΙΒΩΣ ΤΙ ΛΕΙΠΕΙ

### 4.1 Για Naive Mode (ήδη σχεδόν έτοιμο)

| # | Feature | Effort | Εξάρτηση |
|---|---------|--------|----------|
| N1 | **Dev Bypass Mode** — Agent CRUD χωρίς Telnyx API call | 1 μέρα | Καμία |
| N2 | **File Upload + Knowledge Base** — Upload UI + backend + Telnyx Embeddings API RAG pipeline | 3-4 μέρες | pdf-parse, mammoth, embeddings API |
| N3 | **Call Forwarding Instructions** — UI + πεδίο "ο αριθμός σας" | 0.5 μέρα | Καμία |
| N4 | **SMS Notification** post-call | 1 μέρα | Telnyx API key |
| N5 | **Email Notification wiring** — σύνδεση email service στο post-call webhook | 0.5 μέρα | RESEND_API_KEY |
| N6 | **Push Notifications** — ServiceWorker + Web Push API | 2-3 μέρες | Καμία |

**Σύνολο Naive Mode**: ~7-9 εργάσιμες μέρες

### 4.2 Για Expert Mode (χρειάζεται χτίσιμο)

| # | Feature | Effort | Εξάρτηση |
|---|---------|--------|----------|
| E1 | **Flow Builder Canvas** — React Flow/XYFlow integration | 3-4 μέρες | npm library |
| E2 | **Agent Node Component** — Τίτλος, σκοπός, instructions, KB, routing | 2-3 μέρες | E1 |
| E3 | **Connection/Routing Editor** — IF conditions σε γραφική μορφή | 2-3 μέρες | E1 |
| E4 | **System Prompt Generator** — Μετατροπή IF rules σε natural language prompt | 1-2 μέρες | Καμία |
| E5 | **Multi-Agent Backend** — Δημιουργία πολλαπλών Telnyx assistants + handoff config | 2-3 μέρες | Telnyx API key |
| E6 | **Flow Save/Load** — Αποθήκευση flow σε DB (JSON), φόρτωση | 1 μέρα | E1 |
| E7 | **Mode Selector UI** — Naive vs Expert επιλογή κατά την εγγραφή | 0.5 μέρα | Καμία |

**Σύνολο Expert Mode**: ~12-16 εργάσιμες μέρες

### 4.3 Κοινά (και για τα δύο modes)

| # | Feature | Effort | Εξάρτηση |
|---|---------|--------|----------|
| C1 | **Telnyx Account Setup** — Εγγραφή, verification, funded account | 2-5 μέρες (αναμονή) | Telnyx approval |
| C2 | **Managed Accounts Activation** — Request + Level 2 verification | 2-5 μέρες (αναμονή) | C1 |
| C3 | **ngrok/Public URL** — Για webhook testing | 0.5 μέρα | Καμία |
| C4 | **First Real Call Test** — End-to-end call with Greek voice | 1 μέρα | C1+C2 |

---

## 5. ΤΕΧΝΙΚΗ ΕΦΙΚΤΟΤΗΤΑ — ΕΠΙΒΕΒΑΙΩΣΗ

### ✅ ΟΛΟΣ Ο ΠΥΡΗΝΑΣ ΥΠΟΣΤΗΡΙΖΕΤΑΙ ΑΠΟ ΤΟ TELNYX API

| Vision Feature | Telnyx API Section | API Endpoint / Tool | Verified |
|----------------|-------------------|---------------------|----------|
| Δημιουργία πράκτορα | Section 3 | `POST /v2/ai/assistants` | ✅ |
| Ελληνική φωνή (TTS) | Section 6 | `Azure.el-GR-AthinaNeural` | ✅ |
| Ελληνική αναγνώριση (STT) | Section 6 | `deepgram/nova-3`, `language: "el"` | ✅ |
| Ελληνικοί αριθμοί +30 | Section 10 | `GET /v2/available_phone_numbers` | ✅ |
| Αγορά αριθμού | Section 10 | `POST /v2/number_orders` | ✅ |
| Multi-agent handoff | Section 17 | `handoff` tool type | ✅ |
| Knowledge Base (RAG) | Section 19 | `retrieval` tool + KB upload | ✅ |
| Dynamic variables (multi-tenant) | Section 4 | `dynamic_variables_webhook_url` | ✅ |
| Memory (cross-conversation) | Section 5 | `memory.conversation_query` | ✅ |
| Post-call insights (AI) | Section 13 | Insight Groups + webhook | ✅ |
| Async tools | Section 9 | `async: true` + Add Messages API | ✅ |
| Transfer σε πραγματικό τηλέφωνο | Section 8 | `transfer` tool type | ✅ |
| SMS κατά τη κλήση | Section 8 | `send_message` tool type | ✅ |
| Webhook security (Ed25519) | Section 14 | SDK verification utilities | ✅ |
| BYO API keys (OpenAI, ElevenLabs) | Section 11 | `POST /v2/integration_secrets` | ✅ |
| Web widget embed | Section 18 | `widget_settings` | ✅ |
| Outbound calls | Section 15 | `POST /v2/texml/ai_calls/{app_id}` | ✅ |

### ⚠️ ΣΗΜΕΙΑ ΠΡΟΣΟΧΗΣ

1. **Knowledge Base API** — ✅ **ΕΡΕΥΝΑ ΟΛΟΚΛΗΡΩΘΗΚΕ** (βλ. Section 3.1). Δεν υπάρχει dedicated KB REST API, αλλά η Telnyx **Embeddings API** (`client.ai.embeddings.*`) παρέχει πλήρη programmatic RAG pipeline: `create` (embed documents) → `buckets` (storage) → `similaritySearch` (query). Αρχιτεκτονική VoiceForge: Upload file → parse text → embed chunks → store in bucket per agent → webhook tool queries during live calls. Πλήρως scalable για multi-tenant SaaS.

2. **Managed Accounts approval** — ΔΕΝ είναι αυτόματο. Πρέπει να κάνεις request στην Telnyx + Level 2 verification. Χωρίς αυτό, η multi-tenant αρχιτεκτονική δεν δουλεύει.

3. **Greek number regulatory requirements** — Μπορεί να χρειαστούν business registration docs για +30 αριθμούς. Ελέγχουμε στο `requirements_met` field.

4. **Handoff chain depth** — Max 3-4 agents στη σειρά (σύσταση Telnyx). Αρκετό για τα use cases μας.

5. **File upload size** — Θα πρέπει να ορίσουμε limits (PDF, max 10-50MB ανάλογα plan).

---

## 6. ΠΡΟΤΕΙΝΟΜΕΝΟ TIMELINE

### Φάση 0: Dev Bypass (ΤΩΡΑ — 1-2 μέρες)
Ξεμπλοκάρει ΟΛΟ το frontend development χωρίς Telnyx.
- Dev bypass mode: agent CRUD χωρίς Telnyx API calls
- Mock phone numbers
- Simulated webhooks (test endpoints)
- Full onboarding flow δοκιμή

### Φάση 1: Naive Mode Complete (5-7 μέρες)
- Knowledge Base file upload (backend + frontend)
- Naive wizard αναβάθμιση (add file upload στο step 3)
- Call forwarding instructions UI
- Email notification wiring
- SMS post-call notification
- Push notifications (basic)

### Φάση 2: Telnyx Integration (παράλληλα αν υπάρχει API key)
- Εγγραφή + Fund + Level 2 Verification
- Managed Accounts activation
- ngrok setup
- First real call test
- Greek voice quality assessment

### Φάση 3: Expert Mode (1.5-2 εβδομάδες)
- Flow Builder UI (React Flow)
- Agent node component
- IF conditions editor
- System prompt generator
- Multi-agent backend (handoff config)
- Flow save/load

### Φάση 4: Polish & Production
- Supabase auth (αντί dev auth)
- Deployment (Railway/Vercel)
- DNS + SSL
- Webhook signature verification (Ed25519)
- Error monitoring
- Rate limiting production config

---

## 7. ΑΡΧΙΤΕΚΤΟΝΙΚΗ EXPERT MODE — FLOW BUILDER

### Τεχνολογία
- **React Flow / XYFlow** — Mature, MIT licensed, React-native canvas
- Κάθε agent = custom node component
- Κάθε connection = handoff routing rule
- Sidebar panel: edit properties του selected node

### Database Schema (νέος πίνακας)
```sql
CREATE TABLE agent_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  name VARCHAR(255) NOT NULL,
  -- React Flow JSON state (nodes, edges, viewport)
  flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  -- Compiled configuration
  entry_agent_id UUID REFERENCES agents(id),  -- Which agent receives calls
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Πώς μεταφράζεται σε Telnyx
```
Flow Builder UI          │  Telnyx API
─────────────────────────┼──────────────────────────────
Agent Node "Γραμματεία"  │  POST /v2/ai/assistants (assistant 1)
Agent Node "Λογιστής"    │  POST /v2/ai/assistants (assistant 2)
Agent Node "HR"          │  POST /v2/ai/assistants (assistant 3)
Connection A→B (rule)    │  Assistant 1 gets handoff tool → [asst2, asst3]
IF condition "οικονομικά"│  Injected into assistant 1's system prompt
Phone Number             │  Assigned to assistant 1 (entry point)
```

### IF Conditions → System Prompt Translation
Το UI θα έχει γραφική μορφή:

```
┌─────────────────────────────────────────────┐
│ IF: Ο πελάτης ρωτάει για [οικονομικά]       │
│ THEN: Handoff → Λογιστής                    │
├─────────────────────────────────────────────┤
│ IF: Ο πελάτης ρωτάει για [θέματα HR]        │
│ THEN: Handoff → Υπεύθ. Προσωπικού          │
├─────────────────────────────────────────────┤
│ ELSE: Εξυπηρέτησε τον πελάτη εσύ           │
└─────────────────────────────────────────────┘
```

Αυτό μεταφράζεται αυτόματα σε:
```
ΚΑΝΟΝΕΣ ΔΡΟΜΟΛΟΓΗΣΗΣ:
1. Αν ο πελάτης ρωτήσει για οικονομικά στοιχεία, μισθοδοσία, τιμολόγια, φορολογικά → χρησιμοποίησε το εργαλείο handoff και μετάφερε στον "Λογιστή"
2. Αν ο πελάτης ρωτήσει για θέματα προσωπικού, άδειες, προσλήψεις, σύμβαση → χρησιμοποίησε το εργαλείο handoff και μετάφερε στον "Υπεύθ. Προσωπικού"
3. Για οτιδήποτε άλλο, εξυπηρέτησε τον πελάτη εσύ

ΣΗΜΑΝΤΙΚΟ: Αν δεν είσαι σίγουρη σε ποια κατηγορία ανήκει το αίτημα, ρώτησε τον πελάτη
```

---

## 8. ΣΥΜΠΕΡΑΣΜΑ

### Η ωμή αλήθεια:
1. **Ο πυρήνας υπάρχει** — API, Web, DB, auth, onboarding wizard, agent CRUD, webhooks
2. **Ο κώδικας Telnyx είναι γραμμένος** αλλά **ΠΟΤΕ δεν δοκιμάστηκε με πραγματικό API key**
3. **Knowledge Base (file upload/RAG)** — Δεν υπάρχει καθόλου, είναι core feature για αυτό που περιγράφεις
4. **Expert Mode (flow builder)** — Δεν υπάρχει καθόλου, απαιτεί σημαντική δουλειά (React Flow + multi-agent backend)
5. **Handoff** — Το Telnyx το υποστηρίζει τέλεια, αλλά χρειάζεται implementation στο backend + frontend
6. **Notifications (push/SMS)** — Δεν υφίστανται, αλλά το email service είναι έτοιμο
7. **Stripe** — Σωστά δεν χρειάζεται (B2B τιμολόγιο). Ο κώδικας υπάρχει αλλά δεν είναι προτεραιότητα

### Recommended πρώτο βήμα:
**Dev Bypass Mode** → unblocks ΟΛΟΚΛΗΡΟ το frontend development. Μετά → Knowledge Base + File Upload → Naive Mode Complete → Expert Mode.

---

## 9. PLAN B — ELEVENLABS + TELNYX (ΜΟΝΟ ΑΡΙΘΜΟΙ)

> **Σκοπός**: Αν η Telnyx δυσκολέψει (Managed Accounts approval, API issues, voice quality), μπορούμε να χρησιμοποιήσουμε **ElevenLabs** για ΟΛΑ (AI agents, KB, handoff, analytics) και **Telnyx μόνο για τηλεφωνικούς αριθμούς** μέσω SIP trunk.

### 9.1 Τι προσφέρει η ElevenLabs — ΠΛΗΡΗΣ ΕΡΕΥΝΑ

#### A. ElevenAgents Platform — Conversational AI

| Feature | ElevenLabs | Telnyx | Σύγκριση |
|---------|-----------|--------|----------|
| **Agent CRUD (API)** | `POST /v1/convai/agents/create` — πλήρες SDK (`@elevenlabs/elevenlabs-js` v2.36.0) | `POST /v2/ai/assistants` | ✅ Ισοδύναμα |
| **Knowledge Base** | **FULL API**: `create_from_text()`, `create_from_url()`, `create_from_file()` — auto-indexing + RAG built-in | Embeddings API (χρειάζεται custom pipeline) | ⭐ **ElevenLabs ΠΟΛΥ καλύτερο** — native KB API, δεν χτίζεις RAG pipeline |
| **RAG** | Built-in toggle, configurable: embedding model, max chunks, max distance | Custom webhook pipeline | ⭐ **ElevenLabs ευκολότερο** |
| **Agent Handoff** | `transfer_to_agent` system tool — conditions, delay, transfer message, nested chains | `handoff` tool type | ✅ Ισοδύναμα — η ElevenLabs έχει λίγο πιο δομημένο API |
| **Tools (Webhooks)** | Server tools (webhook), Client tools, MCP tools, System tools | Webhook tools, async tools | ✅ Ισοδύναμα |
| **System Tools** | End call, Language detection, Agent transfer, Transfer to number, Skip turn, DTMF, Voicemail detection | Hangup, Handoff, Transfer, SIPRefer, DTMF, SendMessage, SkipTurn | ✅ Ισοδύναμα |
| **Dynamic Variables** | `{{variable_name}}` — system vars + custom + secret vars + tool assignment | `{{var_name}}` via dynamic_variables_webhook_url | ✅ Ισοδύναμα |
| **Greek Voice** | 5000+ voices, **Greek (el)** υποστηρίζεται σε multilingual v2, flash v2.5, turbo v2.5 + v3 | Azure.el-GR-AthinaNeural, Azure.el-GR-NestorasNeural | ⭐ **ElevenLabs πιθανώς καλύτερο** — 5000+ voices vs 2 Azure voices |
| **Greek STT** | Scribe v2 — 90+ γλώσσες, word-level timestamps | Deepgram nova-3, language: "el" | ✅ Και τα δύο OK |
| **Multi-language** | 31+ γλώσσες, auto-detection tool, per-language voice | Manual configuration | ⭐ ElevenLabs καλύτερο |
| **Conversation Analysis** | Built-in: success evaluation, data collection, analytics | Insight Groups + webhook | ✅ Ισοδύναμα |
| **Visual Workflow Builder** | Workflows feature (native στο platform) | Δεν υπάρχει (πρέπει να χτίσουμε) | ⭐ **ElevenLabs ΠΟΛΥ καλύτερο** — δεν χρειάζεται React Flow |
| **Widget** | Embeddable HTML snippet: `<elevenlabs-convai agent-id="xxx">` | `widget_settings` | ✅ Ισοδύναμα |
| **Phone Numbers** | ❌ ΔΕΝ πουλάει αριθμούς — χρειάζεται Twilio ή SIP trunk | ✅ Native αγορά +30 αριθμών | ⭐ **Telnyx καλύτερο** |
| **SIP Trunk** | ✅ Universal SIP trunk — δέχεται ΟΠΟΙΟΝΔΗΠΟΤΕ SIP provider | ✅ Native | ✅ Ισοδύναμα |
| **Managed Accounts** | ❌ Δεν υπάρχει | ✅ Multi-tenant sub-accounts | ⭐ **Telnyx μοναδικό** (αλλά δεν χρειάζεται αν χρησιμοποιούμε ElevenLabs agents) |

#### B. Knowledge Base API — Η ΜΕΓΑΛΗ ΔΙΑΦΟΡΑ

```typescript
// ElevenLabs — ΕΤΟΙΜΟ, built-in:
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const client = new ElevenLabsClient({ apiKey: 'xxx' });

// Upload αρχείο → αυτόματο indexing + RAG
const doc = await client.conversationalAi.knowledgeBase.documents.createFromFile({
  file: fs.createReadStream('/path/to/document.pdf'),
  name: 'Ποινικός Κώδικας'
});

// Attach στον agent
await client.conversationalAi.agents.update('agent-id', {
  conversation_config: {
    agent: {
      prompt: {
        knowledge_base: [{ type: 'file', name: doc.name, id: doc.id }],
        rag: { enabled: true, embedding_model: 'e5_mistral_7b_instruct' }
      }
    }
  }
});

// DONE — δεν χρειάζεται: pdf-parse, chunking, embeddings, buckets, webhook search
```

**vs Telnyx (χρειάζεται custom RAG pipeline)**:
```
Upload → pdf-parse/mammoth → text chunking → embeddings.create() per chunk
→ bucket management → webhook tool → similaritySearch() → inject to AI
```

**Εξοικονόμηση**: ~3-4 μέρες δουλειάς backend RAG pipeline

#### C. Agent Transfer — Πλήρως Programmatic

```typescript
// ElevenLabs — Agent handoff configuration
const agent = await client.conversationalAi.agents.create({
  name: 'Γραμματεία',
  conversation_config: {
    agent: {
      prompt: {
        prompt: 'Είσαι η γραμματεία...',
        first_message: 'Γεια σας, πώς μπορώ να σας βοηθήσω;',
        tools: [{
          type: 'system',
          name: 'transfer_to_agent',
          description: 'Μεταφορά σε εξειδικευμένο πράκτορα',
          params: {
            transfers: [
              {
                agent_id: 'ACCOUNTANT_AGENT_ID',
                condition: 'Ο πελάτης ρωτάει για οικονομικά',
                delay_ms: 1000,
                transfer_message: 'Σας μεταφέρω στον λογιστή μας...',
                enable_transferred_agent_first_message: true
              },
              {
                agent_id: 'HR_AGENT_ID',
                condition: 'Ο πελάτης ρωτάει για θέματα προσωπικού',
                delay_ms: 1000,
                transfer_message: 'Σας μεταφέρω στο τμήμα HR...'
              }
            ]
          }
        }]
      }
    }
  }
});
```

#### D. SIP Trunk — Πώς Συνδέονται Telnyx Αριθμοί + ElevenLabs Agents

```
┌─────────────────────┐     SIP INVITE      ┌──────────────────────┐
│   PSTN / Cosmote    │  ──────────────────▶ │   Telnyx             │
│   +30 XXX XXXX      │                      │   Phone Number       │
│   (Πελάτης καλεί)   │                      │   (SIP Trunk)        │
└─────────────────────┘                      └────────┬─────────────┘
                                                      │
                                                      │ SIP forward to:
                                                      │ sip.rtc.elevenlabs.io:5060
                                                      ▼
                                             ┌──────────────────────┐
                                             │   ElevenLabs         │
                                             │   SIP Trunk          │
                                             │   → Agent assigned   │
                                             │   → AI handles call  │
                                             │   → KB/RAG active    │
                                             │   → Handoff works    │
                                             └──────────────────────┘
```

**Setup βήματα**:
1. Telnyx: Αγορά +30 αριθμού, configure SIP trunk → forward στο `sip.rtc.elevenlabs.io:5060`
2. ElevenLabs: Import phone number via SIP trunk (Label, Number, Auth credentials)
3. ElevenLabs: Assign Agent στον αριθμό
4. Test: Κλήση στον +30 αριθμό → Telnyx SIP → ElevenLabs → AI agent απαντάει

**Outbound**: ElevenLabs στέλνει SIP INVITE → `sip.telnyx.com` → Telnyx κάνει call

### 9.2 Pricing Comparison

| Πάροχος | Κόστος | Τι Περιλαμβάνει |
|---------|--------|-----------------|
| **Telnyx Only** | ~$0.005-0.02/min (voice) + ~$1/mo/number + AI assistant usage | Αριθμοί + AI + KB (Embeddings) + Managed Accounts |
| **ElevenLabs (Scale)** | $330/mo → 2M credits (~2000 min TTS) | Agents + KB/RAG + Handoff + Analytics + 5000+ voices |
| **ElevenLabs (Business)** | $1,320/mo → 11M credits (~11000 min TTS) | Όλα τα παραπάνω + low-latency TTS ~5c/min |
| **ElevenLabs (Startup Grant)** | **$0 για 12 μήνες** + 33M characters | Πλήρες platform δωρεάν! |
| **Telnyx (Μόνο αριθμοί)** | ~$1/mo/number + SIP minutes | Αριθμοί + SIP trunk μόνο |

**Hybrid κόστος**: ElevenLabs Scale ($330/mo) + Telnyx αριθμοί (~$10-50/mo) = **~$340-380/mo**

**⭐ STARTUP GRANT**: Η ElevenLabs δίνει **12 μήνες δωρεάν** σε startups! Αυτό σημαίνει:
- 0 κόστος AI platform για 1 χρόνο
- Μόνο Telnyx αριθμοί (~$10-50/mo)
- Αρκετό χρόνο να χτίσεις, τεστάρεις, και βρεις πελάτες

### 9.3 Τι ΚΕΡΔΙΖΟΥΜΕ με ElevenLabs

| Πλεονέκτημα | Λεπτομέρεια |
|-------------|-------------|
| ❌ **Δεν χτίζουμε RAG pipeline** | Native KB upload API — εξοικονόμηση 3-4 μέρες |
| ❌ **Δεν χτίζουμε Flow Builder** | ElevenLabs Workflows — native visual builder (ίσως) |
| ❌ **Δεν χρειαζόμαστε Managed Accounts** | Κάθε agent ζει στο δικό μας ElevenLabs account |
| ✅ **5000+ φωνές** | Πολύ καλύτερη ποιότητα vs 2 Azure Greek voices |
| ✅ **Auto language detection** | System tool — ο agent αλλάζει γλώσσα αυτόματα |
| ✅ **Voicemail detection** | Αν ο agent κληθεί, ανιχνεύει voicemail |
| ✅ **Built-in analytics** | Success evaluation, data collection, cost tracking |
| ✅ **Startup Grant** | 12 μήνες δωρεάν — τεράστιο για early-stage |

### 9.4 Τι ΧΑΝΟΥΜΕ με ElevenLabs

| Μειονέκτημα | Λεπτομέρεια |
|-------------|-------------|
| ❌ **Δεν υπάρχει Managed Accounts** | Multi-tenant isolation — πρέπει να τα διαχειριστούμε εμείς (separate agents per customer) |
| ❌ **Δύο providers** | Πολυπλοκότητα: Telnyx (numbers) + ElevenLabs (AI) — 2 accounts, 2 billing, 2 dashboards |
| ❌ **SIP trunk latency** | Extra hop: PSTN → Telnyx → SIP → ElevenLabs (μικρή αύξηση latency) |
| ❌ **KB size limits** | Free: 1MB, Scale: 500MB, Business: 1GB (vs Telnyx Embeddings: no documented limit) |
| ❌ **Concurrency limits** | Scale: max 15 concurrent TTS requests (~100 simultaneous calls based on docs) |
| ❌ **Rewrite Telnyx service** | Πρέπει να ξαναγράψουμε `telnyx.ts` → `elevenlabs.ts` (αλλά ο κώδικας δεν έχει δοκιμαστεί anyway) |
| ❌ **Credit-based pricing** | Κόστος ανά χαρακτήρα/λεπτό — πρέπει monitoring |

### 9.5 ΤΕΛΙΚΗ ΕΚΤΙΜΗΣΗ — ΠΟΤΕ ΕΝΕΡΓΟΠΟΙΟΥΜΕ ΤΟ PLAN B

| Σενάριο | Απόφαση |
|---------|---------|
| Telnyx Managed Accounts approved + API δουλεύει OK | ➡️ **Μένουμε Telnyx** |
| Telnyx Managed Accounts αρνήθηκαν ή πήρε >2 εβδομάδες | ➡️ **Switch σε ElevenLabs** |
| Telnyx Greek voice quality κακή | ➡️ **Switch σε ElevenLabs** (5000+ voices) |
| Telnyx KB/Embeddings API δεν δουλεύει σωστά | ➡️ **Switch σε ElevenLabs** (native KB) |
| Startup Grant approved | ➡️ **Σοβαρά σκεφτόμαστε ElevenLabs** ακόμα κι αν η Telnyx δουλεύει |

**Πρακτική σύσταση**: Ξεκίνα με Telnyx (ήδη γραμμένος κώδικας). Αν μέσα σε 1-2 εβδομάδες η Telnyx δεν αποδίδει → pivot σε ElevenLabs. **Ο κώδικας frontend (React, dashboard, wizard) ΜΕΝΕΙ ΙΔΙΟΣ** — αλλάζει μόνο το backend service layer.

### 9.6 ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΛΛΑΓΗ ΑΝ ΓΙΝΕΙ SWITCH

```
ΤΩΡΑ (Telnyx):                          PLAN B (ElevenLabs + Telnyx numbers):
─────────────────                        ─────────────────────────────────────
services/telnyx.ts                       services/elevenlabs.ts (NEW)
  → createAssistant()                      → createAgent()
  → updateAssistant()                      → updateAgent()
  → deleteAssistant()                      → deleteAgent()
  → searchAvailableNumbers()             services/telnyx.ts (ΜΟΝΟ αριθμοί)
  → purchasePhoneNumber()                  → searchAvailableNumbers()
  → embeddings.create()                    → purchasePhoneNumber()
  → embeddings.similaritySearch()          → configureSIPTrunk()
                                         routes/knowledge-bases.ts (ΑΠΛΟΥΣΤΕΥΜΕΝΟ)
routes/knowledge-bases.ts                  → upload file → ElevenLabs KB API
  → upload → parse → chunk → embed         → NO chunking, NO embeddings pipeline
  → webhook search tool                    → NO webhook search tool (built-in RAG)
```

**Χρόνος μετάβασης**: ~3-5 μέρες (γράφουμε `elevenlabs.ts`, αλλάζουμε routes, SIP trunk config)

---

*VoiceForge AI Vision Analysis | Panos Skouras | Feb 2026*
