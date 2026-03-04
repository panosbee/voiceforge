// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — AI Knowledge Base Wizard Route
// AI-assisted generation of structured knowledge files for agents
// Asks business questions → generates KB document → uploads to ElevenLabs
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, agents, knowledgeBaseDocuments } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { SUPPORTED_LANGUAGES } from '@voiceforge/shared';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('kb-wizard');

export const kbWizardRoutes = new Hono<{ Variables: { user: AuthUser } }>();

// All wizard routes require authentication
kbWizardRoutes.use('*', authMiddleware);

// ── Types ────────────────────────────────────────────────────────

/** Questions the wizard asks to gather business information */
interface WizardQuestion {
  id: string;
  question: string;
  questionEn: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

// ── Wizard Questions ─────────────────────────────────────────────

const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: 'business_name',
    question: 'Ποιο είναι το όνομα της επιχείρησής σας;',
    questionEn: 'What is your business name?',
    placeholder: 'π.χ. Ιατρείο Παπαδόπουλου',
    required: true,
    type: 'text',
  },
  {
    id: 'business_type',
    question: 'Τι τύπος επιχείρησης είναι;',
    questionEn: 'What type of business is it?',
    placeholder: 'π.χ. Δικηγορικό γραφείο, Ιατρείο, Κομμωτήριο...',
    required: true,
    type: 'text',
  },
  {
    id: 'services',
    question: 'Ποιες υπηρεσίες προσφέρετε;',
    questionEn: 'What services do you offer?',
    placeholder: 'Περιγράψτε τις κύριες υπηρεσίες σας...',
    required: true,
    type: 'textarea',
  },
  {
    id: 'working_hours',
    question: 'Ποιες είναι οι ώρες λειτουργίας σας;',
    questionEn: 'What are your working hours?',
    placeholder: 'π.χ. Δευτέρα-Παρασκευή 09:00-17:00, Σάββατο 10:00-14:00',
    required: true,
    type: 'textarea',
  },
  {
    id: 'address',
    question: 'Ποια είναι η διεύθυνσή σας;',
    questionEn: 'What is your address?',
    placeholder: 'π.χ. Σταδίου 10, Αθήνα 10564',
    required: false,
    type: 'text',
  },
  {
    id: 'contact_info',
    question: 'Στοιχεία επικοινωνίας (email, τηλέφωνα, website);',
    questionEn: 'Contact information (email, phones, website)?',
    placeholder: 'π.χ. info@example.gr, 210-1234567, www.example.gr',
    required: false,
    type: 'textarea',
  },
  {
    id: 'pricing',
    question: 'Πληροφορίες τιμολόγησης (αν θέλετε να τις γνωρίζει ο βοηθός);',
    questionEn: 'Pricing information (if you want the assistant to know)?',
    placeholder: 'π.χ. Πρώτη συνεδρία: 50€, Ραντεβού παρακολούθησης: 30€',
    required: false,
    type: 'textarea',
  },
  {
    id: 'faq',
    question: 'Ποιες είναι οι πιο συχνές ερωτήσεις που λαμβάνετε;',
    questionEn: 'What are the most frequently asked questions you receive?',
    placeholder: 'Γράψτε τις πιο συχνές ερωτήσεις και τις απαντήσεις τους...',
    required: false,
    type: 'textarea',
  },
  {
    id: 'special_instructions',
    question: 'Ειδικές οδηγίες ή πολιτικές (ακυρώσεις, επιστροφές κ.λπ.);',
    questionEn: 'Special instructions or policies (cancellations, returns, etc.)?',
    placeholder: 'π.χ. Ακύρωση ραντεβού πρέπει να γίνει 24 ώρες πριν...',
    required: false,
    type: 'textarea',
  },
  {
    id: 'tone',
    question: 'Πώς θέλετε να μιλάει ο βοηθός; (τόνος, ύφος)',
    questionEn: 'How should the assistant speak? (tone, style)',
    placeholder: 'π.χ. Επαγγελματικός αλλά φιλικός, χρήση πληθυντικού...',
    required: false,
    type: 'text',
  },
];

// ═══════════════════════════════════════════════════════════════════
// GET /kb-wizard/questions — Return the wizard questions
// ═══════════════════════════════════════════════════════════════════

kbWizardRoutes.get('/questions', async (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: WIZARD_QUESTIONS,
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /kb-wizard/generate — Generate KB document from wizard answers
// ═══════════════════════════════════════════════════════════════════

const generateSchema = z.object({
  answers: z.record(z.string()),
  language: z.string().default('el'),
  agentId: z.string().optional(),
});

kbWizardRoutes.post('/generate', zValidator('json', generateSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const customer = await db.query.customers.findFirst({
    where: eq(customers.userId, user.sub),
  });
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  log.info({ customerId: customer.id, language: body.language, answerCount: Object.keys(body.answers).length }, 'Generating KB from wizard');

  try {
    // Build the knowledge base document content from answers
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === body.language)?.nameEn || 'Greek';
    const kbContent = buildKnowledgeBaseContent(body.answers, body.language, langName);

    // Generate the system prompt (instructions) based on answers
    const generatedPrompt = buildSystemPrompt(body.answers, body.language, langName);

    // Generate greeting based on business info
    const generatedGreeting = buildGreeting(body.answers, body.language);

    // Upload KB document to ElevenLabs as a text file
    const businessName = body.answers.business_name || customer.businessName || 'Business';
    const fileName = `${businessName.replace(/[^a-zA-Z0-9\u0370-\u03FF\s]/g, '')}_Knowledge_Base.txt`;

    let elevenlabsDocId: string | null = null;

    if (elevenlabsService.isConfigured()) {
      const kbBlob = new Blob([kbContent], { type: 'text/plain' });
      const doc = await elevenlabsService.uploadKBDocument(kbBlob, fileName);
      elevenlabsDocId = doc.id;
      log.info({ docId: doc.id, fileName }, 'KB document uploaded to ElevenLabs');

      // If agentId provided, attach document to the agent
      if (body.agentId) {
        const agent = await db.query.agents.findFirst({
          where: eq(agents.id, body.agentId),
        });
        if (agent?.elevenlabsAgentId) {
          await elevenlabsService.attachKBToAgent(agent.elevenlabsAgentId, [{ id: doc.id, name: fileName }]);
          log.info({ agentId: body.agentId, docId: doc.id }, 'KB attached to agent');
        }
      }
    } else {
      elevenlabsDocId = `dev_kb_${crypto.randomUUID().slice(0, 8)}`;
    }

    // Store KB document reference in our database
    const [kbDoc] = await db
      .insert(knowledgeBaseDocuments)
      .values({
        customerId: customer.id,
        agentId: body.agentId || null,
        elevenlabsDocId: elevenlabsDocId!,
        name: fileName,
        source: 'text',
        mimeType: 'text/plain',
        fileSize: new TextEncoder().encode(kbContent).length,
        status: 'ready',
      })
      .returning();

    return c.json<ApiResponse>({
      success: true,
      data: {
        document: kbDoc,
        generatedPrompt,
        generatedGreeting,
        kbContent,
      },
    }, 201);
  } catch (error) {
    log.error({ error }, 'Failed to generate KB from wizard');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate knowledge base' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// Helper: Build structured KB content from wizard answers
// ═══════════════════════════════════════════════════════════════════

function buildKnowledgeBaseContent(answers: Record<string, string>, langCode: string, langName: string): string {
  const isGreek = langCode === 'el';
  const sections: string[] = [];

  // Header
  sections.push(`# ${answers.business_name || 'Business'} — ${isGreek ? 'Βάση Γνώσεων' : 'Knowledge Base'}`);
  sections.push(`${isGreek ? 'Γλώσσα' : 'Language'}: ${langName}`);
  sections.push(`${isGreek ? 'Δημιουργήθηκε' : 'Generated'}: ${new Date().toISOString().split('T')[0]}`);
  sections.push('');

  // Business Overview
  sections.push(`## ${isGreek ? 'ΠΛΗΡΟΦΟΡΙΕΣ ΕΠΙΧΕΙΡΗΣΗΣ' : 'BUSINESS INFORMATION'}`);
  if (answers.business_name) sections.push(`${isGreek ? 'Επωνυμία' : 'Name'}: ${answers.business_name}`);
  if (answers.business_type) sections.push(`${isGreek ? 'Τύπος' : 'Type'}: ${answers.business_type}`);
  if (answers.address) sections.push(`${isGreek ? 'Διεύθυνση' : 'Address'}: ${answers.address}`);
  if (answers.contact_info) sections.push(`${isGreek ? 'Επικοινωνία' : 'Contact'}: ${answers.contact_info}`);
  sections.push('');

  // Working Hours
  if (answers.working_hours) {
    sections.push(`## ${isGreek ? 'ΩΡΕΣ ΛΕΙΤΟΥΡΓΙΑΣ' : 'WORKING HOURS'}`);
    sections.push(answers.working_hours);
    sections.push('');
  }

  // Services
  if (answers.services) {
    sections.push(`## ${isGreek ? 'ΥΠΗΡΕΣΙΕΣ' : 'SERVICES'}`);
    sections.push(answers.services);
    sections.push('');
  }

  // Pricing
  if (answers.pricing) {
    sections.push(`## ${isGreek ? 'ΤΙΜΟΚΑΤΑΛΟΓΟΣ' : 'PRICING'}`);
    sections.push(answers.pricing);
    sections.push('');
  }

  // FAQ
  if (answers.faq) {
    sections.push(`## ${isGreek ? 'ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ' : 'FREQUENTLY ASKED QUESTIONS'}`);
    sections.push(answers.faq);
    sections.push('');
  }

  // Policies
  if (answers.special_instructions) {
    sections.push(`## ${isGreek ? 'ΠΟΛΙΤΙΚΕΣ & ΕΙΔΙΚΕΣ ΟΔΗΓΙΕΣ' : 'POLICIES & SPECIAL INSTRUCTIONS'}`);
    sections.push(answers.special_instructions);
    sections.push('');
  }

  return sections.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Generate system prompt from wizard answers
// ═══════════════════════════════════════════════════════════════════

function buildSystemPrompt(answers: Record<string, string>, langCode: string, langName: string): string {
  const isGreek = langCode === 'el';
  const bName = answers.business_name || '';
  const bType = answers.business_type || '';
  const tone = answers.tone || (isGreek ? 'Επαγγελματικός αλλά φιλικός' : 'Professional yet friendly');

  if (isGreek) {
    return [
      `Είσαι η ψηφιακή ρεσεψιονίστ του "${bName}", ${bType}.`,
      `Ο τόνος σου είναι: ${tone}.`,
      '',
      'ΚΑΝΟΝΕΣ:',
      '- Απάντα πάντα με βάση τις πληροφορίες στη Βάση Γνώσεών σου',
      '- Αν δεν γνωρίζεις κάτι, πες ειλικρινά ότι θα το ελέγξεις και θα επιστρέψεις',
      '- Βοήθα τους πελάτες να κλείσουν ραντεβού όταν χρειάζεται',
      '- Δώσε πληροφορίες για υπηρεσίες, τιμές και ωράρια',
      '- Να είσαι ευγενικός και επαγγελματικός σε κάθε συνομιλία',
      answers.working_hours ? `- Ωράριο: ${answers.working_hours}` : '',
      answers.address ? `- Διεύθυνση: ${answers.address}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    `You are the digital receptionist of "${bName}", a ${bType}.`,
    `Your tone is: ${tone}.`,
    '',
    'RULES:',
    '- Always answer based on the information in your Knowledge Base',
    '- If you don\'t know something, honestly say you\'ll check and get back',
    '- Help customers book appointments when needed',
    '- Provide information about services, prices, and hours',
    '- Be polite and professional in every conversation',
    answers.working_hours ? `- Hours: ${answers.working_hours}` : '',
    answers.address ? `- Address: ${answers.address}` : '',
  ].filter(Boolean).join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Generate greeting from wizard answers
// ═══════════════════════════════════════════════════════════════════

function buildGreeting(answers: Record<string, string>, langCode: string): string {
  const bName = answers.business_name || '';

  if (langCode === 'el') {
    return `Γεια σας! Καλωσορίσατε στο ${bName}. Πώς μπορώ να σας εξυπηρετήσω;`;
  }
  if (langCode === 'de') {
    return `Guten Tag! Willkommen bei ${bName}. Wie kann ich Ihnen helfen?`;
  }
  if (langCode === 'fr') {
    return `Bonjour ! Bienvenue chez ${bName}. Comment puis-je vous aider ?`;
  }
  return `Hello! Welcome to ${bName}. How can I help you today?`;
}
