// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — 404 Not Found Page
// ═══════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-brand-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">{t.errors.pageNotFound}</h1>
        <p className="text-text-secondary mb-8">
          {t.errors.pageNotFoundDescription}
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
              {t.errors.home}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
