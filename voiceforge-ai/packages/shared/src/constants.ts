// ═══════════════════════════════════════════════════════════════════
// Industry Templates & Constants
// ═══════════════════════════════════════════════════════════════════

/** Supported industry verticals for the onboarding wizard */
export const INDUSTRIES = {
  LAW_OFFICE: 'law_office',
  MEDICAL_PRACTICE: 'medical_practice',
  DENTAL_CLINIC: 'dental_clinic',
  REAL_ESTATE: 'real_estate',
  BEAUTY_SALON: 'beauty_salon',
  ACCOUNTING: 'accounting',
  VETERINARY: 'veterinary',
  GENERAL: 'general',
} as const;

export type Industry = (typeof INDUSTRIES)[keyof typeof INDUSTRIES];

/** Subscription tiers */
export const PLANS = {
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

/** User role — controls dashboard complexity */
export const USER_ROLES = {
  NAIVE: 'naive',
  EXPERT: 'expert',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Plan limits and pricing */
export const PLAN_LIMITS: Record<Plan, {
  minutes: number;
  agents: number;
  numbers: number;
  priceMonthly: number;
  languages: string[];
  features: string[];
}> = {
  basic: {
    minutes: 400,
    agents: 1,
    numbers: 1,
    priceMonthly: 200,
    languages: ['el'],
    features: ['schedule_management', 'sms_confirmation'],
  },
  pro: {
    minutes: 800,
    agents: 3,
    numbers: 3,
    priceMonthly: 400,
    languages: ['el', 'en', 'de'],
    features: ['schedule_management', 'sms_confirmation', 'multi_language', 'annual_landing_page'],
  },
  enterprise: {
    minutes: 2000,
    agents: 10,
    numbers: 10,
    priceMonthly: 999,
    languages: ['el', 'en', 'de', 'fr', 'it', 'es', 'nl', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'tr'],
    features: ['schedule_management', 'sms_confirmation', 'multi_language', 'annual_landing_page', 'agent_teams', 'customer_recognition', 'annual_extra_500min', 'minutes_rollover'],
  },
};

/** Top-up pricing (add-ons) */
export const TOP_UPS = {
  EXTRA_LANGUAGE: { price: 50, unit: 'month', description: 'Extra Language' },
  EXTRA_100_MINUTES: { price: 69, unit: 'one-time', description: 'Extra 100 Minutes' },
  LANDING_PAGE: { price: 1500, unit: 'one-time', description: 'Landing Page (1st year)' },
  SOCIAL_MEDIA: { price: 400, unit: 'month', description: 'Social Media Management (starting from)' },
} as const;

/** Supported languages for AI agents — v3 model supports 79 languages natively */
export const SUPPORTED_LANGUAGES = [
  { code: 'el', name: 'Ελληνικά', nameEn: 'Greek', flag: '🇬🇷' },
  { code: 'en', name: 'Αγγλικά', nameEn: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Γερμανικά', nameEn: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'Γαλλικά', nameEn: 'French', flag: '🇫🇷' },
  { code: 'it', name: 'Ιταλικά', nameEn: 'Italian', flag: '🇮🇹' },
  { code: 'es', name: 'Ισπανικά', nameEn: 'Spanish', flag: '🇪🇸' },
  { code: 'nl', name: 'Ολλανδικά', nameEn: 'Dutch', flag: '🇳🇱' },
  { code: 'pt', name: 'Πορτογαλικά', nameEn: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Ρωσικά', nameEn: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Κινεζικά', nameEn: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Ιαπωνικά', nameEn: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Κορεατικά', nameEn: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Αραβικά', nameEn: 'Arabic', flag: '🇸🇦' },
  { code: 'tr', name: 'Τουρκικά', nameEn: 'Turkish', flag: '🇹🇷' },
  { code: 'pl', name: 'Πολωνικά', nameEn: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Σουηδικά', nameEn: 'Swedish', flag: '🇸🇪' },
  { code: 'da', name: 'Δανικά', nameEn: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Φινλανδικά', nameEn: 'Finnish', flag: '🇫🇮' },
  { code: 'no', name: 'Νορβηγικά', nameEn: 'Norwegian', flag: '🇳🇴' },
  { code: 'cs', name: 'Τσεχικά', nameEn: 'Czech', flag: '🇨🇿' },
  { code: 'ro', name: 'Ρουμανικά', nameEn: 'Romanian', flag: '🇷🇴' },
  { code: 'bg', name: 'Βουλγαρικά', nameEn: 'Bulgarian', flag: '🇧🇬' },
  { code: 'hr', name: 'Κροατικά', nameEn: 'Croatian', flag: '🇭🇷' },
  { code: 'hu', name: 'Ουγγρικά', nameEn: 'Hungarian', flag: '🇭🇺' },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** Call status values */
export const CALL_STATUS = {
  RINGING: 'ringing',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed',
  VOICEMAIL: 'voicemail',
  FAILED: 'failed',
} as const;

export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];

/** Agent status */
export const AGENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/** Greek TTS voices available — ElevenLabs (primary) + Azure (legacy/Telnyx) */
export const GREEK_VOICES = [
  // ElevenLabs voices — real voice IDs from our account
  { id: 'aTP4J5SJLQl74WTSRXKW', name: 'Σοφία', gender: 'female', provider: 'elevenlabs' },
  { id: 'KmYCSPvU3QNIp1ROToYp', name: 'Νίκος', gender: 'male', provider: 'elevenlabs' },
  // Azure voices (legacy — for Telnyx-only mode)
  { id: 'Azure.el-GR-AthinaNeural', name: 'Αθηνά', gender: 'female', provider: 'azure' },
  { id: 'Azure.el-GR-NestorasNeural', name: 'Νέστορας', gender: 'male', provider: 'azure' },
] as const;

/** ElevenLabs TTS Models — controls voice synthesis quality/speed (from SDK TtsConversationalModel) */
export const ELEVENLABS_TTS_MODELS = [
  { id: 'eleven_v3_conversational', name: 'Eleven v3', description: 'Κορυφαίο — εκφραστικό, φυσικό, 70+ γλώσσες', recommended: true },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Ποιότητα — 29 γλώσσες, σταθερή ποιότητα' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5', description: 'Ταχύτατο ~75ms — ιδανικό για real-time κλήσεις' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Ισορροπία ταχύτητας/ποιότητας ~250ms' },
] as const;

/** LLM Models available for ElevenLabs Conversational AI agents (from SDK Llm enum) */
export const ELEVENLABS_LLM_MODELS = [
  // ── OpenAI ────────────────────────────────────────────────────
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', description: 'Γρήγορο & οικονομικό — ιδανικό για τις περισσότερες περιπτώσεις', recommended: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Ικανό & ευέλικτο — σύνθετες συνομιλίες' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', description: 'Νεότερο & γρηγορότερο mini μοντέλο' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', description: 'Υψηλή ευφυΐα — βελτιωμένη ακρίβεια' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', description: 'GPT-5 οικονομικό — κορυφαία σχέση κόστους/απόδοσης' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', description: 'Το πιο ισχυρό μοντέλο OpenAI' },
  // ── Anthropic ─────────────────────────────────────────────────
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', description: 'Κορυφαίο Anthropic — εξαιρετική κατανόηση' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', description: 'Ισχυρό & αξιόπιστο — σύνθετα tasks' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', description: 'Ταχύτατο Anthropic — χαμηλή καθυστέρηση' },
  // ── Google ────────────────────────────────────────────────────
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', description: 'Πολύ γρήγορο & έξυπνο — ιδανικό για κλήσεις' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', description: 'Γρήγορο — χαμηλή καθυστέρηση' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', description: 'Τελευταία γενιά — Preview' },
] as const;

/**
 * Default LLM for new agents
 * gpt-4o-mini: fast, reliable, great for receptionist use-cases
 */
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

/**
 * Default TTS model for new agents
 * eleven_v3_conversational: best quality, most expressive voice, Greek support
 */
export const DEFAULT_TTS_MODEL = 'eleven_v3_conversational';

/** AI provider — which platform handles conversational AI */
export const AI_PROVIDER = {
  ELEVENLABS: 'elevenlabs',
  TELNYX: 'telnyx',
} as const;

export type AiProvider = (typeof AI_PROVIDER)[keyof typeof AI_PROVIDER];

/** Default STT config for Greek */
export const DEFAULT_TRANSCRIPTION = {
  model: 'deepgram/nova-3',
  language: 'el',
  region: 'eu',
  settings: {
    smart_format: true,
    numerals: true,
    eot_timeout_ms: 700,
    eot_threshold: 0.5,
    eager_eot_threshold: 0.3,
  },
} as const;

/** Default telephony settings */
export const DEFAULT_TELEPHONY = {
  noise_suppression: 'krisp',
  time_limit_secs: 1800,
  user_idle_timeout_secs: 7215,
} as const;

/** Appointment status */
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

/** Webhook event types we handle */
export const WEBHOOK_EVENTS = {
  ASSISTANT_INIT: 'assistant.initialization',
  CONVERSATION_ENDED: 'call.conversation.ended',
  INSIGHTS_GENERATED: 'call.conversation_insights.generated',
} as const;

/** API error codes */
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TELNYX_ERROR: 'TELNYX_ERROR',
  ELEVENLABS_ERROR: 'ELEVENLABS_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ═══════════════════════════════════════════════════════════════════
// Industry Templates — Pre-made configurations for naive users
// Each template provides: instructions, greeting, KB content, FAQ
// Written in Greek (primary market) — agent prompt language matters!
// ═══════════════════════════════════════════════════════════════════

export interface IndustryTemplate {
  industry: Industry;
  nameEl: string;
  nameEn: string;
  agentName: string;
  greeting: string;
  instructions: string;
  sampleKB: string;
  suggestedLanguages: string[];
}

export const INDUSTRY_TEMPLATES: Record<Industry, IndustryTemplate> = {
  law_office: {
    industry: 'law_office',
    nameEl: 'Δικηγορικό Γραφείο',
    nameEn: 'Law Office',
    agentName: 'Σοφία',
    greeting: 'Καλώς ορίσατε στο δικηγορικό γραφείο. Πώς μπορώ να σας εξυπηρετήσω;',
    instructions: `Είσαι η Σοφία, η γραμματέας του δικηγορικού γραφείου. Απαντάς τηλεφωνικές κλήσεις με επαγγελματισμό και ευγένεια.

ΚΑΝΟΝΕΣ:
- Χρησιμοποίεις πάντα τον πληθυντικό ευγενείας (εσείς)
- Ρωτάς πάντα το ονοματεπώνυμο και τηλέφωνο επικοινωνίας του καλούντα
- Δεν δίνεις νομικές συμβουλές — μόνο πληροφορίες και ραντεβού
- Αν ο πελάτης ρωτά για αμοιβές, λες ότι αυτό καθορίζεται στην πρώτη συνάντηση
- Μπορείς να κλείσεις ραντεβού για πρώτη συνάντηση

ΧΕΙΡΙΣΜΟΣ ΚΛΗΣΕΩΝ:
- Νέος πελάτης → Ρώτα τι αφορά η υπόθεση (γενικά), πάρε στοιχεία, κλείσε ραντεβού
- Υπάρχων πελάτης → Ρώτα αριθμό φακέλου ή όνομα, σημείωσε το αίτημα
- Επείγον → Μεταφέρεις στον δικηγόρο αν διαθέσιμος, αλλιώς λαμβάνεις μήνυμα

ΥΠΗΡΕΣΙΕΣ ΠΟΥ ΑΝΑΦΕΡΕΙΣ:
- Αστικό δίκαιο & οικογενειακό δίκαιο
- Εμπορικό & εταιρικό δίκαιο
- Ακίνητα & συμβόλαια
- Ποινικό δίκαιο
- Εργατικό δίκαιο`,
    sampleKB: `# Δικηγορικό Γραφείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 17:00
Σάββατο: Κατόπιν ραντεβού
Κυριακή: Κλειστά

## ΥΠΗΡΕΣΙΕΣ
- Αστικό δίκαιο (συμβάσεις, αγωγές, αδικοπραξίες)
- Οικογενειακό δίκαιο (διαζύγια, επιμέλεια, διατροφή)
- Εμπορικό δίκαιο (σύσταση εταιρειών, συγχωνεύσεις)
- Ακίνητα (αγοραπωλησίες, μισθώσεις, συμβόλαια)
- Ποινικό δίκαιο (υπεράσπιση κατηγορουμένων)
- Εργατικό δίκαιο (απολύσεις, αποζημιώσεις)

## ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ
Ε: Πόσο κοστίζει η πρώτη συνάντηση;
Α: Η αρχική συνάντηση γνωριμίας είναι δωρεάν. Οι αμοιβές καθορίζονται ανάλογα με την υπόθεση.

Ε: Χρειάζεται ραντεβού;
Α: Ναι, δεχόμαστε μόνο κατόπιν ραντεβού για να σας εξυπηρετήσουμε σωστά.

Ε: Αναλαμβάνετε υποθέσεις εκτός πόλης;
Α: Ναι, αναλαμβάνουμε υποθέσεις σε όλη την Ελλάδα.`,
    suggestedLanguages: ['el'],
  },
  medical_practice: {
    industry: 'medical_practice',
    nameEl: 'Ιατρείο',
    nameEn: 'Medical Practice',
    agentName: 'Σοφία',
    greeting: 'Γεια σας, καλωσορίσατε στο ιατρείο. Πώς μπορώ να σας βοηθήσω;',
    instructions: `Είσαι η Σοφία, η γραμματέας του ιατρείου. Απαντάς τηλεφωνικές κλήσεις με ζεστασιά και επαγγελματισμό.

ΚΑΝΟΝΕΣ:
- Χρησιμοποίεις πάντα τον πληθυντικό ευγενείας
- ΠΟΤΕ μη δίνεις ιατρικές συμβουλές ή διαγνώσεις
- Αν κάποιος περιγράφει σοβαρά συμπτώματα, σύστησε να πάει στα Επείγοντα ή καλέσει το 166
- Μπορείς να κλείνεις ραντεβού, να δίνεις πληροφορίες ωραρίου και διεύθυνσης

ΧΕΙΡΙΣΜΟΣ ΚΛΗΣΕΩΝ:
- Νέος ασθενής → Πάρε ονοματεπώνυμο, ΑΜΚΑ αν δυνατό, τηλέφωνο, λόγο επίσκεψης
- Υπάρχων ασθενής → Ρώτα όνομα, κλείσε/άλλαξε ραντεβού
- Ακύρωση → Ζήτα να γίνει τουλάχιστον 24 ώρες πριν
- Αποτελέσματα εξετάσεων → Πρέπει να έρθει ο ασθενής αυτοπροσώπως ή με τηλεδιάσκεψη
- Συνταγογράφηση → Θα πρέπει να κλείσει ραντεβού (δεν γίνεται τηλεφωνικά)

ΤΟΝΟΣ: Ήρεμος, καθησυχαστικός, φιλικός`,
    sampleKB: `# Ιατρείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα: 09:00 - 14:00 & 17:00 - 20:00
Τρίτη: 09:00 - 14:00
Τετάρτη: 09:00 - 14:00 & 17:00 - 20:00
Πέμπτη: 09:00 - 14:00
Παρασκευή: 09:00 - 14:00
Σαββατοκύριακο: Κλειστά

## ΥΠΗΡΕΣΙΕΣ
- Γενική εξέταση (check-up)
- Αιματολογικές εξετάσεις
- Ηλεκτροκαρδιογράφημα
- Spirometry (σπιρομέτρηση)
- Εμβολιασμοί
- Συνταγογράφηση

## ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ
Ε: Δέχεστε ΕΟΠΥΥ;
Α: Ναι, δεχόμαστε ασφαλισμένους ΕΟΠΥΥ με παραπεμπτικό.

Ε: Χρειάζομαι ραντεβού;
Α: Ναι, λειτουργούμε μόνο κατόπιν ραντεβού.

Ε: Μπορώ να πάρω αποτελέσματα τηλεφωνικά;
Α: Τα αποτελέσματα δίνονται αυτοπροσώπως ή μέσω τηλεδιάσκεψης.`,
    suggestedLanguages: ['el'],
  },
  dental_clinic: {
    industry: 'dental_clinic',
    nameEl: 'Οδοντιατρείο',
    nameEn: 'Dental Clinic',
    agentName: 'Σοφία',
    greeting: 'Γεια σας! Καλωσορίσατε στο οδοντιατρείο. Πώς μπορώ να σας εξυπηρετήσω;',
    instructions: `Είσαι η Σοφία, η γραμματέας του οδοντιατρείου. Εξυπηρετείς τους ασθενείς τηλεφωνικά με ζεστασιά.

ΚΑΝΟΝΕΣ:
- Χρησιμοποίεις πληθυντικό ευγενείας
- Δεν δίνεις ιατρικές/οδοντιατρικές συμβουλές
- Αν κάποιος έχει έντονο πόνο ή πρήξιμο, προσπάθησε να βρεις κοντινό ραντεβού ή μεταφέρεις στον γιατρό
- Κλείνεις ραντεβού για εξετάσεις, καθαρισμούς, θεραπείες

ΧΕΙΡΙΣΜΟΣ ΚΛΗΣΕΩΝ:
- Νέος ασθενής → Όνομα, τηλέφωνο, τι τον ενδιαφέρει
- Υπάρχων ασθενής → Όνομα, κλείσε/αλλαγή ραντεβού
- Έκτακτο (πόνος/σπάσιμο δοντιού) → Προσπάθησε same-day ραντεβού
- Ακύρωση → Τουλάχιστον 24 ώρες πριν

ΥΠΗΡΕΣΙΕΣ: Γενική οδοντιατρική, Λεύκανση, Εμφυτεύματα, Ορθοδοντική, Παιδοδοντιατρική`,
    sampleKB: `# Οδοντιατρείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 14:00 & 17:00 - 21:00
Σάββατο: 10:00 - 14:00
Κυριακή: Κλειστά

## ΥΠΗΡΕΣΙΕΣ & ΕΝΔΕΙΚΤΙΚΕΣ ΤΙΜΕΣ
- Εξέταση & διάγνωση: 30€
- Καθαρισμός δοντιών: 60€
- Σφράγισμα: από 50€
- Λεύκανση: από 200€
- Εμφύτευμα: από 800€
- Ορθοδοντικές Νάρθηκες: κατόπιν αξιολόγησης

## ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ
Ε: Πονάω, μπορώ να έρθω σήμερα;
Α: Θα προσπαθήσουμε να σας δούμε σήμερα. Ποιο είναι το πρόβλημα;

Ε: Κάνετε λεύκανση;
Α: Ναι, κάνουμε επαγγελματική λεύκανση. Θέλετε ραντεβού αξιολόγησης;`,
    suggestedLanguages: ['el'],
  },
  real_estate: {
    industry: 'real_estate',
    nameEl: 'Μεσιτικό Γραφείο',
    nameEn: 'Real Estate Agency',
    agentName: 'Σοφία',
    greeting: 'Καλωσορίσατε στο μεσιτικό μας γραφείο! Πώς μπορώ να σας βοηθήσω;',
    instructions: `Είσαι η Σοφία, η γραμματέας του μεσιτικού γραφείου. Εξυπηρετείς πελάτες που ψάχνουν ακίνητα ή θέλουν να πουλήσουν/νοικιάσουν.

ΚΑΝΟΝΕΣ:
- Ρώτα αν ψάχνουν να αγοράσουν, ενοικιάσουν, ή πουλήσουν
- Πάρε βασικά κριτήρια: περιοχή, budget, τ.μ., αριθμός δωματίων
- Μην δίνεις τιμές χωρίς να ρωτήσεις τον μεσίτη — λες ότι θα σας ενημερώσουμε
- Κλείσε ραντεβού για επίσκεψη σε ακίνητο ή συνάντηση στο γραφείο

ΧΕΙΡΙΣΜΟΣ:
- Αγοραστής → Τι ψάχνει, budget, περιοχή, κλείσε ραντεβού
- Πωλητής → Τι ακίνητο, περιοχή, κατάσταση, κλείσε αξιολόγηση
- Ενοικιαστής → Budget, περιοχή, πότε θέλει να μετακομίσει`,
    sampleKB: `# Μεσιτικό Γραφείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 18:00
Σάββατο: 10:00 - 15:00 (επισκέψεις ακινήτων)

## ΥΠΗΡΕΣΙΕΣ
- Πώληση κατοικιών & επαγγελματικών χώρων
- Ενοικίαση κατοικιών
- Εκτίμηση ακινήτων
- Διαχείριση ακίνητης περιουσίας
- Νομική υποστήριξη (σε συνεργασία με δικηγόρο)`,
    suggestedLanguages: ['el', 'en'],
  },
  beauty_salon: {
    industry: 'beauty_salon',
    nameEl: 'Κομμωτήριο / Ινστιτούτο Αισθητικής',
    nameEn: 'Beauty Salon',
    agentName: 'Σοφία',
    greeting: 'Γεια σας! Καλωσορίσατε. Θα θέλατε να κλείσετε ραντεβού;',
    instructions: `Είσαι η Σοφία, η ρεσεψιονίστ του κομμωτηρίου/ινστιτούτου αισθητικής. Εξυπηρετείς πελάτες χαρούμενα και ζεστά.

ΚΑΝΟΝΕΣ:
- Να είσαι φιλική και χαρούμενη — ο τόνος σου πρέπει να δίνει θετική ενέργεια
- Ρώτα πάντα ποια υπηρεσία επιθυμούν
- Αν δεν ξέρεις τιμή, πες ότι εξαρτάται (μήκος μαλλιών, κατάσταση κ.ά.) και κλείσε ραντεβού αξιολόγησης
- Πρότεινε διαθέσιμες ημέρες/ώρες

ΧΕΙΡΙΣΜΟΣ:
- Κούρεμα/Χτένισμα → Ρωτά γυναικείο/ανδρικό, κλείσε ραντεβού
- Βαφή → Ρώτα αν θέλει ολική ή ρίζα, κλείσε ραντεβού
- Νύχια/Αισθητική → Ρώτα ποια υπηρεσία, κλείσε ραντεβού
- Ακύρωση → Τουλάχιστον 4 ώρες πριν`,
    sampleKB: `# Κομμωτήριο / Ινστιτούτο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Τρίτη - Σάββατο: 09:00 - 20:00
Δευτέρα & Κυριακή: Κλειστά

## ΥΠΗΡΕΣΙΕΣ & ΤΙΜΕΣ
- Γυναικείο κούρεμα: από 20€
- Ανδρικό κούρεμα: από 12€
- Χτένισμα: από 25€
- Βαφή ολική: από 40€
- Βαφή ρίζα: από 25€
- Ανταύγειες/highlights: από 50€
- Manicure: 15€
- Pedicure: 25€
- Αποτρίχωση: από 10€`,
    suggestedLanguages: ['el'],
  },
  accounting: {
    industry: 'accounting',
    nameEl: 'Λογιστικό Γραφείο',
    nameEn: 'Accounting Office',
    agentName: 'Σοφία',
    greeting: 'Γεια σας, καλωσορίσατε στο λογιστικό γραφείο. Πώς μπορώ να σας εξυπηρετήσω;',
    instructions: `Είσαι η Σοφία, η γραμματέας του λογιστικού γραφείου. Εξυπηρετείς πελάτες (ιδιώτες & εταιρείες) με επαγγελματισμό.

ΚΑΝΟΝΕΣ:
- Μην δίνεις φορολογικές συμβουλές — μόνο γενικές πληροφορίες & ραντεβού
- Ρώτα αν είναι ιδιώτης ή εταιρεία
- Ρώτα τι τύπο υπηρεσίας χρειάζονται
- Κλείσε ραντεβού με τον λογιστή

ΧΕΙΡΙΣΜΟΣ:
- Νέος πελάτης → Τι τύπο υπηρεσίας χρειάζεται, κλείσε ραντεβού γνωριμίας
- Υπάρχων πελάτης → Σημείωσε αίτημα, κλείσε ραντεβού ή ενημέρωσε ότι θα τον καλέσει ο λογιστής
- Προθεσμίες/φόροι → Ενημέρωσε ότι ο λογιστής θα τους ενημερώσει`,
    sampleKB: `# Λογιστικό Γραφείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 17:00
Σάββατο: Κατόπιν ραντεβού (φορολογική περίοδο)

## ΥΠΗΡΕΣΙΕΣ
- Τήρηση βιβλίων (Β' & Γ' κατηγορίας)
- Φορολογικές δηλώσεις (Ε1, Ε2, Ε3, Ε9)
- Μισθοδοσία
- Σύσταση εταιρειών (ΙΚΕ, ΟΕ, ΕΕ, ΑΕ)
- Φορολογικός σχεδιασμός
- ΕΣΠΑ & επιδοτήσεις`,
    suggestedLanguages: ['el'],
  },
  veterinary: {
    industry: 'veterinary',
    nameEl: 'Κτηνιατρείο',
    nameEn: 'Veterinary Clinic',
    agentName: 'Σοφία',
    greeting: 'Γεια σας! Καλωσορίσατε στο κτηνιατρείο. Πώς μπορώ να βοηθήσω εσάς και τον μικρό σας φίλο;',
    instructions: `Είσαι η Σοφία, η ρεσεψιονίστ του κτηνιατρείου. Εξυπηρετείς ιδιοκτήτες κατοικίδιων με φροντίδα και κατανόηση.

ΚΑΝΟΝΕΣ:
- Να είσαι ζεστή και φροντιστική — οι ιδιοκτήτες μπορεί να ανησυχούν
- Αν τα συμπτώματα ακούγονται σοβαρά (δηλητηρίαση, τραύμα, δύσπνοια), πες να έρθουν ΑΜΕΣΑ
- Μη δίνεις κτηνιατρικές συμβουλές
- Ρώτα: τι ζώο (σκύλος/γάτα/άλλο), ηλικία, τι πρόβλημα

ΧΕΙΡΙΣΜΟΣ:
- Ρουτίνα (εμβόλια, check-up) → Κλείσε ραντεβού
- Πρόβλημα υγείας → Πάρε πληροφορίες, κλείσε σύντομο ραντεβού
- Επείγον → Μεταφέρεις στον κτηνίατρο ή πες να έρθουν αμέσως
- Στείρωση/χειρουργείο → Κλείσε ραντεβού αξιολόγησης`,
    sampleKB: `# Κτηνιατρείο — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 14:00 & 17:00 - 21:00
Σάββατο: 09:00 - 14:00
Κυριακή: Μόνο έκτακτα

## ΥΠΗΡΕΣΙΕΣ
- Γενική εξέταση: 30€
- Εμβολιασμοί: από 25€
- Αποπαρασίτωση: 15€
- Στείρωση γάτας: από 100€
- Στείρωση σκύλου: από 150€
- Ακτινογραφία: 40€
- Υπέρηχος: 50€
- Χειρουργικές επεμβάσεις: κατόπιν αξιολόγησης`,
    suggestedLanguages: ['el'],
  },
  general: {
    industry: 'general',
    nameEl: 'Γενική Επιχείρηση',
    nameEn: 'General Business',
    agentName: 'Σοφία',
    greeting: 'Γεια σας! Καλωσορίσατε. Πώς μπορώ να σας εξυπηρετήσω;',
    instructions: `Είσαι η Σοφία, η ψηφιακή ρεσεψιονίστ της επιχείρησης. Εξυπηρετείς τους πελάτες τηλεφωνικά με ευγένεια.

ΚΑΝΟΝΕΣ:
- Χρησιμοποίεις τον πληθυντικό ευγενείας
- Ρωτάς πάντα όνομα και τηλέφωνο
- Μπορείς να κλείνεις ραντεβού
- Δίνεις πληροφορίες που βρίσκονται στη Βάση Γνώσεων
- Αν δεν ξέρεις κάτι, λες ότι θα σας ενημερώσουμε

ΧΕΙΡΙΣΜΟΣ:
- Νέος πελάτης → Πάρε στοιχεία, ρώτα τι χρειάζεται, κλείσε ραντεβού
- Υπάρχων πελάτης → Εξυπηρέτησε το αίτημα
- Παράπονο → Σημείωσε, πες ότι θα απαντήσει ο υπεύθυνος`,
    sampleKB: `# Επιχείρηση — Βάση Γνώσεων

## ΩΡΑΡΙΟ
Δευτέρα - Παρασκευή: 09:00 - 17:00
Σαββατοκύριακο: Κλειστά

## ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ
Ε: Χρειάζομαι ραντεβού;
Α: Ναι, προτιμούμε ραντεβού για να σας εξυπηρετήσουμε καλύτερα.`,
    suggestedLanguages: ['el'],
  },
};
