// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Auth Provider
// Initializes auth listener and syncs to Zustand store.
// Supports both Supabase (production) and Dev Auth (development).
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { isDevAuthEnabled, getDevToken, clearDevToken, devGetMe } from '@/lib/dev-auth';
import type { CustomerProfile, ApiResponse } from '@voiceforge/shared';

const IS_DEV = isDevAuthEnabled();
const supabase = IS_DEV ? null : createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { setUser, setSession, setProfile, setLoading, setInitialized } = useAuthStore();

  /** Fetch the customer profile from the backend */
  const fetchProfile = useCallback(async () => {
    try {
      const result = await api.get<ApiResponse<CustomerProfile>>('/api/customers/me');
      if (result.success && result.data) {
        setProfile(result.data);
      }
    } catch {
      // Profile doesn't exist yet (new user, hasn't onboarded)
      setProfile(null);
    }
  }, [setProfile]);

  useEffect(() => {
    // ── Dev Auth Mode ──────────────────────────────────────────
    if (IS_DEV) {
      // Token provider: return dev JWT from cookie
      api.setTokenProvider(async () => getDevToken());

      const initDevAuth = async () => {
        const token = getDevToken();

        if (token) {
          try {
            const result = await devGetMe(token);
            if (result.success && result.data) {
              // Create a minimal user-like object for the store
              setUser({ id: result.data.user.id, email: result.data.user.email } as never);
              setSession({ access_token: token } as never);
              await fetchProfile();
            } else {
              // Token invalid/expired — clear it
              clearDevToken();
              setUser(null);
              setSession(null);
            }
          } catch {
            clearDevToken();
            setUser(null);
            setSession(null);
          }
        } else {
          setUser(null);
          setSession(null);
        }

        setLoading(false);
        setInitialized(true);
      };

      initDevAuth();
      // No subscription needed in dev mode
      return;
    }

    // ── Supabase Auth Mode (Production) ────────────────────────
    api.setTokenProvider(async () => {
      const { data } = await supabase!.auth.getSession();
      return data.session?.access_token ?? null;
    });

    // Get initial session
    const initAuth = async () => {
      const { data: { session } } = await supabase!.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile();
      }

      setLoading(false);
      setInitialized(true);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        await fetchProfile();
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setProfile, setLoading, setInitialized, fetchProfile, router]);

  return <>{children}</>;
}
