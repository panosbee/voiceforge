// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dev Auth Utilities (Client)
// Manages dev JWT token in cookies and provides auth helpers
// Only used when NEXT_PUBLIC_DEV_AUTH=true
// ═══════════════════════════════════════════════════════════════════

import { API_URL } from './env';

/** Cookie name for the dev auth JWT */
export const DEV_TOKEN_COOKIE = 'voiceforge-dev-token';

/** Check if dev auth mode is enabled */
export function isDevAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_AUTH === 'true';
}

/** Get dev token from document cookies (browser only) */
export function getDevToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEV_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Set dev token in a cookie (browser only, 7 day expiry) */
export function setDevToken(token: string): void {
  if (typeof document === 'undefined') return;
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  document.cookie = `${DEV_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Clear the dev token cookie */
export function clearDevToken(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${DEV_TOKEN_COOKIE}=; path=/; max-age=0`;
}

/** Dev auth API response */
interface DevAuthResponse {
  success: boolean;
  data?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: {
      id: string;
      email: string;
      role: string;
    };
    hasProfile?: boolean;
    onboardingCompleted?: boolean;
  };
  error?: { code?: string; message: string };
}

/**
 * Login via the dev auth endpoint.
 * Returns the JWT token and user info.
 */
export async function devLogin(email: string, password: string): Promise<DevAuthResponse> {
  const res = await fetch(`${API_URL}/auth/dev/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json() as Promise<DevAuthResponse>;
}

/**
 * Register via the dev auth endpoint.
 * Creates a customer record in the database and returns JWT.
 */
export async function devRegister(data: {
  email: string;
  password: string;
  ownerName: string;
  businessName: string;
  userRole?: 'naive' | 'expert';
}): Promise<DevAuthResponse> {
  const res = await fetch(`${API_URL}/auth/dev/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<DevAuthResponse>;
}

/**
 * Get current dev user info from the backend.
 */
export async function devGetMe(token: string): Promise<DevAuthResponse> {
  const res = await fetch(`${API_URL}/auth/dev/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<DevAuthResponse>;
}
