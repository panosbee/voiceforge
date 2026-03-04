// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dashboard Layout
// Sidebar + main content area + support chatbot
// ═══════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { SupportChatbot } from '@/components/support-chatbot';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
      {/* Technical support chatbot — floating widget on all dashboard pages */}
      <SupportChatbot />
    </div>
  );
}
