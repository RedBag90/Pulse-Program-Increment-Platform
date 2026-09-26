"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  useActionState,
  memo,
} from "react";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  goalHref,
  goalDetailHref,
  goalCreateHref,
} from "@/modules/core/goals/features/lib/goal-href";
import {
  ChevronRight,
  Pencil,
  Plus,
  ChevronsDownUp,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import { type RollupTrio } from "@/modules/core/goals/domain/goals-rollup";
import { goalTimeframe, goalTimeframeStart } from "@/modules/core/goals/domain/goal-period";
import {
  filterGoalBranches,
  collectNodeIdsWithChildren,
} from "@/modules/core/goals/domain/goal-tree-filter";
import {
  goalNodeProgress,
  goalNodeConfidenceLabel,
  goalNodeOwner,
  goalNodeTimeframeLabel,
  goalInitials,
  isGoalDrifting,
  isGoalOffTrack,
} from "@/modules/core/goals/features/lib/goal-node-view";
import { reparentGoalNodeAction } from "@/modules/core/goals/features/actions/ziele";
import { HEAD_GOAL_ACCENT } from "@/modules/core/goals/features/lib/goal-accent";
import { GoalStatusPill } from "@/modules/core/goals/features/components/goal-status/goal-status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";

/** Drop-Position relativ zur Ziel-Zeile: davor/dazwischen (Geschwister) oder unterordnen. */
type Placement = "before" | "inside" | "after";

/**
 * Drag-Kontext — **nur stabile Handler** (durch NodeRows → Row gereicht). Der
 * häufig wechselnde Over-Zustand (`overId`/`overPlacement`) wird bewusst NICHT
 * hier geführt, sondern als Per-Zeilen-Primitive gereicht, damit ein Hover nur
 * die betroffenen (memoisierten) Zeilen neu rendert, nicht den ganzen Baum.
 */
interface DragCtx {
  canEdit: boolean;
  /** Umsortieren (davor/danach) nur im Sortier-Modus „Manuell". */
  reorderable: boolean;
  onStart: (node: GoalNode) => void;
  onDropOn: (target: GoalNode | null, placement: Placement) => void;
  isValidTarget: (targetId: string) => boolean;
  setOver: (id: string | null, placement: Placement | null) => void;
}

/** Findet Parent-Id + Geschwister-Array (das Array, das `targetId` enthält). */
function locateSiblings(
  nodes: GoalNode[],
  targetId: string,
  parentId: string | null = null,
): { parentId: string | null; siblings: GoalNode[] } | null {
  if (nodes.some((n) => n.id === targetId)) return { parentId, siblings: nodes };
  for (const n of nodes) {
    const r = locateSiblings(n.children, targetId, n.id);
    if (r) return r;
  }
  return null;
}

/** Nächster scrollbarer Vorfahr (für Auto-Scroll beim Ziehen); Fallback = Dokument. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/** Collapse-Kontext für den ein-/ausklappbaren Baum. */
interface TreeCtx {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  userLabels: Record<string, string>;
}

/** Enthält der Subtree von `n` die id `id`? (Client-Zyklus-Guard.) */
function subtreeHas(n: GoalNode, id: string): boolean {
  if (n.id === id) return true;
  return n.children.some((c) => subtreeHas(c, id));
}

/** Sortierkriterium der Top-Level-Themes (Geschwister); „manual" = Server-Reihenfolge. */
type SortKey = "manual" | "progress" | "value" | "period" | "title";

/**
 * Strategie als hierarchische Tabelle — Default-Layout im Strategie-Tab.
 * Ein-/ausklappbarer Ziel-Baum: **Name (Held) · Owner · Status · Progress ·
 * Wert · Zeitraum · Aktionen**. Edit-Affordances nur bei `canEdit`.
 */
interface Props {
  themes: GoalNode[];
  canEdit: boolean;
  userLabels?: Record<string, string>;
}

export function StrategyTableView({ themes, canEdit, userLabels = {} }: Props) {
  const t = useTranslations();
  const dragNode = useRef<GoalNode | null>(null);
  const [over, setOver] = useState<{ id: string; placement: Placement } | null>(null);
  const [overTop, setOverTop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Auf-/Zuklapp-Zustand überlebt einen Reload (Geräte-Ansichtspräferenz).
  const [collapsedIds, setCollapsedIds] = useLocalStorageState<string[]>("ziele:collapsed", []);
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const [offTrackOnly, setOffTrackOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [, reparentRun] = useActionState(reparentGoalNodeAction, {});

  const allParentIds = useMemo(() => collectNodeIdsWithChildren(themes), [themes]);
  const visibleThemes = useMemo(
    () => (offTrackOnly ? filterGoalBranches(themes, isGoalOffTrack) : themes),
    [themes, offTrackOnly],
  );
  // Sortierung betrifft nur die Top-Level-Themes; Kinder behalten ihre Reihenfolge.
  const sortedThemes = useMemo(() => {
    if (sortKey === "manual") return visibleThemes;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...visibleThemes].sort((a, b) => {
      switch (sortKey) {
        case "progress":
          return ((a.progress ?? -1) - (b.progress ?? -1)) * dir;
        case "value":
          return ((a.trio.realized ?? 0) - (b.trio.realized ?? 0)) * dir;
        case "period":
          return (
            (goalTimeframeStart(goalTimeframe(a.period, a.periodStart, a.periodEnd)) -
              goalTimeframeStart(goalTimeframe(b.period, b.periodStart, b.periodEnd))) *
            dir
          );
        case "title":
          return a.title.localeCompare(b.title) * dir;
        default:
          return 0;
      }
    });
  }, [visibleThemes, sortKey, sortDir]);
  const filtersActive = sortKey !== "manual" || offTrackOnly;
  const reorderable = sortKey === "manual";

  // Deep-Links erhalten die aktiven Filter/Layout-Params — einmal an der Wurzel
  // lesen (statt via Hook pro Zeile) und als `sp` durch den Baum reichen.
  const sp = useSearchParams();

  const onDropOn = useCallback(
    (target: GoalNode | null, placement: Placement) => {
      const src = dragNode.current;
      dragNode.current = null;
      setOver(null);
      setOverTop(false);
      setDragging(false);
      if (!src) return;
      if (target && (src.id === target.id || subtreeHas(src, target.id))) return;

      let newParentId = "";
      let beforeId = "";
      if (target && placement === "inside") {
        newParentId = target.id; // unterordnen (ans Ende)
      } else if (target) {
        const loc = locateSiblings(themes, target.id);
        newParentId = loc?.parentId ?? "";
        if (placement === "before") {
          beforeId = target.id;
        } else {
          const sibs = loc?.siblings ?? [];
          const i = sibs.findIndex((s) => s.id === target.id);
          beforeId = i >= 0 && i + 1 < sibs.length ? (sibs[i + 1]?.id ?? "") : "";
        }
      }
      // target null = oberste Ebene (Append): newParentId "" bleibt.

      const fd = new FormData();
      fd.set("id", src.id);
      fd.set("newParentId", newParentId);
      fd.set("beforeId", beforeId);
      startTransition(() => reparentRun(fd));
    },
    [themes, reparentRun],
  );

  // Stabile Handler → `drag`-Identität wechselt NICHT bei jedem Hover; der
  // Over-Zustand kommt separat als Per-Zeilen-Primitive.
  const drag: DragCtx = useMemo(
    () => ({
      canEdit,
      reorderable,
      onStart: (node) => {
        dragNode.current = node;
        setDragging(true);
      },
      isValidTarget: (targetId) => {
        const src = dragNode.current;
        return !!src && src.id !== targetId && !subtreeHas(src, targetId);
      },
      onDropOn,
      setOver: (id, placement) => setOver(id && placement ? { id, placement } : null),
    }),
    [canEdit, reorderable, onDropOn],
  );

  // Auto-Scroll: natives HTML5-Drag scrollt nicht — am oberen/unteren Rand des
  // Scroll-Containers automatisch weiterscrollen, damit lange Listen erreichbar sind.
  useEffect(() => {
    if (!dragging) return;
    const scroller = getScrollParent(containerRef.current);
    if (!scroller) return;
    let raf = 0;
    let lastY = 0;
    const EDGE = 72;
    const MAX = 22;
    const onOver = (e: DragEvent) => {
      lastY = e.clientY;
    };
    const step = () => {
      const r = scroller.getBoundingClientRect();
      const top = lastY - r.top;
      const bottom = r.bottom - lastY;
      if (top >= 0 && top < EDGE) scroller.scrollTop -= MAX * (1 - top / EDGE);
      else if (bottom >= 0 && bottom < EDGE) scroller.scrollTop += MAX * (1 - bottom / EDGE);
      raf = requestAnimationFrame(step);
    };
    const stop = () => setDragging(false);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
    };
  }, [dragging]);

  const toggle = useCallback(
    (id: string) =>
      setCollapsedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setCollapsedIds],
  );
  const tree: TreeCtx = useMemo(
    () => ({ collapsed, userLabels, toggle }),
    [collapsed, userLabels, toggle],
  );

  if (themes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">{t("goals.table.empty")}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("goals.table.emptyHint")}</p>
        {canEdit && (
          <div className="mt-4 flex justify-center">
            <NewLink entity="theme">{t("goals.table.newGoalLong")}</NewLink>
          </div>
        )}
      </div>
    );
  }

  const allCollapsed = allParentIds.length > 0 && collapsed.size >= allParentIds.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border">
            <ToolbarButton
              onClick={() => setCollapsedIds(allParentIds)}
              disabled={allParentIds.length === 0 || allCollapsed}
              title={t("goals.table.collapseAll")}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden />
              {t("goals.table.collapse")}
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setCollapsedIds([])}
              disabled={collapsed.size === 0}
              title={t("goals.table.expandAll")}
              className="border-l"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
              {t("goals.table.expand")}
            </ToolbarButton>
          </div>
          <label className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
            <span className="text-meta font-medium text-muted-foreground">
              {t("goals.table.sort")}
            </span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-transparent text-xs font-medium focus-visible:outline-none"
              aria-label={t("goals.table.sortBy")}
            >
              <option value="manual">{t("goals.table.manual")}</option>
              <option value="progress">{t("goals.table.progress")}</option>
              <option value="value">{t("goals.table.value")}</option>
              <option value="period">{t("goals.table.timeframe")}</option>
              <option value="title">{t("goals.table.title")}</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              disabled={sortKey === "manual"}
              aria-label={sortDir === "asc" ? "Aufsteigend" : "Absteigend"}
              title={sortDir === "asc" ? "Aufsteigend" : "Absteigend"}
              className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {sortDir === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </label>
          <button
            type="button"
            onClick={() => setOffTrackOnly((v) => !v)}
            aria-pressed={offTrackOnly}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              offTrackOnly
                ? "border-amber-300 bg-warning-surface text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {t("goals.shared.onlyOffTrack")}
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSortKey("manual");
                setSortDir("desc");
                setOffTrackOnly(false);
              }}
              className="inline-flex items-center rounded-md px-2 py-1 text-meta font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("goals.shared.reset")}
            </button>
          )}
          {offTrackOnly && visibleThemes.length === 0 && (
            <span className="text-meta text-muted-foreground">{t("goals.shared.noOffTrack")}</span>
          )}
        </div>
        {canEdit && <NewLink entity="theme">{t("goals.table.newGoal")}</NewLink>}
      </div>
      {canEdit && (
        <p className="text-meta text-muted-foreground">
          {reorderable ? t("goals.table.dragHintReorderable") : t("goals.table.dragHintNestOnly")}
        </p>
      )}
      {canEdit && (
        <div
          onDragOver={(e) => {
            if (dragNode.current) {
              e.preventDefault();
              setOverTop(true);
            }
          }}
          onDragLeave={() => setOverTop(false)}
          onDrop={(e) => {
            e.preventDefault();
            drag.onDropOn(null, "inside");
          }}
          className={cn(
            "rounded-md border border-dashed px-3 py-1.5 text-center text-meta text-muted-foreground transition-colors",
            overTop && "border-primary bg-primary/10 text-foreground",
          )}
        >
          {t("goals.table.dropToTopLevel")}
        </div>
      )}
      <div
        ref={containerRef}
        data-tour="goals-table"
        className="overflow-x-auto rounded-lg bg-card shadow-card shadow-sm"
      >
        <table className="w-full text-sm">
          <thead className={STICKY_THEAD}>
            <tr>
              <Th>{t("goals.table.name")}</Th>
              <Th className="w-14">{t("goals.table.owner")}</Th>
              <Th className="w-32">{t("goals.table.status")}</Th>
              <Th className="w-36">{t("goals.table.progress")}</Th>
              <Th className="w-28">{t("goals.table.value")}</Th>
              <Th className="w-20">{t("goals.table.timeframe")}</Th>
              {canEdit && (
                <Th className="sticky right-0 z-30 w-24 border-l bg-muted/95">
                  {t("goals.table.actions")}
                </Th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedThemes.map((t) => (
              <NodeRows
                key={t.id}
                node={t}
                depth={0}
                canEdit={canEdit}
                drag={drag}
                tree={tree}
                sp={sp}
                overId={over?.id ?? null}
                overPlacement={over?.placement ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Rekursive Knoten-Zeilen — jeder Knoten rendert eine `Row`; Kinder folgen
 * rekursiv, es sei denn der Knoten ist eingeklappt.
 */
function NodeRows({
  node,
  depth,
  canEdit,
  drag,
  tree,
  sp,
  overId,
  overPlacement,
}: {
  node: GoalNode;
  depth: number;
  canEdit: boolean;
  drag: DragCtx;
  tree: TreeCtx;
  sp: ReturnType<typeof useSearchParams>;
  overId: string | null;
  overPlacement: Placement | null;
}) {
  // Kompakter Inline-Suffix: nur der Beitrags-Anteil bei Unterzielen (die
  // Hierarchie-Ebene zeigt bereits Theme vs. Unterziel).
  const subtitle =
    depth > 0 && node.rollupWeight != null
      ? `trägt ${Math.round(node.contributionShare * 100)} %`
      : "";
  const progress = goalNodeProgress(node);
  const hasChildren = node.children.length > 0;
  const isCollapsed = tree.collapsed.has(node.id);
  const ownerLabel = goalNodeOwner(node, tree.userLabels);
  // Nur dieser Knoten sieht seinen eigenen Over-Zustand → memoisierte Row rendert
  // bei einem Hover auf eine ANDERE Zeile nicht neu.
  const isOver = overId === node.id;

  return (
    <>
      <Row
        node={node}
        drag={drag}
        depth={depth}
        title={node.title}
        subtitle={subtitle}
        drift={isGoalDrifting(node)}
        href={goalDetailHref(sp, node.id)}
        statusValue={node.status}
        checkinAt={node.latestCheckin?.at ?? null}
        progress={progress}
        trio={node.trio}
        periodLabel={goalNodeTimeframeLabel(node)}
        canEdit={canEdit}
        ownerLabel={ownerLabel}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        toggle={tree.toggle}
        isOver={isOver}
        overPlacement={isOver ? overPlacement : null}
        editHref={goalDetailHref(sp, node.id)}
        addChildHref={goalCreateHref(sp, node.id)}
      />
      {hasChildren &&
        !isCollapsed &&
        node.children.map((child) => (
          <NodeRows
            key={child.id}
            node={child}
            depth={depth + 1}
            canEdit={canEdit}
            drag={drag}
            tree={tree}
            sp={sp}
            overId={overId}
            overPlacement={overPlacement}
          />
        ))}
    </>
  );
}

interface RowProps {
  node: GoalNode;
  drag: DragCtx;
  depth: number;
  title: string;
  subtitle: string;
  drift: boolean;
  href: string;
  statusValue: string | null;
  checkinAt: string | null;
  progress: number;
  trio: RollupTrio;
  periodLabel: string;
  canEdit: boolean;
  ownerLabel: string | null;
  hasChildren: boolean;
  isCollapsed: boolean;
  /** Stabiler Toggle (Row bindet die id selbst) — memo-freundlich. */
  toggle: (id: string) => void;
  /** Per-Zeilen-Over-Zustand (nur diese Zeile wechselt beim Hover). */
  isOver: boolean;
  overPlacement: Placement | null;
  editHref: string;
  addChildHref: string;
}

const Row = memo(function Row({
  node,
  drag,
  depth,
  title,
  subtitle,
  drift,
  href,
  statusValue,
  checkinAt,
  progress,
  trio,
  periodLabel,
  canEdit,
  ownerLabel,
  hasChildren,
  isCollapsed,
  toggle,
  isOver,
  overPlacement,
  editHref,
  addChildHref,
}: RowProps) {
  const t = useTranslations();
  // Aus `node` abgeleitet statt als Prop durchgereicht: `Row` ist memoisiert und
  // hat den Knoten ohnehin.
  const confidenceLabel = goalNodeConfidenceLabel(node);
  const placement = isOver ? overPlacement : null;
  // Kopf-Ziele (Top-Level-Themes) tragen eine hellblaue Schiene links; beim Ziehen
  // zeigt eine blaue Linie oben/unten die Einfüge-Position (davor/danach).
  const isHead = depth === 0;
  const shadow: string[] = [];
  if (isHead) shadow.push(`inset 3px 0 0 0 ${HEAD_GOAL_ACCENT}`);
  if (placement === "before") shadow.push("inset 0 2px 0 0 var(--primary)");
  if (placement === "after") shadow.push("inset 0 -2px 0 0 var(--primary)");
  return (
    <tr
      className={cn(
        "group align-middle hover:bg-muted/40",
        placement === "inside" && "outline outline-2 -outline-offset-2 outline-primary",
      )}
      style={shadow.length ? { boxShadow: shadow.join(", ") } : undefined}
      draggable={drag.canEdit}
      onDragStart={(e) => {
        if (!drag.canEdit) return;
        drag.onStart(node);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!drag.canEdit || !drag.isValidTarget(node.id)) return;
        e.preventDefault();
        let next: Placement = "inside";
        if (drag.reorderable) {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = (e.clientY - r.top) / r.height;
          next = rel < 0.4 ? "before" : rel > 0.6 ? "after" : "inside";
        }
        if (!isOver || overPlacement !== next) drag.setOver(node.id, next);
      }}
      onDragLeave={() => {
        if (isOver) drag.setOver(null, null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag.onDropOn(node, overPlacement ?? "inside");
      }}
    >
      <Td>
        <div className="flex min-w-0 items-center">
          {/* Tiefen-Linien: ein vertikaler Guide je Einrück-Stufe. */}
          {Array.from({ length: depth }).map((_unused, i) => (
            <span
              key={i}
              className="w-[18px] shrink-0 self-stretch border-l border-border/40"
              aria-hidden
            />
          ))}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Ausklappen" : "Einklappen"}
              className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")}
                aria-hidden
              />
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden />
          )}
          <Link
            href={href as never}
            scroll={false}
            className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
          >
            <span className="truncate text-sm font-medium">{title}</span>
            {drift && (
              <span
                className="shrink-0 rounded-full bg-warning-surface px-1 py-0.5 text-label font-semibold text-warning dark:bg-amber-500/20 dark:text-amber-300"
                title={t("goals.shared.runRateBelowPlan")}
              >
                ⚠
              </span>
            )}
            {depth === 0 && node.valueStreams.length > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                {node.valueStreams.slice(0, 2).map((v) => (
                  <Badge
                    key={v.id}
                    variant="secondary"
                    className="max-w-[8rem] truncate"
                    title={`Wertstrom: ${v.name}`}
                  >
                    {v.name}
                  </Badge>
                ))}
                {node.valueStreams.length > 2 && (
                  <span className="text-label text-muted-foreground">
                    +{node.valueStreams.length - 2}
                  </span>
                )}
              </span>
            )}
            {subtitle && (
              <span className="shrink-0 text-meta uppercase tracking-[0.1em] text-muted-foreground">
                {subtitle}
              </span>
            )}
          </Link>
        </div>
      </Td>
      <Td>
        <OwnerAvatar label={ownerLabel} head={isHead} />
      </Td>
      <Td>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <GoalStatusPill status={statusValue} />
          {checkinAt && (
            <span className="text-meta text-muted-foreground">{relativeGoalTime(checkinAt)}</span>
          )}
        </span>
      </Td>
      <Td>
        {/* Bei Zuversicht sagt die Stufe mehr als der Prozentwert: eine 3 ist
            „mittlere Zuversicht", nicht „halb fertig". */}
        {confidenceLabel ? (
          <span className="flex items-center gap-2">
            <ProgressBar value={progress} />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {confidenceLabel}
            </span>
          </span>
        ) : (
          <ProgressBar value={progress} />
        )}
      </Td>
      <Td>
        <TrioBadge trio={trio} />
      </Td>
      <Td className="text-xs text-muted-foreground">{periodLabel}</Td>
      {canEdit && (
        <Td className="sticky right-0 z-10 border-l bg-card group-hover:bg-muted/40">
          <RowActions editHref={editHref} addChildHref={addChildHref} />
        </Td>
      )}
    </tr>
  );
});

function OwnerAvatar({ label, head }: { label: string | null; head?: boolean }) {
  if (!label) return <span className="text-meta text-muted-foreground/50">—</span>;
  const initials = goalInitials(label);
  return (
    <Avatar size="sm" title={label}>
      <AvatarFallback
        className={cn("text-label font-medium", head && "bg-primary/10 text-primary")}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function RowActions({
  editHref,
  addChildHref,
}: {
  editHref: string;
  addChildHref?: string | null;
}) {
  const t = useTranslations();
  return (
    // Sichtbar bei Hover ODER Tastatur-Fokus (fokussierbar trotz opacity-0);
    // Trefferflächen ≥32px für Maus/Touch/Tastatur.
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 group-focus-within:opacity-100">
      {addChildHref && (
        <Link
          href={addChildHref as never}
          scroll={false}
          className="grid size-8 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          title={t("goals.table.addSubGoal")}
          aria-label={t("goals.table.addSubGoal")}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Link>
      )}
      <Link
        href={editHref as never}
        scroll={false}
        className="grid size-8 place-items-center rounded-md border bg-background hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        title={t("goals.table.edit")}
        aria-label={t("goals.table.edit")}
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function NewLink({ entity, children }: { entity: "theme"; children: React.ReactNode }) {
  const sp = useSearchParams();
  return (
    <Link
      href={goalHref(sp, { entity, new: "1", id: null, parent: null }) as never}
      scroll={false}
      className="inline-flex items-center gap-1 rounded-md border border-dashed bg-card px-2.5 py-1 text-meta font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      <Plus className="h-3 w-3" aria-hidden />
      {children}
    </Link>
  );
}

// ── Status + Progress + €-Trio ───────────────────────────────────────

/** Compact relative time ("vor 3 Tagen") for the last check-in. */
function relativeGoalTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diffMs / 86_400_000);
  if (day <= 0) return "heute";
  if (day === 1) return "gestern";
  if (day < 30) return `vor ${day} Tagen`;
  const mon = Math.floor(day / 30);
  return `vor ${mon} Monat${mon === 1 ? "" : "en"}`;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            value >= 0.7
              ? "from-emerald-600 to-emerald-400"
              : value >= 0.3
                ? "from-amber-600 to-amber-400"
                : "from-rose-600 to-rose-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-meta tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

/** €-Ratio einzeilig realized/planned; Details im Tooltip. */
function TrioBadge({ trio }: { trio: RollupTrio }) {
  if (trio.planned === 0 && trio.realized === 0) {
    return <span className="text-meta text-muted-foreground/50">—</span>;
  }
  return (
    <span
      className="whitespace-nowrap font-mono text-meta tabular-nums"
      title={`Planned €${eur(trio.planned)} · Realized €${eur(trio.realized)} · Run-Rate €${eur(trio.runRate)}`}
    >
      €{compact(trio.realized)}
      <span className="text-muted-foreground"> / €{compact(trio.planned)}</span>
    </span>
  );
}

function eur(n: number): string {
  return Math.round(n).toLocaleString("de-DE");
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-1.5 text-left font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-1.5 align-middle", className)}>{children}</td>;
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card",
        className,
      )}
    >
      {children}
    </button>
  );
}
