import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding'];
const AUTH_PREFIXES = ['/login', '/register', '/activate'];
const DEV_TOKEN_COOKIE = 'voiceforge-dev-token';
const SUPABASE_COOKIE_PREFIX = 'sb-';

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDevAuth = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

  let hasAuth = false;

  if (isDevAuth) {
    hasAuth = !!request.cookies.get(DEV_TOKEN_COOKIE)?.value;
  } else {
    const allCookies = request.cookies.getAll();
    hasAuth = allCookies.some(
      (c) => c.name.startsWith(SUPABASE_COOKIE_PREFIX) && c.value.length > 0,
    );
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  // Admin panel has its own auth — skip middleware checks
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (!hasAuth && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasAuth && isAuthPage) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/|health).*)'],
};
