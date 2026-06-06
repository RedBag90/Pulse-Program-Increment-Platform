/**
 * URL-driven selection on the admin users page. The shell encodes the current
 * `?selected` search param as one of three shapes; every list/pane component
 * reads or writes via this small union, so the encoding lives in one place.
 *
 * Encoding (`?selected=`):
 * - `user_<id>` → an existing user (the master-detail editor)
 * - `invite` → the "Neuen Nutzer einladen" pane in create mode
 * - missing → nothing selected
 *
 * Mirrors the `goals-selection.ts` codec from `/transformation/ziele` —
 * intentionally copied (not abstracted) per the rework plan.
 */
export type Selection = { kind: "user"; id: string } | { kind: "invite" } | { kind: "none" };

export function parseSelection(raw: string | null | undefined): Selection {
  if (!raw) return { kind: "none" };
  if (raw === "invite") return { kind: "invite" };
  if (raw.startsWith("user_")) return { kind: "user", id: raw.slice(5) };
  return { kind: "none" };
}

export function encodeSelection(sel: Selection): string | null {
  if (sel.kind === "none") return null;
  if (sel.kind === "invite") return "invite";
  return `user_${sel.id}`;
}
