// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — License Activation Page
// Customer enters the license key received via email to activate
// their account and get immediate access to the dashboard.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useI18n } from '@/lib/i18n';
import { API_URL } from '@/lib/env';
import { setDevToken } from '@/lib/dev-auth';
import { toast } from 'sonner';
import { KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ActivatePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [activationData, setActivationData] = useState<{
    plan: string;
    durationMonths: number;
    expiresAt: string;
  } | null>(null);

  const formatKey = (value: string) => {
    // Auto-format: VF-XXXX-XXXX-XXXX
    const clean = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return clean;
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast.error('Εισάγετε το κλειδί ενεργοποίησης');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/registration/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error?.message || 'Σφάλμα ενεργοποίησης');
        return;
      }

      // Save the auth token
      if (data.data.access_token) {
        setDevToken(data.data.access_token);
      }

      setActivationData(data.data.license);
      setIsActivated(true);
      toast.success('Ο λογαριασμός σας ενεργοποιήθηκε!');
    } catch {
      toast.error('Σφάλμα σύνδεσης με τον server');
    } finally {
      setIsLoading(false);
    }
  };

  const planLabels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    business: 'Business',
    enterprise: 'Enterprise',
  };

  // ── Activation Success ──
  if (isActivated && activationData) {
    const formattedExpiry = new Date(activationData.expiresAt).toLocaleDateString('el-GR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Ενεργοποίηση Επιτυχής!</h2>
        <p className="text-text-secondary mb-6">
          Ο λογαριασμός σας είναι τώρα ενεργός. Καλώς ήρθατε στο VoiceForge AI!
        </p>

        <div className="bg-surface border border-border rounded-xl p-5 mb-6 text-left">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Πακέτο</span>
              <span className="font-semibold text-brand-600">
                {planLabels[activationData.plan] || activationData.plan}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Διάρκεια</span>
              <span className="font-medium">{activationData.durationMonths} μήνες</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Ισχύει μέχρι</span>
              <span className="font-semibold text-green-600">{formattedExpiry}</span>
            </div>
          </div>
        </div>

        <Button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-700 hover:to-purple-700"
        >
          Μετάβαση στο Dashboard <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Activation Form ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Ενεργοποίηση Λογαριασμού</h2>
          <p className="text-sm text-text-secondary mt-1">
            Εισάγετε το κλειδί που λάβατε μέσω email
          </p>
        </div>
        <LanguageToggle />
      </div>

      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="text-sm text-brand-800">
            <p className="font-medium mb-1">Πώς λειτουργεί;</p>
            <ol className="list-decimal list-inside space-y-1 text-brand-700">
              <li>Εγγραφείτε και πληρώστε μέσω τραπεζικής κατάθεσης</li>
              <li>Ο διαχειριστής επιβεβαιώνει την πληρωμή</li>
              <li>Λαμβάνετε κλειδί ενεργοποίησης στο email σας</li>
              <li>Εισάγετε το κλειδί εδώ και ξεκινάτε!</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Κλειδί Ενεργοποίησης
          </label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(formatKey(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            placeholder="VF-XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 text-lg font-mono tracking-widest text-center border border-border rounded-xl bg-surface text-text-primary focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition placeholder:text-text-tertiary"
            maxLength={16}
          />
        </div>

        <Button
          onClick={handleActivate}
          isLoading={isLoading}
          disabled={licenseKey.length < 10}
          className="w-full"
        >
          Ενεργοποίηση
        </Button>
      </div>

      <div className="mt-8 pt-6 border-t border-border text-center space-y-2">
        <p className="text-sm text-text-secondary">
          Δεν έχετε λογαριασμό;{' '}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
            Εγγραφή
          </Link>
        </p>
        <p className="text-sm text-text-secondary">
          Έχετε ήδη λογαριασμό;{' '}
          <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            Σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
