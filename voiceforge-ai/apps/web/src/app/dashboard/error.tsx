// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dashboard Error Page
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="p-6">
      <Card padding="lg">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-danger-500" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">{t.errors.loadingError}</h2>
          <p className="text-sm text-text-secondary mb-6 text-center max-w-md">
            {t.errors.loadingErrorDescription}
          </p>
          <Button onClick={reset} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t.errors.tryAgain}
          </Button>
        </div>
      </Card>
    </div>
  );
}
