// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Login Page
// Email/password + magic link login with i18n
// Supports Dev Auth mode (no Supabase needed) and Supabase Auth
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { isDevAuthEnabled, devLogin, setDevToken } from '@/lib/dev-auth';
import { Button, Input } from '@/components/ui';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

const IS_DEV = isDevAuthEnabled();

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = IS_DEV ? null : createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      // ── Dev Auth Mode ──────────────────────────────────────────
      if (IS_DEV) {
        const result = await devLogin(email, password);
        if (!result.success || !result.data) {
          toast.error(result.error?.message ?? t.common.error);
          return;
        }
        setDevToken(result.data.access_token);
        toast.success(`${t.auth.loginSuccess} (Dev Mode)`);
        router.push('/dashboard');
        return;
      }

      // ── Supabase Auth Mode ─────────────────────────────────────
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message === 'Invalid login credentials'
          ? t.common.error
          : error.message);
        return;
      }
      toast.success(t.auth.loginSuccess);
      router.push('/dashboard');
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t.auth.magicLinkSent);
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{t.auth.loginTitle}</h2>
        <LanguageToggle />
      </div>

      {IS_DEV && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {t.auth.devMode}
        </div>
      )}

      {mode === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <Input
            label={t.auth.email}
            type="email"
            placeholder="info@example.gr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label={t.auth.password}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            {t.common.login}
          </Button>

          {!IS_DEV && (
            <button
              type="button"
              onClick={() => setMode('magic-link')}
              className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {t.auth.magicLink}
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <Input
            label={t.auth.email}
            type="email"
            placeholder="info@example.gr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            {t.auth.magicLink}
          </Button>

          <button
            type="button"
            onClick={() => setMode('password')}
            className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            {t.common.login}
          </button>
        </form>
      )}

      <div className="mt-6 pt-6 border-t border-border text-center">
        <p className="text-sm text-text-secondary">
          {t.auth.noAccount}{' '}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
            {t.common.register}
          </Link>
        </p>
      </div>
    </div>
  );
}
