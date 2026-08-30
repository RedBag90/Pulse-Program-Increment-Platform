/**
 * UI formatting helpers — concentrate the de-DE Intl-formatter setup that
 * 20+ components had inline. Pure functions, no JSX. Live in `src/lib/` so
 * server components, client components and tests can all read them.
 *
 * Three EUR variants for the three call-shapes that grew in the codebase:
 * - `formatEUR(n)` — full Intl.NumberFormat de-DE EUR (no decimals).
 * - `formatCompactEUR(n)` — `€X.XM` / `€X.XK` / `€1.234` (overview tiles).
 * - `formatCompactNumber(n)` — same compact rule sans EUR prefix.
 *
 * Date helpers cover the two formats the UI used most often (date, datetime).
 */

const EUR_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Standard de-DE EUR — rounds to whole euros, returns a string like
 * `12.345 €`. Replaces 4+ inline `new Intl.NumberFormat("de-DE", { style:
 * "currency", currency: "EUR", maximumFractionDigits: 0 })` setups.
 */
export function formatEUR(n: number): string {
  return EUR_FORMATTER.format(Math.round(n));
}

/**
 * Plain `€<grouped>` (no Intl-locale-currency placement, just the symbol
 * prefix). Used by tiles that already render their own layout and don't
 * want the trailing ` €`. Replaces several inline `€${Math.round(n).toLocaleString("de-DE")}`.
 */
export function formatEURPrefix(n: number): string {
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}

/**
 * Compact EUR: `€1.2M` / `€1.2K` / `€999`. Threshold at 1M / 1K (using the
 * absolute value so negatives format correctly). Matches the eur() helpers
 * that lived in epic-realized-tile, funding-block, funding-snapshot-table,
 * overview-executive.
 */
export function formatCompactEUR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
  return formatEURPrefix(n);
}

/**
 * Compact plain number with `M`/`K` suffix — same logic as `formatCompactEUR`
 * but without the EUR prefix, for non-€ metrics in strategy / okr views.
 */
export function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

/**
 * Deutscher Kompakt-Euro für Portfolio-Kennzahlen: `24,6 Mio €` / `1,3 Mrd €`,
 * eine Nachkommastelle, deutsche Dezimaltrennung (Komma). Anders als
 * `formatCompactEUR` (`€24.60M`, englisch) folgt dies der LPM-Review-Vorgabe
 * (Spec: „24,6 Mio €"). Werte < 1 Mio werden ebenfalls in Mio dargestellt
 * (z. B. `0,4 Mio €`), damit KPI-Karten und Achsen eine Einheit teilen.
 */
export function formatMioEUR(n: number): string {
  const abs = Math.abs(n);
  const de = (x: number) =>
    x.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${de(n / 1_000_000_000)} Mrd €`;
  return `${de(n / 1_000_000)} Mio €`;
}

/**
 * Prozent aus einem 0..1-Verhältnis, ganzzahlig gerundet, mit Leerzeichen vor
 * `%` (de-Konvention): `formatPercent(0.876)` → `88 %`. Konvention im Ziele-/
 * Portfolio-Code: Verhältnisse bleiben 0..1 und werden erst am Rand formatiert.
 */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

const PP_FORMATTER = new Intl.NumberFormat("de-DE", {
  signDisplay: "always",
  maximumFractionDigits: 1,
});

/**
 * Prozentpunkt-Delta mit Vorzeichen: `formatPp(0.085)` → `+8,5 pp`. Eingabe ist
 * ein 0..1-Delta (gleiche Konvention wie `formatPercent`), Ausgabe die Differenz
 * zweier Anteile — deshalb „pp" und nicht „%".
 */
export function formatPp(delta: number): string {
  return `${PP_FORMATTER.format(delta * 100)} pp`;
}

/**
 * de-DE date formatter. `iso` may be a `Date`, an ISO string, or `null`
 * (renders as em-dash). Default mode is `"date"` (`05.06.2026`); `"datetime"`
 * adds time (`05.06.2026, 14:32`).
 */
export function formatDate(
  value: Date | string | null | undefined,
  mode: "date" | "datetime" = "date",
): string {
  if (value == null) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return mode === "datetime"
    ? d.toLocaleString("de-DE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString("de-DE");
}
