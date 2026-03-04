// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dashboard Loading Page
// Skeleton shown during dashboard route transitions.
// ═══════════════════════════════════════════════════════════════════

import { Spinner } from '@/components/ui';

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    </div>
  );
}
