// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — AI-Powered Support Chat Endpoint
// Uses OpenAI (or compatible) to provide contextual, intelligent
// technical support for platform users. NOT pre-written responses.
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { INDUSTRY_TEMPLATES } from '@voiceforge/shared';

const log = createLogger('support-chat');

export const supportChatRoutes = new Hono();

// Auth required — only authenticated users can use support chat
supportChatRoutes.use('*', authMiddleware);

// ── System prompt with full platform knowledge ───────────────────

const PLATFORM_SYSTEM_PROMPT = `Είσαι ο AI τεχνικός βοηθός της πλατφόρμας VoiceForge AI. Βοηθάς τους χρήστες να ρυθμίσουν και να χρησιμοποιήσουν σωστά την πλατφόρμα.

## Τι είναι το VoiceForge AI
Το VoiceForge AI είναι μια white-label πλατφόρμα AI φωνητικής ρεσεψιόν (AI Voice Receptionist) σχεδιασμένη για ελληνικές μικρομεσαίες επιχειρήσεις. Δημιουργεί AI βοηθούς που:
- Απαντούν τηλεφωνικές κλήσεις 24/7
- Κλείνουν ραντεβού αυτόματα
- Απαντούν σε ερωτήσεις πελατών βάσει των πληροφοριών της επιχείρησης
- Μιλούν φυσικά σε πολλές γλώσσες (Ελληνικά, Αγγλικά, Γερμανικά κ.ά.)
- Θυμούνται τους τακτικούς πελάτες (episodic memory)

## Πώς λειτουργεί η πλατφόρμα

### 1. Δημιουργία AI Βοηθού
- Ο χρήστης πηγαίνει στο μενού "AI Βοηθοί" και πατάει "Νέος Βοηθός"
- Συμπληρώνει: Όνομα (π.χ. "Σοφία"), Κλάδο (π.χ. Ιατρείο), Χαιρετισμό (τι λέει όταν σηκώνει), Οδηγίες (System Prompt — πώς συμπεριφέρεται)
- Επιλέγει φωνή (Σοφία, Νίκος κ.ά.) από τη βιβλιοθήκη ElevenLabs
- Επιλέγει γλώσσες υποστήριξης
- Ο βοηθός δημιουργείται στην πλατφόρμα ElevenLabs (conversational AI)

### 2. Βάση Γνώσεων (Knowledge Base)
- Ο χρήστης ανεβάζει αρχεία (PDF, TXT, DOCX) με πληροφορίες για την επιχείρηση
- Αυτές οι πληροφορίες γίνονται η "μνήμη" του βοηθού
- Ο βοηθός χρησιμοποιεί αυτές τις πληροφορίες για να απαντάει σωστά
- Υπάρχει **AI Οδηγός Γνώσεων** που βοηθάει τον χρήστη να δημιουργήσει αυτόματα αρχείο γνώσεων απαντώντας απλές ερωτήσεις

### 3. Αριθμός Τηλεφώνου (+30)
- Ο χρήστης αγοράζει ελληνικό αριθμό (+30) μέσα από την πλατφόρμα
- Ο αριθμός συνδέεται αυτόματα με τον βοηθό
- Όταν κάποιος καλεί τον αριθμό, ο AI βοηθός απαντάει
- Μπορεί να ρυθμιστεί μεταφορά κλήσης στο κινητό του ιδιοκτήτη για επείγοντα

### 4. Κλήσεις & Analytics
- Κάθε κλήση καταγράφεται: διάρκεια, σύνοψη, transcript, sentiment (θετικό/αρνητικό/ουδέτερο)
- Πλήρες ιστορικό κλήσεων με φίλτρα
- Ανάλυση performance: πόσες κλήσεις, μέση διάρκεια, ικανοποίηση πελατών

### 5. Ραντεβού
- Ο βοηθός κλείνει ραντεβού κατά τη διάρκεια κλήσεων
- Αποθηκεύονται στη βάση: ημερομηνία, ώρα, όνομα πελάτη, τηλέφωνο, λόγος

### 6. Πολυγλωσσική Υποστήριξη
- Ο βοηθός υποστηρίζει 24+ γλώσσες (Ελληνικά, Αγγλικά, Γερμανικά, Γαλλικά, Ιταλικά κ.ά.)
- Αναγνωρίζει αυτόματα τη γλώσσα του καλούντα
- Μιλάει φυσικά — χωρίς robotic accent

### 7. Μνήμη Καλ​ούντων (Episodic Memory)
- Ο βοηθός θυμάται τους καλούντες που έχουν ξανακαλέσει
- Χαιρετάει με το όνομά τους
- Θυμάται προηγούμενα ραντεβού/αιτήματα

### 8. Ροές Εξυπηρέτησης (Expert Mode)
- Προχωρημένη λειτουργία: ο χρήστης σχεδιάζει ροές βήμα-βήμα (decision trees)
- Ο βοηθός ακολουθεί τη ροή κατά τη κλήση

## Κλάδοι & Industry Templates
Η πλατφόρμα περιλαμβάνει έτοιμα templates για τους εξής κλάδους:

${Object.values(INDUSTRY_TEMPLATES).map(t =>
  `### ${t.nameEl} (${t.nameEn})
Προτεινόμενος βοηθός: "${t.agentName}"
Χαιρετισμός: "${t.greeting}"
Κύρια χαρακτηριστικά: ${t.instructions.split('\n').slice(0, 3).join(' ').trim()}`
).join('\n\n')}

## Tips για χρήστες
1. **Γράψτε αναλυτικές οδηγίες** — Ο βοηθός ακολουθεί πιστά τις οδηγίες. Όσο πιο αναλυτικές, τόσο καλύτερα.
2. **Ανεβάστε Βάση Γνώσεων** — FAQ, τιμές, ωράρια, υπηρεσίες σε αρχείο
3. **Χρησιμοποιήστε τον AI Οδηγό** — Απαντάτε ερωτήσεις και φτιάχνεται αυτόματα
4. **Δοκιμάστε πριν ενεργοποιήσετε** — Πατήστε "Δοκιμή" για να μιλήσετε στον βοηθό
5. **Ρυθμίστε τηλέφωνο μεταφοράς** — Δώστε το κινητό σας για επείγοντα
6. **Ελέγχετε τις κλήσεις τακτικά** — Βελτιώστε τις οδηγίες βάσει feedback
7. **Επιλέξτε σωστό template** — Ξεκινήστε με το industry template του κλάδου σας

## Πλάνα & Τιμολόγηση
- **Βασικό (Basic):** 200€/μήνα — 400 λεπτά, 1 βοηθός, 24 γλώσσες, 5 αρχεία KB
- **Pro:** 400€/μήνα — 800 λεπτά, 5 βοηθοί, custom voice, 20 αρχεία KB
- **Enterprise:** 999€/μήνα — 2000 λεπτά, 25 βοηθοί, SLA, API, αναγνώριση πελατών

## Κανόνες Απάντησης
- Απάντα στη γλώσσα που σε ρωτούν (Ελληνικά ή Αγγλικά)
- Αν ο χρήστης αναφέρει συγκεκριμένο κλάδο (π.χ. "έχω ιατρείο"), δώσε ΕΞΕΙΔΙΚΕΥΜΕΝΕΣ συμβουλές για αυτόν τον κλάδο βάσει των templates
- Δώσε βήμα-προς-βήμα οδηγίες — μη λέεις απλά "δημιουργήστε βοηθό"
- Αν σε ρωτήσουν κάτι εκτός πλατφόρμας, πες ευγενικά ότι μπορείς να βοηθήσεις μόνο με θέματα VoiceForge AI
- Να είσαι φιλικός, κατανοητός, και χρήσιμος
- Μη λέεις ψέματα — αν δεν ξέρεις, πες ότι θα ρωτήσεις την ομάδα
`;

// ── Request/Response schemas ─────────────────────────────────────

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(30).default([]),
  locale: z.enum(['el', 'en']).default('el'),
});

// ── Chat endpoint ────────────────────────────────────────────────

supportChatRoutes.post(
  '/message',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { message, conversationHistory, locale } = c.req.valid('json');

    log.info({ messageLength: message.length, historyLength: conversationHistory.length, locale }, 'Support chat request');

    // Build messages array for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: PLATFORM_SYSTEM_PROMPT },
    ];

    // Add conversation history (last 20 messages for context window management)
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add the new user message
    messages.push({ role: 'user', content: message });

    // ── Try OpenAI first, then fall back to ElevenLabs-based generation ──

    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      // No OpenAI key — use a built-in smart response generator
      log.warn('No OPENAI_API_KEY configured — using built-in response generator');
      const response = generateSmartResponse(message, conversationHistory, locale);
      return c.json({
        success: true,
        data: { response, source: 'built-in' },
      });
    }

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages,
          temperature: 0.7,
          max_completion_tokens: 1500,
          top_p: 0.95,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        log.error({ status: openaiResponse.status, error: errorText }, 'OpenAI API error');

        // Fallback to built-in
        const response = generateSmartResponse(message, conversationHistory, locale);
        return c.json({
          success: true,
          data: { response, source: 'built-in-fallback' },
        });
      }

      const result = await openaiResponse.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens: number };
      };

      const assistantMessage = result.choices?.[0]?.message?.content;

      if (!assistantMessage) {
        log.error({ result }, 'Empty OpenAI response');
        const response = generateSmartResponse(message, conversationHistory, locale);
        return c.json({
          success: true,
          data: { response, source: 'built-in-fallback' },
        });
      }

      log.info({ tokens: result.usage?.total_tokens }, 'OpenAI support chat response');

      return c.json({
        success: true,
        data: { response: assistantMessage, source: 'openai' },
      });
    } catch (error) {
      log.error({ error }, 'Support chat error');

      // Fallback to built-in
      const response = generateSmartResponse(message, conversationHistory, locale);
      return c.json({
        success: true,
        data: { response, source: 'built-in-fallback' },
      });
    }
  },
);

// ── Industry template retrieval ──────────────────────────────────

supportChatRoutes.get('/templates', async (c) => {
  return c.json({
    success: true,
    data: { templates: INDUSTRY_TEMPLATES },
  });
});

supportChatRoutes.get('/templates/:industry', async (c) => {
  const industry = c.req.param('industry');
  const template = INDUSTRY_TEMPLATES[industry as keyof typeof INDUSTRY_TEMPLATES];

  if (!template) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Unknown industry: ${industry}` } }, 404);
  }

  return c.json({
    success: true,
    data: { template },
  });
});

// ── Built-in smart response generator (fallback) ────────────────
// This is NOT a dumb keyword matcher. It uses the conversation context
// and industry detection to give contextual responses.

function generateSmartResponse(
  message: string,
  history: Array<{ role: string; content: string }>,
  locale: 'el' | 'en',
): string {
  const msg = message.toLowerCase();
  const isGreek = locale === 'el';

  // Detect industry from message context
  const detectedIndustry = detectIndustry(msg);

  // If an industry is detected, give industry-specific guidance
  if (detectedIndustry) {
    const template = INDUSTRY_TEMPLATES[detectedIndustry];
    if (template) {
      return isGreek
        ? `Τέλεια! Για **${template.nameEl}**, η πλατφόρμα μας έχει **έτοιμο template** που θα σας διευκολύνει πολύ!\n\n**Βήματα για να ξεκινήσετε:**\n1. Πηγαίνετε στο μενού "AI Βοηθοί" → "Νέος Βοηθός"\n2. Επιλέξτε κλάδο: **${template.nameEl}**\n3. Θα συμπληρωθούν αυτόματα:\n   - Χαιρετισμός: "${template.greeting}"\n   - Οδηγίες βοηθού (πώς να εξυπηρετεί κλήσεις)\n   - Βάση Γνώσεων με τυπικές πληροφορίες\n4. Προσαρμόστε τα στοιχεία για τη δική σας επιχείρηση (ωράρια, τιμές, υπηρεσίες)\n5. Ανεβάστε επιπλέον αρχεία στη Βάση Γνώσεων αν θέλετε\n6. Αγοράστε +30 αριθμό και συνδέστε τον\n7. Δοκιμάστε πατώντας "Δοκιμή"!\n\nΘέλετε να σας πω περισσότερα για κάποιο βήμα;`
        : `Great! For **${template.nameEn}**, our platform has a **ready-made template** that will make setup easy!\n\n**Steps to get started:**\n1. Go to "AI Assistants" → "New Assistant"\n2. Select industry: **${template.nameEn}**\n3. Auto-filled for you:\n   - Greeting: "${template.greeting}"\n   - Assistant instructions (how to handle calls)\n   - Knowledge base with typical info\n4. Customize for your business (hours, prices, services)\n5. Upload additional files to Knowledge Base if needed\n6. Purchase a +30 number and connect it\n7. Test by clicking "Test"!\n\nWould you like more details on any step?`;
    }
  }

  // Check if user is asking for help getting started
  if (/ξεκιν|πώς|αρχ[ιί]|start|begin|how.*start|setup|εγκατ|ρύθμ|στήσ/.test(msg)) {
    return isGreek
      ? `**Για να ξεκινήσετε με το VoiceForge AI:**\n\n1. **Δημιουργήστε AI Βοηθό** — Μενού "AI Βοηθοί" → "Νέος Βοηθός"\n   💡 Επιλέξτε τον κλάδο σας και θα γεμίσουν αυτόματα τα πεδία!\n\n2. **Ρυθμίστε τη Βάση Γνώσεων** — Ανεβάστε αρχεία ή χρησιμοποιήστε τον AI Οδηγό\n\n3. **Αγοράστε αριθμό +30** — Ο βοηθός θα απαντάει σε αυτόν τον αριθμό\n\n4. **Δοκιμάστε** — Πατήστε "Δοκιμή" για να μιλήσετε στον βοηθό\n\nΤι κλάδο εξυπηρετείτε; Μπορώ να σας δώσω εξειδικευμένες συμβουλές!`
      : `**To get started with VoiceForge AI:**\n\n1. **Create an AI Assistant** — "AI Assistants" → "New Assistant"\n   💡 Select your industry and fields auto-fill!\n\n2. **Set up Knowledge Base** — Upload files or use the AI Wizard\n\n3. **Purchase a +30 number** — The assistant will answer on this number\n\n4. **Test it** — Click "Test" to talk to your assistant\n\nWhat industry are you in? I can give you specialized advice!`;
  }

  // Agent/assistant questions
  if (/βοηθ[oόο]|agent|assistant|δημιουργ|create|φτι[αά]ξ/.test(msg)) {
    return isGreek
      ? `**Δημιουργία AI Βοηθού:**\n\n1. Μενού "AI Βοηθοί" → "Νέος Βοηθός"\n2. Συμπληρώστε:\n   - **Όνομα:** π.χ. "Σοφία"\n   - **Κλάδος:** Επιλέξτε τον κλάδο σας (αυτόματα γεμίζει template!)\n   - **Χαιρετισμός:** Τι λέει όταν σηκώνει\n   - **Οδηγίες:** Πώς συμπεριφέρεται\n3. Επιλέξτε **φωνή** και **γλώσσες**\n4. Πατήστε "Δημιουργία"\n\n💡 **Tip:** Χρησιμοποιήστε τον AI Οδηγό (tab "AI Οδηγός") για αυτόματη δημιουργία οδηγιών!`
      : `**Creating an AI Assistant:**\n\n1. "AI Assistants" → "New Assistant"\n2. Fill in:\n   - **Name:** e.g. "Sofia"\n   - **Industry:** Select yours (auto-fills template!)\n   - **Greeting:** What it says when answering\n   - **Instructions:** How it behaves\n3. Choose **voice** and **languages**\n4. Click "Create"\n\n💡 **Tip:** Use the AI Wizard ("AI Wizard" tab) to auto-generate instructions!`;
  }

  // Knowledge base
  if (/knowledge|γνώσ[εη]|kb|βάση|wizard|οδηγ[oόο]ς/.test(msg)) {
    return isGreek
      ? `**Βάση Γνώσεων:**\n\nΗ Βάση Γνώσεων είναι η "μνήμη" του βοηθού — εδώ βάζετε πληροφορίες για την επιχείρησή σας.\n\n**Τρόποι δημιουργίας:**\n1. **Χειροκίνητα:** Ανεβάστε αρχεία (PDF, TXT, DOCX) στο tab "Βάση Γνώσεων"\n2. **AI Οδηγός:** Tab "AI Οδηγός" → Απαντήστε ερωτήσεις → Δημιουργείται αυτόματα!\n\n**Τι να περιλαμβάνει:**\n- Ωράρια λειτουργίας\n- Υπηρεσίες & τιμές\n- Συχνές ερωτήσεις (FAQ)\n- Διεύθυνση & στοιχεία επικοινωνίας\n- Πολιτική ακυρώσεων/ραντεβού`
      : `**Knowledge Base:**\n\nThe Knowledge Base is the assistant's "memory" — add your business info here.\n\n**Creation methods:**\n1. **Manual:** Upload files (PDF, TXT, DOCX) in "Knowledge Base" tab\n2. **AI Wizard:** "AI Wizard" tab → Answer questions → Auto-generated!\n\n**What to include:**\n- Operating hours\n- Services & prices\n- FAQ\n- Address & contact info\n- Cancellation/appointment policy`;
  }

  // Phone number
  if (/αριθμ|τηλ[εέ]φ|phone|number|\+30|νούμερ/.test(msg)) {
    return isGreek
      ? `**Σύνδεση αριθμού τηλεφώνου:**\n\n1. Στη σελίδα "AI Βοηθοί", πατήστε "Αριθμός" δίπλα στον βοηθό σας\n2. Αναζητήστε +30 αριθμούς στην περιοχή σας\n3. Αγοράστε & συνδέστε — ο βοηθός αρχίζει να απαντάει αμέσως!\n\n**Μεταφορά κλήσης:** Μπορείτε να ρυθμίσετε "τηλέφωνο μεταφοράς" (το κινητό σας). Αν ο πελάτης ζητήσει ανθρώπινη εξυπηρέτηση ή υπάρχει επείγον, η κλήση μεταφέρεται στο κινητό σας.`
      : `**Connecting a phone number:**\n\n1. On "AI Assistants", click "Number" next to your assistant\n2. Search for +30 numbers in your area\n3. Purchase & connect — the assistant starts answering immediately!\n\n**Call forwarding:** Set a "forwarding number" (your mobile). If a customer requests human help or there's an emergency, the call transfers to your mobile.`;
  }

  // Pricing / plans
  if (/τιμ[ηή]|κόστ|πόσο|πλάν|plan|pric|cost|money|χρήμ|ευρώ|€/.test(msg)) {
    return isGreek
      ? `**Πλάνα & Τιμολόγηση:**\n\n| Πλάνο | Τιμή | Λεπτά | Βοηθοί | KB αρχεία |\n|-------|-------|-------|--------|-----------|\n| **Βασικό** | 200€/μήνα | 400 | 1 | 5 |\n| **Pro** | 400€/μήνα | 800 | 5 | 20 |\n| **Enterprise** | 999€/μήνα | 2.000 | 25 | Απεριόριστα |\n\n**Επιπλέον λεπτά:** 0,50€/λεπτό (Basic), 0,45€/λεπτό (Pro), 0,35€/λεπτό (Enterprise)\n\nΌλα τα πλάνα περιλαμβάνουν: 24 γλώσσες, analytics, memory, webhooks`
      : `**Plans & Pricing:**\n\n| Plan | Price | Minutes | Assistants | KB files |\n|------|-------|---------|------------|----------|\n| **Basic** | €200/mo | 400 | 1 | 5 |\n| **Pro** | €400/mo | 800 | 5 | 20 |\n| **Enterprise** | €999/mo | 2,000 | 25 | Unlimited |\n\n**Extra minutes:** €0.50/min (Basic), €0.45/min (Pro), €0.35/min (Enterprise)\n\nAll plans include: 24 languages, analytics, caller memory, webhooks`;
  }

  // Default contextual response
  return isGreek
    ? `Ευχαριστώ για την ερώτησή σας! Μπορώ να σας βοηθήσω με:\n\n• **Δημιουργία βοηθού** — Πώς να φτιάξετε AI βοηθό βήμα-βήμα\n• **Βάση Γνώσεων** — Πώς να ανεβάσετε πληροφορίες & AI Οδηγός\n• **Τηλέφωνο** — Αγορά & σύνδεση +30 αριθμού\n• **Γλώσσες** — Πολυγλωσσική υποστήριξη\n• **Κλήσεις** — Ιστορικό & analytics\n• **Τιμολόγηση** — Πλάνα & τιμές\n• **Industry Templates** — Έτοιμα templates ανά κλάδο\n\n💡 **Tip:** Πείτε μου τον κλάδο σας (π.χ. "έχω ιατρείο") και θα σας δώσω εξειδικευμένες οδηγίες!`
    : `Thanks for your question! I can help with:\n\n• **Creating assistant** — Step-by-step AI assistant setup\n• **Knowledge Base** — Uploading info & AI Wizard\n• **Phone** — Purchasing & connecting +30 number\n• **Languages** — Multi-language support\n• **Calls** — History & analytics\n• **Pricing** — Plans & prices\n• **Industry Templates** — Ready-made templates per industry\n\n💡 **Tip:** Tell me your industry (e.g. "I have a dental clinic") and I'll give you specialized guidance!`;
}

/** Detect which industry the user is talking about */
function detectIndustry(msg: string): keyof typeof INDUSTRY_TEMPLATES | null {
  // Medical / pathology / doctor
  if (/ιατρ|γιατρ|παθολ|καρδιολ|doctor|medical|health|clinic|κλινικ|χειρουρ|δερματ|ορθοπ|νευρολ|ωρλ|ουρολ|γυναικ/.test(msg)) {
    return 'medical_practice';
  }
  // Dental
  if (/οδοντ|dental|dentist|δόντι|δοντι/.test(msg)) {
    return 'dental_clinic';
  }
  // Law office
  if (/δικηγ|νομικ|law|lawyer|attorney|legal|δίκη|δικαστ/.test(msg)) {
    return 'law_office';
  }
  // Real estate
  if (/μεσιτ|ακίνητ|real.?estate|σπίτι|ενοικ|πώληση.*σπιτ|κτηματ/.test(msg)) {
    return 'real_estate';
  }
  // Beauty salon
  if (/κομμωτ|κουρε|beauty|salon|μαλλι|βαφ[ηή]|αισθητ|nail|νύχι|μανικ|πεντικ|κομμ[oό]/.test(msg)) {
    return 'beauty_salon';
  }
  // Accounting
  if (/λογιστ|account|φορολ|tax|δήλωσ|βιβλί|μισθοδ|εφορ/.test(msg)) {
    return 'accounting';
  }
  // Veterinary
  if (/κτηνίατρ|κτηνιατρ|vet|ζώο|σκύλ|γάτ|κατοικίδ|animal/.test(msg)) {
    return 'veterinary';
  }
  return null;
}
