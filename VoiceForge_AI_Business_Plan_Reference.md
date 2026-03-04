# VoiceForge AI — Πλήρης Αναφορά για Business Plan

**Ημερομηνία:** Μάρτιος 2026  
**Σκοπός:** Αυτό το έγγραφο περιέχει τα πάντα για το VoiceForge AI — σκοπό, αρχιτεκτονική, τεχνολογία, τιμολόγηση, κόστη λειτουργίας, αγορά-στόχο, ανταγωνιστικά πλεονεκτήματα, και υφιστάμενη κατάσταση ανάπτυξης — ώστε να χρησιμοποιηθεί ως βάση για ένα ολοκληρωμένο business plan.

---

## 1. ΤΟ ΟΡΑΜΑ — ΤΙ ΕΙΝΑΙ ΤΟ VOICEFORGE AI

### 1.1 Η Ιδέα σε Μία Παράγραφο

Το VoiceForge AI είναι μια white-label πλατφόρμα AI φωνητικής ρεσεψιόν (AI Voice Receptionist) σχεδιασμένη αποκλειστικά για ελληνικές μικρομεσαίες επιχειρήσεις. Κάθε πελάτης αποκτά τη δική του ψηφιακή γραμματέα — μια τεχνητή νοημοσύνη που απαντάει τηλεφωνικές κλήσεις 24 ώρες το 24ωρο, 7 ημέρες την εβδομάδα, μιλάει φυσικά ελληνικά (και 24+ ακόμη γλώσσες), κλείνει ραντεβού, απαντάει σε ερωτήσεις πελατών βάσει πληροφοριών που φόρτωσε ο ιδιοκτήτης, και θυμάται τους τακτικούς πελάτες από προηγούμενες κλήσεις. Ο πελάτης βλέπει ένα όμορφο ελληνικό dashboard, και δεν χρειάζεται καμία τεχνική γνώση για να ξεκινήσει.

### 1.2 Το Πρόβλημα που Λύνουμε

Στην Ελλάδα, οι μικρομεσαίες επιχειρήσεις — δικηγορικά γραφεία, ιατρεία, οδοντιατρεία, λογιστικά γραφεία, μεσιτικά, κομμωτήρια, κτηνιατρεία — αντιμετωπίζουν ένα κοινό πρόβλημα: χάνουν τηλεφωνικές κλήσεις. Όταν ο γιατρός εξετάζει, ο δικηγόρος είναι στο δικαστήριο, ο κομμωτής δουλεύει, κανείς δεν σηκώνει το τηλέφωνο. Κάθε αναπάντητη κλήση είναι ένας χαμένος πελάτης. Η πρόσληψη γραμματέα κοστίζει €800-1.200/μήνα (μισθός, ΙΚΑ, 13ος/14ος). Και ακόμη κι αν υπάρχει γραμματέας, δεν δουλεύει μετά τις 5 το απόγευμα, τα Σαββατοκύριακα, ή σε αργίες.

Το VoiceForge AI λύνει αυτό το πρόβλημα: αντί για ανθρώπινη γραμματέα, δίνουμε μια AI ρεσεψιονίστ που δεν αρρωσταίνει, δεν παίρνει άδεια, δεν κάνει λάθη, και κοστίζει κλάσμα ανθρώπινου μισθού.

### 1.3 Γιατί Τώρα

Η τεχνολογία ωρίμασε μόλις τώρα. Μέχρι πρόσφατα, οι AI φωνητικοί βοηθοί ήταν ρομποτικοί, δεν κατανοούσαν ελληνικά, και είχαν μεγάλη καθυστέρηση. Σήμερα, χάρη στην ElevenLabs (μηδενική καθυστέρηση TTS), το Deepgram Nova-3 (state-of-the-art STT σε ελληνικά), και τα GPT-4o/GPT-5/Claude (σχεδόν ανθρώπινη κατανόηση), μια AI μπορεί να κάνει μια τηλεφωνική συνομιλία αδιαφοροποίητη από άνθρωπο. Η ελληνική αγορά δεν έχει ακόμη τέτοιο προϊόν — αυτό μας δίνει first-mover advantage.

---

## 2. ΤΟ ΠΡΟΪΟΝ — ΠΩΣ ΔΟΥΛΕΥΕΙ

### 2.1 Δύο Επίπεδα Χρήστη

Η πλατφόρμα προσφέρει δύο εμπειρίες χρήστη, αναγνωρίζοντας ότι οι πελάτες μας έχουν πολύ διαφορετικά επίπεδα τεχνικής γνώσης:

#### Επίπεδο "Naive" (Απλός Χρήστης) — Η Κύρια Εμπειρία

Σχεδιασμένο για τον μέσο ιδιοκτήτη μικρής επιχείρησης στην Ελλάδα — κάποιον που χρησιμοποιεί smartphone αλλά δεν είναι τεχνικός. Ο χρήστης ακολουθεί ένα wizard βήμα-βήμα και σε λίγα λεπτά έχει ζωντανό AI βοηθό:

- **Βήμα 1:** Πληροφορίες επιχείρησης — Όνομα, κλάδος (law_office, medical, dental κ.ά.), email, τηλέφωνο, timezone. Ο κλάδος επιλέγεται από dropdown, και αυτόματα φορτώνονται προτεινόμενες ρυθμίσεις (template).
- **Βήμα 2:** Πλάνο — Επιλογή ενός από τα τρία πλάνα (Basic, Pro, Enterprise). Καθαρή σύγκριση χαρακτηριστικών.
- **Βήμα 3:** AI Βοηθός — Όνομα (π.χ. "Σοφία"), επιλογή φωνής, χαιρετισμός (τι λέει ο βοηθός όταν σηκώνει), οδηγίες (system prompt). Αν ο χρήστης δεν ξέρει τι να γράψει, το industry template τον βοηθάει — γεμίζει αυτόματα.
- **Βήμα 4:** Τηλεφωνικός αριθμός — Αναζήτηση ελληνικών +30 αριθμών, επιλογή του αριθμού. Αγοράζεται μέσω Telnyx API και συνδέεται αυτόματα με τον βοηθό μέσω SIP trunk.
- **Βήμα 5:** Σύνοψη & Εκτόξευση — Ο χρήστης βλέπει τη σύνοψη, πατάει "Εκτόξευση" και σε λιγότερο από 30 δευτερόλεπτα ο βοηθός είναι ζωντανός.

Αποτέλεσμα: ένας AI βοηθός, ένας τηλεφωνικός αριθμός, μηδέν τεχνικές γνώσεις.

#### Επίπεδο "Expert" (Προχωρημένος Χρήστης) — Ισχύ και Ευελιξία

Σχεδιασμένο για τεχνικότερους πελάτες ή μεγαλύτερες επιχειρήσεις. Αντί για ένα βοηθό, ο χρήστης σχεδιάζει flows πολλαπλών agents. Κάθε flow αποτελείται από πολλαπλούς AI βοηθούς (agents) που συνδέονται μεταξύ τους με κανόνες μεταφοράς (handoff). Για παράδειγμα, μια εταιρεία μπορεί να δημιουργήσει:

- **Γραμματεία (Ρεσεψιόν)** → Ο πρώτος βοηθός, δέχεται την κλήση
- **Λογιστής** → Αν ο πελάτης ρωτήσει για οικονομικά, μεταφέρεται εδώ
- **HR/Προσωπικό** → Αν ρωτήσει για θέματα εργαζομένων, μεταφέρεται εδώ

Κάθε βοηθός (node) στο flow έχει τα δικά του χαρακτηριστικά: τίτλος, σκοπός, οδηγίες (system prompt), βάση γνώσεων, φωνή. Οι κανόνες δρομολόγησης (IF conditions) εκφράζονται γραφικά: "Αν ο πελάτης ρωτήσει για X → Μεταφέρεται στον Y" — και μεταφράζονται αυτόματα σε natural language στο system prompt καθενός.

Τεχνικά, κάθε agent node δημιουργεί ξεχωριστό ElevenLabs conversational agent. Ο entry agent (π.χ. Γραμματεία) διαθέτει `transfer_to_agent` system tool με τα IDs των υπόλοιπων. Η ElevenLabs διαχειρίζεται αυτόνομα τα handoffs εντός κλήσης. Η μέγιστη αλυσίδα handoff είναι 3-4 agents (σύσταση ElevenLabs).

### 2.2 Βασικά Χαρακτηριστικά Προϊόντος

#### AI Φωνητικοί Βοηθοί (Agents)
Κάθε βοηθός είναι πλήρως παραμετροποιήσιμος:
- **Ταυτότητα:** Όνομα, γλώσσα, κλάδος
- **Φωνή:** Επιλογή από βιβλιοθήκη ElevenLabs (5000+ voices, 79 γλώσσες). Δύο preset ελληνικές φωνές ("Σοφία" γυναικεία, "Νίκος" ανδρική), ή custom selection. Μοντέλα σύνθεσης: `eleven_v3_conversational` (κορυφαίο, εκφραστικό), `eleven_flash_v2_5` (ταχύτατο ~75ms), `eleven_turbo_v2_5` (ισορροπία), `eleven_multilingual_v2` (σταθερότητα).
- **Νοημοσύνη:** Επιλογή LLM ανεξάρτητα. Υποστηρίζονται: OpenAI GPT-4o-mini (default, γρήγορο), GPT-4o, GPT-4.1, GPT-5, Anthropic Claude Sonnet 4/4.5 & Haiku, Google Gemini 2.5 Flash & 3 Flash.
- **Οδηγίες (System Prompt):** Ελεύθερο κείμενο — αυτές οι οδηγίες καθορίζουν πλήρως πώς συμπεριφέρεται ο βοηθός. Κανόνες λήψης ραντεβού, τρόπος ομιλίας, πληροφορίες που δίνει ή αποκρύπτει, πολιτική εταιρείας.
- **Πολυγλωσσική υποστήριξη:** 24+ γλώσσες (Ελληνικά, Αγγλικά, Γερμανικά, Γαλλικά, Ιταλικά, Ισπανικά, Ολλανδικά, Πορτογαλικά, Ρωσικά, Κινέζικα, Ιαπωνικά, Κορεατικά, Αραβικά, Τουρκικά, Πολωνικά, Σουηδικά, Δανικά, Φινλανδικά, Νορβηγικά, Τσεχικά, Ρουμανικά, Βουλγαρικά, Κροατικά, Ουγγρικά). Αυτόματη αναγνώριση γλώσσας — ο βοηθός απαντά στη γλώσσα που μιλάει ο καλών.
- **Εργαλεία (Tools):** check_availability (έλεγχος ημερολογίου), book_appointment (κράτηση ραντεβού), transfer (μεταφορά σε πραγματικό τηλέφωνο), hangup, send_message (SMS). Αποθηκεύονται ως JSON.
- **Τηλεφωνικές ρυθμίσεις:** Noise suppression (Krisp), μέγιστη διάρκεια κλήσης (30 λεπτά default), voicemail detection, ηχογράφηση κλήσεων (MP3), idle timeout.
- **Μεταγραφή (STT):** Deepgram Nova-3 (state-of-the-art whisper-level accuracy), ελληνική υποστήριξη, EU region, smart formatting, ρυθμιζόμενη ανίχνευση τέλους πρότασης (EOT).

#### Βάση Γνώσεων (Knowledge Base / RAG)
Η βάση γνώσεων είναι το core feature: ο ιδιοκτήτης ανεβάζει αρχεία (PDF, TXT, DOCX) που περιγράφουν την επιχείρησή του — ωράριο, υπηρεσίες, τιμές, FAQ, πολιτικές — κι ο βοηθός τα χρησιμοποιεί αυτόματα (RAG) για να δίνει σωστές απαντήσεις στους πελάτες.

Υπάρχουν τρεις τρόποι δημιουργίας:
1. **Upload αρχείων** απευθείας (drag & drop)
2. **URL scraping** — βάζεις τη σελίδα της επιχείρησης
3. **AI Οδηγός Γνώσεων (KB Wizard)** — ο χρήστης απαντάει 10 απλές ερωτήσεις (ωράριο, υπηρεσίες, τιμές, FAQ, κ.ά.) κι αυτόματα δημιουργείται ολοκληρωμένο αρχείο γνώσεων. Ιδανικό για μη-τεχνικούς χρήστες.

Τεχνικά: Τα αρχεία ανεβαίνουν στο ElevenLabs Knowledge Base API — αυτόματο indexing, chunking, και RAG χωρίς να χρειάζεται δικό μας pipeline.

#### Κλήσεις, Αναλυτικά, & Ιστορικό
Κάθε τηλεφωνική κλήση καταγράφεται με πλήρη λεπτομέρεια:
- Αριθμός καλούντα & agent, κατεύθυνση (εισερχόμενη/εξερχόμενη), κατάσταση
- Χρονική στιγμή έναρξης & λήξης, διάρκεια σε δευτερόλεπτα
- Πλήρες transcript (απομαγνητοφώνηση) ολόκληρης της συνομιλίας
- AI summary (σύνοψη 2-3 προτάσεων)
- Sentiment analysis (1-5 κλίμακα: αρνητικό → θετικό)
- Intent category (π.χ. "appointment_booking", "information_request")
- Αν κλείστηκε ραντεβού ή όχι
- URL εγγραφής (recording) σε MP3
- Raw insights JSON από τον AI provider
- Idempotency (αποφυγή διπλής επεξεργασίας webhook)

**Dashboard KPIs:** Σύνολο κλήσεων, μέση διάρκεια, ποσοστό ικανοποίησης, ραντεβού που κλείστηκαν. Φίλτρα κατά χρονική περίοδο, agent, κατάσταση κλήσης.

#### Ραντεβού (Appointments)
Ο βοηθός κλείνει ραντεβού κατά τη διάρκεια κλήσεων. Κάθε ραντεβού αποθηκεύεται με:
- Όνομα και τηλέφωνο καλούντα
- Τύπος υπηρεσίας, ημερομηνία/ώρα, διάρκεια
- Κατάσταση: pending → confirmed → completed (ή cancelled / no_show)
- Σημειώσεις
- Google Calendar sync (μελλοντικό — OAuth ID αποθηκεύεται)
- Υπενθύμιση (reminder)

#### Μνήμη Καλούντων (Episodic Memory)
Ο βοηθός θυμάται τους καλούντες βάσει του αριθμού τηλεφώνου τους. Η βάση δεδομένων αποθηκεύει ανά αριθμό: όνομα, τελευταία κλήση, αριθμός αλληλεπιδράσεων, σημειωμένα topics, δυνατότητα VIP σήμανσης. Ο βοηθός λέει "Γεια σας κ. Παπαδόπουλε, πώς μπορώ να σας βοηθήσω σήμερα;" αντί για γενικό χαιρετισμό — δημιουργώντας αίσθηση εξατομίκευσης.

#### Industry Templates — Έτοιμες Ρυθμίσεις ανά Κλάδο
Η πλατφόρμα παρέχει 8 έτοιμα templates — ένα για κάθε στοχευμένο κλάδο:

| Κλάδος | Template | Περιεχόμενο |
|--------|----------|-------------|
| **Δικηγορικό Γραφείο** | law_office | Χαιρετισμός γραφείου, κανόνες αποφυγής νομικών συμβουλών, λήψη στοιχείων πελάτη, κλείσιμο ραντεβού, υπηρεσίες (αστικό/ποινικό/εμπορικό/εργατικό δίκαιο), FAQ |
| **Ιατρείο** | medical_practice | Ιατρικό πρωτόκολλο, ΠΟΤΕ ιατρικές συμβουλές, επείγοντα → 166, λήψη ΑΜΚΑ, ωράριο, υπηρεσίες |
| **Οδοντιατρείο** | dental_clinic | Κλείσιμο ραντεβού, ενδεικτικές τιμές (εξέταση 30€, καθαρισμός 60€, εμφύτευμα 800€+), έκτακτα same-day |
| **Μεσιτικό Γραφείο** | real_estate | Αγορά/πώληση/ενοικίαση, κριτήρια αναζήτησης, budget, περιοχή |
| **Κομμωτήριο** | beauty_salon | Φιλικός τόνος, υπηρεσίες & τιμές (κούρεμα 20€, βαφή 40€+, manicure 15€), ακύρωση 4 ώρες πριν |
| **Λογιστικό Γραφείο** | accounting | Ιδιώτης/εταιρεία, τήρηση βιβλίων, φορολογικές δηλώσεις, ΕΣΠΑ, μισθοδοσία |
| **Κτηνιατρείο** | veterinary | Ζεστός τόνος, τύπος ζώου/ηλικία, επείγοντα (δηλητηρίαση/τραύμα → άμεσα), τιμές |
| **Γενική Επιχείρηση** | general | Βασικοί κανόνες εξυπηρέτησης, λήψη στοιχείων, ραντεβού |

Κάθε template περιλαμβάνει: πλήρες system prompt (στα ελληνικά), χαιρετισμό, sample KB (ωράριο, υπηρεσίες, FAQ), και προτεινόμενες γλώσσες.

#### AI Chatbot Υποστήριξης (In-App Support)
Εντός της πλατφόρμας υπάρχει AI chatbot υποστήριξης, τροφοδοτούμενο από GPT-5.2 (OpenAI). Ο χρήστης ρωτάει ερωτήσεις για τη χρήση της πλατφόρμας στα ελληνικά ή αγγλικά, και ο chatbot απαντάει εξειδικευμένα — βάσει πλήρους knowledge base για τη πλατφόρμα, τα templates, τα πλάνα, τα βήματα ρύθμισης. Αν αναφέρει κλάδο (π.χ. "έχω ιατρείο"), ο chatbot δίνει industry-specific συμβουλές.

#### GDPR Compliance
Πλήρης εφαρμογή ΕΕ GDPR:
- **Άρθρο 15:** Δικαίωμα πρόσβασης — ο χρήστης εξάγει ΟΛΑ τα δεδομένα του (JSON)
- **Άρθρο 17:** Δικαίωμα διαγραφής — πλήρης διαγραφή λογαριασμού, agents, κλήσεων, ραντεβού
- **Άρθρο 20:** Δικαίωμα φορητότητας — εξαγωγή δεδομένων σε μηχαναγνώσιμη μορφή
- **Audit Log:** Κάθε ενέργεια (δημιουργία, ενημέρωση, διαγραφή, πρόσβαση) καταγράφεται
- **AES-256-GCM Encryption:** Τα API keys πελατών αποθηκεύονται κρυπτογραφημένα
- **Data Retention:** Αυτόματος καθαρισμός παλιών δεδομένων (configurable)

---

## 3. ΤΕΧΝΟΛΟΓΙΚΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ

### 3.1 Στοίβα Τεχνολογίας (Tech Stack)

| Επίπεδο | Τεχνολογία | Σκοπός |
|---------|------------|--------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | Responsive web dashboard (SPA) |
| **Styling** | Tailwind CSS 4, shadcn/ui | Modern, ελληνικό UI |
| **Backend API** | Hono.js (TypeScript, ultra-fast), @hono/node-server | REST API, port 3001 |
| **Database** | PostgreSQL 16 (Docker container) | Κύρια βάση δεδομένων — 10 πίνακες |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **AI Voice Platform** | ElevenLabs SDK (@elevenlabs/elevenlabs-js) | Conversational AI agents, KB, TTS, STT, handoff |
| **Τηλεφωνία** | Telnyx SDK | Ελληνικοί +30 αριθμοί, SIP trunk, managed sub-accounts |
| **Billing** | Stripe SDK | Subscriptions, checkout, customer portal |
| **Email** | Resend API | Transactional emails (welcome, call summaries) |
| **AI Support Chat** | OpenAI GPT-5.2 | In-app chatbot υποστήριξης |
| **Security** | AES-256-GCM encryption, JWT auth, rate limiting, Ed25519 webhook verification | Ασφάλεια δεδομένων & API |
| **Deployment** | Docker (docker-compose), PM2, Nginx | Production hosting |

### 3.2 Monorepo Αρχιτεκτονική

Ο κώδικας οργανώνεται σε pnpm monorepo workspace με τρία πακέτα:

```
voiceforge-ai/
├── apps/api/          → @voiceforge/api (Hono API server, port 3001)
├── apps/web/          → @voiceforge/web (Next.js frontend, port 3000)
├── packages/shared/   → @voiceforge/shared (Types, constants, shared logic)
├── docker/            → Docker configs, Nginx, SQL migrations
└── scripts/           → Deployment scripts
```

**API routes (13 endpoints):** agents, billing, calls, customers, dev-auth, elevenlabs-webhooks, flows, gdpr, health, knowledge-base, numbers, tools, voices, webhooks, support-chat, kb-wizard.

**Database (10 πίνακες):**
1. `customers` → Πελάτες/χρήστες — στοιχεία, plan, industry, Telnyx/Stripe IDs, Google Calendar OAuth
2. `agents` → AI βοηθοί — ρυθμίσεις, φωνή, LLM, system prompt, εργαλεία, τηλέφωνο
3. `calls` → Ιστορικό κλήσεων — transcript, summary, sentiment, recording
4. `appointments` → Ραντεβού — στοιχεία, κατάσταση, Google Calendar sync
5. `knowledge_base_documents` → Αρχεία γνώσεων — ElevenLabs doc IDs, source type, status
6. `agent_flows` → Expert mode flows — routing rules, agent order, entry agent
7. `customer_records` → Πελατολόγιο επιχείρησης — αριθμοί πελατών, document access levels
8. `webhook_events` → Log webhook events — idempotency
9. `audit_logs` → GDPR audit trail — κάθε ενέργεια
10. `caller_memories` → Episodic memory — θυμάται ποιος κάλεσε ξανά

### 3.3 Ροή Λειτουργίας — Τι Συμβαίνει σε μια Κλήση

```
1. Ο πελάτης (end-user) καλεί τον +30 αριθμό
2. Telnyx (SIP trunk) δρομολογεί την κλήση στο ElevenLabs
3. ElevenLabs AI Agent σηκώνει — λέει τον χαιρετισμό
4. Pre-call webhook → VoiceForge API:
   - Φόρτωση δυναμικών μεταβλητών (όνομα γραφείου, ωράριο κ.ά.)
   - Αν αναγνωρίζεται ο αριθμός → Episodic Memory (θυμάται τον πελάτη)
5. Η AI συνομιλεί, χρησιμοποιώντας:
   - System prompt (οδηγίες)
   - Knowledge Base (RAG — πληροφορίες επιχείρησης)
   - Tools (ελέγχει/κλείνει ραντεβού μέσω webhook)
6. Αν χρειαστεί handoff → μεταφορά σε άλλο agent ή στο κινητό ιδιοκτήτη
7. Τέλος κλήσης → Post-call webhook:
   - Αποθήκευση transcript + recording
   - AI summary + sentiment analysis
   - Ενημέρωση dashboard (real-time)
   - Email notification στον ιδιοκτήτη
   - Αποθήκευση στατιστικών usage (για billing)
```

### 3.4 Hybrid Architecture: ElevenLabs + Telnyx

Αρχικό σχέδιο ήταν Telnyx-only (all-in-one: AI + τηλεφωνία). Μετά από αξιολόγηση, αποφασίστηκε hybrid architecture:

| Component | Provider | Λόγος |
|-----------|----------|-------|
| **AI Agents (conversational AI)** | ElevenLabs | Πολύ ανώτερο KB API (native, δεν χτίζεις RAG pipeline), 5000+ voices διεθνώς, native handoff, auto language detection |
| **Τηλεφωνικοί αριθμοί (+30)** | Telnyx | Μοναδικός provider ελληνικών αριθμών μέσω API. Native SIP, managed sub-accounts |
| **SIP Trunk (σύνδεση)** | Telnyx → ElevenLabs | Telnyx αριθμός → SIP forward → ElevenLabs agent |

Αυτό σημαίνει: ο πελάτης καλεί τον Telnyx +30 αριθμό, το Telnyx δρομολογεί μέσω SIP στο ElevenLabs, όπου ο AI agent απαντάει. Outbound: ElevenLabs στέλνει SIP call μέσω Telnyx.

**Πλεονεκτήματα hybrid vs Telnyx-only:**
- ΔΕΝ χρειάζεται custom RAG pipeline (εξοικονόμηση 3-4+ εβδομάδες development)
- 5000+ φωνές (vs 2 Azure Greek voices στο Telnyx)
- Native KB upload API (αντί embeddings + buckets + similarity search)
- Transfer to agent native στο ElevenLabs SDK
- Built-in analytics, conversation evaluation
- Αυτόματο language detection

**Telnyx παραμένει αναγκαίο για:**
- Αγορά ελληνικών +30 αριθμών
- Managed Accounts (multi-tenant isolation ανά πελάτη)
- SIP trunk σύνδεση
- Πιθανό SMS αποστολής μετά-κλήσης

---

## 4. ΤΙΜΟΛΟΓΙΚΗ ΠΟΛΙΤΙΚΗ

### 4.1 Πλάνα Συνδρομής

| Πλάνο | Τιμή/μήνα | Λεπτά κλήσεων | AI Βοηθοί | Τηλεφωνικοί αριθμοί | Γλώσσες | Χαρακτηριστικά |
|-------|-----------|---------------|-----------|---------------------|---------|----------------|
| **Basic** | €200 | 400 | 1 | 1 | Ελληνικά | Διαχείριση ραντεβού, SMS επιβεβαίωσης |
| **Pro** | €400 | 800 | 3 | 3 | EL + EN + DE | +Multi-language, Annual landing page |
| **Enterprise** | €999 | 2.000 | 10 | 10 | 14 γλώσσες | +Agent teams, Αναγνώριση πελατών, Rollover λεπτών, +500 λεπτά/χρόνο |

### 4.2 Top-Ups (Πρόσθετα)

| Πρόσθετο | Τιμή | Μονάδα |
|----------|------|--------|
| Extra γλώσσα | €50 | /μήνα |
| Extra 100 λεπτά | €69 | one-time |
| Landing page (1ο έτος) | €1.500 | one-time |
| Social Media Management | από €400 | /μήνα |

### 4.3 Σύγκριση με Ανθρώπινη Γραμματέα

| | Ανθρώπινη Γραμματέα | VoiceForge Basic | VoiceForge Pro |
|---|---|---|---|
| Μηνιαίο κόστος | €800–1.200+ (μισθός+ΙΚΑ) | €200 | €400 |
| Ετήσιο κόστος | €11.200–16.800+ (13ος, 14ος, ΙΚΑ) | €2.400 | €4.800 |
| Διαθεσιμότητα | 8ωρη (Δευ-Παρ) | 24/7/365 | 24/7/365 |
| Γλώσσες | 1-2 (μάλλον μόνο Ελληνικά) | Ελληνικά | 3+ |
| Αδειες / ασθένεια | Ναι | Ποτέ | Ποτέ |
| Εκπαίδευση | Εβδομάδες | Λεπτά (template) | Λεπτά |
| Εξοικονόμηση | — | 75-83% | 60-75% |

**Βασικό selling point:** "Η Σοφία κοστίζει λιγότερο από τον μισό μισθό μιας γραμματέα — και δεν κοιμάται ποτέ."

### 4.4 Τιμολόγηση Υπέρβασης (Overage)

Αν ένας πελάτης υπερβεί τα λεπτά του πλάνου, χρεώνεται υπέρβαση. Η ακριβής τιμή ανά υπέρβαση θα οριστεί (ενδεικτικά: ~€0.50/λεπτό overage ≈ €0.05/min sell vs €0.01-0.015 cost = 70%+ margin).

---

## 5. ΔΟΜΗ ΚΟΣΤΟΥΣ — ΤΙ ΠΛΗΡΩΝΟΥΜΕ ΕΜΕΙΣ

### 5.1 Κόστος Infrastructure Providers

| Provider | Πάγιο κόστος | Μεταβλητό κόστος | Σημειώσεις |
|----------|-------------|------------------|------------|
| **ElevenLabs** | **Scale:** $330/μήνα (2M credits ≈ 2.000 min TTS) ή **Business:** $1.320/μήνα (11M credits ≈ 11.000 min) | Character-based: ~$0.03-0.05/min TTS | Πιθανό Startup Grant = **€0 για 12 μήνες** (33M characters) |
| **Telnyx** | ~€10-50/μήνα (αριθμοί) | ~€0.010-0.015/min voice, ~€1/μήνα/αριθμός | Rollup billing — εμείς πληρώνουμε, όχι ο πελάτης |
| **OpenAI** (support chat) | €0 (pay-per-use) | ~$0.01-0.03/chat interaction | Μόνο για τον in-app chatbot |
| **PostgreSQL** (Docker) | €0 (self-hosted) ή ~€20-50/μο (managed DB) | — | Production: managed DB recommended |
| **Hosting** (VPS/Cloud) | ~€50-150/μήνα | — | Railway, Render, ή bare VPS |
| **Domain + SSL** | ~€15-30/χρόνο | — | voiceforge.ai |
| **Resend** (email) | Free tier → ~$20/μο scale | $1/1000 emails | Transactional emails |

### 5.2 Unit Economics — Τι κοστίζει ΜΑΣ ανά πελάτη

**Σενάριο: Πελάτης Basic (€200/μήνα, 400 λεπτά)**

| Στοιχείο | Κόστος/μήνα | Υπολογισμός |
|----------|-------------|-------------|
| ElevenLabs TTS | ~€15-20 | ~400 min × €0.04/min (Scale plan) |
| Telnyx αριθμός | ~€1-2 | 1 αριθμός × €1-2/μο |
| Telnyx voice minutes | ~€4-6 | ~400 min × €0.01-0.015/min |
| LLM inference | ~€3-8 | GPT-4o-mini: ~400 conversations |
| Μερίδιο hosting | ~€2-5 | Ανάλογα αριθμού πελατών |
| **ΣΥΝΟΛΟ ΚΟΣΤΟΥΣ** | **~€25-41** | |
| **ΕΣΟΔΟ** | **€200** | |
| **ΜΕΙΚΤΟ ΚΕΡΔΟΣ** | **€159-175** | **~80-87% gross margin** |

**Σενάριο: Πελάτης Pro (€400/μήνα, 800 λεπτά)**

| Στοιχείο | Κόστος/μήνα |
|----------|-------------|
| ElevenLabs TTS | ~€30-40 |
| Telnyx (3 αριθμοί + minutes) | ~€12-20 |
| LLM inference | ~€6-15 |
| Hosting share | ~€3-5 |
| **ΣΥΝΟΛΟ** | **~€51-80** |
| **ΕΣΟΔΟ** | **€400** |
| **ΜΕΙΚΤΟ ΚΕΡΔΟΣ** | **€320-349** | **~80-87%** |

**Σημαντικό:** Αν εγκριθεί το **ElevenLabs Startup Grant**, το κόστος ElevenLabs μηδενίζεται για 12 μήνες, ανεβάζοντας το margin πάνω από 90%.

### 5.3 Break-Even Analysis

| Σενάριο | Fixed costs/μήνα | Break-even πελάτες |
|---------|-----------------|-------------------|
| **Solo founder, ElevenLabs Scale** | ~€500 (EL $330 + hosting €150 + misc) | 3 πελάτες Basic (€600 revenue) |
| **Solo founder, Startup Grant** | ~€200 (hosting €150 + misc) | 1 πελάτης Basic (€200 revenue) |
| **2-person team** | ~€1.500 (EL + hosting + salaries/overhead) | 8-10 πελάτες Basic (€1.600-2.000) |
| **Growth phase** | ~€3.000 (EL Business + hosting + team) | 15-20 πελάτες Basic |

---

## 6. ΑΓΟΡΑ-ΣΤΟΧΟΣ (TARGET MARKET)

### 6.1 Γεωγραφία: Ελλάδα (αρχικά)

**Γιατί Ελλάδα:**
- Πρώτη αγορά: εγχώρια γνώση, δίκτυο επαφών, κατανόηση αναγκών
- Ώριμη αγορά SMEs: ~800.000 ενεργές μικρομεσαίες επιχειρήσεις
- Κανένας τοπικός ανταγωνιστής σε AI voice receptionist (first-mover advantage)
- Ελληνική γλώσσα = φράγμα εισόδου για ξένους ανταγωνιστές (η AI πρέπει να μιλάει φυσικά ελληνικά)
- Κουλτούρα "τηλεφωνικής εξυπηρέτησης" — οι Έλληνες παίρνουν τηλέφωνο, δεν κλείνουν online

**Μελλοντική επέκταση:** Κύπρος, Βαλκάνια (Βουλγαρία, Ρουμανία), Μεσόγειος (Ιταλία, Ισπανία) — ίδιο μοντέλο, νέα templates.

### 6.2 Κλάδοι-Στόχοι

| Κλάδος | Μέγεθος αγοράς (Ελλάδα) | Πόνος | Ευκολία adoption |
|--------|-------------------------|-------|------------------|
| **Ιατρεία / Οδοντιατρεία** | ~30.000 μονάδες | Πολύ υψηλός — χάνουν ασθενείς κατά τη χειρουργική/εξέταση | Πολύ υψηλή — σαφής ROI |
| **Δικηγορικά γραφεία** | ~45.000 δικηγόροι | Υψηλός — στο δικαστήριο = αναπάντητα | Υψηλή — εμπιστεύονται τεχνολογία |
| **Λογιστικά γραφεία** | ~20.000 γραφεία | Υψηλός — φορολογική περίοδος = αδύνατο σήκωμα τηλεφώνου | Υψηλή |
| **Μεσιτικά γραφεία** | ~15.000 γραφεία | Μεσαίος — χάνουν leads | Μεσαία |
| **Κομμωτήρια / Ινστιτούτα** | ~25.000 μονάδες | Μεσαίος — κλείσιμο ραντεβού | Μεσαίος (λιγότερο tech-savvy) |
| **Κτηνιατρεία** | ~5.000 μονάδες | Μεσαίος — επείγοντα | Υψηλή |

**Ιδανικός πρώτος πελάτης:** Ιατρείο ή δικηγορικό γραφείο. Σαφές πρόβλημα (αναπάντητα), σαφής ROI (ένας νέος ασθενής/πελάτης αξίζει >€200), εξοικειωμένοι με τεχνολογία.

### 6.3 Persona Πελάτη

**Μαρία, 42, Οδοντίατρος στη Θεσσαλονίκη**
- Έχει ιδιωτικό οδοντιατρείο, 1 βοηθό (μερική απασχόληση)
- Χάνει 5-10 κλήσεις/ημέρα ενώ εξετάζει
- Πληρώνει €900/μο για τη βοηθό (8ωρη, Δευ-Παρ)
- Θέλει: ραντεβού 24/7, σωστές πληροφορίες στους ασθενείς, ελληνικά
- Budget: €200-400/μο (κλάσμα ανθρώπινου μισθού)
- Τεχνικές γνώσεις: χαμηλές — χρειάζεται wizard, templates, support

**Γιάννης, 55, Δικηγόρος στο Ηράκλειο**
- Μικρό γραφείο, μόνος (ή 1-2 συνέταιροι)
- Όταν είναι στο δικαστήριο ή σε πελάτες, κανείς δεν σηκώνει
- Χρειάζεται: αυτόματη λήψη στοιχείων, κλείσιμο ραντεβού, αποφυγή νομικών συμβουλών
- Budget: €200/μο — "αν μου φέρει 1 πελάτη/μήνα, βγαίνει"

---

## 7. ΥΦΙΣΤΑΜΕΝΗ ΚΑΤΑΣΤΑΣΗ ΑΝΑΠΤΥΞΗΣ

### 7.1 Τι Λειτουργεί Σήμερα (Μάρτιος 2026)

| Module | Κατάσταση | Λεπτομέρεια |
|--------|-----------|-------------|
| Monorepo + Build System | ✅ 100% | pnpm workspace, TypeScript, concurrent build |
| Docker + PostgreSQL | ✅ 100% | Docker Compose, 10 tables, migrations |
| API Server (Hono) | ✅ 100% | 13+ route files, middleware (auth, rate-limit, webhook-verify) |
| Dev Auth (JWT) | ✅ 100% | Register/login/me χωρίς Supabase dependency |
| Web Frontend (Next.js 15) | ✅ 100% | Dashboard, sidebar, navigation, i18n (EL/EN) |
| Login/Register UI | ✅ 100% | Πλήρης auth flow |
| Dashboard Overview | ✅ 100% | KPIs, πρόσφατες κλήσεις, στατιστικά |
| Agents Page (CRUD) | ✅ 100% | List, create, edit, delete, industry template auto-fill |
| Agent Edit Modal | ✅ 100% | Πλήρης φόρμα (ρυθμίσεις, φωνή, LLM, γλώσσες, template) |
| Calls Page | ✅ 100% | Ιστορικό, filters, pagination |
| Settings Page | ✅ 100% | Profile, timezone, locale |
| Onboarding Wizard | ✅ 100% | 5 steps: Business → Plan → Agent → Number → Review |
| Shared Types + Constants | ✅ 100% | Agent, Call, Customer, Webhook, Billing types, 8 templates |
| ElevenLabs Service | ✅ 100% | Agent CRUD, KB upload, attach KB, voice list, conversations, handoff (748 γραμμές) |
| Telnyx Service | ✅ Κώδικας | Managed accounts, assistant CRUD, phone numbers, SIP — **UNTESTED** (χρειάζεται API key + approval) |
| Knowledge Base Upload | ✅ 100% | Upload, wizard, attach to agent |
| KB Wizard (AI) | ✅ 100% | 10 ερωτήσεις → αυτόματο KB |
| Industry Templates (8) | ✅ 100% | Πλήρη templates με instructions, KB, greeting, languages |
| AI Support Chatbot | ✅ 100% | GPT-5.2, πλήρες platform knowledge |
| GDPR Routes | ✅ 100% | Export, delete, audit log |
| Email Service | ✅ 100% | Resend — welcome, call summary templates |
| Encryption Service | ✅ 100% | AES-256-GCM — API keys |
| Rate Limiting | ✅ 100% | Per-plan limits |
| Webhooks | ✅ Κώδικας | Pre-call, post-call, insights — untested with real calls |
| Caller Memory | ✅ 100% | Episodic memory schema + logic |
| Stripe Billing | ✅ Κώδικας | Checkout, portal, subscriptions — untested |
| Docker Production | ✅ 100% | Dockerfile.api, Dockerfile.web, Nginx config, PM2 |

### 7.2 Τι Λείπει / Χρειάζεται Δουλειά

| Feature | Τι χρειάζεται | Εκτίμηση χρόνου |
|---------|--------------|-----------------|
| **Telnyx Real Integration** | API key, Level 2 verification, Managed Accounts approval, first real call | 1-2 εβδομάδες (waiting + testing) |
| **ElevenLabs SIP Trunk Setup** | Σύνδεση Telnyx αριθμών → ElevenLabs agents μέσω SIP | 1-2 μέρες (μετά Telnyx approval) |
| **Expert Mode Flow Builder UI** | React Flow canvas, agent nodes, connection lines, routing rules editor | 2-3 εβδομάδες |
| **Google Calendar Integration** | OAuth2 flow, calendar read/write, sync appointments | 1 εβδομάδα |
| **Push Notifications** | Service Worker, Web Push API, real-time dashboard alerts | 3-4 ημέρες |
| **SMS Post-Call** | Telnyx SMS API — αποστολή SMS μετά κλήση στον πελάτη | 1-2 ημέρες |
| **Agent Test Widget** | In-browser δοκιμή φωνής agent (ElevenLabs widget embed) | 2-3 ημέρες |
| **Supabase Production Auth** | Αντικατάσταση dev auth → Supabase Auth + social login | 3-4 ημέρες |
| **Customer Records CRUD** | API route + UI for enterprise feature (πελατολόγιο) | 2-3 ημέρες |
| **Plan Name Migration** | DB enum rename (starter→basic, business→enterprise) | 1 ημέρα |
| **Landing Page / Marketing Site** | Public website, pricing, demo, signup | 1-2 εβδομάδες |

---

## 8. ΑΝΤΑΓΩΝΙΣΤΙΚΗ ΤΟΠΟΘΕΤΗΣΗ

### 8.1 Τι Υπάρχει στην Αγορά

**Διεθνώς:**
- **Vapi.ai** — AI voice agent platform (ΗΠΑ). Τεχνικό target, developer-focused, δεν υποστηρίζει ελληνικά natively. $0.05/min + infra costs.
- **Bland.ai** — Enterprise AI phone agents. Πολύ ακριβό, USA-focused.
- **Air.ai** — Consumer-facing AI calls. Limited language support.
- **Retell.ai** — Developer platform, build-your-own. Δεν είναι white-label SaaS.
- **Synthflow.ai** — No-code AI voice agents, πιο κοντά σε εμάς. Αγγλικά/Ισπανικά/Γερμανικά. Ελληνικά ΟΧΙ.

**Στην Ελλάδα:**
- **ΚΑΝΕΝΑΣ** δεν προσφέρει AI voice receptionist ως SaaS για ελληνικές SMEs. Υπάρχουν τηλεφωνικά κέντρα (call centers) και virtual assistant υπηρεσίες αλλά ανθρώπινες.

### 8.2 Τα Ανταγωνιστικά μας Πλεονεκτήματα

| Πλεονέκτημα | Εξήγηση |
|-------------|---------|
| **Ελληνικά-first** | Η πλατφόρμα, τα templates, το UI, το support chatbot — ΟΛΑ στα ελληνικά. Κανένας ανταγωνιστής δεν κάνει αυτό. |
| **Industry templates** | 8 κλάδους με έτοιμα system prompts, KB, FAQ — ο πελάτης ξεκινάει σε λεπτά. |
| **Naive mode** | Wizard 5-βημάτων — μηδέν τεχνικές γνώσεις. Ο ανταγωνισμός είναι developer-focused. |
| **Expert mode** | Multi-agent flows — επεκτασιμότητα σε μεγαλύτερες επιχειρήσεις. |
| **Τιμολόγηση** | €200-999/μο vs €800-1.200/μο ανθρώπινη γραμματέα. Αδιαμφισβήτητο ROI. |
| **24/7** | Δεν κοιμάται, δεν αρρωσταίνει, δεν παραπονιέται. |
| **Episodic memory** | Θυμάται τους πελάτες — κάτι που ούτε οι ανθρώπινες γραμματείς κάνουν πάντα. |
| **GDPR built-in** | EU compliance from day one — σημαντικό για ευρωπαϊκή αγορά. |
| **White-label δυνατότητα** | Η αρχιτεκτονική (managed sub-accounts, per-customer isolation) επιτρέπει B2B2B — πώληση σε consultants/partners. |

---

## 9. ΜΟΝΤΕΛΟ ΕΣΟΔΩΝ & PROJECTIONS

### 9.1 Revenue Streams

1. **Monthly Subscriptions (κύριο):** €200-999/μο ανά πελάτη
2. **Overage Minutes:** ~€0.50/λεπτό υπέρβασης
3. **Top-Ups:** Extra γλώσσες (€50/μο), Extra λεπτά (€69)
4. **Add-On Services:** Landing page (€1.500), Social Media Management (€400+/μο)
5. **Enterprise Custom:** Tailor-made λύσεις, custom integrations, SLA

### 9.2 Ενδεικτικές Προβλέψεις (Conservative)

| Χρονικό σημείο | Πελάτες | MRR (Monthly Recurring Revenue) | Gross Margin |
|----------------|---------|------|--------------|
| **Μήνας 3** (soft launch) | 5 | €1.200 (mix Basic/Pro) | ~80% |
| **Μήνας 6** | 15 | €4.000 | ~82% |
| **Μήνας 12** | 40 | €12.000 | ~85% |
| **Μήνας 18** | 80 | €25.000 | ~85% |
| **Μήνας 24** | 150 | €50.000 | ~87% |

**Υποθέσεις:** Mix ~60% Basic / 30% Pro / 10% Enterprise. Churn ~5%/μήνα αρχικά, μειώνεται. Δεν περιλαμβάνει add-on services.

### 9.3 Κλιμάκωση Κόστους

| Πελάτες | ElevenLabs | Telnyx | Hosting | Σύνολο fixed/μο |
|---------|-----------|--------|---------|-----------------|
| 1-10 | $330 (Scale) | ~€30 | ~€100 | ~€430 |
| 10-50 | $330-660 | ~€100 | ~€200 | ~€800 |
| 50-100 | $1.320 (Business) | ~€300 | ~€400 | ~€2.000 |
| 100-500 | $1.320+ usage | ~€1.000 | ~€1.000 | ~€4.000+ |

---

## 10. MODULES & ΑΡΧΙΤΕΚΤΟΝΙΚΗ — ΠΛΗΡΗΣ ΑΝΑΦΟΡΑ

### 10.1 Backend API Modules (apps/api)

| Module (Route) | Αρχείο | Λειτουργίες |
|----------------|--------|-------------|
| **Agents** | routes/agents.ts | CRUD AI βοηθών, σύνδεση με ElevenLabs, ρυθμίσεις φωνής/LLM/tools |
| **Calls** | routes/calls.ts | Ιστορικό κλήσεων, filters, pagination, transcript, recording |
| **Billing** | routes/billing.ts | Stripe checkout, portal, subscription management (341 γραμμές) |
| **Customers** | routes/customers.ts | Profile management, settings |
| **Numbers** | routes/numbers.ts | Αναζήτηση + αγορά +30 αριθμών μέσω Telnyx |
| **Knowledge Base** | routes/knowledge-base.ts | Upload αρχείων, attach σε agent, list, delete |
| **KB Wizard** | routes/kb-wizard.ts | AI-powered βοηθός δημιουργίας KB (10 ερωτήσεις → αυτόματο αρχείο, 347 γραμμές) |
| **Flows** | routes/flows.ts | Expert mode — CRUD multi-agent flows, routing rules |
| **Webhooks** | routes/webhooks.ts | Telnyx pre-call (dynamic vars, memory), post-call (transcript, summary, insights) |
| **ElevenLabs Webhooks** | routes/elevenlabs-webhooks.ts | ElevenLabs-specific events |
| **Tools** | routes/tools.ts | Calendar check/book endpoints (κλήση εντός AI conversation, 231 γραμμές) |
| **GDPR** | routes/gdpr.ts | Data export, delete, audit — EU compliance (306 γραμμές) |
| **Voices** | routes/voices.ts | Λίστα φωνών ElevenLabs |
| **Health** | routes/health.ts | API health check |
| **Support Chat** | routes/support-chat.ts | AI chatbot (GPT-5.2) — πλήρες platform knowledge (344 γραμμές) |
| **Dev Auth** | routes/dev-auth.ts | JWT development auth (register/login/me) |

| Service | Αρχείο | Λειτουργίες |
|---------|--------|-------------|
| **ElevenLabs** | services/elevenlabs.ts | Agent CRUD, KB upload/attach, voice list, conversations, handoff, phone config (748 γραμμές) |
| **Telnyx** | services/telnyx.ts | Managed accounts, assistant CRUD, phone numbers, SIP, conversations (690 γραμμές) |
| **Stripe** | services/stripe.ts | Customer management, subscriptions, checkout (242 γραμμές) |
| **Email** | services/email.ts | Welcome email, call summary, templates (Resend, 241 γραμμές) |
| **Encryption** | services/encryption.ts | AES-256-GCM encrypt/decrypt for API keys |
| **Dev Auth** | services/dev-auth.ts | JWT sign/verify for development mode |

| Middleware | Σκοπός |
|------------|--------|
| **auth.ts** | Dual mode: Supabase Auth + Dev JWT |
| **rate-limit.ts** | Per-plan rate limiting |
| **webhook-verify.ts** | Ed25519 signature verification |

### 10.2 Frontend Modules (apps/web)

| Σελίδα/Component | Λειτουργία |
|------------------|------------|
| **Dashboard Overview** | KPIs, πρόσφατες κλήσεις, στατιστικά, γρήγορες ενέργειες |
| **Agents Page** | List agents, create/edit/delete, industry template auto-fill |
| **Agent Edit Modal** | Πλήρης φόρμα ρυθμίσεων (40+ πεδία), industry template auto-fill, voice selection |
| **Calls Page** | Ιστορικό κλήσεων, filters, expanded details, transcript, recording player |
| **Settings Page** | Profile, timezone, locale, notifications |
| **Onboarding (5 steps)** | Step-by-step wizard: Business → Plan → Agent → Number → Review → Launch |
| **Support Chatbot** | Floating AI chatbot, quick suggestions, reset, GPT-5.2 powered |
| **Knowledge Base Upload** | Drag & drop upload, file list, KB wizard trigger |
| **Layout** | Sidebar navigation, responsive, user menu, dark/light mode |
| **i18n** | Ελληνικά + English (full translation files) |
| **Auth Pages** | Login, Register, password reset, redirect flows |

### 10.3 Shared Package (packages/shared)

Περιλαμβάνει:
- **Types:** Agent, Call, Customer, Webhook, Billing, Flow, KnowledgeBase, Appointment — TypeScript interfaces
- **Constants:** Industries (8), Plans & limits, Top-ups, Supported languages (24), Voices, LLM models, TTS models, Call statuses, Agent statuses, Error codes
- **Industry Templates:** 8 πλήρη templates (instructions, greeting, sampleKB, suggestedLanguages)

---

## 11. ΑΣΦΑΛΕΙΑ & COMPLIANCE

| Μέτρο | Υλοποίηση |
|-------|-----------|
| **Encryption at rest** | AES-256-GCM για API keys (Telnyx, Google OAuth, ElevenLabs) |
| **JWT Authentication** | Stateless auth, secure cookie storage |
| **Rate Limiting** | Per-plan limits — Basic: χαμηλότερα, Enterprise: υψηλότερα |
| **Webhook Verification** | Ed25519 signature verification (Telnyx) |
| **GDPR** | Full Articles 15 (access), 17 (erasure), 20 (portability) |
| **Audit Log** | Κάθε ενέργεια καταγράφεται (create, update, delete, access, export) |
| **Data Retention** | Configurable auto-cleanup worker (data-retention.ts) |
| **CORS** | Strict origin policy |
| **Input Validation** | Zod schemas σε κάθε endpoint |
| **EU Data Residency** | PostgreSQL EU, ElevenLabs EU endpoints, Telnyx EU PoPs |

---

## 12. ΒΑΣΙΚΑ ΡΙΣΚΑ & ΑΝΤΙΜΕΤΩΠΙΣΗ

| Ρίσκο | Πιθανότητα | Επίπτωση | Αντιμετώπιση |
|-------|-----------|----------|--------------|
| **Telnyx Managed Accounts δεν εγκρίνονται** | Χαμηλή-Μεσαία | Υψηλή — δεν δουλεύει multi-tenant | Fallback: single Telnyx account, isolation μέσω software |
| **ElevenLabs αλλαγή τιμών** | Μεσαία | Μεσαία — κόστος αυξάνεται | Telnyx AI Assistants ως backup, architecture is swappable |
| **Ελληνική φωνή δεν ικανοποιεί** | Χαμηλή | Υψηλή — core value proposition | Δοκιμή πολλαπλών φωνών ElevenLabs, custom voice training |
| **Αργή απόκτηση πελατών** | Μεσαία | Υψηλή — revenue delay | Δωρεάν trial period, referral program, partnerships με συλλόγους |
| **AI hallucinates** | Μεσαία | Μεσαία — λάθος πληροφορίες | KB-grounded responses, strict system prompts, monitoring |
| **Churn** | Μεσαία | Μεσαία | Continuous improvement, callbacks, quarterly business reviews |
| **Regulatory** | Χαμηλή | Μεσαία — GDPR, τηλεπικοινωνίες | Built-in GDPR, EU data residency, legal consultation |

---

## 13. ΟΜΑΔΑ & ΡΟΛΟΙ

| Ρόλος | Ευθύνες |
|-------|---------|
| **Πάνος (Founder)** | Vision, product management, development, customer acquisition, Greek market expertise |
| **Wlad (Co-founder/Partner)** | Ρόλος TBD — business development ή/και τεχνικό |
| **AI Dev Agent** | Κωδικοποίηση, αρχιτεκτονική, debugging, documentation (πλήρης ανάπτυξη codebase) |

---

## 14. ROAD MAP — ΠΡΟΣΕΧΕΙΣ ΜΗΝΕΣ

### Μάρτιος 2026 — Q1 Ολοκλήρωση
- [x] Ολοκλήρωση Naive mode (onboarding wizard, templates, KB wizard)
- [x] AI support chatbot
- [x] Industry templates (8 κλάδοι)
- [x] Episodic memory
- [ ] Telnyx activation + first real call
- [ ] ElevenLabs SIP trunk σε πραγματικό αριθμό
- [ ] Agent test widget (in-browser voice testing)

### Απρίλιος 2026 — Beta Launch
- [ ] 5-10 beta πελάτες (ιατρεία + δικηγόροι)
- [ ] Supabase production auth
- [ ] Push notifications
- [ ] SMS post-call
- [ ] Landing page + marketing site
- [ ] Feedback collection & iteration

### Μάιος-Ιούνιος 2026 — Growth
- [ ] Expert mode (flow builder UI)
- [ ] Google Calendar integration
- [ ] 20-30 πελάτες
- [ ] Customer records (enterprise)
- [ ] Outbound calls feature
- [ ] Analytics dashboards (detailed)

### Q3-Q4 2026 — Scale
- [ ] 50-100 πελάτες
- [ ] Partnerships (ιατρικοί/δικηγορικοί σύλλογοι)
- [ ] Κύπρος expansion
- [ ] API access (enterprise)
- [ ] Mobile PWA optimization
- [ ] White-label for partners

---

## 15. ΒΑΣΙΚΑ METRICS & KPIs

| Metric | Τι μετράμε | Στόχος Year 1 |
|--------|-----------|---------------|
| **MRR** | Monthly Recurring Revenue | €12.000+ |
| **Paying Customers** | Ενεργοί πελάτες | 40+ |
| **Churn Rate** | % πελατών που αποχωρούν/μήνα | <5% |
| **LTV** | Customer Lifetime Value | €2.400+ (12 μήνες Basic) |
| **CAC** | Customer Acquisition Cost | <€200 |
| **LTV:CAC** | Αναλογία | >10:1 |
| **Gross Margin** | (Revenue - COGS) / Revenue | >80% |
| **Total Minutes** | Λεπτά κλήσεων/μήνα | 10.000+ |
| **CSAT** | Customer Satisfaction Score | >4.0/5.0 |
| **NPS** | Net Promoter Score | >40 |

---

## 16. ΓΛΩΣΣΑΡΙΟ

| Όρος | Εξήγηση |
|------|---------|
| **Agent** | AI φωνητικός βοηθός — μια ρεσεψιονίστ τεχνητής νοημοσύνης |
| **Flow** | Σύνολο agents που συνδέονται (expert mode) |
| **Knowledge Base (KB)** | Αρχεία/κείμενα που ο agent χρησιμοποιεί ως πληροφορίες |
| **RAG** | Retrieval-Augmented Generation — η AI "ψάχνει" στη KB πριν απαντήσει |
| **System Prompt** | Οδηγίες που ορίζουν τη συμπεριφορά του agent |
| **Handoff** | Μεταφορά κλήσης από agent σε agent (ή σε άνθρωπο) |
| **SIP Trunk** | Πρωτόκολλο τηλεφωνίας — συνδέει Telnyx αριθμούς με ElevenLabs |
| **TTS** | Text-to-Speech — μετατροπή κειμένου σε φωνή (ElevenLabs) |
| **STT** | Speech-to-Text — μεταγραφή ομιλίας σε κείμενο (Deepgram) |
| **LLM** | Large Language Model — η "νοημοσύνη" (GPT, Claude, Gemini) |
| **MRR** | Monthly Recurring Revenue — μηνιαία επαναλαμβανόμενα έσοδα |
| **Churn** | Ρυθμός αποχώρησης πελατών |
| **CAC** | Customer Acquisition Cost — κόστος απόκτησης πελάτη |
| **LTV** | Lifetime Value — συνολική αξία πελάτη |
| **White-label** | Platform χωρίς branding — ο partner το πουλάει ως δικό του |
| **Managed Accounts** | Telnyx feature: sub-accounts per customer (multi-tenant isolation) |
| **Naive/Expert** | Τα δύο UX modes: απλό wizard vs flow builder |

---

*VoiceForge AI Business Plan Reference — Μάρτιος 2026*  
*Αυτό το έγγραφο αντικατοπτρίζει πιστά τη σημερινή κατάσταση κώδικα, τεχνολογίας, και business logic.*
