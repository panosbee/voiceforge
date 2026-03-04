// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Landing Page
// Production-ready with pricing, features, industries & i18n
// ═══════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Check, Phone, Calendar, BarChart3, GitBranch, PhoneForwarded, Bot, Plus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const FEATURE_ICONS = {
  greekVoice: '🇬🇷',
  appointments: Calendar,
  analytics: BarChart3,
  customFlows: GitBranch,
  forwardCalls: PhoneForwarded,
  multiAgent: Bot,
} as const;

export default function Home() {
  const { t } = useI18n();

  const features = [
    { key: 'greekVoice' as const, ...t.landing.features.greekVoice },
    { key: 'appointments' as const, ...t.landing.features.appointments },
    { key: 'analytics' as const, ...t.landing.features.analytics },
    { key: 'customFlows' as const, ...t.landing.features.customFlows },
    { key: 'forwardCalls' as const, ...t.landing.features.forwardCalls },
    { key: 'multiAgent' as const, ...t.landing.features.multiAgent },
  ];

  const industries = Object.values(t.landing.industries);

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <span className="text-lg font-bold text-text-primary">VoiceForge AI</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {t.common.login}
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              {t.common.freeSignup}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4">
        <section className="py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-3xl mx-auto">
            {t.landing.heroTitle} <br />
            <span className="text-brand-600">{t.landing.heroTitleHighlight}</span>
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
            {t.landing.heroSubtitle}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3 text-base font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-colors"
            >
              {t.common.getStartedFree}
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 text-base font-semibold text-text-primary bg-surface border border-border hover:bg-surface-tertiary rounded-xl transition-colors"
            >
              {t.common.login}
            </Link>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="py-16">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-10">
            {t.landing.featuresTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const iconEntry = FEATURE_ICONS[feature.key];
              const isEmoji = typeof iconEntry === 'string';
              const Icon = isEmoji ? null : iconEntry;

              return (
                <div
                  key={feature.key}
                  className="bg-surface border border-border rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <div className="text-3xl mb-4">
                    {isEmoji ? iconEntry : Icon && <Icon className="w-8 h-8 text-brand-600" />}
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                  <p className="text-sm text-text-secondary">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────── */}
        <section id="pricing" className="py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary">{t.landing.pricingTitle}</h2>
            <p className="mt-3 text-lg text-text-secondary max-w-xl mx-auto">
              {t.landing.pricingSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Basic Plan */}
            <div className="relative bg-surface border-2 border-brand-500 rounded-2xl p-8 shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 text-xs font-bold uppercase rounded-full bg-brand-600 text-white">
                  {t.landing.plans.basic.badge}
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-text-primary">{t.landing.plans.basic.name}</h3>
                <p className="text-sm text-text-secondary mt-2">{t.landing.plans.basic.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-text-primary">{t.landing.plans.basic.price}</span>
                  <span className="text-text-secondary">{t.landing.plans.basic.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {t.landing.plans.basic.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-brand-600 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block w-full text-center px-6 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
              >
                {t.landing.plans.basic.cta}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="relative bg-surface border-2 border-amber-500 rounded-2xl p-8 shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 text-xs font-bold uppercase rounded-full bg-amber-500 text-white">
                  {t.landing.plans.pro.badge}
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-text-primary">{t.landing.plans.pro.name}</h3>
                <p className="text-sm text-text-secondary mt-2">{t.landing.plans.pro.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-text-primary">{t.landing.plans.pro.price}</span>
                  <span className="text-text-secondary">{t.landing.plans.pro.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {t.landing.plans.pro.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block w-full text-center px-6 py-3 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors"
              >
                {t.landing.plans.pro.cta}
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="relative bg-surface border-2 border-border rounded-2xl p-8 hover:border-purple-400 transition-colors">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <span className="px-4 py-1 text-xs font-bold uppercase rounded-full bg-purple-600 text-white">
                  {t.landing.plans.enterprise.badge}
                </span>
                <span className="px-3 py-1 text-xs font-bold uppercase rounded-full bg-red-500 text-white animate-pulse">
                  {t.landing.plans.enterprise.comingSoon}
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-text-primary">{t.landing.plans.enterprise.name}</h3>
                <p className="text-sm text-text-secondary mt-2">{t.landing.plans.enterprise.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-text-primary">{t.landing.plans.enterprise.price}</span>
                  <span className="text-text-secondary">{t.landing.plans.enterprise.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {t.landing.plans.enterprise.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-purple-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block w-full text-center px-6 py-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              >
                {t.landing.plans.enterprise.cta}
              </Link>
            </div>
          </div>

          {/* ── Top-Ups ─────────────────────────────────────────── */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-text-primary text-center mb-6">{t.landing.topupsTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(t.landing.topups).map((topup) => (
                <div
                  key={topup}
                  className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 shadow-card"
                >
                  <Plus className="w-5 h-5 text-brand-600 shrink-0" />
                  <span className="text-sm text-text-secondary">{topup}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Industries ────────────────────────────────────────── */}
        <section className="py-16 text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-8">{t.landing.industriesTitle}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((industry) => (
              <span
                key={industry}
                className="px-4 py-2 bg-brand-50 text-brand-700 text-sm font-medium rounded-full"
              >
                {industry}
              </span>
            ))}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <section className="py-20 text-center">
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-2xl p-12 shadow-xl">
            <h2 className="text-3xl font-bold">{t.landing.ctaTitle}</h2>
            <p className="mt-4 text-brand-100 text-lg">{t.landing.ctaSubtitle}</p>
            <Link
              href="/register"
              className="mt-8 inline-block px-8 py-3 text-base font-semibold bg-white text-brand-700 hover:bg-brand-50 rounded-xl transition-colors shadow-sm"
            >
              {t.common.getStartedFree}
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-surface border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <p className="text-sm text-text-tertiary">
            © {new Date().getFullYear()} VoiceForge AI. {t.common.allRightsReserved}
          </p>
          <LanguageToggle />
        </div>
      </footer>
    </div>
  );
}
