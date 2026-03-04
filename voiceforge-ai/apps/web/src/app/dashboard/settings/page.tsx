// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Settings Page
// Profile editing, plan info, account actions
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, type FormEvent } from 'react';
import { Card, PageHeader, Button, Input, Select, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { getIndustryLabels, getPlanLabels } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Save, User, Building2, CreditCard, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerProfile, ApiResponse } from '@voiceforge/shared';

export default function SettingsPage() {
  const { t } = useI18n();
  const industryLabels = getIndustryLabels(t);
  const planLabels = getPlanLabels(t);
  const industryOpts = Object.entries(industryLabels).map(([value, label]) => ({ value, label }));

  const { profile, setProfile } = useAuthStore();

  const [businessName, setBusinessName] = useState(profile?.businessName ?? '');
  const [ownerName, setOwnerName] = useState(profile?.ownerName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Europe/Athens');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await api.patch<ApiResponse<CustomerProfile>>('/api/customers/me', {
        businessName,
        ownerName,
        phone,
        timezone,
      });

      if (result.success && result.data) {
        setProfile(result.data);
        toast.success(t.settings.saveSuccess);
      }
    } catch {
      toast.error(t.settings.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const planInfo = planLabels[profile?.plan ?? 'starter']!;

  return (
    <div>
      <PageHeader title={t.settings.title} description={t.settings.description} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-text-primary">{t.settings.profile}</h3>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Επωνυμία Επιχείρησης"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                label="Ονοματεπώνυμο"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  value={profile?.email ?? ''}
                  disabled
                  hint="Το email δεν μπορεί να αλλάξει"
                />
                <Input
                  label="Τηλέφωνο"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Select
                label="Ζώνη Ώρας"
                options={[
                  { value: 'Europe/Athens', label: 'Ελλάδα (Europe/Athens)' },
                  { value: 'Europe/Nicosia', label: 'Κύπρος (Europe/Nicosia)' },
                ]}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
              <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
                  {t.common.save}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Plan Info */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-text-primary">{t.settings.plan}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.currentPlan}</span>
                <Badge variant="brand">{planInfo.name}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.price}</span>
                <span className="text-sm font-medium text-text-primary">{planInfo.price}{t.common.perMonth}</span>
              </div>
              <p className="text-xs text-text-tertiary pt-2">{planInfo.description}</p>
            </div>
          </Card>

          {/* Account Status */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-text-primary">{t.settings.account}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.statusLabel}</span>
                <Badge variant={profile?.isActive ? 'success' : 'danger'}>
                  {profile?.isActive ? t.settings.active : t.settings.inactive}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.elevenLabsAI}</span>
                <Badge variant={profile?.hasElevenLabsAgents ? 'success' : 'default'}>
                  {profile?.hasElevenLabsAgents ? t.settings.activeStatus : t.settings.noAgents}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.aiAssistants}</span>
                <span className="text-sm font-medium text-text-primary">{profile?.agentCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.telephony}</span>
                <Badge variant={profile?.hasTelnyxAccount ? 'success' : 'default'}>
                  {profile?.hasTelnyxAccount ? t.settings.connected : t.settings.notConfigured}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t.settings.industryLabel}</span>
                <span className="text-sm text-text-primary">
                  {industryLabels[profile?.industry ?? ''] ?? profile?.industry}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
