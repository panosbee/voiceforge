// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Global Loading Page
// Shown during route transitions at the root level.
// ═══════════════════════════════════════════════════════════════════

import { Spinner } from '@/components/ui';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />

      </div>
    </div>
  );
}
