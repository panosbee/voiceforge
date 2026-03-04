// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Supabase Client (Server Components / Route Handlers)
// ═══════════════════════════════════════════════════════════════════

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ignore — setAll is called from a Server Component
          // where cookies cannot be set. This is expected.
        }
      },
    },
  });
}
