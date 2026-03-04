import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VoiceForge AI — Admin Panel',
  description: 'Διαχείριση πελατών, εγγραφών και αδειών χρήσης.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 min-h-screen">
      {children}
    </div>
  );
}
