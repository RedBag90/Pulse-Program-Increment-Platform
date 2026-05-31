/**
 * Shared EUR formatter — single source of truth for currency rendering.
 * Locale `de-DE`, EUR, no fractional digits (rounded). Importers can pass
 * either a number or a number-ish (Decimal converted upstream); rendering
 * stays consistent across Budgeting, Controlling, Dashboards and Structure.
 *
 * Previously inlined in nine components — kept here so future changes
 * (locale tweak, fractional digits, K/M abbreviation) land in one place.
 */

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Returns "€12.345" for 12345. Rounds to the nearest integer. */
export function fmtEur(n: number): string {
  return EUR.format(Math.round(n));
}

/** Returns "—" for `null` / `undefined`, else `fmtEur(n)`. */
export function fmtEurOrDash(n: number | null | undefined): string {
  return n == null ? "—" : fmtEur(n);
}
