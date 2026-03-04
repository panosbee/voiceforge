// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 5 — Review & Confirm
// Final summary before creating everything
// ═══════════════════════════════════════════════════════════════════

'use client';

import { Button } from '@/components/ui';
import { INDUSTRY_LABELS, PLAN_LABELS, formatPhoneNumber } from '@/lib/utils';
import { GREEK_VOICES } from '@voiceforge/shared';
import { CheckCircle, Building2, CreditCard, Bot, Phone, Pencil } from 'lucide-react';
import type { OnboardingData } from './page';

interface StepReviewProps {
  data: OnboardingData;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  goToStep: (step: number) => void;
}

function SectionCard({
  title,
  icon,
  stepIndex,
  goToStep,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  stepIndex: number;
  goToStep: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-text-primary">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => goToStep(stepIndex)}
          className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          <Pencil className="w-3.5 h-3.5" />
          Επεξεργασία
        </button>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export function StepReview({ data, onBack, onSubmit, isSubmitting, goToStep }: StepReviewProps) {
  const voiceName = GREEK_VOICES.find((v) => v.id === data.voiceId)?.name ?? data.voiceId;
  const planInfo = PLAN_LABELS[data.plan]!;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-50 mb-3">
          <CheckCircle className="w-6 h-6 text-success-500" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Σύνοψη Εγκατάστασης</h2>
        <p className="text-sm text-text-secondary mt-1">
          Ελέγξτε τα στοιχεία σας πριν ξεκινήσουμε.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Business */}
        <SectionCard title="Επιχείρηση" icon={<Building2 className="w-5 h-5 text-brand-500" />} stepIndex={0} goToStep={goToStep}>
          <InfoRow label="Επωνυμία" value={data.businessName} />
          <InfoRow label="Κλάδος" value={INDUSTRY_LABELS[data.industry] ?? data.industry} />
          <InfoRow label="Ιδιοκτήτης" value={data.ownerName} />
          <InfoRow label="Email" value={data.email} />
          <InfoRow label="Τηλέφωνο" value={data.phone} />
          <InfoRow label="Ζώνη Ώρας" value={data.timezone} />
        </SectionCard>

        {/* Plan */}
        <SectionCard title="Πακέτο" icon={<CreditCard className="w-5 h-5 text-brand-500" />} stepIndex={1} goToStep={goToStep}>
          <InfoRow label="Πακέτο" value={planInfo.name} />
          <InfoRow label="Τιμή" value={`${planInfo.price}/μήνα`} />
          <InfoRow label="Περιλαμβάνει" value={planInfo.description} />
        </SectionCard>

        {/* Agent */}
        <SectionCard title="AI Βοηθός" icon={<Bot className="w-5 h-5 text-brand-500" />} stepIndex={2} goToStep={goToStep}>
          <InfoRow label="Όνομα" value={data.agentName} />
          <InfoRow label="Φωνή" value={voiceName} />
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-text-tertiary mb-1">Χαιρετισμός:</p>
            <p className="text-sm text-text-secondary italic">&ldquo;{data.greeting.slice(0, 120)}{data.greeting.length > 120 ? '...' : ''}&rdquo;</p>
          </div>
        </SectionCard>

        {/* Phone Number */}
        <SectionCard title="Τηλεφωνικός Αριθμός" icon={<Phone className="w-5 h-5 text-brand-500" />} stepIndex={4} goToStep={goToStep}>
          {data.selectedNumber ? (
            <>
              <InfoRow label="Αριθμός" value={formatPhoneNumber(data.selectedNumber)} />
              {data.numberMonthlyCost && <InfoRow label="Κόστος" value={`${data.numberMonthlyCost}/μήνα`} />}
            </>
          ) : (
            <p className="text-sm text-text-tertiary italic">Δεν επιλέχθηκε αριθμός — μπορείτε να προσθέσετε αργότερα</p>
          )}
        </SectionCard>
      </div>

      {/* What happens next */}
      <div className="bg-brand-50/50 border border-brand-200 rounded-xl p-5 mb-8">
        <h4 className="text-sm font-semibold text-brand-800 mb-2">Τι θα γίνει μετά:</h4>
        <ol className="text-sm text-brand-700 space-y-1 list-decimal list-inside">
          <li>Δημιουργία λογαριασμού VoiceForge</li>
          <li>Ρύθμιση AI βοηθού (ElevenLabs) με τις οδηγίες σας</li>
          {data.kbDocumentIds.length > 0 && <li>Σύνδεση βάσης γνώσεων ({data.kbDocumentIds.length} αρχεία)</li>}
          {data.selectedNumber && <li>Αγορά & σύνδεση τηλεφωνικού αριθμού</li>}
          <li>Ο βοηθός σας θα είναι έτοιμος!</li>
        </ol>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Πίσω
        </Button>
        <Button onClick={onSubmit} isLoading={isSubmitting} size="lg">
          🚀 Ξεκινήστε!
        </Button>
      </div>
    </div>
  );
}
