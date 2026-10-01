"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
  memo,
} from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
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
  GripVertical,
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
  goalNodeConfidence,
  goalNodeConfidenceLabel,
  isConfidenceGoal,
  goalNodeOwner,
  goalNodeTimeframeLabel,
  goalInitials,
  isGoalDrifting,
  isGoalOffTrack,
} from "@/modules/core/goals/features/lib/goal-node-view";
import { reparentGoalNodeAction } from "@/modules/core/goals/features/actions/ziele";
import { getGoalSparklinesAction } from "@/modules/core/goals/features/actions/goal-detail";
import type { ProgressChart } from "@/modules/core/goals/server/views/ziele-view";
import { GoalSparkline } from "@/modules/core/goals/features/components/goal-sparkline";
import {
  dropPlacement,
  planDrop,
  type DropPlacement,
} from "@/modules/core/goals/domain/goal-reparent";
import { HEAD_GOAL_ACCENT } from "@/modules/core/goals/features/lib/goal-accent";
import { GoalStatusPill } from "@/modules/core/goals/features/components/goal-status/goal-status-pill";
import { ConfidenceHand } from "@/modules/core/goals/features/components/confidence-hand";
import { CONFIDENCE_KEYS } from "@/modules/core/goals/domain/goal-confidence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";

type Placement = DropPlacement;

/**
 * Verläufe je Ziel für die Mini-Linien — nachgeladen (`getGoalSparklinesAction`).
 * Als Context statt Prop, damit die memoisierten Zeilen ihre Props behalten
 * und nur einmal neu rendern, wenn die Daten da sind.
 */
const SparkContext = createContext<Record<string, ProgressChart> | null>(null);

/** Id der Ablage „auf oberste Ebene" (keine Zeile). */
const TOP_DROP = "__oberste-ebene__";

/**
 * Drag-Kontext — nur, was jede Zeile braucht und selten wechselt. Der häufig
 * wechselnde Over-Zustand (`overId`/`overPlacement`) wird bewusst NICHT hier
 * geführt, sondern als Per-Zeilen-Primitive gereicht, damit ein Hover nur die
 * betroffenen (memoisierten) Zeilen neu rendert, nicht den ganzen Baum.
 */
interface DragCtx {
  canEdit: boolean;
}

/**
 * Senkrechte Zeigerposition während des Ziehens: Startpunkt (Maus oder
 * Finger) plus zurückgelegter Weg.
 */
function pointerY(e: DragMoveEvent | DragEndEvent): number | null {
  const a = e.activatorEvent as MouseEvent | TouchEvent | null;
  if (!a) return null;
  const start = "touches" in a ? a.touches[0]?.clientY : (a as MouseEvent).clientY;
  return start == null ? null : start + e.delta.y;
}

/** Collapse-Kontext für den ein-/ausklappbaren Baum. */
interface TreeCtx {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  userLabels: Record<string, string>;
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
  const [over, setOver] = useState<{ id: string; placement: Placement } | null>(null);
  const overRef = useRef(over);
  overRef.current = over;
  const [activeId, setActiveId] = useState<string | null>(null);
  const dndId = useId();
  const sensors = useSensors(
    // Maus ab 5 px Weg; Finger nach 250 ms Halten (8 px Toleranz) — ein Wischen
    // scrollt weiter, ein Tippen bleibt ein Tippen.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  // Auf-/Zuklapp-Zustand überlebt einen Reload (Geräte-Ansichtspräferenz).
  const [collapsedIds, setCollapsedIds] = useLocalStorageState<string[]>("ziele:collapsed", []);
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const [offTrackOnly, setOffTrackOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  // Mini-Verläufe nach dem ersten Rendern holen; bis dahin bleibt der Balken.
  // `themes` wechselt nach jeder Änderung (Revalidate) — dann neu holen.
  const [sparks, setSparks] = useState<Record<string, ProgressChart> | null>(null);
  useEffect(() => {
    let live = true;
    getGoalSparklinesAction()
      .then((r) => {
        if (live && r) setSparks(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [themes]);

  /**
   * Loslassen: aus Quelle, Ziel und Platzierung die Server-Anfrage bauen
   * (`planDrop`) und abschicken. Scheitert sie, sagt ein Toast warum — vorher
   * sprang die Zeile kommentarlos zurück.
   */
  const commitDrop = useCallback(
    (srcId: string, targetId: string | null, placement: Placement) => {
      const plan = planDrop(themes, srcId, targetId, placement);
      if (!plan) return;
      const fd = new FormData();
      fd.set("id", srcId);
      fd.set("newParentId", plan.newParentId ?? "");
      fd.set("beforeId", plan.beforeId ?? "");
      startTransition(async () => {
        const res = await reparentGoalNodeAction({}, fd);
        if (res.error) toast.error(res.error);
      });
    },
    [themes],
  );

  const onDragMove = useCallback(
    (e: DragMoveEvent) => {
      const o = e.over;
      if (!o) return setOver(null);
      const id = String(o.id);
      if (id === TOP_DROP) return setOver({ id, placement: "inside" });
      const y = pointerY(e);
      const rel = y == null ? 0.5 : (y - o.rect.top) / o.rect.height;
      const placement = dropPlacement(rel, reorderable);
      // Ungültige Ziele (eigener Teilbaum) gar nicht erst markieren.
      if (!planDrop(themes, String(e.active.id), id, placement)) return setOver(null);
      setOver((prev) =>
        prev?.id === id && prev.placement === placement ? prev : { id, placement },
      );
    },
    [themes, reorderable],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const last = overRef.current;
      setActiveId(null);
      setOver(null);
      if (!last || !e.over) return;
      commitDrop(String(e.active.id), last.id === TOP_DROP ? null : last.id, last.placement);
    },
    [commitDrop],
  );

  const drag: DragCtx = useMemo(() => ({ canEdit }), [canEdit]);
  const activeNode = useMemo(
    () => (activeId ? findGoal(themes, activeId) : null),
    [themes, activeId],
  );

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
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e) => {
          setActiveId(String(e.active.id));
          // Ein kurzer Ruck, wo das Gerät es kann: die Zeile ist aufgenommen.
          if (typeof navigator !== "undefined") navigator.vibrate?.(10);
        }}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOver(null);
        }}
      >
        {canEdit && (
          <TopDropZone active={over?.id === TOP_DROP} label={t("goals.table.dropToTopLevel")} />
        )}
        <div
          data-tour="goals-table"
          className="overflow-x-auto rounded-lg bg-card shadow-card shadow-sm"
        >
          {/* Festes Spaltenlayout: die Namensspalte bekommt den Rest und kürzt
              lange Titel, statt die Tabelle zu verbreitern. Unterhalb von 56rem
              scrollt der Container waagrecht. */}
          <table className="w-full min-w-4xl table-fixed text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <Th>{t("goals.table.name")}</Th>
                <Th className="w-14">{t("goals.table.owner")}</Th>
                <Th className="w-44">{t("goals.table.status")}</Th>
                <Th className="w-44">{t("goals.table.progress")}</Th>
                <Th className="w-32">{t("goals.table.value")}</Th>
                <Th className="w-28">{t("goals.table.timeframe")}</Th>
                {canEdit && (
                  <Th className="sticky right-0 z-30 w-24 border-l bg-muted/95">
                    {t("goals.table.actions")}
                  </Th>
                )}
              </tr>
            </thead>
            <SparkContext.Provider value={sparks}>
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
            </SparkContext.Provider>
          </table>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeNode ? (
            <div className="flex w-max max-w-md translate-x-6 translate-y-5 cursor-grabbing items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-lg">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{activeNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** Ablage „auf oberste Ebene" über der Tabelle. */
function TopDropZone({ active, label }: { active: boolean; label: string }) {
  const { setNodeRef } = useDroppable({ id: TOP_DROP });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-dashed px-3 py-1.5 text-center text-meta text-muted-foreground transition-colors",
        active && "border-primary bg-primary/10 text-foreground",
      )}
    >
      {label}
    </div>
  );
}

/** Knoten per Id im Baum finden (für die Zeile am Finger). */
function findGoal(nodes: GoalNode[], id: string): GoalNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findGoal(n.children, id);
    if (hit) return hit;
  }
  return null;
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
  rails = "",
  isLast = true,
}: {
  node: GoalNode;
  depth: number;
  canEdit: boolean;
  drag: DragCtx;
  tree: TreeCtx;
  sp: ReturnType<typeof useSearchParams>;
  overId: string | null;
  overPlacement: Placement | null;
  /** Je Vorfahren-Ebene „1", wenn dort der Stamm weiterläuft (siehe TreeLines). */
  rails?: string;
  /** Letztes Kind seines Elternziels (└ statt ├). */
  isLast?: boolean;
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
        rails={rails}
        isLast={isLast}
      />
      {hasChildren &&
        !isCollapsed &&
        node.children.map((child, i) => (
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
            // Der Stamm dieses Knotens läuft weiter, solange er nicht das letzte
            // Kind ist; Oberziele haben keinen eigenen Stamm.
            rails={depth === 0 ? "" : rails + (isLast ? "0" : "1")}
            isLast={i === node.children.length - 1}
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
  rails: string;
  isLast: boolean;
}

/**
 * **Einfügelinie beim Ziehen** — zwischen zwei Zielen, an der Ober- oder
 * Unterkante der Zielzeile. Ein eigenes Element statt `box-shadow` auf der
 * Zeile: Safari zeichnet auf <tr> keinen Schatten, die Linie war dort
 * unsichtbar.
 *
 * Sie hängt an der Namenszelle (`relative`) und beginnt waagrecht an ihrer
 * Fluss-Position — nach der Einrückung, also auf der Ebene, auf der das Ziel
 * landet. Nach rechts läuft sie über die Zeile; der Tabellen-Container
 * schneidet sie am Rand ab.
 */
function DropLine({ at }: { at: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-20 h-0.5 rounded-full bg-primary"
      style={{ [at]: -1, width: 4000 }}
    >
      <span className="absolute -left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
    </span>
  );
}

/** Breite einer Baum-Ebene — so breit wie der Auf-/Zuklapp-Pfeil. */
const TREE_STEP = 20;

/**
 * **Baum-Linien der Tabelle** wie ein Datei-Baum: je Vorfahren-Ebene ein
 * durchgehender Stamm, solange dort noch Geschwister folgen; der eigene
 * Abzweig ├ bzw. └ beim letzten Kind; und vom aufgeklappten Elternziel ein
 * Strich nach unten zum ersten Kind.
 *
 * Die Linien hängen an der **Tabellenzelle** (`relative`), nicht am Inhalt —
 * nur so reichen sie über die volle Zeilenhöhe, auch wenn eine andere Spalte
 * die Zeile höher macht, und laufen von Zeile zu Zeile durch. Waagrecht bleibt
 * der Container an seiner Fluss-Position (kein `left`), also direkt hinter dem
 * Griff.
 */
function TreeLines({
  depth,
  rails,
  isLast,
  expanded,
}: {
  depth: number;
  rails: string;
  isLast: boolean;
  expanded: boolean;
}) {
  const mitte = (ebene: number) => ebene * TREE_STEP + TREE_STEP / 2;
  const linie = "absolute w-px bg-border";
  return (
    <span className="pointer-events-none absolute inset-y-0" aria-hidden>
      {[...rails].map((r, k) =>
        r === "1" ? (
          <span key={k} className={cn(linie, "inset-y-0")} style={{ left: mitte(k) }} />
        ) : null,
      )}
      {depth > 0 && (
        <>
          <span
            className={cn(linie, isLast ? "top-0 h-1/2" : "inset-y-0")}
            style={{ left: mitte(depth - 1) }}
          />
          <span
            className="absolute top-1/2 h-px bg-border"
            style={{ left: mitte(depth - 1), width: TREE_STEP / 2 + 1 }}
          />
        </>
      )}
      {expanded && (
        <span
          className={cn(linie, "bottom-0")}
          style={{ left: mitte(depth), top: "calc(50% + 9px)" }}
        />
      )}
    </span>
  );
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
  rails,
  isLast,
}: RowProps) {
  const t = useTranslations();
  // Aus `node` abgeleitet statt als Prop durchgereicht: `Row` ist memoisiert und
  // hat den Knoten ohnehin.
  const confidence = goalNodeConfidence(node);
  const confidenceLabel = goalNodeConfidenceLabel(node);
  const placement = isOver ? overPlacement : null;
  const { setNodeRef: setDropRef } = useDroppable({ id: node.id, disabled: !drag.canEdit });
  const {
    setNodeRef: setDragRef,
    attributes: dragAttributes,
    listeners: dragListeners,
    isDragging,
  } = useDraggable({ id: node.id, disabled: !drag.canEdit });
  // Kopf-Ziele (Top-Level-Themes) tragen eine hellblaue Schiene links; beim Ziehen
  // zeigt eine blaue Linie oben/unten die Einfüge-Position (davor/danach).
  const isHead = depth === 0;
  const shadow: string[] = [];
  if (isHead) shadow.push(`inset 3px 0 0 0 ${HEAD_GOAL_ACCENT}`);
  return (
    <tr
      ref={setDropRef}
      className={cn(
        "group align-middle hover:bg-muted/40",
        // Unterordnen: die Zielzeile getönt. Hintergrund statt `outline` auf
        // <tr> — Safari zeichnet weder `outline` noch `box-shadow` auf Zeilen.
        placement === "inside" && "bg-primary/10 hover:bg-primary/10",
        isDragging && "opacity-40",
      )}
      style={shadow.length ? { boxShadow: shadow.join(", ") } : undefined}
    >
      <Td className="relative">
        <div className="flex min-w-0 items-center">
          {drag.canEdit && (
            // Griff: nur hier beginnt das Ziehen. Maus ab 5 px, Finger nach
            // 250 ms Halten — der Rest der Zeile bleibt Klick = Ziel öffnen.
            <button
              type="button"
              ref={setDragRef}
              {...dragAttributes}
              {...dragListeners}
              aria-label={t("goals.table.dragHandle", { title })}
              title={t("goals.table.dragHandle", { title })}
              className="-ml-1 mr-0.5 grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing [@media(pointer:coarse)]:size-9"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center self-stretch">
            <TreeLines
              depth={depth}
              rails={rails}
              isLast={isLast}
              expanded={hasChildren && !isCollapsed}
            />
            {depth > 0 && (
              <span className="shrink-0" style={{ width: depth * TREE_STEP }} aria-hidden />
            )}
            {(placement === "before" || placement === "after") && (
              <DropLine at={placement === "before" ? "top" : "bottom"} />
            )}
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
              <span className="truncate text-sm font-medium" title={title}>
                {title}
              </span>
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
        {/* Bei Zuversicht sagt die Hand mehr als ein Balken: eine 3 ist
            „mittlere Zuversicht", nicht „halb fertig". */}
        {confidence && confidenceLabel ? (
          <span className="flex items-center gap-2">
            <ConfidenceHand value={confidence} size={22} />
            <span className="shrink-0 text-xs font-semibold tabular-nums">
              {confidenceLabel.replace(/\s/g, "")}
            </span>
            <span className="truncate text-meta text-muted-foreground">
              {t(CONFIDENCE_KEYS[confidence])}
            </span>
          </span>
        ) : isConfidenceGoal(node) ? (
          // Confidence-Ziel ohne Vote: kein „0 %"-Balken, sondern „–/5".
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="shrink-0 text-xs font-semibold tabular-nums">–/5</span>
            <span className="truncate text-meta">{t("goals.confidence.noVote")}</span>
          </span>
        ) : (
          <ProgressCell nodeId={node.id} progress={progress} />
        )}
      </Td>
      <Td>
        <TrioBadge trio={trio} />
      </Td>
      <Td className="truncate text-xs text-muted-foreground">
        <span title={periodLabel}>{periodLabel}</span>
      </Td>
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
    // auf Geräten ohne Hover (Touch) immer — dort gäbe es sonst nichts, was sie
    // einblendet. Trefferflächen ≥32px für Maus/Touch/Tastatur.
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
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

/**
 * Fortschritt: die Mini-Linie, sobald der Verlauf geladen ist und es einen
 * gibt; sonst der Balken in derselben Breite (kein Sprung beim Nachladen).
 */
function ProgressCell({ nodeId, progress }: { nodeId: string; progress: number }) {
  const t = useTranslations();
  const sparks = useContext(SparkContext);
  const chart = sparks?.[nodeId];
  const pct = Math.round(progress * 100);
  if (!chart || chart.series.length === 0) return <ProgressBar value={progress} />;
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center">
        <GoalSparkline
          chart={chart}
          nowMs={Date.now()}
          label={t("goals.table.sparkLabel", { pct })}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-meta tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
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
