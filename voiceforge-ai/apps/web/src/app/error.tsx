// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Global Error Page
// Shown when an unhandled error occurs at the root level.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-danger-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-danger-500" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">{t.errors.appError}</h1>
        <p className="text-text-secondary mb-8">
          {t.errors.appErrorDescription}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t.errors.tryAgain}
          </Button>
          <Button variant="primary" onClick={() => (window.location.href = '/')} leftIcon={<Home className="w-4 h-4" />}>
            {t.errors.home}
          </Button>
        </div>
      </div>
    </div>
  );
}
