import { getTranslations } from "next-intl/server";
import { routing, isLocale, type Locale } from "@/i18n/routing";
import type { Translate } from "@/i18n/translate";

/**
 * **Die Sprache einer API-Antwort steht im `Accept-Language`-Kopf.**
 *
 * Die Oberfläche trägt ihre Sprache im Pfad (`/de/…`, `/en/…`), und
 * `next-intl` liest sie dort. Eine Route unter `/api/v1/` hat kein
 * `[locale]`-Segment — `getTranslations()` ohne Angabe fiele dort still auf
 * die Vorgabe zurück, und ein englischsprachiger Aufrufer bekäme deutsche
 * Fehlertexte, ohne dass es je auffiele.
 *
 * Gelesen wird nur das, was wir führen: der Kopf darf `de-CH, de;q=0.9, *;q=0.5`
 * sagen, die Antwort ist trotzdem eine der zwei Sprachen. Steht nichts
 * Erkennbares darin, gilt die Vorgabe aus `routing`.
 *
 * **Warum überhaupt übersetzt wird.** Seit Zug 5 tragen `reason` und `detail`
 * eines `DomainError` Katalog-Schlüssel. Ohne diese Naht stünde in der
 * `detail`-Zeile einer 409-Antwort `work.errors.epicNotInFunnel` statt eines
 * Satzes — RFC 7807 verlangt dort ausdrücklich etwas Lesbares.
 */
export function localeFromHeader(header: string | null): Locale {
  for (const eintrag of (header ?? "").split(",")) {
    const tag = eintrag.split(";")[0]?.trim().toLowerCase() ?? "";
    const basis = tag.split("-")[0];
    if (isLocale(basis)) return basis;
  }
  return routing.defaultLocale;
}

/** Der Übersetzer für eine API-Antwort, in der Sprache des Aufrufers. */
export async function apiTranslate(request: Request): Promise<Translate> {
  const locale = localeFromHeader(request.headers.get("accept-language"));
  return getTranslations({ locale });
}
