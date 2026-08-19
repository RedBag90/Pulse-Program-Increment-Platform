/**
 * Budget-Perioden-Primitive (Core-Kernel) — der defensive Parser für
 * Perioden-Amount-Maps (`{ "YYYY-H1": 12345, … }`). Bewusst Core, weil sowohl
 * **Work** (Portfolio-Dashboard) als auch **Budgeting** ihn konsumieren — Work
 * darf nicht auf Budgeting zeigen (ADR-0013), also lebt das geteilte Primitiv
 * unten im Kernel. No I/O.
 *
 * Die frühere Funded-Window-Mathe (`fundedPeriodRange`/`fundedEndDate`) ist mit
 * [ADR-0019] entfallen: das Epic-Soll-Fenster folgt dem Reifegrad-Plan des
 * Owners, nicht dem finanzierten Fenster — es gab danach keinen Aufrufer mehr.
 */

/**
 * Defensive parser for a `{ "YYYY-H1": 12345, … }` JSON map: drops entries whose
 * value isn't a finite number, returns an empty map on null/non-object.
 */
export function parsePeriodAmountMap(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
