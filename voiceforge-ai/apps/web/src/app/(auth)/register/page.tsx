// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — B2B Registration Page
// Full business registration with:
// 1. Personal info (name, email, phone, password)
// 2. Business info (company, AFM, DOY, address)
// 3. Plan selection + duration
// 4. Confirmation + IBAN display for bank transfer
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input } from '@/components/ui';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useI18n } from '@/lib/i18n';
import { API_URL } from '@/lib/env';
import { toast } from 'sonner';
import { Check, Building2, User, CreditCard, ArrowLeft, ArrowRight, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'personal' | 'business' | 'plan' | 'confirm' | 'success';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number | null;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Για μικρές επιχειρήσεις',
    priceMonthly: 29,
    features: ['1 AI Agent', '1 Αριθμός τηλεφώνου', '500 λεπτά/μήνα', 'Email υποστήριξη'],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Για αναπτυσσόμενες επιχειρήσεις',
    priceMonthly: 79,
    features: ['3 AI Agents', '3 Αριθμοί', '2.000 λεπτά/μήνα', 'Priority υποστήριξη', 'Webhooks'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Για μεγάλες επιχειρήσεις',
    priceMonthly: 199,
    features: ['10 AI Agents', '10 Αριθμοί', '10.000 λεπτά/μήνα', '24/7 υποστήριξη', 'API πρόσβαση', 'SLA 99.9%'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Εξατομικευμένη λύση',
    priceMonthly: null,
    features: ['Απεριόριστοι Agents', 'Απεριόριστα λεπτά', 'Account Manager', 'Custom development'],
  },
];

const DURATION_OPTIONS = [
  { value: '1', label: '1 μήνας' },
  { value: '3', label: '3 μήνες' },
  { value: '6', label: '6 μήνες (-5%)' },
  { value: '12', label: '12 μήνες (-15%)' },
];

interface BankDetails {
  bankName: string;
  iban: string;
  beneficiary: string;
  swift: string;
  note: string;
}

export default function RegisterPage() {
  const { t } = useI18n();

  const [step, setStep] = useState<Step>('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIban, setCopiedIban] = useState(false);

  // Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Business info
  const [companyName, setCompanyName] = useState('');
  const [afm, setAfm] = useState('');
  const [doy, setDoy] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Plan
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [durationMonths, setDurationMonths] = useState('3');

  // After submission
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [totalPrice, setTotalPrice] = useState('');
  const [nextSteps, setNextSteps] = useState<string[]>([]);

  // ── Computed ──
  const plan = PLANS.find((p) => p.id === selectedPlan);
  const duration = parseInt(durationMonths);
  const discount = duration >= 12 ? 0.85 : duration >= 6 ? 0.95 : 1;
  const monthlyPrice = plan?.priceMonthly ?? 0;
  const computedTotal = Math.round(monthlyPrice * duration * discount);

  // ── Step Validation ──
  const canProceedPersonal = firstName.length >= 2 && lastName.length >= 2 &&
    email.includes('@') && phone.length >= 10 && password.length >= 8 && password === confirmPassword;
  const canProceedBusiness = companyName.length >= 2 && /^\d{9}$/.test(afm) && doy.length >= 2 && businessAddress.length >= 5;

  // ── Submit ──
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/registration/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          companyName,
          afm,
          doy,
          businessAddress,
          plan: selectedPlan,
          durationMonths: duration,
          userRole: 'naive',
        }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error?.message || 'Σφάλμα κατά την υποβολή');
        return;
      }

      setBankDetails(data.data.bankDetails);
      setTotalPrice(data.data.totalPrice);
      setNextSteps(data.data.nextSteps || []);
      setStep('success');
      toast.success('Η εγγραφή υποβλήθηκε επιτυχώς!');
    } catch {
      toast.error('Σφάλμα σύνδεσης με τον server');
    } finally {
      setIsLoading(false);
    }
  };

  const copyIban = () => {
    if (bankDetails?.iban) {
      navigator.clipboard.writeText(bankDetails.iban.replace(/\s/g, ''));
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  // ── Step Indicators ──
  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: 'Στοιχεία', icon: <User className="w-4 h-4" /> },
    { id: 'business', label: 'Επιχείρηση', icon: <Building2 className="w-4 h-4" /> },
    { id: 'plan', label: 'Πακέτο', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'confirm', label: 'Επιβεβαίωση', icon: <Check className="w-4 h-4" /> },
  ];

  const stepOrder: Step[] = ['personal', 'business', 'plan', 'confirm'];
  const currentStepIndex = stepOrder.indexOf(step);

  // ═══════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN — After registration submitted
  // ═══════════════════════════════════════════════════════════════════

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Η εγγραφή υποβλήθηκε!</h2>
          <p className="text-text-secondary mt-2">
            Ολοκληρώστε την πληρωμή μέσω τραπεζικής κατάθεσης
          </p>
        </div>

        {bankDetails && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4">🏦 Στοιχεία Τραπεζικού Λογαριασμού</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">Τράπεζα</p>
                <p className="text-sm font-semibold text-blue-900">{bankDetails.bankName}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">IBAN</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-blue-900 tracking-wider">{bankDetails.iban}</p>
                  <button onClick={copyIban} className="p-1.5 rounded-lg hover:bg-blue-100 transition" title="Αντιγραφή IBAN">
                    {copiedIban ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">Δικαιούχος</p>
                <p className="text-sm font-semibold text-blue-900">{bankDetails.beneficiary}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">SWIFT</p>
                <p className="text-sm font-mono text-blue-900">{bankDetails.swift}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">Ποσό Κατάθεσης</p>
                <p className="text-xl font-bold text-green-700">{totalPrice}</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 font-medium">⚠️ {bankDetails.note}</p>
            </div>
          </div>
        )}

        {nextSteps.length > 0 && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6">
            <h3 className="text-sm font-bold text-text-primary mb-3">Επόμενα Βήματα:</h3>
            <ol className="space-y-2">
              {nextSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-text-secondary">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-text-secondary mb-4">
            Μόλις επιβεβαιωθεί η πληρωμή, θα λάβετε email με το κλειδί ενεργοποίησης.
          </p>
          <Link
            href="/activate"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-purple-600 text-white font-semibold rounded-lg hover:from-brand-700 hover:to-purple-700 transition"
          >
            Έχω ήδη κλειδί → Ενεργοποίηση
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTRATION FORM — Multi-step wizard
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Εγγραφή Επιχείρησης</h2>
          <p className="text-sm text-text-secondary mt-1">Δημιουργήστε τον λογαριασμό σας στο VoiceForge AI</p>
        </div>
        <LanguageToggle />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition w-full justify-center',
                i < currentStepIndex ? 'bg-green-100 text-green-700' :
                i === currentStepIndex ? 'bg-brand-100 text-brand-700' :
                'bg-gray-100 text-gray-400',
              )}
            >
              {i < currentStepIndex ? <Check className="w-4 h-4" /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'w-6 h-0.5 rounded shrink-0',
                i < currentStepIndex ? 'bg-green-300' : 'bg-gray-200',
              )} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Personal Info ── */}
      {step === 'personal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Όνομα *" placeholder="π.χ. Πάνος" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Επώνυμο *" placeholder="π.χ. Παπαδόπουλος" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input label="Email *" type="email" placeholder="info@company.gr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Τηλέφωνο *" type="tel" placeholder="+30 69xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="Κωδικός Πρόσβασης *" type="password" placeholder="Τουλάχιστον 8 χαρακτήρες" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <Input
            label="Επιβεβαίωση Κωδικού *"
            type="password"
            placeholder="Επαναλάβετε τον κωδικό"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            error={confirmPassword && password !== confirmPassword ? 'Οι κωδικοί δεν ταιριάζουν' : undefined}
          />
          <div className="flex justify-between pt-4">
            <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Σύνδεση
            </Link>
            <Button onClick={() => setStep('business')} disabled={!canProceedPersonal}>
              Επόμενο <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Business Info ── */}
      {step === 'business' && (
        <div className="space-y-4">
          <Input label="Επωνυμία Εταιρείας *" placeholder="π.χ. ABC Μονοπρόσωπη ΕΠΕ" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="ΑΦΜ *"
              placeholder="9 ψηφία"
              value={afm}
              onChange={(e) => setAfm(e.target.value.replace(/\D/g, '').slice(0, 9))}
              required
              error={afm && !/^\d{9}$/.test(afm) ? 'Το ΑΦΜ πρέπει να είναι 9 ψηφία' : undefined}
            />
            <Input label="ΔΟΥ *" placeholder="π.χ. Α' Αθηνών" value={doy} onChange={(e) => setDoy(e.target.value)} required />
          </div>
          <Input label="Διεύθυνση Επιχείρησης *" placeholder="π.χ. Ερμού 10, Αθήνα 10563" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} required />
          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setStep('personal')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Πίσω
            </Button>
            <Button onClick={() => setStep('plan')} disabled={!canProceedBusiness}>
              Επόμενο <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Plan Selection ── */}
      {step === 'plan' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={cn(
                  'relative text-left p-5 rounded-xl border-2 transition',
                  selectedPlan === p.id
                    ? 'border-brand-500 bg-brand-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-bold bg-brand-600 text-white rounded-full">
                    Δημοφιλές
                  </span>
                )}
                <h4 className="text-lg font-bold text-text-primary">{p.name}</h4>
                <p className="text-xs text-text-secondary mb-3">{p.description}</p>
                <p className="text-2xl font-bold text-text-primary mb-3">
                  {p.priceMonthly ? `€${p.priceMonthly}` : 'Custom'}
                  {p.priceMonthly && <span className="text-sm font-normal text-text-secondary">/μήνα</span>}
                </p>
                <ul className="space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-text-secondary">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          {/* Duration */}
          <div className="bg-white border border-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-text-primary mb-3">Διάρκεια Συνδρομής</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDurationMonths(opt.value)}
                  className={cn(
                    'px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition',
                    durationMonths === opt.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {plan?.priceMonthly && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>€{plan.priceMonthly}/μήνα × {duration} μήνες</span>
                  <span>€{plan.priceMonthly * duration}</span>
                </div>
                {discount < 1 && (
                  <div className="flex justify-between text-sm text-green-600 mt-1">
                    <span>Έκπτωση ({Math.round((1 - discount) * 100)}%)</span>
                    <span>-€{Math.round(plan.priceMonthly * duration * (1 - discount))}</span>
                  </div>
                )}
                <div className="flex justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-base font-bold text-text-primary">Σύνολο</span>
                  <span className="text-xl font-bold text-green-600">€{computedTotal}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep('business')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Πίσω
            </Button>
            <Button onClick={() => setStep('confirm')}>
              Επιβεβαίωση <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirmation ── */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Σύνοψη Εγγραφής</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-secondary font-medium uppercase mb-2">Προσωπικά Στοιχεία</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Όνομα:</span> <span className="font-medium">{firstName} {lastName}</span></div>
                  <div><span className="text-gray-400">Email:</span> <span className="font-medium">{email}</span></div>
                  <div><span className="text-gray-400">Τηλέφωνο:</span> <span className="font-medium">{phone}</span></div>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-secondary font-medium uppercase mb-2">Στοιχεία Επιχείρησης</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Επωνυμία:</span> <span className="font-medium">{companyName}</span></div>
                  <div><span className="text-gray-400">ΑΦΜ:</span> <span className="font-medium">{afm}</span></div>
                  <div><span className="text-gray-400">ΔΟΥ:</span> <span className="font-medium">{doy}</span></div>
                  <div><span className="text-gray-400">Διεύθυνση:</span> <span className="font-medium">{businessAddress}</span></div>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-secondary font-medium uppercase mb-2">Πακέτο & Πληρωμή</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Πακέτο:</span> <span className="font-medium text-brand-600">{plan?.name}</span></div>
                  <div><span className="text-gray-400">Διάρκεια:</span> <span className="font-medium">{duration} μήνες</span></div>
                  {plan?.priceMonthly && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Σύνολο:</span>{' '}
                      <span className="text-lg font-bold text-green-600">€{computedTotal}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>💳 Πληρωμή:</strong> Μετά την υποβολή θα δείτε τα στοιχεία τραπεζικού λογαριασμού
              για κατάθεση. Μόλις επιβεβαιωθεί η πληρωμή, θα λάβετε email με το κλειδί ενεργοποίησης.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep('plan')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Πίσω
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              className="bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-700 hover:to-purple-700"
            >
              Υποβολή Εγγραφής
            </Button>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="mt-8 pt-6 border-t border-border text-center space-y-2">
        <p className="text-sm text-text-secondary">
          Έχετε ήδη λογαριασμό;{' '}
          <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            Σύνδεση
          </Link>
        </p>
        <p className="text-sm text-text-secondary">
          Έχετε κλειδί ενεργοποίησης;{' '}
          <Link href="/activate" className="text-brand-600 hover:text-brand-700 font-medium">
            Ενεργοποίηση
          </Link>
        </p>
      </div>
    </div>
  );
}
