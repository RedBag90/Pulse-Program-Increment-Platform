"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CreateValueStreamDialog } from "@/modules/core/org/features/value-stream/components/create-value-stream-dialog";
import {
  activeNodeFromPath,
  isRoutedKind,
  nodeHref,
} from "@/modules/core/org/features/structure/components/structure-routes";
import type { NodeKind, StructureRow } from "@/modules/core/org/server/views/structure-page";

/**
 * Die Farbmarke je Knotenart — dieselben drei wie im Entwurf: der Wertstrom
 * trägt die Akzentfarbe, der ART Smaragd, die Solution Violett. Sie ersetzt das
 * Icon **und** die Textzeile „Wertstrom · 2 ARTs": in einem Baum sagt die Ebene
 * schon, was ein Knoten ist, und eine zweite Zeile je Zeile macht aus einem
 * Baum eine Kartenliste.
 */
const KIND_DOT: Record<NodeKind, string> = {
  vs: "bg-primary",
  art: "bg-emerald-600",
  solution: "bg-violet-500",
  timeline: "bg-muted-foreground",
};

const KIND_LABEL: Record<NodeKind, string> = {
  vs: "Wertstrom",
  art: "ART",
  solution: "Solution",
  timeline: "Timeline",
};

const FILTER_ORDER: NodeKind[] = ["vs", "art", "solution"];
const FILTER_LABEL: Record<string, string> = {
  vs: "Wertströme",
  art: "ARTs",
  solution: "Solutions",
};

interface Props {
  rows: StructureRow[];
  kindCounts: Record<NodeKind, number>;
  availableKinds: NodeKind[];
  canCreateVs: boolean;
}

/**
 * Der Baum als **Navigation** — die linke Spalte des Struktur-Bereichs.
 *
 * Drei Dinge unterscheiden ihn von der früheren Liste:
 *
 * 1. **Die Zeilen sind Links, keine Schaltflächen.** Ein Knoten ist eine Route;
 *    damit funktionieren Zurück-Taste, Lesezeichen und geteilte Links. Die
 *    aktive Auswahl wird aus dem Pfad gelesen, nicht selbst gehalten.
 * 2. **Er ist ein Baum, keine Kartenliste.** Eine Zeile ist eine Zeile: Marke,
 *    Name, Einrückung. Bei 18 Knoten auf drei Ebenen entscheidet die Dichte
 *    darüber, ob man die Struktur überhaupt als Struktur sieht.
 * 3. **Wertströme klappen ein.** Voll ausgefahren füllt der Baum die Spalte,
 *    bevor man etwas gewählt hat. Offen ist, was den aktiven Knoten enthält.
 *
 * Suche und Filter bleiben im URL-Zustand (`?q`, `?kind`) — sie gehören zum
 * Baum, nicht zum Knoten, und überleben deshalb den Wechsel zwischen Knoten.
 */
export function StructureNav({ rows, kindCounts, availableKinds, canCreateVs }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLUListElement>(null);

  // Unter `lg` ist der Baum eine ausfahrbare Schublade: drei Ebenen —
  // Navigation, Baum, Reiter — passen auf einem schmalen Schirm nicht
  // nebeneinander. Ab `lg` steht er immer, unabhängig von diesem Zustand.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const kindFilter = (searchParams.get("kind") as NodeKind | null) ?? null;
  const query = searchParams.get("q") ?? "";
  const active = activeNodeFromPath(pathname);

  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);

  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => pushParam("q", draft || null), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, pushParam]);

  /** Der Wertstrom, unter dem der aktive Knoten hängt — er ist offen. */
  const activeBranch = useMemo(() => {
    if (!active) return null;
    const byId = new Map(rows.map((r) => [`${r.kind}_${r.id}`, r]));
    let cursor = byId.get(`${active.kind}_${active.id}`);
    while (cursor && cursor.parentId != null) {
      const parent =
        byId.get(`vs_${cursor.parentId}`) ??
        byId.get(`art_${cursor.parentId}`) ??
        byId.get(`solution_${cursor.parentId}`);
      if (!parent) break;
      cursor = parent;
    }
    return cursor?.kind === "vs" ? cursor.id : null;
  }, [rows, active]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const isOpen = useCallback(
    (vsId: string) =>
      collapsed.has(vsId) ? false : vsId === activeBranch || activeBranch === null,
    [collapsed, activeBranch],
  );
  const toggle = useCallback(
    (vsId: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        const open = prev.has(vsId) ? false : vsId === activeBranch || activeBranch === null;
        if (open) next.add(vsId);
        else next.delete(vsId);
        return next;
      }),
    [activeBranch],
  );

  const q = query.trim().toLowerCase();
  const filtering = q !== "" || kindFilter != null;

  /**
   * Beim Suchen wird flach gezeigt, was passt — sonst versteckte die
   * Einklappung genau den Treffer, den man sucht.
   */
  const visible = useMemo(() => {
    if (filtering) {
      return rows.filter((r) => {
        if (kindFilter != null && r.kind !== kindFilter) return false;
        return q === "" || r.label.toLowerCase().includes(q);
      });
    }
    return rows.filter((r) => {
      if (r.depth === 0) return true;
      // Alles unterhalb hängt an einem Wertstrom — der entscheidet.
      const branch = branchOf(rows, r);
      return branch != null && isOpen(branch);
    });
  }, [rows, filtering, kindFilter, q, isOpen]);

  const focusIndex = Math.max(
    0,
    visible.findIndex((r) => active != null && r.kind === active.kind && r.id === active.id),
  );

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]');
    if (!items || items.length === 0) return;
    const current = Array.from(items).findIndex((el) => el === document.activeElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : e.key === "ArrowDown"
            ? Math.min(items.length - 1, current + 1)
            : Math.max(0, current - 1);
    e.preventDefault();
    items[next]?.focus();
  }, []);

  const visibleKinds = FILTER_ORDER.filter((k) => availableKinds.includes(k));
  const total = visibleKinds.reduce((a, k) => a + kindCounts[k], 0);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        aria-expanded={drawerOpen}
        className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-sm font-medium lg:hidden"
      >
        Struktur durchsuchen
        <ChevronDown
          className={cn("size-4 transition-transform", drawerOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      <div className={cn("space-y-2", drawerOpen ? "block" : "hidden", "lg:block")}>
        <div className="rounded-lg border bg-card p-2">
          <div className="mb-2 flex items-center justify-between gap-2 border-b px-1 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Organisation
            </span>
            {canCreateVs && <CreateValueStreamDialog compact />}
          </div>

          <div className="relative mb-2">
            <Search
              className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Suche…"
              aria-label="Struktur durchsuchen"
              className="h-7 pl-7 text-xs"
            />
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            <FilterChip
              label="Alle"
              count={total}
              active={kindFilter === null}
              onClick={() => pushParam("kind", null)}
            />
            {visibleKinds.map((kind) => (
              <FilterChip
                key={kind}
                label={FILTER_LABEL[kind] ?? kind}
                count={kindCounts[kind]}
                active={kindFilter === kind}
                onClick={() => pushParam("kind", kindFilter === kind ? null : kind)}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              {rows.length === 0
                ? "Noch keine Struktur — mit „Wertstrom“ den ersten anlegen."
                : "Kein Treffer."}
            </p>
          ) : (
            <ul
              ref={listRef}
              role="tree"
              aria-label="Organisation"
              className="max-h-[calc(100vh-16rem)] overflow-y-auto"
              onKeyDown={onKeyDown}
              data-tour="structure-tree"
            >
              {visible.map((row, i) => (
                <NavRow
                  key={`${row.kind}_${row.id}`}
                  row={row}
                  selected={active != null && active.kind === row.kind && active.id === row.id}
                  tabbable={i === focusIndex}
                  expandable={row.kind === "vs" && !filtering && hasChildren(rows, row.id)}
                  expanded={row.kind === "vs" ? isOpen(row.id) : undefined}
                  onToggle={() => toggle(row.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Der Wertstrom, unter dem eine Zeile hängt — über `parentId` nach oben. */
function branchOf(rows: readonly StructureRow[], row: StructureRow): string | null {
  if (row.kind === "vs") return row.id;
  if (row.depth === 1) return row.parentId;
  const parent = rows.find((r) => r.id === row.parentId);
  return parent ? branchOf(rows, parent) : null;
}

function hasChildren(rows: readonly StructureRow[], id: string): boolean {
  return rows.some((r) => r.parentId === id);
}

function NavRow({
  row,
  selected,
  tabbable,
  expandable,
  expanded,
  onToggle,
}: {
  row: StructureRow;
  selected: boolean;
  tabbable: boolean;
  expandable: boolean;
  expanded?: boolean | undefined;
  onToggle: () => void;
}) {
  const body = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-[2px]", KIND_DOT[row.kind])} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      <span className="sr-only">{KIND_LABEL[row.kind]}</span>
      {row.gaps.length > 0 && (
        <span
          className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800"
          title={row.gaps.join(", ")}
        >
          {row.gaps.length}
          <span className="sr-only"> offene Angaben: {row.gaps.join(", ")}</span>
        </span>
      )}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-2 rounded-md py-1 pr-2 text-[13px] leading-tight transition-colors",
    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    selected ? "bg-primary/10 font-medium text-primary" : "text-foreground",
  );
  // 8px Grundabstand, je Ebene 14px — die Einrückung trägt die Hierarchie.
  const indent = { paddingLeft: `${0.5 + row.depth * 0.875}rem` };

  return (
    <li role="none" className="flex items-center">
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `${row.label} einklappen` : `${row.label} ausklappen`}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {expanded ? (
            <ChevronDown className="size-3" aria-hidden />
          ) : (
            <ChevronRight className="size-3" aria-hidden />
          )}
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}

      {isRoutedKind(row.kind) ? (
        <Link
          href={nodeHref(row.kind, row.id)}
          role="treeitem"
          aria-level={row.depth + 1}
          aria-selected={selected}
          {...(expanded !== undefined ? { "aria-expanded": expanded } : {})}
          tabIndex={tabbable ? 0 : -1}
          className={className}
          style={indent}
        >
          {body}
        </Link>
      ) : (
        <span
          role="treeitem"
          aria-level={row.depth + 1}
          aria-selected={false}
          tabIndex={tabbable ? 0 : -1}
          className={className}
          style={indent}
        >
          {body}
        </span>
      )}
    </li>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-input text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
