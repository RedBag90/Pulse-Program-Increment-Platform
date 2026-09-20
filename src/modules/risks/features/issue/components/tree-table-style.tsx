import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STICKY_THEAD } from "@/components/ui/table-chrome";

/**
 * Shared visual tokens + primitives for the Goals-style tree/list tables (issue
 * register + cluster review). Mirrors `strategy-table-view.tsx` so the issue
 * surfaces look like the Ziele tree, without importing the goals module (ADR-0013).
 */

/** Head-row left accent rail colour (Tailwind blue-400) — matches goals. */
export const HEAD_ACCENT = "#60a5fa";

/**
 * Der Kasten um die `<table>`.
 *
 * **`clip` statt `auto`, sobald die Tabelle passt.** `overflow-x: auto` rechnet
 * `overflow-y` auf `auto` hoch und macht den Kasten damit zum Scroll-Container —
 * und ein `sticky` Kopf klebt am oberen Rand **dieses** Kastens, der bei 148
 * Zeilen 5070 px hoch ist und selbst nie scrollt. Der Kopf war deshalb nach dem
 * ersten Bildschirm weg, obwohl er `sticky` trug.
 *
 * `overflow-x: clip` schneidet ab, **ohne** Scroll-Container zu sein: der Kopf
 * hängt wieder an `main`. Gebraucht wird das Querscrollen ohnehin nur in
 * schmalen Fenstern — bei 1440 px misst die Tabelle 1336 px in einem 1336 px
 * breiten Kasten. Unterhalb von `xl` bleibt es deshalb bei `auto`.
 */
export const TREE_CONTAINER = "overflow-x-auto xl:overflow-x-clip rounded-lg bg-card shadow-card";

/**
 * `<thead>`-Chrom — klebend, gedämpft, versal (geteiltes Token, siehe
 * `table-chrome.ts`). Es klebt **unter** der Bedienleiste: deren Höhe schwankt
 * mit der Zahl der umbrechenden Filter-Chips, steht deshalb als CSS-Variable am
 * Abschnitt und nicht als Zahl in einer Klasse.
 */
export const TREE_THEAD = cn(STICKY_THEAD, "top-[var(--issues-toolbar-h,0px)]");

/** `<th>` cell. */
export const TREE_TH = "px-3 py-1.5 text-left font-medium whitespace-nowrap";

/** `<td>` cell. */
export const TREE_TD = "px-3 py-1.5 align-middle";

/** `<tr>` base. */
export const TREE_ROW = "group align-middle hover:bg-muted/40";

/** Contribution/rollup badge ("trägt 67 %" look). */
export const TREE_BADGE = "text-label uppercase tracking-[0.1em] text-muted-foreground";

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
    <span className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground">
      <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </span>
  );
}
