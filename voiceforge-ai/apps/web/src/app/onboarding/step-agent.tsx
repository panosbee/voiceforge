// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 3 — Agent Configuration
// Name, greeting, instructions, voice selection
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, type FormEvent } from 'react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { KnowledgeBaseUpload } from '@/components/knowledge-base-upload';
import { INDUSTRY_LABELS } from '@/lib/utils';
import { GREEK_VOICES } from '@voiceforge/shared';
import type { OnboardingData } from './page';
import type { KBDocumentSummary } from '@voiceforge/shared';

interface StepAgentProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Generate default greeting and instructions based on industry */
function getDefaults(industry: string, businessName: string) {
  const industryLabel = INDUSTRY_LABELS[industry] ?? 'Επιχείρηση';

  const greeting = `Γεια σας, καλωσορίσατε στο ${businessName}! Με λένε {{agent_name}} και είμαι η ψηφιακή βοηθός σας. Πώς μπορώ να σας εξυπηρετήσω;`;

  const instructions = `Είσαι η ψηφιακή βοηθός (ρεσεψιονίστ) για "${businessName}" (${industryLabel}).

Βασικοί κανόνες:
- Μίλα ΠΑΝΤΑ στα ελληνικά, με ευγενικό και επαγγελματικό ύφος
- Χρησιμοποίησε τον πληθυντικό ευγενείας
- Αν ο καλών ρωτήσει κάτι που δεν γνωρίζεις, πες ότι θα τον καλέσει πίσω κάποιος από το γραφείο
- Μπορείς να ελέγξεις διαθεσιμότητα ραντεβού και να κλείσεις ραντεβού
- Ζήτα πάντα το ονοματεπώνυμο και τον αριθμό τηλεφώνου πριν κλείσεις ραντεβού
- Μην δίνεις ιατρικές/νομικές/οικονομικές συμβουλές — παραπέμψε στον ειδικό
- Κράτα σύντομες τις απαντήσεις σου (1-2 προτάσεις maximum)

Ωράριο λειτουργίας: Δευτέρα-Παρασκευή 09:00-17:00
Διεύθυνση: {{var_address}}
Τηλέφωνο: {{var_phone}}`;

  return { greeting, instructions };
}

const voiceOptions = GREEK_VOICES.map((v) => ({
  value: v.id,
  label: `${v.name} (${v.gender === 'female' ? 'Γυναικεία' : 'Ανδρική'})`,
}));

export function StepAgent({ data, updateData, onNext, onBack }: StepAgentProps) {
  // Auto-fill defaults when user first lands on this step
  useEffect(() => {
    if (!data.greeting && !data.instructions && data.industry) {
      const defaults = getDefaults(data.industry, data.businessName);
      updateData({
        agentName: 'Σοφία',
        greeting: defaults.greeting,
        instructions: defaults.instructions,
      });
    }
  }, [data.greeting, data.instructions, data.industry, data.businessName, updateData]);

  // Track KB document IDs for agent creation
  const handleKBDocumentsChange = useCallback((docs: KBDocumentSummary[]) => {
    const docIds = docs.map((d) => d.elevenlabsDocId);
    updateData({ kbDocumentIds: docIds });
  }, [updateData]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = data.agentName && data.greeting && data.instructions && data.voiceId;

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Ρυθμίστε τον AI Βοηθό</h2>
      <p className="text-sm text-text-secondary mb-6">
        Προσαρμόστε τον τρόπο που ο βοηθός σας απαντά τις κλήσεις. Έχουμε προ-συμπληρώσει τις
        ρυθμίσεις βάσει του κλάδου σας.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Όνομα Βοηθού"
            placeholder="π.χ. Σοφία"
            value={data.agentName}
            onChange={(e) => updateData({ agentName: e.target.value })}
            hint="Το όνομα που θα αναφέρει ο βοηθός"
            required
          />
          <Select
            label="Φωνή"
            options={voiceOptions}
            value={data.voiceId}
            onChange={(e) => updateData({ voiceId: e.target.value })}
            hint="Ελληνική TTS φωνή"
          />
        </div>

        <Textarea
          label="Χαιρετισμός"
          placeholder="Γεια σας, καλωσορίσατε στο..."
          value={data.greeting}
          onChange={(e) => updateData({ greeting: e.target.value })}
          hint="Η πρώτη πρόταση που θα πει ο βοηθός όταν σηκώσει"
          rows={3}
          required
        />

        <Textarea
          label="Οδηγίες Βοηθού (System Prompt)"
          placeholder="Είσαι η ψηφιακή βοηθός..."
          value={data.instructions}
          onChange={(e) => updateData({ instructions: e.target.value })}
          hint="Αναλυτικές οδηγίες για τη συμπεριφορά του βοηθού. Χρησιμοποιήστε {{μεταβλητές}} για δυναμικά δεδομένα."
          rows={12}
          required
        />

        {/* Knowledge Base Upload */}
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Βάση Γνώσεων (προαιρετικό)</h3>
          <p className="text-xs text-text-tertiary mb-3">
            Ανεβάστε αρχεία με πληροφορίες (τιμοκατάλογο, FAQ, κανονισμούς κ.λπ.) ώστε ο βοηθός να τις χρησιμοποιεί στις κλήσεις.
          </p>
          <KnowledgeBaseUpload
            agentId={null}
            onDocumentsChange={handleKBDocumentsChange}
            compact
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} type="button">
            Πίσω
          </Button>
          <Button type="submit" disabled={!isValid}>
            Επόμενο
          </Button>
        </div>
      </form>
    </div>
  );
}
