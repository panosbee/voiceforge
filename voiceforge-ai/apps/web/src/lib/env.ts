// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Environment Configuration (Client)
// Only NEXT_PUBLIC_ variables are exposed to the browser
// ═══════════════════════════════════════════════════════════════════

/** Supabase public URL  */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Supabase public anon key */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** API base URL (backend) */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** App name */
export const APP_NAME = 'VoiceForge AI';

/** App description */
export const APP_DESCRIPTION = 'Η AI ρεσεψιονίστ σας — 24/7 στα ελληνικά';
