// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Auth Callback Route
// Handles Supabase magic link / OAuth redirect
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Redirect to login on error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
