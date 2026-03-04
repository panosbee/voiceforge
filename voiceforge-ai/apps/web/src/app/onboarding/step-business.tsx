// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 1 — Business Information
// ═══════════════════════════════════════════════════════════════════

'use client';

import type { FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { INDUSTRY_LABELS } from '@/lib/utils';
import type { OnboardingData } from './page';

interface StepBusinessProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const industryOptions = Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function StepBusiness({ data, updateData, onNext }: StepBusinessProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = data.businessName && data.industry && data.ownerName && data.email && data.phone;

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Στοιχεία Επιχείρησης</h2>
      <p className="text-sm text-text-secondary mb-6">
        Πείτε μας για την επιχείρησή σας ώστε να ρυθμίσουμε τον AI βοηθό σας.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Επωνυμία Επιχείρησης"
          placeholder="π.χ. Δικηγορικό Γραφείο Παπαδόπουλος"
          value={data.businessName}
          onChange={(e) => updateData({ businessName: e.target.value })}
          required
        />

        <Select
          label="Κλάδος"
          placeholder="Επιλέξτε κλάδο..."
          options={industryOptions}
          value={data.industry}
          onChange={(e) => updateData({ industry: e.target.value as OnboardingData['industry'] })}
          required
        />

        <Input
          label="Ονοματεπώνυμο Ιδιοκτήτη"
          placeholder="π.χ. Γιάννης Παπαδόπουλος"
          value={data.ownerName}
          onChange={(e) => updateData({ ownerName: e.target.value })}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="info@example.gr"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
            required
          />
          <Input
            label="Τηλέφωνο"
            type="tel"
            placeholder="+30 210 1234567"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            required
          />
        </div>

        <Select
          label="Ζώνη Ώρας"
          options={[
            { value: 'Europe/Athens', label: 'Ελλάδα (Europe/Athens)' },
            { value: 'Europe/Nicosia', label: 'Κύπρος (Europe/Nicosia)' },
          ]}
          value={data.timezone}
          onChange={(e) => updateData({ timezone: e.target.value })}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={!isValid}>
            Επόμενο
          </Button>
        </div>
      </form>
    </div>
  );
}
