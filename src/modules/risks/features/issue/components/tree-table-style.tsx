import { ChevronRight } from "lucide-react";

/**
 * Shared visual tokens + primitives for the Goals-style tree/list tables (issue
 * register + cluster review). Mirrors `strategy-table-view.tsx` so the issue
 * surfaces look like the Ziele tree, without importing the goals module (ADR-0013).
 */

/** Head-row left accent rail colour (Tailwind blue-400) — matches goals. */
export const HEAD_ACCENT = "#60a5fa";

/** Outer container around the `<table>`. */
export const TREE_CONTAINER = "overflow-x-auto rounded-xl border bg-card shadow-sm";

/** `<thead>` chrome — sticky, muted, uppercase. */
export const TREE_THEAD =
  "sticky top-0 z-20 border-b bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur";

/** `<th>` cell. */
export const TREE_TH = "px-3 py-1.5 text-left font-medium whitespace-nowrap";

/** `<td>` cell. */
export const TREE_TD = "px-3 py-1.5 align-middle";

/** `<tr>` base. */
export const TREE_ROW = "group align-middle hover:bg-muted/40";

/** Contribution/rollup badge ("trägt 67 %" look). */
export const TREE_BADGE = "text-[11px] uppercase tracking-wider text-muted-foreground";

/**
 * Compose the row `boxShadow`: a left accent rail for head rows, plus an optional
 * drop-hint (top/bottom insertion line). Returns undefined when nothing applies.
 */
export function rowShadow(opts: {
  head?: boolean;
  drop?: "over" | "before" | "after";
}): string | undefined {
  const parts: string[] = [];
  if (opts.head) parts.push(`inset 3px 0 0 0 ${HEAD_ACCENT}`);
  if (opts.drop === "before") parts.push("inset 0 2px 0 0 var(--primary)");
  if (opts.drop === "after") parts.push("inset 0 -2px 0 0 var(--primary)");
  return parts.length ? parts.join(", ") : undefined;
}

/** Full-outline ring for an active "drop inside" target (assign / nest). */
export function dropInsideRing(isOver: boolean): string {
  return isOver ? "outline outline-2 -outline-offset-2 outline-primary" : "";
}

/** Depth spacers with faint tree guide lines (goal-tree style). */
export function TreeIndent({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }).map((_u, i) => (
        <span
          key={i}
          className="w-[18px] shrink-0 self-stretch border-l border-border/40"
          aria-hidden
        />
      ))}
    </>
  );
}

/** Rotating chevron for expandable rows; a fixed-width placeholder for leaves. */
export function TreeChevron({ open, hasChildren }: { open: boolean; hasChildren: boolean }) {
  if (!hasChildren) return <span className="w-5 shrink-0" aria-hidden />;
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground">
      <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </span>
  );
}
