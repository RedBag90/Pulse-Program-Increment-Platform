import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Refreshes the Supabase session cookie and returns the response + user.
 * Called from middleware before next-intl locale handling.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` gibt bei „keine Session" ein `{ data, error }` zurück, WIRFT aber
  // bei Netzwerk-/DNS-Fehlern (im Edge-Runtime-Sandbox tritt sporadisch
  // `ENOTFOUND` beim Supabase-Host auf). Diese beiden Fälle müssen unterschieden
  // werden: „keine Session" ⇒ Redirect auf /sign-in ist korrekt; „Netzwerkfehler"
  // ⇒ NICHT ausloggen (der Node-Runtime-`getPrincipal` auf der Seite prüft Auth
  // ohnehin zuverlässig). `authCheckFailed` signalisiert den transienten Fehler.
  let user = null;
  let authCheckFailed = false;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    authCheckFailed = true;
  }

  return { supabaseResponse, user, authCheckFailed };
}
