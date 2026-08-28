/**
 * WSJF-Primitive (Weighted Shortest Job First) — reines Tiering + Formatierung
 * eines berechneten `wsjfComputed`-Werts. Wohnt in **Core** (Basis-Tier), damit
 * Work, Drumbeat *und* die Infra-Schichten (`src/domain`, `src/server/views`)
 * abwärts darauf zugreifen — statt in das Legacy-`src/domain/schemas` zu greifen
 * (ADR-0013). Rein, kein I/O.
 *
 * Die Schwellen sind **caller-supplied** (Daten, nicht Fork): Drumbeat nutzt
 * ≥8/≥4 mit Label „unscored", die ART-Feature-Listen ≥5/≥2 mit „none".
 */

/** Die drei bewerteten Bänder; das Missing-Label liefert der Aufrufer. */
export type WsjfBandLabel = "high" | "medium" | "low";

/**
 * Bucketet einen berechneten WSJF-Score in `high | medium | low`, oder das
 * `missingLabel` des Aufrufers, wenn kein Score vorliegt. `>=` auf beiden
 * Schwellen (wie alle Aufrufer); `0` ist ein echter Score → `"low"`.
 */
export function wsjfBand<M extends string>(
  computed: number | null,
  opts: { high: number; medium: number; missingLabel: M },
): WsjfBandLabel | M {
  if (computed == null) return opts.missingLabel;
  if (computed >= opts.high) return "high";
  if (computed >= opts.medium) return "medium";
  return "low";
}

/**
 * Ein Display-Formatter für `wsjfComputed`. Kanonische Präzision: 2 Nachkomma-
 * stellen (matcht `computeWsjf`s Rundung). `null`/non-finite → Gedankenstrich.
 * Akzeptiert auch ein Prisma-`Decimal` (via `Number` gecoerct).
 */
export function formatWsjf(value: number | null | { toString(): string }, digits = 2): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
