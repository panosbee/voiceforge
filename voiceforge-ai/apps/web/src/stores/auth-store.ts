// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Auth Store (Zustand)
// Global auth state management
// ═══════════════════════════════════════════════════════════════════

'use client';

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { CustomerProfile } from '@voiceforge/shared';

interface AuthState {
  /** Supabase user object */
  user: User | null;
  /** Supabase session object */
  session: Session | null;
  /** VoiceForge customer profile */
  profile: CustomerProfile | null;
  /** Loading state */
  isLoading: boolean;
  /** Whether auth has been initialized */
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: CustomerProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () => set({ user: null, session: null, profile: null, isLoading: false }),
}));
