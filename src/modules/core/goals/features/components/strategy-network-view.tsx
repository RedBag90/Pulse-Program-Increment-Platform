"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ReactFlow,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ViewportPortal,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import { keyResultProgress, type RollupTrio } from "@/modules/core/goals/domain/goals-rollup";
import { goalStatusColor, goalStatusKey } from "@/modules/core/goals/domain/goal-status";
import type { ConfidenceValue } from "@/modules/core/goals/domain/goal-confidence";
import { formatMetricValue, type MetricSpec } from "@/modules/core/goals/domain/goal-metric";
import { goalTimeframeLabel } from "@/modules/core/goals/domain/goal-period";
import type { Locale } from "@/i18n/routing";
import {
  filterGoalBranches,
  collectNodeIdsWithChildren,
} from "@/modules/core/goals/domain/goal-tree-filter";
import {
  goalLineage,
  radialLayout,
  radialRoot,
  RING_ABSTAND,
} from "@/modules/core/goals/domain/radial-layout";
import { tapAction } from "@/modules/core/kernel/domain/tap-focus";
import {
  goalNodeConfidence,
  isConfidenceGoal,
  goalNodeTimeframe,
  goalNodeTimeframeShort,
  isGoalDrifting,
  isGoalOffTrack,
} from "@/modules/core/goals/features/lib/goal-node-view";
import { cn } from "@/lib/utils";
import { goalBranchColor } from "@/modules/core/goals/features/lib/goal-accent";
import { goalCreateHref, goalDetailHref } from "@/modules/core/goals/features/lib/goal-href";
import { ConfidenceHand } from "@/modules/core/goals/features/components/confidence-hand";
import { GoalStatusPill } from "@/modules/core/goals/features/components/goal-status/goal-status-pill";

/**
 * **Die Ziele als Rad.** In der Mitte die Strategie des Mandanten, im ersten
 * Ring die Oberziele, weiter außen ihre Unterziele. Gibt es nur ein
 * Oberziel, steht es selbst in der Mitte (`radialRoot`). Wer Ziele pflegen
 * darf, findet an jedem Ziel ein kleines „+" für ein weiteres Unterziel, an
 * der Mitte eines für ein neues Oberziel. Es ist bewusst kein eigener Knoten
 * im Layout: es hängt am Ziel wie das ± und kostet keinen Platz im Rad.
 *
 * **Farbe sparsam.** Die Kreise sind hell; die gedämpfte Astfarbe zeigt sich
 * nur am Rand und an der Kante. Die Aussage tragen der Ring in Statusfarbe
 * und die Status-Pill darunter. Confidence-Ziele tragen statt der Zahl die
 * Hand.
 *
 * **Hervorheben.** Mit der Maus hebt das Überfahren den Baum eines Ziels
 * hervor (Vorfahren, Ziel, Nachfahren), ein Klick öffnet es. Auf Touch hebt
 * das erste Tippen hervor, das zweite öffnet (`tapAction`).
 *
 * Die Positionen rechnet `radial-layout.ts`; xyflow bleibt für Pan, Zoom,
 * Pinch, Controls und Mini-Map. Schreibgeschützt: nichts ist ziehbar oder
 * verbindbar.
 */
interface Props {
  themes: GoalNode[];
  /** Name des Mandanten für die Mitte. */
  tenantName?: string;
  /** Privater Bereich: die Mitte heisst nur „Mein Bereich". */
  personal?: boolean;
  /** Darf Ziele anlegen (`target.manage`) → „+" an jedem Ziel. */
  canEdit?: boolean;
}

interface GoalData extends Record<string, unknown> {
  goalId: string;
  title: string;
  status: string | null;
  progress: number;
  confidence: ConfidenceValue | null;
  /** Confidence-Ziel — auch ohne Vote nie als Prozent zeigen. */
  isConfidence: boolean;
  /** Ist- und Zielwert in der Metrik des Ziels; formatiert wird im Knoten. */
  current: number | null;
  target: number | null;
  /** Zeitraum-Label (Quartal, Halbjahr, Jahr oder Start–Ende); `null` = keiner. */
  timeframe: string | null;
  /** Voller Zeitraum für den Tooltip (mit Tagen). */
  timeframeFull: string | null;
  spec: MetricSpec;
  color: string;
  /** 0 = Ziel in der Mitte, 1 = erster Ring … */
  depth: number;
  atRisk: boolean;
  hasChildren: boolean;
  descendantCount: number;
  collapsed: boolean;
  dimmed?: boolean;
  onToggle: (goalId: string) => void;
  onOpen: (goalId: string) => void;
  /** Unterziel anlegen; nur gesetzt, wenn das „+" sichtbar sein soll. */
  onAdd?: (goalId: string) => void;
}

interface CenterData extends Record<string, unknown> {
  tenantName: string;
  personal?: boolean;
  /** Oberziel anlegen; nur gesetzt, wenn das „+" sichtbar sein soll. */
  onAddTop?: () => void;
}

interface SpokeData extends Record<string, unknown> {
  cx: number;
  cy: number;
  color: string;
  emphasis?: "hi" | "dim";
}

const CENTER_ID = "strategie";
const CENTER_D = 96;
/** Breite der Knotenfläche — genug für Status- und Zeitraum-Badge nebeneinander. */
const NODE_W = 190;
/** Platz unter dem Kreis für Name und Status-Pill. */
const LABEL_H = 96;
/** Kreisdurchmesser: Mitte groß, Oberziele mittel, Unterziele klein. */
const circleSize = (depth: number) => (depth === 0 ? CENTER_D : depth === 1 ? 64 : 52);
/** Neutrale Farbe der Mitte in der Mini-Map. */
const MINIMAP_CENTER = "#475569";

export function StrategyNetworkView({
  themes,
  tenantName = "",
  personal = false,
  canEdit = false,
}: Props) {
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [offTrackOnly, setOffTrackOnly] = useState(false);
  /** Hervorgehobenes Ziel: per Überfahren (Maus) oder erstem Tippen (Touch). */
  const [focusId, setFocusId] = useState<string | null>(null);
  // Der letzte Zeiger: Nach einem Tippen feuert der Browser nachgeahmte
  // Maus-Ereignisse — ihr „Überfahren" darf die Hervorhebung nicht setzen,
  // sonst öffnete schon das erste Tippen.
  const letzterZeiger = useRef<string>("mouse");

  const onToggle = useCallback((goalId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }, []);

  // Deep-Link erhält die aktiven Filter/Layout-Params: Schließen des Drawers
  // führt zurück ins Rad.
  const onOpen = useCallback(
    (goalId: string) => router.push(goalDetailHref(sp, goalId) as never, { scroll: false }),
    [router, sp],
  );

  const collapseAll = useCallback(
    () => setCollapsed(new Set(collectNodeIdsWithChildren(themes))),
    [themes],
  );
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const visibleThemes = useMemo(
    () => (offTrackOnly ? filterGoalBranches(themes, isGoalOffTrack) : themes),
    [themes, offTrackOnly],
  );
  // „Nur off-track" zeigt nur Auffälliges — dort gibt es kein „+".
  const showAdd = canEdit && !offTrackOnly;
  const onAdd = useCallback(
    (parentId?: string) => router.push(goalCreateHref(sp, parentId) as never, { scroll: false }),
    [router, sp],
  );
  const graph = useMemo(
    () =>
      buildGraph(
        visibleThemes,
        collapsed,
        onToggle,
        onOpen,
        { tenantName, personal },
        showAdd ? onAdd : null,
        locale,
      ),
    [visibleThemes, collapsed, onToggle, onOpen, tenantName, personal, showAdd, onAdd, locale],
  );

  // Nur die Markierung hängt an der Hervorhebung — das Layout rechnet nicht neu.
  const { nodes, edges } = useMemo(() => {
    const linie = focusId ? goalLineage(graph.lineage, focusId) : null;
    if (!linie || linie.size === 0) return graph;
    return {
      nodes: graph.nodes.map((n) =>
        n.type === "goal" ? { ...n, data: { ...n.data, dimmed: !linie.has(n.id) } } : n,
      ),
      edges: graph.edges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          emphasis:
            linie.has(e.target) && (e.source === CENTER_ID || linie.has(e.source)) ? "hi" : "dim",
        },
      })),
    };
  }, [graph, focusId]);

  if (themes.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
        {t("goals.table.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffTrackOnly((v) => !v)}
          aria-pressed={offTrackOnly}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-meta font-medium transition-colors",
            offTrackOnly
              ? "border-amber-300 bg-warning-surface text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {t("goals.shared.onlyOffTrack")}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border bg-background px-2.5 py-1 text-meta font-medium text-muted-foreground hover:bg-muted"
          >
            {t("goals.table.collapseAll")}
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border bg-background px-2.5 py-1 text-meta font-medium text-muted-foreground hover:bg-muted"
          >
            {t("goals.table.expandAll")}
          </button>
        </div>
      </div>
      {offTrackOnly && visibleThemes.length === 0 && (
        <p className="text-meta text-muted-foreground">{t("goals.shared.noOffTrack")}</p>
      )}
      <div
        className="h-[720px] overflow-hidden rounded-lg bg-card shadow-card"
        role="figure"
        aria-label={t("goals.network.label")}
        onPointerDownCapture={(e) => {
          letzterZeiger.current = e.pointerType;
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          // Nie über 100 % einpassen: ein einzelnes Ziel füllte sonst die Fläche.
          fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
          // React Flow bringt eigene, helle Farben mit (`dist/style.css`);
          // ohne `colorMode` verschwindet die Navigation im dunklen Modus.
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // Ohne Klick-Handler setzt xyflow auf nicht ziehbare, nicht wählbare
          // Knoten `pointer-events: none` — dann kämen weder Öffnen noch ±
          // an. Der Handler hält sie klickbar.
          onNodeClick={(_e, n) => {
            if (n.type !== "goal") return;
            if (tapAction(letzterZeiger.current === "touch", focusId, n.id) === "focus") {
              setFocusId(n.id);
              return;
            }
            onOpen(n.id);
          }}
          onNodeMouseEnter={(_e, n) => {
            if (letzterZeiger.current === "touch") return;
            setFocusId(n.type === "goal" ? n.id : null);
          }}
          onNodeMouseLeave={() => {
            if (letzterZeiger.current !== "touch") setFocusId(null);
          }}
          // Tippen auf die leere Fläche hebt die Hervorhebung auf.
          onPaneClick={() => setFocusId(null)}
          minZoom={0.1}
          maxZoom={1.6}
        >
          <ViewportPortal>
            <Rings radii={graph.ringRadii} />
          </ViewportPortal>
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            className="!bg-card"
            nodeColor={(n) => (n.type === "goal" ? (n.data as GoalData).color : MINIMAP_CENTER)}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * Die Ringe je Ebene. `z-index: -1` legt sie im Viewport unter Kanten und
 * Knoten; die Portal-Ebene liegt sonst obenauf. Jede Scheibe ist halb
 * durchsichtig — übereinander werden sie zur Mitte hin dunkler.
 */
function Rings({ radii }: { radii: number[] }) {
  if (radii.length === 0) return null;
  const aussen = radii[radii.length - 1]! + RING_ABSTAND / 2;
  const scheiben = [...radii.map((r) => r + RING_ABSTAND / 2), CENTER_D / 2 + 24].sort(
    (a, b) => b - a,
  );
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: -aussen, top: -aussen, zIndex: -1 }}
      width={aussen * 2}
      height={aussen * 2}
      viewBox={`${-aussen} ${-aussen} ${aussen * 2} ${aussen * 2}`}
    >
      {scheiben.map((r) => (
        <circle key={r} cx={0} cy={0} r={r} className="fill-muted" fillOpacity={0.45} />
      ))}
      {radii.map((r) => (
        <circle
          key={`bahn-${r}`}
          cx={0}
          cy={0}
          r={r}
          fill="none"
          className="stroke-border"
          strokeDasharray="3 6"
        />
      ))}
    </svg>
  );
}

const NODE_TYPES = { goal: GoalCircle, center: CenterNode };

/**
 * Das „+" am Kreis (rechts unten): legt ein Ziel darunter an. Bewusst anders
 * als das Ein-/Ausklappen (links oben, Quadrat mit Chevrons): ein Kreis mit
 * gestricheltem Rand — „hier kann etwas hin". Es stoppt die Weitergabe, damit
 * der Klick nicht zugleich das Ziel öffnet; eine Touch-Vorstufe gibt es nicht.
 */
function AddButton({ label, size, onClick }: { label: string; size: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="nopan pointer-events-auto absolute grid size-5 place-items-center rounded-full border border-dashed border-muted-foreground/60 bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 after:absolute after:-inset-2 after:content-['']"
      style={{ left: `calc(50% + ${size / 2 - 8}px)`, top: size - 16 }}
    >
      <Plus className="size-3" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
const EDGE_TYPES = { spoke: Spoke };

/** Unsichtbare Anfasser in der Kreismitte: Kanten laufen von Mitte zu Mitte. */
function CenterHandles({ top }: { top: number }) {
  const style = {
    left: "50%",
    top,
    width: 1,
    height: 1,
    minWidth: 0,
    minHeight: 0,
    border: 0,
    opacity: 0,
    transform: "translate(-50%, -50%)",
  } as const;
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={style} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={style} />
    </>
  );
}

function CenterNode({ data }: NodeProps) {
  const t = useTranslations();
  const d = data as CenterData;
  return (
    <div
      className="grid size-full place-items-center rounded-full bg-foreground p-2 text-center text-background shadow-md"
      title={d.personal ? t("goals.network.personalCenter") : d.tenantName}
    >
      {/* Im privaten Bereich nur „Mein Bereich": „Strategie" über dem eigenen
          Namen „Mein Bereich (vorname.nachname)" wäre doppelt gemoppelt. */}
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">
          {d.personal ? t("goals.network.personalCenter") : t("goals.network.center")}
        </div>
        {!d.personal && d.tenantName && (
          <div className="mt-0.5 line-clamp-2 text-label leading-tight opacity-75">
            {d.tenantName}
          </div>
        )}
      </div>
      {d.onAddTop && (
        <AddButton label={t("goals.network.addTop")} size={CENTER_D} onClick={d.onAddTop} />
      )}
      <CenterHandles top={CENTER_D / 2} />
    </div>
  );
}

function GoalCircle({ data }: NodeProps) {
  const t = useTranslations();
  const d = data as GoalData;

  const size = circleSize(d.depth);
  const ring = 3;
  const r = size / 2 - ring / 2;
  const umfang = 2 * Math.PI * r;
  const locale = useLocale() as Locale;
  const pct = Math.round(d.progress * 100);
  // Ist / Ziel mit Einheit — nur wo das Ziel eine eigene Metrik hat. Bei
  // Confidence-Zielen sagt es die Hand schon.
  // Ohne Ist-Wert (etwa ein Ziel, das nur zusammenfasst) steht nur das Ziel —
  // ein „— / 1.665.000 €" läse sich wie ein fehlender Eintrag. Dieselbe Quelle
  // wie der Drawer: `current`, keine eigene Hochrechnung.
  const werte = d.isConfidence
    ? d.confidence
      ? null
      : t("goals.confidence.noVote")
    : d.target == null
      ? null
      : d.current == null
        ? t("goals.network.targetOnly", { value: formatMetricValue(d.target, d.spec, locale) })
        : `${formatMetricValue(d.current, d.spec, locale)} / ${formatMetricValue(d.target, d.spec, locale)}`;

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full flex-col items-center transition-opacity duration-150",
        d.dimmed && "opacity-30",
      )}
    >
      {/* Klick öffnet über `onNodeClick` am Flow; hier nur die Tastatur.
          Ein-/Ausklappen und „+" sind eigene Knöpfe und stoppen die
          Weitergabe. */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            d.onOpen(d.goalId);
          }
        }}
        title={`${d.title} · ${d.isConfidence ? `${d.confidence ?? "–"}/5` : `${pct} %`} · ${t(goalStatusKey(d.status))}`}
        className="group flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="relative block" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="absolute inset-0" aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              className="stroke-muted"
              strokeWidth={ring}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={goalStatusColor(d.status)}
              strokeWidth={ring}
              strokeLinecap="round"
              strokeDasharray={umfang}
              strokeDashoffset={umfang * (1 - Math.max(0, Math.min(1, d.progress)))}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
          <span
            className="absolute grid place-items-center rounded-full border-[1.5px] border-solid bg-card text-foreground shadow-xs transition-transform group-hover:scale-105"
            style={{ inset: ring + 2, borderColor: d.color }}
          >
            {d.confidence ? (
              <ConfidenceHand value={d.confidence} size={size * 0.46} />
            ) : d.isConfidence ? (
              // Confidence-Ziel ohne Vote: keine Prozentzahl, sondern „–/5".
              <span
                className={cn(
                  "font-semibold tabular-nums text-muted-foreground",
                  d.depth === 0 ? "text-base" : "text-xs",
                )}
              >
                –<span className="text-label font-medium">/5</span>
              </span>
            ) : (
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  d.depth === 0 ? "text-base" : "text-xs",
                )}
              >
                {pct}
                <span className="ml-px text-label font-medium text-muted-foreground">
                  {locale === "en" ? "%" : "\u202F%"}
                </span>
              </span>
            )}
          </span>
        </span>
        <span
          className={cn(
            "line-clamp-2 max-w-full rounded-md border bg-background/90 px-1.5 py-0.5 text-center text-label leading-tight text-foreground",
            d.depth <= 1 && "font-semibold",
          )}
        >
          {d.title}
        </span>
        {werte && (
          <span
            className="max-w-full truncate text-label tabular-nums leading-tight text-muted-foreground"
            title={werte}
          >
            {werte}
          </span>
        )}
        {/* Nie breiter als der Knoten: passen Status und Zeitraum nicht
            nebeneinander, bricht der Zeitraum in die nächste Zeile um. */}
        <span className="flex max-w-full origin-top scale-90 flex-wrap items-center justify-center gap-1">
          <GoalStatusPill status={d.status} />
          {d.timeframe && (
            <span
              className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              title={d.timeframeFull ?? d.timeframe}
            >
              <CalendarDays className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{d.timeframe}</span>
            </span>
          )}
        </span>
      </div>
      {d.hasChildren && (
        <button
          type="button"
          aria-label={
            d.collapsed ? t("goals.network.expandBranch") : t("goals.network.collapseBranch")
          }
          aria-expanded={!d.collapsed}
          onClick={(e) => {
            e.stopPropagation();
            d.onToggle(d.goalId);
          }}
          className="nopan absolute grid size-5 place-items-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground after:absolute after:-inset-2 after:content-['']"
          style={{ right: `calc(50% + ${size / 2 - 8}px)`, top: -4 }}
        >
          {d.collapsed ? (
            <ChevronsUpDown className="size-3" aria-hidden />
          ) : (
            <ChevronsDownUp className="size-3" aria-hidden />
          )}
        </button>
      )}
      {d.collapsed && d.descendantCount > 0 && (
        <span
          className="absolute rounded-full bg-primary/15 px-1 text-label font-semibold text-primary"
          style={{ left: `calc(50% + ${size / 2 - 4}px)`, top: -2 }}
          title={t("goals.network.hiddenCount", { count: d.descendantCount })}
        >
          +{d.descendantCount}
        </span>
      )}
      {d.atRisk && !d.collapsed && (
        <span
          className="absolute rounded-full bg-warning-surface px-1 text-label font-semibold text-warning"
          style={{ left: `calc(50% + ${size / 2 - 4}px)`, top: -2 }}
          title={t("goals.shared.runRateBelowPlan")}
        >
          ⚠
        </span>
      )}
      {d.onAdd && (
        <AddButton
          label={t("goals.network.addChild", { title: d.title })}
          size={size}
          onClick={() => d.onAdd!(d.goalId)}
        />
      )}
      <CenterHandles top={size / 2} />
    </div>
  );
}

/** Speiche: sanfte Kurve von der Eltern- zur Kindmitte in gedämpfter Astfarbe. */
function Spoke({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = data as SpokeData;
  const hi = d.emphasis === "hi";
  return (
    <BaseEdge
      id={id}
      path={`M ${sourceX} ${sourceY} Q ${d.cx} ${d.cy} ${targetX} ${targetY}`}
      style={{
        stroke: d.color,
        strokeOpacity: hi ? 0.9 : d.emphasis === "dim" ? 0.12 : 0.45,
        strokeWidth: hi ? 2.5 : 1.5,
        transition: "stroke-opacity 150ms",
      }}
    />
  );
}

function buildGraph(
  themes: GoalNode[],
  collapsed: Set<string>,
  onToggle: (goalId: string) => void,
  onOpen: (goalId: string) => void,
  mitte: { tenantName: string; personal: boolean },
  /** „+" anlegen; `null` = ausgeblendet. Ohne Eltern-Id: neues Oberziel. */
  onAdd: ((parentId?: string) => void) | null,
  locale: string,
): {
  nodes: Node[];
  edges: Edge[];
  ringRadii: number[];
  /** Eltern-Beziehungen aller sichtbaren Ziele für `goalLineage`. */
  lineage: { id: string; parentId: string | null }[];
} {
  const { center, rings } = radialRoot(themes, collapsed);
  const layout = radialLayout(rings, collapsed);
  const byId = new Map<string, GoalNode>();
  const merke = (n: GoalNode) => {
    byId.set(n.id, n);
    n.children.forEach(merke);
  };
  themes.forEach(merke);

  const goalData = (n: GoalNode, depth: number, color: string): GoalData => ({
    goalId: n.id,
    title: n.title,
    status: n.status,
    // Container ohne aufgelösten Fortschritt fallen auf die €-Trio-Quote
    // zurück (netzplan-spezifisch); ein messbares Blatt nutzt keyResultProgress.
    progress: n.progress ?? (isMeasuredLeaf(n) ? keyResultProgress(n) : trioProgress(n.trio)),
    confidence: goalNodeConfidence(n),
    isConfidence: isConfidenceGoal(n),
    current: n.current,
    // Kurzform im Badge (sprachabhängig), die Tage stehen im Tooltip.
    timeframe: goalNodeTimeframeShort(n, locale),
    timeframeFull: (() => {
      const tf = goalNodeTimeframe(n);
      return tf ? goalTimeframeLabel(tf) : null;
    })(),
    target: n.target,
    spec: {
      metricType: n.metricType,
      precision: n.precision,
      currencyCode: n.currencyCode,
      metricUnit: n.metricUnit,
    },
    color,
    depth,
    atRisk: isGoalDrifting(n),
    hasChildren: n.children.length > 0,
    descendantCount: descendantCount(n),
    collapsed: collapsed.has(n.id),
    onToggle,
    onOpen,
    ...(onAdd ? { onAdd: (id: string) => onAdd(id) } : {}),
  });

  const rootId = center?.id ?? CENTER_ID;
  const nodes: Node[] = [];
  const lineage: { id: string; parentId: string | null }[] = [];
  if (center) {
    // Ein einziges Oberziel steht selbst in der Mitte.
    nodes.push({
      id: center.id,
      type: "goal",
      position: { x: -NODE_W / 2, y: -CENTER_D / 2 },
      data: goalData(center, 0, MINIMAP_CENTER),
      width: NODE_W,
      height: CENTER_D + LABEL_H,
      draggable: false,
      selectable: false,
    });
    lineage.push({ id: center.id, parentId: null });
  } else {
    nodes.push({
      id: CENTER_ID,
      type: "center",
      position: { x: -CENTER_D / 2, y: -CENTER_D / 2 },
      data: {
        ...mitte,
        ...(onAdd ? { onAddTop: () => onAdd() } : {}),
      } satisfies CenterData,
      width: CENTER_D,
      height: CENTER_D,
      draggable: false,
      selectable: false,
    });
  }

  const edges: Edge[] = [];
  const radius = (depth: number) => (depth <= 0 ? 0 : (layout.ringRadii[depth - 1] ?? 0));

  for (const p of layout.nodes) {
    const color = goalBranchColor(p.branch);
    const rp = radius(p.depth - 1);
    const n = byId.get(p.id)!;
    const size = circleSize(p.depth);
    const parentId = p.parentId ?? rootId;
    nodes.push({
      id: n.id,
      type: "goal",
      position: { x: p.x - NODE_W / 2, y: p.y - size / 2 },
      data: goalData(n, p.depth, color),
      width: NODE_W,
      height: size + LABEL_H,
      draggable: false,
      selectable: false,
    });
    lineage.push({ id: n.id, parentId: p.parentId ?? (center ? center.id : null) });
    // Kontrollpunkt auf dem Ring des Elternteils, im Winkel des Kinds: die
    // Speiche verlässt den Elternteil geradeaus nach außen und biegt dann ab.
    edges.push({
      id: `${parentId}__${n.id}`,
      source: parentId,
      target: n.id,
      type: "spoke",
      data: {
        cx: rp * Math.cos(p.angle),
        cy: rp * Math.sin(p.angle),
        color,
      } satisfies SpokeData,
    });
  }

  return { nodes, edges, ringRadii: layout.ringRadii, lineage };
}

/**
 * Messbares Blatt mit eigener Metrik; aggregierende Knoten (rollup,
 * kpi_tree-Ast) sind Container.
 */
function isMeasuredLeaf(n: GoalNode): boolean {
  return (
    n.isMeasurable &&
    n.progressMode !== "rollup" &&
    !(n.progressMode === "kpi_tree" && n.children.length > 0)
  );
}

/** Gesamtzahl der Nachfahren eines Knotens (für das „+N"-Collapse-Badge). */
function descendantCount(n: GoalNode): number {
  return n.children.reduce((sum, c) => sum + 1 + descendantCount(c), 0);
}

/** Netzplan-spezifischer Container-Fallback: €-Trio-Quote (realized/planned). */
function trioProgress(trio: RollupTrio): number {
  if (trio.planned <= 0) return 0;
  return Math.max(0, Math.min(1, trio.realized / trio.planned));
}
