// ═══════════════════════════════════════════════════════════════════
// Onboarding Step 1 — Business Information
// ═══════════════════════════════════════════════════════════════════

'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Input, Select } from '@/components/ui';
import { INDUSTRY_LABELS } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid =
    data.businessName &&
    data.industry &&
    data.ownerName &&
    data.email &&
    data.phone &&
    data.consentToProcessing &&
    data.consentToRecording;

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">{t.onboarding.businessTitle}</h2>
      <p className="text-sm text-text-secondary mb-6">
        {t.onboarding.businessSubtitle}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.onboarding.businessNameLabel}
          placeholder={t.onboarding.businessNamePlaceholder}
          value={data.businessName}
          onChange={(e) => updateData({ businessName: e.target.value })}
          required
        />

        <Select
          label={t.onboarding.industryLabel}
          placeholder={t.onboarding.industryPlaceholder}
          options={industryOptions}
          value={data.industry}
          onChange={(e) => updateData({ industry: e.target.value as OnboardingData['industry'] })}
          required
        />

        <Input
          label={t.onboarding.ownerNameLabel}
          placeholder={t.onboarding.ownerNamePlaceholder}
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
            label={t.onboarding.phoneLabel}
            type="tel"
            placeholder="+30 210 1234567"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            required
          />
        </div>

        <Select
          label={t.onboarding.timezoneLabel}
          options={[
            { value: 'Europe/Athens', label: t.onboarding.timezoneGreece },
            { value: 'Europe/Nicosia', label: t.onboarding.timezoneCyprus },
          ]}
          value={data.timezone}
          onChange={(e) => updateData({ timezone: e.target.value })}
        />

        {/* ── GDPR Consent Section (Art. 6/7) ───────────────────────── */}
        <div className="border border-border rounded-lg p-4 space-y-4 bg-surface-secondary mt-6">
          <h3 className="text-sm font-semibold text-text-primary">{t.onboarding.consentTitle}</h3>

          {/* Consent to data processing — REQUIRED */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
              checked={data.consentToProcessing}
              onChange={(e) => updateData({ consentToProcessing: e.target.checked })}
              required
            />
            <div>
              <span className="text-sm font-medium text-text-primary">{t.onboarding.consentProcessing}</span>
              <p className="text-xs text-text-secondary mt-0.5">
                {t.onboarding.consentProcessingDesc}{' '}
                <Link href="/privacy" target="_blank" className="text-primary underline">
                  {t.onboarding.consentPrivacyLink}
                </Link>
                {' '}{t.onboarding.consentAnd}{' '}
                <Link href="/terms" target="_blank" className="text-primary underline">
                  {t.onboarding.consentTermsLink}
                </Link>
              </p>
            </div>
          </label>

          {/* Consent to call recording — REQUIRED */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
              checked={data.consentToRecording}
              onChange={(e) => updateData({ consentToRecording: e.target.checked })}
              required
            />
            <div>
              <span className="text-sm font-medium text-text-primary">{t.onboarding.consentRecording}</span>
              <p className="text-xs text-text-secondary mt-0.5">{t.onboarding.consentRecordingDesc}</p>
            </div>
          </label>

          {/* Consent to marketing — OPTIONAL */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
              checked={data.consentToMarketing}
              onChange={(e) => updateData({ consentToMarketing: e.target.checked })}
            />
            <div>
              <span className="text-sm font-medium text-text-primary">{t.onboarding.consentMarketing}</span>
              <p className="text-xs text-text-secondary mt-0.5">{t.onboarding.consentMarketingDesc}</p>
            </div>
          </label>

          <p className="text-xs text-text-tertiary">{t.onboarding.consentRequired}</p>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={!isValid}>
            {t.common.next}
          </Button>
        </div>
      </form>
    </div>
  );
}


  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-8">
      <h2 className="text-xl font-semibold text-text-primary mb-2">{t.onboarding.businessTitle}</h2>
      <p className="text-sm text-text-secondary mb-6">
        {t.onboarding.businessSubtitle}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.onboarding.businessNameLabel}
          placeholder={t.onboarding.businessNamePlaceholder}
          value={data.businessName}
          onChange={(e) => updateData({ businessName: e.target.value })}
          required
        />

        <Select
          label={t.onboarding.industryLabel}
          placeholder={t.onboarding.industryPlaceholder}
          options={industryOptions}
          value={data.industry}
          onChange={(e) => updateData({ industry: e.target.value as OnboardingData['industry'] })}
          required
        />

        <Input
          label={t.onboarding.ownerNameLabel}
          placeholder={t.onboarding.ownerNamePlaceholder}
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
            label={t.onboarding.phoneLabel}
            type="tel"
            placeholder="+30 210 1234567"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            required
          />
        </div>

        <Select
          label={t.onboarding.timezoneLabel}
          options={[
            { value: 'Europe/Athens', label: t.onboarding.timezoneGreece },
            { value: 'Europe/Nicosia', label: t.onboarding.timezoneCyprus },
          ]}
          value={data.timezone}
          onChange={(e) => updateData({ timezone: e.target.value })}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={!isValid}>
            {t.common.next}
          </Button>
        </div>
      </form>
    </div>
  );
}
