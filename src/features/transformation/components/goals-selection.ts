/**
 * URL-driven selection on the strategic-goals page. The shell encodes the
 * current `?selected` search-param as one of three shapes; every list / pane
 * component reads or writes via this small union, so the encoding lives in
 * one place.
 *
 * Encoding (`?selected=`):
 * - `g_<uuid>` → a strategic goal
 * - `kpi_<uuid>` → an unbound KPI
 * - `new` → a brand-new goal in the detail pane
 * - missing → nothing selected
 */
export type Selection =
  | { kind: "goal"; id: string }
  | { kind: "kpi"; id: string }
  | { kind: "new" }
  | { kind: "none" };

export function parseSelection(raw: string | null | undefined): Selection {
  if (!raw) return { kind: "none" };
  if (raw === "new") return { kind: "new" };
  if (raw.startsWith("g_")) return { kind: "goal", id: raw.slice(2) };
  if (raw.startsWith("kpi_")) return { kind: "kpi", id: raw.slice(4) };
  return { kind: "none" };
}

export function encodeSelection(sel: Selection): string | null {
  if (sel.kind === "none") return null;
  if (sel.kind === "new") return "new";
  if (sel.kind === "goal") return `g_${sel.id}`;
  return `kpi_${sel.id}`;
}
