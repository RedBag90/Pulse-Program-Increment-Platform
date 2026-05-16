import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/** Pathname patterns that require an authenticated session. */
const PROTECTED_PATTERNS = [/^\/[a-z]{2}\/(portfolio|art|team|admin|pi)/];

/** Pathname patterns accessible only to unauthenticated users. */
const AUTH_ONLY_PATTERNS = [/^\/[a-z]{2}\/(sign-in|sign-up)/];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

function isAuthOnly(pathname: string): boolean {
  return AUTH_ONLY_PATTERNS.some((p) => p.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Detect the locale prefix (e.g. /en, /de)
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnly(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/portfolio`;
    return NextResponse.redirect(url);
  }

  // Run next-intl middleware and merge Set-Cookie headers from Supabase.
  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).+)", "/"],
};
