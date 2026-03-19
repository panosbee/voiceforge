// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Privacy Policy Page
// GDPR Art. 12-14 compliant: transparent, concise, plain language
// ═══════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Πολιτική Απορρήτου — VoiceForge AI',
  description:
    'Πολιτική Απορρήτου VoiceForge AI. Μάθετε πώς επεξεργαζόμαστε τα δεδομένα σας σύμφωνα με τον GDPR.',
};

const LAST_UPDATED = '1 Ιανουαρίου 2025';
const DATA_CONTROLLER = 'VoiceForge AI';
const CONTACT_EMAIL = 'privacy@voiceforge.ai';
const DPA_URL = 'https://www.dpa.gr';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <span className="font-semibold text-text-primary">VoiceForge AI</span>
          </Link>
          <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            ← Επιστροφή
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 space-y-10">

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-text-primary">Πολιτική Απορρήτου</h1>
            <p className="text-text-secondary text-sm">Τελευταία ενημέρωση: {LAST_UPDATED}</p>
          </div>

          {/* Intro */}
          <section className="prose prose-sm max-w-none space-y-4">
            <p className="text-text-secondary leading-relaxed">
              Η παρούσα Πολιτική Απορρήτου περιγράφει τον τρόπο με τον οποίο η{' '}
              <strong className="text-text-primary">{DATA_CONTROLLER}</strong> («εμείς», «μας» ή
              «VoiceForge AI») συλλέγει, χρησιμοποιεί και προστατεύει τα προσωπικά σας δεδομένα
              κατά τη χρήση της πλατφόρμας AI φωνητικού βοηθού μας, σύμφωνα με τον Κανονισμό (ΕΕ)
              2016/679 (GDPR).
            </p>
          </section>

          <Divider />

          {/* 1. Data Controller */}
          <Section title="1. Υπεύθυνος Επεξεργασίας">
            <p>
              Υπεύθυνος επεξεργασίας των δεδομένων σας είναι η <strong>{DATA_CONTROLLER}</strong>.
              Για οποιοδήποτε ζήτημα σχετικό με την προστασία των προσωπικών σας δεδομένων,
              επικοινωνήστε μαζί μας στη διεύθυνση:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          {/* 2. Data We Collect */}
          <Section title="2. Δεδομένα που Συλλέγουμε">
            <p className="mb-3">Συλλέγουμε τις εξής κατηγορίες δεδομένων:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Δεδομένα λογαριασμού:</strong> Όνομα, επαγγελματικό email, όνομα
                επιχείρησης, τηλέφωνο, κλάδος δραστηριότητας
              </li>
              <li>
                <strong>Δεδομένα κλήσεων:</strong> Αριθμός καλούντος, transcript συνομιλίας,
                σύνοψη, διάρκεια, αποτέλεσμα κλήσης, URL ηχογράφησης (εφόσον έχετε δώσει
                συναίνεση)
              </li>
              <li>
                <strong>Ραντεβού:</strong> Ονόματα και τηλέφωνα πελατών σας που κλείνουν ραντεβού
                μέσω του AI βοηθού σας
              </li>
              <li>
                <strong>Τεχνικά δεδομένα:</strong> Διεύθυνση IP, user agent, cookies συνεδρίας
              </li>
              <li>
                <strong>Δεδομένα πληρωμής:</strong> Τα στοιχεία κάρτας/πληρωμής διαχειρίζεται
                αποκλειστικά η Stripe και δεν αποθηκεύονται στους servers μας
              </li>
            </ul>
          </Section>

          {/* 3. Legal Basis */}
          <Section title="3. Νόμιμη Βάση Επεξεργασίας (Άρθρο 6 GDPR)">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Εκτέλεση σύμβασης (Άρθρο 6§1β):</strong> Επεξεργαζόμαστε τα δεδομένα σας
                για να παρέχουμε τις υπηρεσίες VoiceForge AI που έχετε εγγραφεί
              </li>
              <li>
                <strong>Συναίνεση (Άρθρο 6§1α):</strong> Η ηχογράφηση κλήσεων και η αποστολή
                marketing emails πραγματοποιούνται μόνο με την εκ των προτέρων συναίνεσή σας
              </li>
              <li>
                <strong>Έννομο συμφέρον (Άρθρο 6§1στ):</strong> Για την ασφάλεια της πλατφόρμας
                και την αποτροπή κατάχρησης
              </li>
            </ul>
          </Section>

          {/* 4. How We Use Data */}
          <Section title="4. Χρήση των Δεδομένων">
            <ul className="list-disc pl-5 space-y-2">
              <li>Παροχή, συντήρηση και βελτίωση των υπηρεσιών AI φωνητικού βοηθού</li>
              <li>Ανάλυση κλήσεων για εξαγωγή insights και αναφορών</li>
              <li>Τιμολόγηση και διαχείριση συνδρομής</li>
              <li>Τεχνική υποστήριξη και ειδοποιήσεις υπηρεσίας</li>
              <li>Marketing επικοινωνίες (μόνο με τη συναίνεσή σας)</li>
            </ul>
          </Section>

          {/* 5. Data Sharing */}
          <Section title="5. Αποδέκτες Δεδομένων">
            <p className="mb-3">
              Δεν πωλούμε τα δεδομένα σας. Τα κοινοποιούμε μόνο με εγκεκριμένους επεξεργαστές:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>ElevenLabs:</strong> Σύνθεση ομιλίας AI (επεξεργαστής — SCCs εφαρμόζονται
                για μεταφορά εκτός ΕΕ)
              </li>
              <li>
                <strong>Telnyx:</strong> Τηλεφωνική υποδομή VoIP (επεξεργαστής)
              </li>
              <li>
                <strong>Stripe:</strong> Επεξεργασία πληρωμών (ανεξάρτητος υπεύθυνος επεξεργασίας)
              </li>
              <li>
                <strong>Supabase:</strong> Αυθεντικοποίηση χρηστών
              </li>
            </ul>
            <p className="mt-3">
              Όλες οι μεταφορές δεδομένων εκτός ΕΟΧ πραγματοποιούνται βάσει Τυποποιημένων
              Συμβατικών Ρητρών (SCCs) σύμφωνα με το Άρθρο 46 GDPR.
            </p>
          </Section>

          {/* 6. Retention */}
          <Section title="6. Χρόνος Διατήρησης">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Δεδομένα κλήσεων:</strong> Διαγράφονται αυτόματα μετά από{' '}
                <strong>90 ημέρες</strong> (ρυθμιζόμενο)
              </li>
              <li>
                <strong>Δεδομένα λογαριασμού:</strong> Διατηρούνται έως ότου διαγράψετε τον
                λογαριασμό σας
              </li>
              <li>
                <strong>Αρχεία ελέγχου (audit logs):</strong> Διατηρούνται για{' '}
                <strong>1 έτος</strong> για λόγους συμμόρφωσης
              </li>
              <li>
                <strong>Δεδομένα τιμολόγησης:</strong> Διατηρούνται για{' '}
                <strong>7 έτη</strong> βάσει φορολογικής νομοθεσίας
              </li>
            </ul>
          </Section>

          {/* 7. Rights */}
          <Section title="7. Δικαιώματά σας (Άρθρα 15-22 GDPR)">
            <p className="mb-3">
              Έχετε τα εξής δικαιώματα σχετικά με τα προσωπικά σας δεδομένα:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Δικαίωμα πρόσβασης (Άρθρο 15):</strong> Λήψη αντιγράφου όλων των
                δεδομένων σας — διαθέσιμο από τις <em>Ρυθμίσεις → GDPR → Εξαγωγή Δεδομένων</em>
              </li>
              <li>
                <strong>Δικαίωμα διόρθωσης (Άρθρο 16):</strong> Επεξεργαστείτε τα στοιχεία σας
                από τις <em>Ρυθμίσεις → Προφίλ</em>
              </li>
              <li>
                <strong>Δικαίωμα διαγραφής (Άρθρο 17):</strong> Διαγραφή λογαριασμού και όλων των
                δεδομένων — από τις{' '}
                <em>Ρυθμίσεις → GDPR → Διαγραφή Λογαριασμού</em>
              </li>
              <li>
                <strong>Δικαίωμα φορητότητας (Άρθρο 20):</strong> Λήψη δεδομένων σε μορφή JSON
              </li>
              <li>
                <strong>Δικαίωμα εναντίωσης (Άρθρο 21):</strong> Ανάκληση συναίνεσης για
                marketing ανά πάσα στιγμή
              </li>
            </ul>
            <p className="mt-3">
              Για την άσκηση δικαιωμάτων σας επικοινωνήστε στο{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
              . Απαντάμε εντός <strong>30 ημερών</strong>.
            </p>
          </Section>

          {/* 8. Security */}
          <Section title="8. Ασφάλεια Δεδομένων (Άρθρο 32 GDPR)">
            <ul className="list-disc pl-5 space-y-2">
              <li>Κρυπτογράφηση δεδομένων κατά τη μεταφορά (TLS 1.3) και σε ηρεμία (AES-256)</li>
              <li>Κρυπτογραφημένη αποθήκευση API keys</li>
              <li>Ελεγχόμενη πρόσβαση βάσει ρόλων (RBAC)</li>
              <li>Αυτόματη διαγραφή δεδομένων βάσει πολιτικής διατήρησης</li>
              <li>Καταγραφή όλων των ενεργειών σε audit log</li>
            </ul>
          </Section>

          {/* 9. Cookies */}
          <Section title="9. Cookies">
            <p>
              Χρησιμοποιούμε μόνο απαραίτητα cookies για τη λειτουργία της υπηρεσίας
              (αυθεντικοποίηση). Δεν χρησιμοποιούμε cookies παρακολούθησης ή διαφήμισης. Η
              επιλογή αποδοχής/απόρριψης cookies εμφανίζεται κατά την πρώτη σας επίσκεψη.
            </p>
          </Section>

          {/* 10. Complaints */}
          <Section title="10. Αρχή Προστασίας Δεδομένων">
            <p>
              Έχετε το δικαίωμα να υποβάλετε καταγγελία στην Αρχή Προστασίας Δεδομένων
              Προσωπικού Χαρακτήρα (ΑΠΔΠΧ) εάν πιστεύετε ότι η επεξεργασία των δεδομένων σας δεν
              συμμορφώνεται με τον GDPR.
            </p>
            <p className="mt-2">
              <a href={DPA_URL} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                www.dpa.gr
              </a>
            </p>
          </Section>

          {/* 11. Changes */}
          <Section title="11. Αλλαγές στην Πολιτική">
            <p>
              Ενδέχεται να ενημερώσουμε την παρούσα Πολιτική Απορρήτου. Θα σας ειδοποιήσουμε
              μέσω email ή ειδοποίησης στην εφαρμογή για ουσιαστικές αλλαγές τουλάχιστον{' '}
              <strong>30 ημέρες</strong> πριν τεθούν σε ισχύ.
            </p>
          </Section>

          <Divider />

          {/* Footer links */}
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <Link href="/terms" className="hover:text-text-primary transition-colors">
              Όροι Χρήσης
            </Link>
            <span>·</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-text-primary transition-colors">
              {CONTACT_EMAIL}
            </a>
            <span>·</span>
            <Link href="/" className="hover:text-text-primary transition-colors">
              VoiceForge AI
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="text-text-secondary leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Divider() {
  return <hr className="border-border" />;
}
