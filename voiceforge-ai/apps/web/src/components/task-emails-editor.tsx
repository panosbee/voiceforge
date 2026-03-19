// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Task Email Recipients Editor
// Configures department emails + roles for post-call AI task routing.
// Used inside the Agent Edit Modal.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api-client';
import { Plus, Trash2, GripVertical, Mail, Save } from 'lucide-react';
import { toast } from 'sonner';

interface TaskEmail {
  id?: string;
  email: string;
  roleLabel: string;
  roleDescription: string;
  sortOrder: number;
}

interface TaskEmailsEditorProps {
  agentId: string;
}

export function TaskEmailsEditor({ agentId }: TaskEmailsEditorProps) {
  const [emails, setEmails] = useState<TaskEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing task emails
  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.get<{ data: TaskEmail[] }>(`/api/tasks/emails/${agentId}`);
        setEmails(result.data || []);
      } catch {
        toast.error('Σφάλμα φόρτωσης task emails');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [agentId]);

  const addEmail = () => {
    setEmails((prev) => [
      ...prev,
      { email: '', roleLabel: '', roleDescription: '', sortOrder: prev.length },
    ]);
  };

  const removeEmail = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, field: keyof TaskEmail, value: string) => {
    setEmails((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSave = async () => {
    // Validate
    const invalid = emails.some((e) => !e.email.trim() || !e.roleLabel.trim());
    if (invalid) {
      toast.error('Συμπληρώστε email και ρόλο για κάθε εγγραφή');
      return;
    }

    setIsSaving(true);
    try {
      const payload = emails.map((e, i) => ({
        email: e.email.trim(),
        roleLabel: e.roleLabel.trim(),
        roleDescription: e.roleDescription.trim() || undefined,
        sortOrder: i,
      }));

      const result = await api.put<{ data: TaskEmail[] }>(`/api/tasks/emails/${agentId}/bulk`, payload);
      setEmails(result.data || []);
      toast.success('Οι παραλήπτες task αποθηκεύτηκαν');
    } catch {
      toast.error('Σφάλμα αποθήκευσης');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary">
          📋 Task Routing — Παραλήπτες Email
        </h3>
        <p className="text-sm text-text-secondary mt-1">
          Προσθέστε emails τμημάτων. Μετά από κάθε κλήση, η AI αναλύει τη συνομιλία
          και στέλνει tasks στο κατάλληλο τμήμα αυτόματα.
        </p>
      </div>

      {/* Email list */}
      <div className="space-y-3">
        {emails.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-4 bg-surface-secondary rounded-lg border border-border"
          >
            <div className="flex items-center pt-2 text-text-tertiary">
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Email *
                </label>
                <Input
                  type="email"
                  placeholder="rentals@company.gr"
                  value={item.email}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Ρόλος / Τμήμα *
                </label>
                <Input
                  type="text"
                  placeholder="Κρατήσεις αυτοκινήτων"
                  value={item.roleLabel}
                  onChange={(e) => updateEmail(index, 'roleLabel', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Περιγραφή (προαιρ.)
                </label>
                <Input
                  type="text"
                  placeholder="Χειρίζεται κρατήσεις & διαθεσιμότητα"
                  value={item.roleDescription}
                  onChange={(e) => updateEmail(index, 'roleDescription', e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeEmail(index)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {emails.length === 0 && (
          <div className="text-center py-8 text-text-tertiary">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Δεν υπάρχουν παραλήπτες task</p>
            <p className="text-xs mt-1">Προσθέστε emails τμημάτων για αυτόματη δρομολόγηση tasks</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEmail}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Προσθήκη Email
        </Button>

        {emails.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-1.5"
          >
            {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            Αποθήκευση
          </Button>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 font-medium">💡 Πώς λειτουργεί</p>
        <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
          <li>Ο πελάτης καλεί τον AI agent</li>
          <li>Μετά την κλήση, η AI αναλύει το transcript</li>
          <li>Αν υπάρχει task, στέλνει email στο αντίστοιχο τμήμα</li>
          <li>Ο παραλήπτης πατάει "Ολοκληρώθηκε" στο email</li>
          <li>Αν δεν γίνει, στέλνεται υπενθύμιση (4h, 12h, 24h, 48h)</li>
          <li>Βλέπετε το status όλων των tasks στο Dashboard → Tasks</li>
        </ol>
      </div>
    </div>
  );
}
