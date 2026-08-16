import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/** Pathname patterns that require an authenticated session. */
const PROTECTED_PATTERNS = [
  /^\/[a-z]{2}\/(start|portfolio|structure|transformation|art|team|value-streams|admin|pi|platform)/,
];

/** Pathname patterns accessible only to unauthenticated users. */
const AUTH_ONLY_PATTERNS = [/^\/[a-z]{2}\/(sign-in|sign-up)/];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

function isAuthOnly(pathname: string): boolean {
  return AUTH_ONLY_PATTERNS.some((p) => p.test(pathname));
}

/**
 * Legacy-Redirect: das Budgeting-Modul besaß früher das `/controlling`-Segment.
 * Alte Deep-Links bleiben erreichbar — `/controlling` → `/budgeting`,
 * `/controlling/budgeting` → `/budgeting/board`, `/controlling/budget-plan(/…)`
 * → `/budgeting/budget-plan(/…)`. Locale-Präfix und Rest-Pfad bleiben erhalten.
 * Als Redirect (nicht als Route-Dir) gelöst, damit der Registry-
 * Vollständigkeitstest kein verwaistes `controlling`-Segment sieht.
 */
function legacyControllingRedirect(pathname: string): string | null {
  const m = pathname.match(/^(\/[a-z]{2})?\/controlling(\/.*)?$/);
  if (!m) return null;
  const localePrefix = m[1] ?? "";
  const rest = m[2] ?? "";
  if (rest === "/budgeting" || rest.startsWith("/budgeting/")) {
    return `${localePrefix}/budgeting/board${rest.slice("/budgeting".length)}`;
  }
  // /controlling und /controlling/budget-plan(/…) → /budgeting(+ Rest)
  return `${localePrefix}/budgeting${rest}`;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, authCheckFailed } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Detect the locale prefix (e.g. /en, /de)
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Legacy `/controlling/*`-Deep-Links auf die neuen `/budgeting/*`-Routen
  // umleiten (Query + Locale bleiben erhalten).
  const legacyTarget = legacyControllingRedirect(pathname);
  if (legacyTarget) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    return NextResponse.redirect(url);
  }

  // Bei transientem Auth-Netzwerkfehler (Edge-Runtime-`ENOTFOUND`) NICHT
  // umleiten — sonst würde ein eingeloggter Nutzer bei jedem Supabase-Blip auf
  // /sign-in geworfen. Die serverseitige `requirePrincipal` (Node-Runtime,
  // zuverlässige DNS-Auflösung) bleibt der eigentliche Auth-Wächter.
  if (!authCheckFailed) {
    if (!user && isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/sign-in`;
      return NextResponse.redirect(url);
    }

    if (user && isAuthOnly(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/start`;
      return NextResponse.redirect(url);
    }
  }

  // Pfad als Request-Header durchreichen — das Dashboard-Layout braucht ihn
  // für den Modul-Route-Guard (Layouts kennen ihre Pathname sonst nicht).
  // next-intl übernimmt die Request-Header in seine Response.
  request.headers.set("x-pathname", pathname);

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
