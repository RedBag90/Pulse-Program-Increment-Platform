import type { Locale } from "@/i18n/routing";

/**
 * Zahlen, Geld und Daten — an **einer** Stelle, und seit September 2026 an die
 * Sprache gebunden.
 *
 * Vorher stand `"de-DE"` hier achtmal fest verdrahtet, dazu deutsche Einheiten
 * (`Mio`, `T€`, `pp`) und das deutsche Leerzeichen vor dem Prozentzeichen. Wer
 * auf `/en/` umschaltete, bekam englische Navigation und weiterhin
 * `05.06.2026` und `12.345 €` — die Umschaltung endete an der Zahl.
 *
 * **Der Locale ist vorerst optional und fällt auf Deutsch zurück.** Das ist
 * eine Übergangsentscheidung, keine Gestaltung: 125 Aufrufe von `formatEUR`
 * allein würden sonst am selben Tag brechen. Die Flächen reichen ihn nach und
 * nach durch (siehe `useFormat` / `getFormat`); zum Abschluss der Umstellung
 * fällt die Vorgabe weg, und der Compiler zeigt, wer sie noch braucht.
 *
 * Rein, ohne JSX, ohne React — `src/lib/`, damit Server, Client, Domäne und
 * Tests gleichermassen lesen dürfen.
 */

/** Die Vorgabe, solange nicht jede Fläche ihren Locale durchreicht. */
const FALLBACK: Locale = "de";

/** BCP-47-Tag je geführter Sprache. */
const TAG: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

const tagOf = (locale: Locale = FALLBACK): string => TAG[locale] ?? TAG[FALLBACK];

/**
 * `Intl`-Formatierer sind teuer im Bau und billig im Gebrauch — einer je
 * Sprache und Sorte, statt einer je Aufruf. Vorher waren es Modul-Konstanten;
 * mit zwei Sprachen braucht es einen kleinen Vorrat.
 */
const cache = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale | undefined, key: string, opts: Intl.NumberFormatOptions) {
  const tag = tagOf(locale);
  const id = `${tag}:${key}`;
  let f = cache.get(id);
  if (!f) {
    f = new Intl.NumberFormat(tag, opts);
    cache.set(id, f);
  }
  return f;
}

/** Ganze Euro mit Währungszeichen: `12.345 €` · `€12,345`. */
export function formatEUR(n: number, locale?: Locale): string {
  return numberFormat(locale, "eur", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * `€<gruppiert>` — das Zeichen vorangestellt, ohne die Stellung, die die
 * Sprache vorsähe. Für Kacheln, die ihr Layout selbst setzen und das
 * nachgestellte ` €` nicht wollen.
 */
export function formatEURPrefix(n: number, locale?: Locale): string {
  return `€${numberFormat(locale, "plain", {}).format(Math.round(n))}`;
}

/** Kompakt mit `M`/`K`: `€1.20M` · `€1.2K` · `€999`. Schwelle bei 1 Mio / 1 Tsd. */
export function formatCompactEUR(n: number, locale?: Locale): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
  return formatEURPrefix(n, locale);
}

/**
 * Kompakter Euro, **dessen Einheit der Grössenordnung folgt** — und die Einheit
 * spricht die Sprache mit: `1,3 Mrd €` gegen `1.3bn €`.
 *
 * Der Vorgänger `formatMioEUR` schrieb **jeden** Betrag in Mio — auch 49.000 €,
 * die damit als `0,0 Mio €` erschienen. Im Horizont-Trichter standen drei
 * Betriebsposten (49/42/35 T€) dadurch ununterscheidbar neben drei Produkten,
 * die gar kein Geld tragen.
 *
 * **Der Sprung an der Mio-Grenze ist gewollt:** 999.500 € liest sich als
 * `1.000 T€`, 1.000.000 € als `1,0 Mio €`. Lieber eine sichtbare Stufe als eine
 * Einheit, die unterhalb ihrer Auflösung weiterzählt.
 */
const SCALE_UNITS: Record<Locale, { bn: string; mn: string; k: string }> = {
  de: { bn: "Mrd €", mn: "Mio €", k: "T€" },
  en: { bn: "bn €", mn: "M €", k: "k €" },
};

export function formatScaledEUR(n: number, locale: Locale = FALLBACK): string {
  const abs = Math.abs(n);
  const unit = SCALE_UNITS[locale] ?? SCALE_UNITS[FALLBACK];
  const one = (x: number) =>
    numberFormat(locale, "one-decimal", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(x);

  if (abs >= 1_000_000_000) return `${one(n / 1_000_000_000)} ${unit.bn}`;
  if (abs >= 1_000_000) return `${one(n / 1_000_000)} ${unit.mn}`;
  if (abs >= 1_000)
    return `${numberFormat(locale, "plain", {}).format(Math.round(n / 1_000))} ${unit.k}`;
  return formatEUR(n, locale);
}

/**
 * Prozent aus einem 0..1-Verhältnis, ganzzahlig: `88 %` im Deutschen, `88%` im
 * Englischen — das Leerzeichen ist eine Sprachkonvention, keine Kosmetik.
 *
 * Konvention im Ziele-/Portfolio-Code: Verhältnisse bleiben 0..1 und werden
 * erst am Rand formatiert.
 */
export function formatPercent(ratio: number, locale: Locale = FALLBACK): string {
  const value = Math.round(ratio * 100);
  return locale === "de" ? `${value} %` : `${value}%`;
}

/**
 * Prozentpunkt-Delta mit Vorzeichen: `+8,5 pp` · `+8.5pp`. Eingabe ist ein
 * 0..1-Delta (gleiche Konvention wie `formatPercent`), Ausgabe die Differenz
 * zweier Anteile — deshalb „pp" und nicht „%".
 */
export function formatPp(delta: number, locale: Locale = FALLBACK): string {
  const value = numberFormat(locale, "pp", {
    signDisplay: "always",
    maximumFractionDigits: 1,
  }).format(delta * 100);
  return locale === "de" ? `${value} pp` : `${value}pp`;
}

const dateCache = new Map<string, Intl.DateTimeFormat>();
function dateFormat(locale: Locale | undefined, key: string, opts: Intl.DateTimeFormatOptions) {
  const tag = tagOf(locale);
  const id = `${tag}:${key}`;
  let f = dateCache.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, opts);
    dateCache.set(id, f);
  }
  return f;
}

/**
 * Datum in der Sprache des Lesers. `value` darf `Date`, ISO-String oder `null`
 * sein — `null` und Unlesbares werden zum Gedankenstrich, nicht zu
 * „Invalid Date".
 */
export function formatDate(
  value: Date | string | null | undefined,
  mode: "date" | "datetime" = "date",
  locale?: Locale,
): string {
  if (value == null) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";

  return mode === "datetime"
    ? dateFormat(locale, "datetime", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d)
    : dateFormat(locale, "date", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
}
