// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Terms of Service Page
// GDPR Art. 12-13 compliant: available before consent capture
// ═══════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Όροι Χρήσης — VoiceForge AI',
  description:
    'Όροι Χρήσης VoiceForge AI. Διαβάστε τους όρους που διέπουν τη χρήση της πλατφόρμας AI φωνητικού βοηθού.',
};

const LAST_UPDATED = '1 Ιανουαρίου 2025';
const DATA_CONTROLLER = 'VoiceForge AI';
const CONTACT_EMAIL = 'legal@voiceforge.ai';

export default function TermsOfServicePage() {
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
            <h1 className="text-3xl font-bold text-text-primary">Όροι Χρήσης</h1>
            <p className="text-text-secondary text-sm">Τελευταία ενημέρωση: {LAST_UPDATED}</p>
          </div>

          {/* Intro */}
          <section className="space-y-4">
            <p className="text-text-secondary leading-relaxed">
              Οι παρόντες Όροι Χρήσης («Όροι») διέπουν τη χρήση της πλατφόρμας{' '}
              <strong className="text-text-primary">{DATA_CONTROLLER}</strong> («Υπηρεσία»),
              συμπεριλαμβανομένου του AI φωνητικού βοηθού, του dashboard διαχείρισης και όλων των
              σχετικών υπηρεσιών. Χρησιμοποιώντας την Υπηρεσία, αποδέχεστε τους παρόντες Όρους.
            </p>
          </section>

          <Divider />

          {/* 1. Service Description */}
          <Section title="1. Περιγραφή Υπηρεσίας">
            <p>
              Η VoiceForge AI παρέχει πλατφόρμα AI φωνητικού βοηθού για επιχειρήσεις, που
              περιλαμβάνει:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Αυτοματοποιημένη απάντηση τηλεφωνικών κλήσεων με AI στα ελληνικά</li>
              <li>Διαχείριση ραντεβού και ημερολόγιου</li>
              <li>Ανάλυση κλήσεων, transcripts και επιχειρηματικά insights</li>
              <li>Διαχείριση γνωσιακής βάσης και προσαρμογή AI βοηθού</li>
              <li>Ενσωμάτωση με Telnyx (VoIP) και ElevenLabs (AI φωνή)</li>
            </ul>
          </Section>

          {/* 2. Eligibility */}
          <Section title="2. Προϋποθέσεις Χρήσης">
            <p>Για να χρησιμοποιήσετε την Υπηρεσία πρέπει:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Να είστε τουλάχιστον 18 ετών</li>
              <li>Να έχετε νόμιμη εξουσιοδότηση να εκπροσωπείτε την επιχείρησή σας</li>
              <li>Να παρέχετε ακριβή και ενημερωμένα στοιχεία εγγραφής</li>
              <li>
                Να συμμορφώνεστε με τους παρόντες Όρους και όλους τους εφαρμοστέους νόμους,
                συμπεριλαμβανομένου του GDPR
              </li>
            </ul>
          </Section>

          {/* 3. Acceptable Use */}
          <Section title="3. Αποδεκτή Χρήση">
            <p>
              Η Υπηρεσία προορίζεται αποκλειστικά για νόμιμη επαγγελματική χρήση.
              Απαγορεύεται ρητά:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Χρήση για παράνομους σκοπούς ή κατά παράβαση δικαιωμάτων τρίτων</li>
              <li>
                Ηχογράφηση κλήσεων χωρίς ενημέρωση των συμμετεχόντων, κατά παράβαση της
                εφαρμοστέας νομοθεσίας
              </li>
              <li>Προσπάθεια απόκτησης μη εξουσιοδοτημένης πρόσβασης στα συστήματά μας</li>
              <li>Μεταπώληση ή μεταβίβαση της Υπηρεσίας σε τρίτους χωρίς άδεια</li>
              <li>Υπερφόρτωση της υποδομής μέσω αυτοματοποιημένων συστημάτων (spam)</li>
            </ul>
          </Section>

          {/* 4. Call Recording Obligation */}
          <Section title="4. Ηχογράφηση Κλήσεων — Υποχρεώσεις">
            <p>
              Εάν ενεργοποιήσετε ηχογράφηση κλήσεων, <strong>εσείς</strong> — ως υπεύθυνος
              επεξεργασίας — φέρετε την ευθύνη να:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                Ενημερώνετε τους καλούντες για την ηχογράφηση (π.χ. μέσω μηνύματος
                αναγγελίας στην αρχή της κλήσης)
              </li>
              <li>Λαμβάνετε την απαραίτητη συναίνεση σύμφωνα με GDPR/ΕΕΠΔ</li>
              <li>Διαχειρίζεστε αιτήματα διαγραφής από τα υποκείμενα δεδομένων</li>
            </ul>
            <p className="mt-2">
              Η VoiceForge AI λειτουργεί ως <strong>εκτελών την επεξεργασία (processor)</strong>{' '}
              για την ηχογράφηση κλήσεων.
            </p>
          </Section>

          {/* 5. Subscription & Billing */}
          <Section title="5. Συνδρομή και Χρέωση">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Η Υπηρεσία διατίθεται με μηνιαία ή ετήσια συνδρομή, ανάλογα με το πλάνο σας
              </li>
              <li>
                Οι χρεώσεις πραγματοποιούνται αυτόματα μέσω Stripe στην αρχή κάθε κύκλου
                χρέωσης
              </li>
              <li>
                Μπορείτε να ακυρώσετε οποιαδήποτε στιγμή — η υπηρεσία παραμένει ενεργή έως το
                τέλος της πληρωμένης περιόδου
              </li>
              <li>
                Δεν παρέχονται επιστροφές χρημάτων για μερικώς χρησιμοποιημένες περιόδους,
                εκτός εάν προβλέπεται διαφορετικά από την εφαρμοστέα νομοθεσία
              </li>
              <li>
                Διατηρούμε το δικαίωμα να τροποποιήσουμε τις τιμές με ειδοποίηση{' '}
                <strong>30 ημερών</strong>
              </li>
            </ul>
          </Section>

          {/* 6. Intellectual Property */}
          <Section title="6. Πνευματική Ιδιοκτησία">
            <p>
              Η VoiceForge AI και οι τεχνολογίες της αποτελούν ιδιοκτησία της{' '}
              {DATA_CONTROLLER}. Σας χορηγείται μη αποκλειστική, μη μεταβιβάσιμη άδεια χρήσης
              της Υπηρεσίας για τους σκοπούς της επιχείρησής σας.
            </p>
            <p className="mt-2">
              Τα δεδομένα κλήσεων, transcripts και περιεχόμενο που παράγετε παραμένουν δικά σας.
              Μας χορηγείτε άδεια επεξεργασίας αυτών αποκλειστικά για την παροχή της Υπηρεσίας.
            </p>
          </Section>

          {/* 7. Data Processing */}
          <Section title="7. Επεξεργασία Δεδομένων">
            <p>
              Ως υπεύθυνος επεξεργασίας (controller) για τα δεδομένα των πελατών σας, και εμείς
              ως εκτελών την επεξεργασία (processor), η σχέση μας διέπεται από τη{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline">
                Πολιτική Απορρήτου
              </Link>{' '}
              και, όπου απαιτείται, από Σύμβαση Επεξεργασίας Δεδομένων (DPA). Επικοινωνήστε
              μαζί μας για DPA στο{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* 8. Service Availability */}
          <Section title="8. Διαθεσιμότητα Υπηρεσίας">
            <p>
              Στόχος μας είναι uptime <strong>99.9%</strong>. Δεν ευθυνόμαστε για διακοπές
              λόγω προγραμματισμένης συντήρησης (με προειδοποίηση 24ωρών), βλαβών τρίτων
              παρόχων (Telnyx, ElevenLabs) ή περιστατικών ανωτέρας βίας.
            </p>
          </Section>

          {/* 9. Limitation of Liability */}
          <Section title="9. Περιορισμός Ευθύνης">
            <p>
              Στο μέγιστο βαθμό που επιτρέπει η εφαρμοστέα νομοθεσία, η συνολική ευθύνη της
              VoiceForge AI δεν υπερβαίνει τις χρεώσεις που καταβλήθηκαν κατά τους τελευταίους{' '}
              <strong>3 μήνες</strong>. Δεν ευθυνόμαστε για έμμεσες ζημίες, διαφυγόντα κέρδη ή
              απώλεια δεδομένων λόγω ανωτέρας βίας.
            </p>
          </Section>

          {/* 10. Termination */}
          <Section title="10. Καταγγελία">
            <p>
              Μπορείτε να καταγγείλετε τη συνδρομή σας ανά πάσα στιγμή από τις Ρυθμίσεις.
              Διατηρούμε το δικαίωμα να αναστείλουμε ή τερματίσουμε λογαριασμούς που παραβιάζουν
              τους παρόντες Όρους, με προηγούμενη ειδοποίηση εκτός εάν η παράβαση είναι σοβαρή.
            </p>
          </Section>

          {/* 11. Governing Law */}
          <Section title="11. Εφαρμοστέο Δίκαιο">
            <p>
              Οι παρόντες Όροι διέπονται από το ελληνικό δίκαιο και το δίκαιο της Ευρωπαϊκής
              Ένωσης. Κάθε διαφορά υπάγεται στη δικαιοδοσία των αρμόδιων δικαστηρίων.
            </p>
          </Section>

          {/* 12. Changes */}
          <Section title="12. Τροποποιήσεις Όρων">
            <p>
              Ενδέχεται να τροποποιήσουμε τους παρόντες Όρους. Θα σας ειδοποιήσουμε μέσω email
              ή ειδοποίησης στην εφαρμογή τουλάχιστον <strong>30 ημέρες</strong> πριν από
              ουσιαστικές αλλαγές. Η συνέχιση χρήσης της Υπηρεσίας μετά την ισχύ των αλλαγών
              συνιστά αποδοχή τους.
            </p>
          </Section>

          {/* 13. Contact */}
          <Section title="13. Επικοινωνία">
            <p>
              Για ερωτήσεις σχετικά με τους παρόντες Όρους:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          <Divider />

          {/* Footer links */}
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">
              Πολιτική Απορρήτου
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
