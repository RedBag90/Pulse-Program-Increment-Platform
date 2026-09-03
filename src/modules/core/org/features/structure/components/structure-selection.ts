import type { NodeKind } from "@/modules/core/org/server/views/structure-page";

/**
 * URL-driven selection on the structure page. Each kind owns its prefix; the
 * shell maps the parsed selection to the right detail pane. Mirrors the codec
 * pattern from `/transformation/ziele` and `/admin/users` — copied per page
 * per the rework plan, not abstracted.
 *
 * Encoding (`?selected=`):
 * - `vs_<id>` · `art_<id>` · `timeline_<id>` → the entity
 * - missing → nothing selected
 */
export type Selection = { kind: NodeKind; id: string } | { kind: "none" };

const PREFIXES: Record<NodeKind, string> = {
  vs: "vs_",
  art: "art_",
  timeline: "timeline_",
  solution: "solution_",
};

export function parseSelection(raw: string | null | undefined): Selection {
  if (!raw) return { kind: "none" };
  for (const [kind, prefix] of Object.entries(PREFIXES) as [NodeKind, string][]) {
    if (raw.startsWith(prefix)) return { kind, id: raw.slice(prefix.length) };
  }
  return { kind: "none" };
}

export function encodeSelection(sel: Selection): string | null {
  if (sel.kind === "none") return null;
  return `${PREFIXES[sel.kind]}${sel.id}`;
}
