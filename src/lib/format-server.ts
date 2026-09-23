import { getLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/routing";

/**
 * Der aktive Locale in Server-Komponenten, Route-Handlern und Server-Actions.
 *
 * Gegenstück zu `useFormat()` auf der Client-Seite: dort bindet ein Hook die
 * Formatierer, hier reicht der aufgelöste Locale — Server-Code ruft die
 * Funktionen aus `formatting.ts` ohnehin direkt und braucht kein Objekt.
 *
 * **Setzt `setRequestLocale` im Layout voraus.** Ohne das kennt der
 * Request-Kontext die Sprache nicht und `getLocale()` liefert die Vorgabe —
 * still, ohne Fehler. Das Wurzel-Layout setzt sie.
 */
export async function requestLocale(): Promise<Locale> {
  const raw = await getLocale();
  return isLocale(raw) ? raw : "de";
}
