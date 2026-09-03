"use client";

import { useEffect } from "react";
import {
  TAB_COOKIE_MAX_AGE,
  tabCookieName,
} from "@/modules/core/org/features/structure/components/tab-memory";

/**
 * Merkt sich den zuletzt geöffneten Reiter — je Knotenart, in einem Cookie.
 *
 * Warum ein Cookie und keine Tabelle: der **Server** muss den Reiter beim
 * ersten Render kennen, sonst steht erst „Allgemein" da und springt danach
 * sichtbar um. Ein Cookie liest er ohne Umweg, und es braucht keine Migration.
 * Preis, den man kennen sollte: die Erinnerung gilt je Browser, nicht je Konto.
 *
 * Je Knotenart eine Ablage, weil Wertstrom und ART verschiedene Reiter haben —
 * „Betrieb" gibt es nur beim Wertstrom.
 *
 * Ein Link **mit** `?tab=` schlägt die Erinnerung immer; sie greift nur, wenn
 * gar kein Reiter in der Adresse steht.
 */
export function RememberTab({ kind, tab }: { kind: string; tab: string }) {
  useEffect(() => {
    // `Lax` — die Erinnerung ist eine Bequemlichkeit, kein Geheimnis.
    document.cookie = `${tabCookieName(kind)}=${encodeURIComponent(tab)};path=/;max-age=${TAB_COOKIE_MAX_AGE};samesite=lax`;
  }, [kind, tab]);
  return null;
}
