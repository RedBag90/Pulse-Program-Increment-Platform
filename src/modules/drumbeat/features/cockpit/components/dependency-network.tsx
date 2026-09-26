"use client";

import { useTranslations } from "next-intl";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type Connection,
  Controls,
  MiniMap,
  useNodesState,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import type {
  CockpitPiSlot,
  CockpitDependency,
  CockpitFeature,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { useDependencyEdgeEditing } from "@/modules/drumbeat/features/dependencies/hooks/use-dependency-edge-editing";
import { EDGE_LABEL } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import type { DependencyEdgeType } from "@/modules/drumbeat/features/dependencies/lib/dependency-actions-client";
import {
  DependencyEdge,
  ExportButton,
  NetworkEditingContext,
  NodeAddPlusButton,
  edgeVisual,
  type DependencyEdgeData,
  type NetworkEditing,
  type QuickAddInput,
} from "@/modules/drumbeat/features/cockpit/components/network-editing";
import { mergeOptimisticEdges } from "@/modules/drumbeat/features/cockpit/lib/optimistic-edges";
import {
  quickAddFeatureWithDependencyAction,
  insertFeatureBetweenAction,
} from "@/modules/work/features/portfolio/actions/breakdown-network";
import {
  FEATURE_TYPES,
  FEATURE_TYPE_KEYS,
  isFeatureType,
  type FeatureType,
} from "@/modules/work/domain/portfolio-guardrails";
import {
  FEATURE_TYPE_MINIMAP,
  normalizeFeatureType,
} from "@/modules/drumbeat/features/lib/feature-type-tokens";
import { Input } from "@/components/ui/input";
import {
  BracketTargetRow,
  EdgePathContext,
  HandleRow,
  useEdgePaths,
  useFocusDimming,
  useLiveHandles,
} from "@/modules/drumbeat/features/cockpit/components/network-shared";
import { assignHandles } from "@/modules/drumbeat/domain/graph-handles";
import { resolveCollisions } from "@/modules/drumbeat/domain/graph-collision";
import { detectCycle } from "@/modules/core/kernel/domain/dependency-graph";
import { PiJobSize } from "@/modules/drumbeat/features/cockpit/components/pi-job-size";
import { FeatureCardBody } from "@/modules/drumbeat/features/cockpit/components/feature-card-body";
import { StatusBadge } from "@/modules/drumbeat/features/lib/status-badges";
import { FeaturePickerPopover } from "@/modules/drumbeat/features/dependencies/components/feature-picker-popover";
import { NODE_W_COCKPIT } from "@/modules/drumbeat/domain/graph-constants";
import {
  swimlaneLayout,
  pointsBackwards,
  piOfColumn,
  columnAtPointer,
  columnDropState,
  type ColumnDropState,
  type SwimlaneColumn,
} from "@/modules/drumbeat/domain/graph-layout";
import { toast } from "sonner";
import { setFeaturePiAction } from "@/modules/work/features/feature/actions/feature";
import { setFeaturePi } from "@/modules/work/features/feature/lib/feature-actions-client";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import { EDGE_COLOR } from "@/modules/drumbeat/features/cockpit/components/graph-palette";

/**
 * **Der Netzplan — einer für Umsetzung und Epic.**
 *
 * Flacher Graph der Features, Dependencies als gerichtete Kanten. Bis
 * September 2026 gab es zwei: diesen im Umsetzungs-Cockpit und einen eigenen
 * im Epic-Reiter „Dependencies" (`breakdown-network-view.tsx`), der ähnlich,
 * aber nicht gleich funktionierte — ohne die Board-Karte, ohne Spaltenbänder,
 * ohne Ziehen in ein PI. Jetzt ist es eine Komponente; die beiden Flächen
 * sind dünne Mäntel (`CockpitNetwork`, der Epic-Mantel), die Daten, Rechte
 * und das Speichern der Positionen hereinreichen.
 *
 * Mutationen gehen an das **ART des jeweiligen Features** — der Epic zeigt
 * Features mehrerer ARTs. `defaultArtId` gilt nur, wenn die Quelle nicht im
 * Bild ist (Cross-ART-Auswahl).
 *
 * Off-Scope-Endpunkte erscheinen als gestrichelte Ghost-Nodes am Rand.
 */
export interface DependencyNetworkProps {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
  /** Die PIs des Fensters — die Spalten der Zeitachse. */
  pis: CockpitPiSlot[];
  /** Das gewählte PI; seine Spalte wird hervorgehoben. */
  selectedPiId: string | null;
  /** ART für Mutationen, deren Quelle nicht im Bild ist. */
  defaultArtId: string;
  permissions: {
    /** `feature.update` — in der Zeitachse per Zug in ein anderes PI. */
    canUpdate: boolean;
    /** `dependency.link` — Kanten anlegen, umhängen, ändern, löschen. */
    canLink: boolean;
    /**
     * `feature.create` — „+" am Knoten (Folge-Feature) und an der Kante
     * (dazwischen). Nur an Features mit Epic: die Aktionen verlangen eines.
     */
    canCreate: boolean;
    /** `feature.wsjf.set` — WSJF und Job Size auf der Karte öffnen den Dialog. */
    canScore: boolean;
  };
  /**
   * **Wo die Positionen der Topologie liegen** — Sache des Aufrufers: die
   * Umsetzung speichert je ART (`art_graph_positions`), der Epic je Epic
   * (`initiative_graph_positions`). Gezogene Positionen schlagen die
   * berechnete Anordnung; `resolveCollisions` gleicht neue Knoten dagegen ab.
   */
  persistence: {
    positions: Record<string, { x: number; y: number }>;
    canPersist: boolean;
    save: (
      positions: { initiativeId: string; x: number; y: number }[],
    ) => Promise<{ error?: string } | undefined>;
    /** Der Knopf „Neu anordnen" — erscheint in der Topologie, wenn es etwas zu verwerfen gibt. */
    clearButton: ReactNode;
  };
  /** Präfix der URL-Parameter, damit zwei Flächen ihre eigenen tragen. */
  paramPrefix?: string;
  /** Kontextzeile der Karte: „Epic ▸ Solution" oder „ART ▸ Solution". */
  cardContext?: "epic" | "art";
  /** Dateiname des PNG-Exports (`netzplan-<name>.png`). */
  exportName?: string;
  /** Was ohne Features erscheint; Vorgabe: „Keine Features im Zeitfenster". */
  emptyState?: ReactNode;
}

/**
 * **Zwei Layouts, zwei Fragen.** Die Zeitachse beantwortet „wann" — x ist der
 * PI, und eine rückwärts laufende Kante ist sofort zu sehen. Die Topologie
 * beantwortet „welche Kette" und lässt dagre ordnen. Vorgabe ist die Zeitachse:
 * eine Abhängigkeit ist ihrem Wesen nach etwas zwischen Zeiträumen.
 */
export type NetworkLayout = "pi" | "topology";

interface PiHeaderData {
  label: string;
  selected: boolean;
  /** Das PI hinter dieser Bahn; `null` für Backlog und die Geisterspalte. */
  pi: CockpitPiSlot | null;
  /** So breit wie die Spalte — der Titel ist damit ein breites Ablageziel. */
  width: number;
  /** Zustand während eines Zugs (`columnDropState`); ruhend `idle`. */
  dropState: ColumnDropState;
}

interface PiBandData {
  width: number;
  height: number;
  dropState: ColumnDropState;
}

const LAYOUT_TABS = [
  { id: "pi" as const, label: "Zeitachse" },
  { id: "topology" as const, label: "Topologie" },
];

const NODE_W = NODE_W_COCKPIT;
/**
 * Die Höhe der Board-Karte — seit September 2026 trägt der Knoten denselben
 * Inhalt wie sie (`FeatureCardBody`) plus den Status. Fest, nicht
 * inhaltsabhängig: Layout, Zeilenabstand und Kantenpfade rechnen mit ihr.
 */
const NODE_H = 112;
/** Luft zwischen zwei Boxen, bevor sie als kollidierend gelten. */
const NODE_GAP = 24;

/**
 * Wie viele Knoten eine PI-Spalte untereinander stapelt, bevor sie eine
 * Nebenkolonne aufmacht. Sechs Reihen sind gut 1000 px — eine Höhe, die auf
 * einen Bildschirm passt (bis September 2026 acht, bei 64 px hohen Knoten).
 * Das vollste PI im Bestand hat 49 Features; ohne diese Grenze wäre seine
 * Spalte über 8000 px hoch.
 */
const COLUMN_MAX_ROWS = 6;

/**
 * React Flow hat einen Zoom-Boden, und der liegt von Haus aus bei 0.5. Er war
 * hier nie gesetzt — solange das Netz ein einzelnes PI zeigte, fiel das kaum
 * auf. Mit dem Zeitfenster reicht er nicht mehr: `fitView` kann die Leinwand
 * dann nicht auf den Schirm holen, und der Zoom-Knopf ist am Anschlag **grau**.
 * Genau das sieht aus, als sei die Sicht eingefroren.
 */
const MIN_ZOOM = 0.1;

type FeatureNodeData = {
  feature: CockpitFeature;
  onOpen: (id: string) => void;
  connectable: boolean;
  /** `feature.wsjf.set` — WSJF und Job Size öffnen den Dialog. */
  canScore: boolean;
  cardContext: "epic" | "art";
  /** `feature.create` und ein Epic am Feature — dann trägt der Knoten „+". */
  canAddSuccessor: boolean;
};

type GhostNodeData = {
  title: string;
  hint: string;
  /** Das Feature hinter dem Geist — ein Klick öffnet sein Slide-Over. */
  featureId: string;
  /** Sein Epic, falls geladen (Epic-Netzplan): „anderes Epic" ist dort die Auskunft. */
  epicTitle: string | null;
  onOpen: (id: string) => void;
};

/**
 * **Dieselbe Karte wie im Board, plus Status.** Bis September 2026 trug der
 * Knoten nur Statuspunkt, Titel, Status und WSJF; jetzt denselben Inhalt wie
 * die Board-Karte (`FeatureCardBody`: Typ-Streifen, Epic ▸ Solution, Owner,
 * Blocker-Symbol, WSJF/JS-Knopf) und darunter den Status — im Netz gibt es
 * keine Status-Bahn, die ihn sagt.
 *
 * Die Hülle ist ein `div role="button"`, kein `<button>`: der Inhalt trägt
 * eigene Knöpfe, und ein Knopf im Knopf ist ungültig. Blocker-Symbol und
 * WSJF-Knopf tragen `nodrag nopan`, damit ein Klick darauf den Knoten nicht
 * zieht.
 */
const FeatureNode = memo(function FeatureNode({ data }: { data: FeatureNodeData }) {
  const f = data.feature;
  return (
    // **Feste Box aus den Konstanten** — die Kantenrechnung setzt die Höhe
    // voraus; wäre sie inhaltsabhängig, sässen die Brücken daneben.
    <div className="group relative" style={{ width: NODE_W, height: NODE_H }}>
      <HandleRow
        type="target"
        position={Position.Left}
        connectable={data.connectable}
        visible={data.connectable}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => data.onOpen(f.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            data.onOpen(f.id);
          }
        }}
        className="relative flex h-full w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-md bg-card p-2 pl-2.5 text-left shadow-card transition-shadow hover:shadow-md"
        title={f.title}
      >
        <FeatureCardBody
          feature={f}
          canScore={data.canScore}
          context={data.cardContext}
          statusSlot={
            <span className="mt-auto flex">
              <StatusBadge status={f.status} className="px-1.5 py-0 text-label" />
            </span>
          }
        />
      </div>
      <HandleRow
        type="source"
        position={Position.Right}
        connectable={data.connectable}
        visible={data.connectable}
      />
      <BracketTargetRow />
      {data.canAddSuccessor && <NodeAddPlusButton featureId={f.id} />}
    </div>
  );
});

const GhostNode = memo(function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <div className="relative" style={{ width: NODE_W, height: NODE_H }}>
      <HandleRow type="target" position={Position.Left} connectable={false} visible={false} />
      <button
        type="button"
        onClick={() => data.onOpen(data.featureId)}
        className="flex h-full w-full cursor-pointer flex-col justify-center gap-0.5 rounded-md
          border border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-left
          text-muted-foreground transition-colors hover:bg-muted/60"
        title={`${data.hint}: ${data.title}`}
      >
        <span className="text-label uppercase tracking-[0.1em]">{data.hint}</span>
        <span className="line-clamp-2 text-xs font-medium leading-tight">{data.title}</span>
        {data.epicTitle && <span className="truncate text-label">{data.epicTitle}</span>}
      </button>
      <HandleRow type="source" position={Position.Right} connectable={false} visible={false} />
    </div>
  );
});

/**
 * Der Spaltenkopf der Zeitachse — ein gewöhnlicher Knoten, nicht ziehbar und
 * nicht wählbar, wie im Epic-Breakdown. Die Spalte des gewählten PI wird
 * hervorgehoben, damit „wo bin ich" über Board und Netz gleich aussieht.
 */
const PiHeaderNode = memo(function PiHeaderNode({ data }: { data: PiHeaderData }) {
  /**
   * **Beim Anheben leuchten die Titel auf, der unter dem Mauszeiger am
   * stärksten** — vor dem Loslassen, damit man weiss, wohin das Feature geht.
   */
  const klasse =
    data.dropState === "target"
      ? "bg-primary text-primary-foreground ring-3 ring-primary/40"
      : data.dropState === "candidate"
        ? "bg-primary/10 text-foreground ring-1 ring-primary/40"
        : data.dropState === "disabled"
          ? "bg-muted/40 text-muted-foreground opacity-40"
          : data.selected
            ? "bg-primary/10 text-foreground ring-1 ring-primary"
            : "bg-muted/60 text-muted-foreground";
  return (
    <div
      className={`rounded-md px-3 py-1 text-center text-meta font-medium uppercase tracking-[0.1em] transition-colors ${klasse}`}
      style={{ width: data.width }}
    >
      {data.label}
      {/* Die Bahn trägt jetzt auch, wie viel Arbeit in ihr liegt. */}
      {data.pi && (
        <div className="mt-0.5 normal-case tracking-normal">
          <PiJobSize pi={data.pi} />
        </div>
      )}
    </div>
  );
});

/**
 * **Das Band einer Spalte** — die Fläche hinter ihren Knoten, vom Titel bis
 * unter die tiefste Reihe. Es trennt die Spalten sichtbar voneinander, auch
 * ohne Zug; beim Ziehen trägt es denselben Zustand wie sein Titel.
 *
 * `pointerEvents: none` am Knoten: die Bänder bedecken die ganze Leinwand
 * und dürften sonst weder das Verschieben noch einen Klick auf den Grund
 * schlucken.
 */
const PiBandNode = memo(function PiBandNode({ data }: { data: PiBandData }) {
  const klasse =
    data.dropState === "target"
      ? "bg-primary/10 ring-2 ring-primary/50"
      : data.dropState === "candidate"
        ? "bg-primary/[0.04] ring-1 ring-primary/15"
        : data.dropState === "disabled"
          ? "bg-muted/10"
          : "bg-muted/30";
  return (
    <div
      aria-hidden
      className={`rounded-lg transition-colors ${klasse}`}
      style={{ width: data.width, height: data.height }}
    />
  );
});

const NODE_TYPES = {
  "pi-band": PiBandNode,
  "pi-header": PiHeaderNode,
  feature: FeatureNode,
  ghost: GhostNode,
};

type AddState = { sourceId: string; anchorX: number; anchorY: number };

export function DependencyNetwork({
  features,
  dependencies,
  pis,
  selectedPiId,
  defaultArtId,
  permissions,
  persistence,
  paramPrefix = "",
  cardContext = "epic",
  exportName = "netzplan",
  emptyState,
}: DependencyNetworkProps) {
  const { canUpdate, canLink: canLinkDependency, canCreate, canScore: canScoreWsjf } = permissions;
  const savedPositions = persistence.positions;
  const layoutParam = `${paramPrefix}nlayout`;
  const queryParam = `${paramPrefix}nq`;
  const typeParam = `${paramPrefix}ntyp`;
  /** ART je Feature — Mutationen gehen an das der Quelle. */
  const artOf = useCallback(
    (featureId: string) => features.find((f) => f.id === featureId)?.artId || defaultArtId,
    [features, defaultArtId],
  );
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [addState, setAddState] = useState<AddState | null>(null);
  const { error, callLink, callUnlink, callChangeType, callRelink } = useDependencyEdgeEditing(
    artOf,
    dependencies,
  );

  // openSlideOver via useCallback stabil gehalten: sonst wird die Referenz pro
  // Render neu erzeugt und triggert das teure `dagre.layout` im useMemo unten
  // (INP-Hotspot). Die Identitaet aendert sich nur, wenn sich router/pathname/
  // searchParams tatsaechlich aendern — dann rebuildet der Layout-Memo bewusst,
  // damit der Klick den aktuellen searchParams-Stand mitnimmt.
  const openSlideOver = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("featureId", id);
      router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function depById(depId: string): CockpitDependency | undefined {
    return dependencies.find((d) => d.id === depId);
  }

  /** Ein URL-Parameter setzen oder, bei `null`, entfernen — ohne Scrollsprung. */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value == null) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // dagre.layout ist der Hotspot — nur re-layouten, wenn sich Features,
  // Dependencies, der (stabile) openSlideOver-Handler oder die Link-Berechtigung
  // aendern.
  const layout: NetworkLayout = searchParams.get(layoutParam) === "topology" ? "topology" : "pi";
  // „pi" ist die Vorgabe — dann bleibt der Parameter aus der URL.
  const setLayout = (next: NetworkLayout) => setParam(layoutParam, next === "pi" ? null : next);

  /**
   * **Suche und Typfilter blenden ab, statt auszublenden.** Ein ausgeblendeter
   * Knoten risse Lücken in die Ketten; abgeblendet bleibt das Netz lesbar und
   * das Gesuchte tritt hervor. Die Suche schreibt entprellt in die URL, damit
   * sie nicht je Tastenanschlag flackert.
   */
  const urlQuery = searchParams.get(queryParam) ?? "";
  const rawType = searchParams.get(typeParam);
  const urlType: "all" | FeatureType = isFeatureType(rawType) ? rawType : "all";
  const [queryDraft, setQueryDraft] = useState(urlQuery);
  useEffect(() => setQueryDraft(urlQuery), [urlQuery]);
  useEffect(() => {
    if (queryDraft === urlQuery) return;
    const timer = window.setTimeout(
      () => setParam(queryParam, queryDraft.trim() === "" ? null : queryDraft.trim()),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [queryDraft, urlQuery, queryParam, setParam]);
  const hasFilter = urlQuery !== "" || urlType !== "all";
  const matchedIds = useMemo<Set<string> | null>(() => {
    if (!hasFilter) return null;
    const q = urlQuery.toLowerCase().trim();
    return new Set(
      features
        .filter((f) => urlType === "all" || f.featureType === urlType)
        .filter((f) => q === "" || f.title.toLowerCase().includes(q))
        .map((f) => f.id),
    );
  }, [features, urlQuery, urlType, hasFilter]);
  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(queryParam);
    params.delete(typeParam);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  const {
    nodes: baseNodes,
    edges: baseEdges,
    columns,
  } = useMemo(
    () =>
      buildLayoutedGraph(
        features,
        dependencies,
        openSlideOver,
        { connectable: canLinkDependency, canCreate, canScore: canScoreWsjf },
        pis,
        selectedPiId,
        layout,
        savedPositions,
        cardContext,
      ),
    [
      features,
      dependencies,
      openSlideOver,
      canLinkDependency,
      canCreate,
      canScoreWsjf,
      pis,
      selectedPiId,
      layout,
      savedPositions,
      cardContext,
    ],
  );

  /**
   * **Ohne `onNodesChange` bewegt React Flow keinen Knoten.** Die Sicht reichte
   * `nodes` als reine Requisite herein; damit war der Graph fest verdrahtet —
   * Ziehen war nie möglich, auch nicht vor der Zeitachse. Dasselbe Muster wie im
   * Epic-Breakdown: `useNodesState` hält die Positionen, der Layout-Memo setzt
   * sie zurück, sobald sich Daten oder Anordnung ändern.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);

  /**
   * **Die Kanten als Zustand — für das optimistische Zeichnen.** Eine neue
   * Kante steht sofort (`tmp-…`), ein Typwechsel und ein Löschen ebenso.
   * **Zusammenführen, nicht ersetzen** (`mergeOptimisticEdges`): ein
   * Server-Stand von vor dem Schreiben löschte die eben gezogene Kante sonst
   * wieder weg.
   */
  const [edges, setEdges] = useState<Edge[]>(baseEdges);
  useEffect(() => {
    setEdges((current) => mergeOptimisticEdges(baseEdges, current));
  }, [baseEdges]);
  /** Abgewiesen: zurück auf den Server-Stand, schwebende Kanten bleiben. */
  const rollback = useCallback(
    () => setEdges((current) => mergeOptimisticEdges(baseEdges, current)),
    [baseEdges],
  );

  /** Neue Kanten entstehen mit diesem Typ. `blocks` ist der mit Reihenfolge. */
  const [connectType, setConnectType] = useState<DependencyEdgeType>("blocks");

  /**
   * **Unbeteiligtes abblenden.** Der überfahrene Knoten und seine Nachbarn
   * bleiben satt, der Rest wird blass. Nur echte Knoten — die Bahnköpfe
   * sind keine Features und haben keine Nachbarn.
   */
  const [hoverId, setHoverId] = useState<string | null>(null);

  /**
   * **Der laufende Zug in der Zeitachse** — aus welcher Spalte das Feature
   * kommt und über welcher der Mauszeiger gerade ist. Daraus leuchten Titel
   * und Bänder (`columnDropState`), und beim Loslassen ist `overCol` das Ziel.
   */
  const [drag, setDrag] = useState<{
    featureId: string;
    fromCol: number;
    overCol: number | null;
  } | null>(null);
  /** Für `screenToFlowPosition`: der Mauszeiger, nicht die Knotenecke, zählt. */
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  // Filter zuerst, das Abblenden beim Überfahren darüber.
  const displayNodes = useMemo(
    () =>
      matchedIds == null
        ? nodes
        : nodes.map((n) =>
            (n.type !== "feature" && n.type !== "ghost") || matchedIds.has(n.id)
              ? n
              : { ...n, style: { ...(n.style ?? {}), opacity: 0.25 } },
          ),
    [nodes, matchedIds],
  );
  const displayEdges = useMemo(
    () =>
      matchedIds == null
        ? edges
        : edges.map((e) =>
            matchedIds.has(e.source) && matchedIds.has(e.target)
              ? e
              : { ...e, style: { ...(e.style ?? {}), opacity: 0.25 } },
          ),
    [edges, matchedIds],
  );
  // Anschlüsse nach der **Live**-Lage — nach dem Ziehen stimmt die Reihenfolge weiter.
  const liveEdges = useLiveHandles(nodes, displayEdges);
  const sicht = useFocusDimming(displayNodes, liveEdges, hoverId);

  /** Speicher-Entprellung je Knoten — wie im Epic-Breakdown. */
  const dragSaveTimers = useMemo<Map<string, ReturnType<typeof setTimeout>>>(() => new Map(), []);

  /**
   * **Die Linien aller Kanten, einmal berechnet — samt Brücken.**
   *
   * Über die **Live**-Positionen (`nodes`), nicht über das Layout-Ergebnis:
   * sonst stünden die Bögen nach jedem Ziehen falsch.
   */
  const edgePaths = useEdgePaths(nodes, liveEdges, { width: NODE_W, height: NODE_H });

  /**
   * **Anlegen aus dem Netz** — Folge-Feature am Knoten, Feature zwischen zwei
   * Knoten. Beide Aktionen verlangen ein Epic (`parentEpicId`); das neue
   * Feature bekommt das Epic und das ART seines Vorgängers. Knoten ohne Epic
   * zeigen deshalb kein „+" (`canAddSuccessor`, `canInsert`).
   */
  const onAddSuccessor = useCallback(
    (featureId: string, input: QuickAddInput) => {
      const f = features.find((x) => x.id === featureId);
      if (!f?.parentId) return;
      const fd = new FormData();
      fd.set("artId", f.artId);
      fd.set("parentEpicId", f.parentId);
      fd.set("predecessorId", f.id);
      fd.set("title", input.title);
      fd.set("featureType", input.featureType);
      startTransition(async () => {
        const res = await quickAddFeatureWithDependencyAction({}, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("drumbeat.ui.folgeFeatureAngelegt"));
        router.refresh();
      });
    },
    [features, router, t],
  );

  const onInsertOnEdge = useCallback(
    (depId: string, input: QuickAddInput) => {
      const d = dependencies.find((x) => x.id === depId);
      const von = d && features.find((x) => x.id === d.fromId);
      if (!d || !von?.parentId) return;
      const fd = new FormData();
      fd.set("artId", von.artId);
      fd.set("parentEpicId", von.parentId);
      fd.set("fromId", d.fromId);
      fd.set("toId", d.toId);
      fd.set("edgeType", d.type);
      fd.set("title", input.title);
      fd.set("featureType", input.featureType);
      startTransition(async () => {
        const res = await insertFeatureBetweenAction({}, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("drumbeat.ui.featureZwischengefuegt"));
        router.refresh();
      });
    },
    [dependencies, features, router, t],
  );

  const onChangeEdgeType = useCallback(
    (depId: string, next: DependencyEdgeType) => {
      setEdges((current) =>
        current.map((e) => {
          if (e.id !== depId) return e;
          const data = e.data as DependencyEdgeData;
          return {
            ...e,
            ...edgeVisual(next, data.backwards),
            data: { ...data, type: next },
          };
        }),
      );
      callChangeType(depId, next, (err) => (err ? rollback() : router.refresh()));
    },
    [callChangeType, rollback, router],
  );

  const onDeleteEdge = useCallback(
    (depId: string) => {
      setEdges((current) => current.filter((e) => e.id !== depId));
      callUnlink(depId, (err) => (err ? rollback() : router.refresh()));
    },
    [callUnlink, rollback, router],
  );

  const editing = useMemo<NetworkEditing>(
    () => ({ onAddSuccessor, onInsertOnEdge, onChangeEdgeType, onDeleteEdge }),
    [onAddSuccessor, onInsertOnEdge, onChangeEdgeType, onDeleteEdge],
  );

  /**
   * **Eine neue Kante steht sofort.** Vorher prüft die Fläche, was sie ohne
   * Rundreise weiss — Selbstbezug, Zyklus über die sichtbaren Kanten (nicht
   * für `relates_to`, das keine Reihenfolge trägt). Der Server prüft
   * mandantenweit und darf strenger sein; weist er ab, verschwindet die Kante.
   */
  const onConnect = useCallback(
    (c: Connection) => {
      if (!canLinkDependency || !c.source || !c.target) return;
      // Ghost-Knoten sind bewusst nicht verbindbar.
      if (c.source.startsWith("ghost:") || c.target.startsWith("ghost:")) return;
      if (c.source === c.target) {
        toast.error(t("drumbeat.errors.selfDependency"));
        return;
      }
      if (
        connectType !== "relates_to" &&
        detectCycle(
          c.source,
          c.target,
          edges.map((e) => ({ fromId: e.source, toId: e.target })),
        )
      ) {
        toast.error(t("drumbeat.errors.wuerdeZyklusErzeugen"));
        return;
      }
      const tmpId = `tmp-${c.source}-${c.target}-${Date.now()}`;
      const tmp: Edge = {
        id: tmpId,
        source: c.source,
        target: c.target,
        type: "dependency",
        ...edgeVisual(connectType, false),
        data: {
          type: connectType,
          backwards: false,
          canChangeType: false,
          canInsert: false,
        } satisfies DependencyEdgeData,
      };
      setEdges((current) => [...current, tmp]);
      callLink(c.source, c.target, connectType, (err) => {
        if (err) setEdges((current) => current.filter((e) => e.id !== tmpId));
        else router.refresh();
      });
    },
    [canLinkDependency, connectType, edges, callLink, router, t],
  );

  /** Entf/Backspace auf einer gewählten Kante. Knoten löscht die Taste nie. */
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!canLinkDependency) return;
      for (const e of deleted) if (!e.id.startsWith("tmp-")) onDeleteEdge(e.id);
    },
    [canLinkDependency, onDeleteEdge],
  );

  /**
   * **Ein Zug auf eine andere Bahn ist eine Umplanung.**
   *
   * Nur in der Zeitachse — dort trägt x eine Bedeutung. In der Topologie sagt
   * die Position nichts über Termine, und ein Zug dort darf keine auslösen.
   *
   * Der Server entscheidet; er weist ab, wenn das Epic noch kein Budget hat
   * (`featurePlanningBlockedKey`) oder die Timeline nicht passt. Seine
   * **Hinweise** — Ziel-PI ausserhalb des Epic-Fensters, vor dem frühesten
   * Termin laut Blockern — liest hier zum ersten Mal jemand; sie lagen seit
   * jeher in der Antwort und wurden nirgends gezeigt.
   */
  const onNodeDragStop = useCallback(
    (_e: unknown, node: Node) => {
      /**
       * **Zwei Layouts, zwei Bedeutungen.**
       *
       * In der Topologie ist die Position ein Bild — sie wird gespeichert. In
       * der Zeitachse ist sie eine Aussage über den Termin — sie wird in ein
       * PI übersetzt. Dieselbe Geste, zwei Wirkungen, und die Verwechslung
       * wäre teuer.
       */
      if (layout === "topology") {
        if (!persistence.canPersist) return;
        // Nur Features: die Speicher-Aktionen verlangen eine Initiative-Id,
        // und `ghost:from:…` ist keine — ein gezogener Geist scheiterte stets.
        if (node.type !== "feature") return;
        // Je Knoten entprellt: mehrere kleine Korrekturen werden ein Speichern.
        const laufend = dragSaveTimers.get(node.id);
        if (laufend) clearTimeout(laufend);
        dragSaveTimers.set(
          node.id,
          setTimeout(() => {
            dragSaveTimers.delete(node.id);
            startTransition(async () => {
              const res = await persistence.save([
                { initiativeId: node.id, x: node.position.x, y: node.position.y },
              ]);
              if (res?.error) toast.error(res.error);
            });
          }, 400),
        );
        return;
      }

      if (layout !== "pi" || !canUpdate) return;
      if (!node.id || node.id.startsWith("pihead:") || node.id.startsWith("ghost:")) return;

      /**
       * **Das Ziel ist die Spalte unter dem Mauszeiger** (`drag.overCol`),
       * dieselbe, die vor dem Loslassen aufgeleuchtet hat — nicht die, in der
       * die linke obere Ecke des Knotens landet. Bis September 2026 war es
       * die Ecke, und ein Knoten, der in derselben Spalte oder rechts in
       * „Außerhalb" landete, blieb liegen, wo er losgelassen wurde.
       */
      const ziel = drag?.featureId === node.id ? drag.overCol : null;
      setDrag(null);
      const zielPi = ziel == null ? undefined : piOfColumn(ziel, pis);
      const jetzt = features.find((f) => f.id === node.id)?.piId ?? null;
      // Kein Ziel, die Geisterspalte oder die eigene Spalte: zurück an den Platz.
      if (zielPi === undefined || zielPi === jetzt) {
        setNodes(baseNodes);
        return;
      }

      startTransition(async () => {
        const res = await setFeaturePi(setFeaturePiAction, {
          featureIds: [node.id],
          piId: zielPi ?? "",
          artId: artOf(node.id),
        });
        if (res.error) {
          toast.error(res.error);
          // Zurück an die berechnete Stelle: der Server hat nicht zugestimmt.
          setNodes(baseNodes);
          return;
        }
        if (res.warnings && res.warnings.length > 0) {
          toast.warning(res.warnings.join(" · "));
        }
        router.refresh();
      });
    },
    [
      layout,
      canUpdate,
      drag,
      pis,
      features,
      artOf,
      baseNodes,
      setNodes,
      router,
      dragSaveTimers,
      persistence,
    ],
  );

  /** Die Spalte eines Features: Backlog 0, die PIs in Reihenfolge ab 1. */
  const spalteVon = useCallback(
    (featureId: string): number | null => {
      const f = features.find((x) => x.id === featureId);
      if (!f) return null;
      if (f.piId === null) return 0;
      const i = pis.findIndex((p) => p.id === f.piId);
      return i < 0 ? null : i + 1;
    },
    [features, pis],
  );

  const onNodeDragStart = useCallback(
    (_e: unknown, node: Node) => {
      if (layout !== "pi" || !canUpdate || node.type !== "feature") return;
      const von = spalteVon(node.id);
      if (von == null) return;
      setHoverId(null);
      setDrag({ featureId: node.id, fromCol: von, overCol: von });
    },
    [layout, canUpdate, spalteVon],
  );

  const onNodeDrag = useCallback(
    (e: MouseEvent | TouchEvent, node: Node) => {
      if (!flow || drag?.featureId !== node.id) return;
      const punkt = "touches" in e ? e.touches[0] : e;
      if (!punkt) return;
      const { x } = flow.screenToFlowPosition({ x: punkt.clientX, y: punkt.clientY });
      const ueber = columnAtPointer(x, columns);
      // Nur bei Spaltenwechsel neu zeichnen — der Zug feuert je Pixel.
      if (ueber !== drag.overCol) setDrag({ ...drag, overCol: ueber });
    },
    [flow, drag, columns],
  );

  /**
   * Titel und Bänder mit ihrem Zustand während des Zugs — über die
   * gerenderten Knoten gelegt, ohne das Layout neu zu rechnen.
   */
  const withDropState = useCallback(
    (list: Node[]): Node[] =>
      drag == null
        ? list
        : list.map((n) => {
            if (n.type !== "pi-header" && n.type !== "pi-band") return n;
            const col = Number(n.id.slice(n.id.indexOf(":") + 1));
            const dropState = columnDropState(col, drag, pis);
            return {
              ...n,
              style: { ...(n.style ?? {}), opacity: 1 },
              data: { ...n.data, dropState },
            };
          }),
    [drag, pis],
  );
  useEffect(() => setNodes(baseNodes), [baseNodes, setNodes]);

  if (features.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <EmptyState
        title={t("drumbeat.ui.keineFeaturesImZeitfenster")}
        body={t("drumbeat.ui.inDenPisDieses")}
        className="h-[420px]"
      />
    );
  }

  return (
    <div className="relative space-y-2">
      {/* Werkzeugzeile: Anordnung, Suche und Typfilter links; der Typ neuer
          Kanten und die Cross-ART-Auswahl rechts. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={layout}
            options={LAYOUT_TABS}
            onChange={setLayout}
            ariaLabel={t("drumbeat.ui.anordnungDesNetzes")}
            className="h-8 bg-card text-xs"
          />
          {/*
            Nur in der Topologie, nur mit Recht, und nur wenn es überhaupt etwas
            zu verwerfen gibt — sonst wäre der Knopf ein Versprechen ohne Wirkung.
            Ohne ihn gäbe es nur Anlegen und Überschreiben: wer sein Bild einmal
            verzogen hat, käme nie zur Rechnung zurück.
          */}
          {layout === "topology" &&
            persistence.canPersist &&
            Object.keys(savedPositions).length > 0 &&
            persistence.clearButton}
          <Input
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder={t("drumbeat.ui.sucheImTitel")}
            aria-label={t("drumbeat.ui.sucheImNetzplan")}
            className="h-8 w-48 text-xs"
          />
          <ToggleGroup
            ariaLabel={t("drumbeat.ui.typFilter")}
            className="h-8 bg-card text-xs"
            value={urlType}
            onChange={(next) => setParam(typeParam, next === "all" ? null : next)}
            options={[
              { id: "all" as const, label: t("work.feature.alleTypen") },
              ...FEATURE_TYPES.map((typ) => ({
                id: typ,
                label: t(FEATURE_TYPE_KEYS[typ] ?? typ),
              })),
            ]}
          />
          {hasFilter && (
            <>
              <span className="text-muted-foreground">
                {t("drumbeat.ui.netzplanSichtbar", {
                  visible: matchedIds?.size ?? 0,
                  total: features.length,
                })}
              </span>
              <button type="button" onClick={clearFilter} className="text-primary hover:underline">
                {t("drumbeat.ui.filterZuruecksetzen")}
              </button>
            </>
          )}
        </div>
        {canLinkDependency && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t("drumbeat.ui.neueEdge")}</span>
            {/* Der Farbpunkt wiederholt die Kantenfarbe — neben dem Wort, nie allein. */}
            <ToggleGroup
              ariaLabel={t("drumbeat.ui.connectionTyp")}
              className="h-8 bg-card text-xs"
              value={connectType}
              onChange={setConnectType}
              options={(["blocks", "relates_to"] as const).map((typ) => ({
                id: typ,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: EDGE_COLOR[typ] }}
                    />
                    {t(EDGE_LABEL[typ])}
                  </span>
                ),
              }))}
            />
            <button
              type="button"
              onClick={() => setAddState({ sourceId: "", anchorX: 24, anchorY: 64 })}
              className="h-8 rounded-md bg-card px-2.5 font-medium shadow-card hover:bg-muted/40"
              title={t("drumbeat.ui.crossArtDependencyAnlegen")}
            >
              {t("drumbeat.ui.crossArt")}
            </button>
          </div>
        )}
      </div>
      {(canLinkDependency || canCreate) && (
        <p className="text-xs text-muted-foreground">
          {canCreate && <>{t("drumbeat.ui.netzplanHinweisPlus")} </>}
          {canLinkDependency && t("drumbeat.ui.netzplanHinweisDragBlockiert")}
        </p>
      )}

      <div className="relative h-[calc(100vh-320px)] min-h-[400px] overflow-hidden rounded-lg border">
        {error && (
          <div className="absolute left-2 top-2 z-30 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive">
            {error}
          </div>
        )}
        <NetworkEditingContext.Provider value={editing}>
          <EdgePathContext.Provider value={edgePaths}>
            <ReactFlow
              nodes={withDropState(sicht.nodes)}
              onInit={setFlow}
              edges={sicht.edges}
              onNodesChange={onNodesChange}
              onNodeMouseEnter={(_e, n) =>
                setHoverId(n.type === "feature" || n.type === "ghost" ? n.id : null)
              }
              onNodeMouseLeave={() => setHoverId(null)}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              /**
               * **In der Zeitachse ist die Position die Aussage** — deshalb wurde
               * dort bis September 2026 gar nicht gezogen. Der Satz stimmt, die
               * Schlussfolgerung war falsch herum: wenn die Position etwas sagt,
               * muss man sie sagen können. Ein Zug auf eine andere Bahn **ist** eine
               * Umplanung, und genau so wird er jetzt behandelt.
               *
               * In der Topologie ordnet dagre nur vor; wer umräumen will, darf.
               */
              nodesDraggable={layout === "topology" || canUpdate}
              nodesConnectable={canLinkDependency}
              elementsSelectable
              edgesFocusable={canLinkDependency}
              deleteKeyCode={canLinkDependency ? ["Backspace", "Delete"] : null}
              // Die Taste löscht Kanten, nie Knoten — ein Feature geht über das Slide-Over.
              onBeforeDelete={async ({ edges: weg }) => ({ nodes: [], edges: weg })}
              onEdgesDelete={onEdgesDelete}
              fitView
              fitViewOptions={{ padding: 0.15, minZoom: MIN_ZOOM }}
              minZoom={MIN_ZOOM}
              // React Flow bringt eigene, helle Farben mit (`dist/style.css`);
              // ohne `colorMode` verschwindet die Navigation im dunklen Modus.
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              proOptions={{ hideAttribution: true }}
              onConnect={onConnect}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              /**
               * **Ein Kantenende aufnehmen und woanders ablegen.**
               *
               * ReactFlow v12 bringt die Geste mit; sie war nur nie eingeschaltet.
               * `detectCycle` läuft hier als Vorprüfung über die **sichtbaren**
               * Kanten — **ohne die Kante, die gerade gezogen wird**, sonst meldete
               * sie einen Zyklus gegen sich selbst. Der Graph auf dem Bildschirm ist
               * ein Ausschnitt; der Server prüft mandantenweit und darf strenger
               * sein.
               */
              edgesReconnectable={canLinkDependency}
              onReconnect={(alteKante, conn) => {
                if (!canLinkDependency) return;
                if (!conn.source || !conn.target) return;
                if (conn.source === conn.target) {
                  toast.error(t("drumbeat.errors.selfDependency"));
                  return;
                }
                if (conn.source.startsWith("ghost:") || conn.target.startsWith("ghost:")) return;
                const d = depById(alteKante.id);
                if (!d) return;
                if (
                  d.type !== "relates_to" &&
                  detectCycle(
                    conn.source,
                    conn.target,
                    edges
                      .filter((e) => e.id !== alteKante.id)
                      .map((e) => ({ fromId: e.source, toId: e.target })),
                  )
                ) {
                  toast.error(t("drumbeat.errors.wuerdeZyklusErzeugen"));
                  return;
                }
                callRelink(alteKante.id, conn.source, conn.target);
              }}
            >
              <Background gap={24} />
              <Controls showInteractive={false} />
              <Panel position="top-right">
                <ExportButton name={exportName} />
              </Panel>
              <MiniMap
                pannable
                zoomable
                ariaLabel={t("drumbeat.ui.netzplanUebersicht")}
                // Nach Typ gefärbt, wie der Streifen der Karte; Bänder unsichtbar,
                // sonst deckten sie die Übersicht zu.
                nodeColor={(n) => {
                  if (n.type === "pi-band") return "transparent";
                  if (n.type === "pi-header") return "var(--muted)";
                  if (n.type === "ghost") return "var(--border)";
                  const f = (n.data as FeatureNodeData).feature;
                  return FEATURE_TYPE_MINIMAP[normalizeFeatureType(f.featureType)];
                }}
                nodeStrokeWidth={0}
                maskColor="color-mix(in oklab, var(--background) 92%, transparent)"
              />
            </ReactFlow>
          </EdgePathContext.Provider>
        </NetworkEditingContext.Provider>
      </div>

      {addState &&
        (addState.sourceId === "" ? (
          <FeaturePickerPopover
            anchorX={addState.anchorX}
            anchorY={addState.anchorY}
            onSelect={(sourceId) =>
              setAddState({ sourceId, anchorX: addState.anchorX, anchorY: addState.anchorY + 80 })
            }
            onCancel={() => setAddState(null)}
            initialQuery=""
          />
        ) : (
          <FeaturePickerPopover
            anchorX={addState.anchorX}
            anchorY={addState.anchorY}
            excludeIds={[addState.sourceId]}
            onSelect={(targetId) => {
              callLink(addState.sourceId, targetId, connectType, (err) => {
                if (!err) router.refresh();
              });
              setAddState(null);
            }}
            onCancel={() => setAddState(null)}
            initialQuery=""
          />
        ))}
    </div>
  );
}

function buildLayoutedGraph(
  features: CockpitFeature[],
  dependencies: CockpitDependency[],
  onOpen: (id: string) => void,
  rights: { connectable: boolean; canCreate: boolean; canScore: boolean },
  pis: CockpitPiSlot[],
  selectedPiId: string | null,
  layout: NetworkLayout,
  savedPositions: Record<string, { x: number; y: number }>,
  cardContext: "epic" | "art",
): { nodes: Node[]; edges: Edge[]; columns: SwimlaneColumn[] } {
  const featureIds = new Set(features.map((f) => f.id));
  const { connectable, canCreate, canScore } = rights;
  const mitEpic = new Set(features.filter((f) => f.parentId != null).map((f) => f.id));
  const nodeData = (f: CockpitFeature): FeatureNodeData => ({
    feature: f,
    onOpen,
    connectable,
    canScore,
    cardContext,
    canAddSuccessor: canCreate && mitEpic.has(f.id),
  });

  /**
   * Spalte je Feature — Backlog ist 0, die PIs folgen in Zeitreihenfolge.
   * Zugleich die Grundlage für `pointsBackwards`: sobald die x-Achse die Zeit
   * ist, hat jede Kante eine Richtung darin.
   */
  const colByPi = new Map(pis.map((p, i) => [p.id, i + 1]));
  const columnOf = (id: string): number | null => {
    const f = features.find((x) => x.id === id);
    if (!f) return null;
    return f.piId === null ? 0 : (colByPi.get(f.piId) ?? null);
  };
  /**
   * Die Kanten, die dagre bekommt — gesammelt, nicht gesetzt. dagre wird erst
   * in der Topologie gebaut; in der Zeitachse wurde der Graph bis September
   * 2026 vollständig aufgebaut und nie gelegt — tote Arbeit bei jedem
   * Memo-Lauf.
   */
  const dagreKanten: [string, string][] = [];

  // Ghost-Knoten fuer Off-Scope-Endpunkte. Ein Ghost je
  // (richtung × off-scope-feature-id) — kein Duplikat wenn mehrere
  // Edges denselben externen Knoten treffen.
  /**
   * Die linken Kanten der PI-Bahnen — nur in der Zeitachse belegt.
   *
   * Sie machen die Geste erst möglich: wohin ein Knoten gezogen wurde, ist
   * eine x-Koordinate; welche Bahn das ist, weiss nur das Layout. Die
   * Spaltenbreite hängt davon ab, wie voll die Spalte ist, eine feste
   * Schrittweite wäre geraten.
   */
  let columns: SwimlaneColumn[] = [];
  /** Bahn und Reihe je Feature — nur in der Zeitachse belegt; die Klammer braucht sie. */
  let colOf = new Map<string, number>();
  let rowOf = new Map<string, number>();
  const ghostIds = new Map<string, GhostNodeData>();

  for (const d of dependencies) {
    if (d.offScopeRole === "from") {
      const ghostId = `ghost:from:${d.fromId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Predecessor (off-scope)",
          featureId: d.fromId,
          epicTitle: d.offScopeEpicTitle ?? null,
          onOpen,
        });
      }
      if (featureIds.has(d.toId)) dagreKanten.push([ghostId, d.toId]);
    } else if (d.offScopeRole === "to") {
      const ghostId = `ghost:to:${d.toId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Successor (off-scope)",
          featureId: d.toId,
          epicTitle: d.offScopeEpicTitle ?? null,
          onOpen,
        });
      }
      if (featureIds.has(d.fromId)) dagreKanten.push([d.fromId, ghostId]);
    } else if (featureIds.has(d.fromId) && featureIds.has(d.toId)) {
      dagreKanten.push([d.fromId, d.toId]);
    }
  }

  const nodes: Node[] = [];

  if (layout === "pi") {
    // Die Zeitachse: x ist der PI. Dieselbe reine Spaltenmathematik, die der
    // Epic-Breakdown für seinen Modus „PI-Bahnen" benutzt — nur mit den Maßen
    // dieser Knoten und dem Wort, das auch die Überlauf-Spalte des Boards trägt.
    const lay = swimlaneLayout(
      features.map((f) => ({ id: f.id, piId: f.piId })),
      [...ghostIds.keys()].map((id) => ({ id })),
      pis.map((p) => ({ id: p.id, name: p.name, startDate: p.startDate.toISOString() })),
      {
        nodeWidth: NODE_W,
        nodeHeight: NODE_H,
        externLabel: "Außerhalb des Fensters",
        maxRows: COLUMN_MAX_ROWS,
      },
      // Die Kanten ordnen die Knoten **innerhalb** einer Bahn: Vorgänger oben.
      dependencies.map((d) => ({ source: d.fromId, target: d.toId })),
    );
    columns = lay.columns;
    colOf = lay.colOf;
    rowOf = lay.rowOf;
    const featureById = new Map(features.map((f) => [f.id, f]));

    // Die Bänder zuerst und ganz hinten: sie trennen die Spalten sichtbar.
    const RAND = 12;
    for (const c of lay.columns) {
      nodes.push({
        id: `piband:${c.col}`,
        type: "pi-band",
        position: { x: c.x0 - RAND, y: -RAND },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
        style: { pointerEvents: "none" },
        data: {
          width: c.x1 - c.x0 + 2 * RAND,
          height: lay.contentBottom + 3 * RAND,
          dropState: "idle",
        } satisfies PiBandData,
      });
    }
    const breiteVon = new Map(lay.columns.map((c) => [c.col, c.x1 - c.x0]));
    for (const h of lay.headers) {
      // Backlog (Spalte 0) und die Geisterspalte (rechts) sind keine PIs.
      const pi = h.col === 0 || h.col > pis.length ? null : (pis[h.col - 1] ?? null);
      nodes.push({
        id: `pihead:${h.col}`,
        type: "pi-header",
        position: { x: h.x, y: h.y },
        draggable: false,
        selectable: false,
        data: {
          label: h.label,
          selected: pi != null && pi.id === selectedPiId,
          pi,
          width: breiteVon.get(h.col) ?? NODE_W,
          dropState: "idle",
        } satisfies PiHeaderData,
      });
    }
    for (const p of lay.features) {
      const f = featureById.get(p.id);
      if (!f) continue;
      nodes.push({
        id: f.id,
        type: "feature",
        position: { x: p.x, y: p.y },
        data: nodeData(f),
      });
    }
    for (const gp of lay.ghosts) {
      const info = ghostIds.get(gp.id);
      if (!info) continue;
      nodes.push({ id: gp.id, type: "ghost", position: { x: gp.x, y: gp.y }, data: info });
    }
  } else {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 80 });
    for (const f of features) g.setNode(f.id, { width: NODE_W, height: NODE_H });
    for (const ghostId of ghostIds.keys()) g.setNode(ghostId, { width: NODE_W, height: NODE_H });
    for (const [von, nach] of dagreKanten) g.setEdge(von, nach);
    dagre.layout(g);

    /**
     * **Zwei Koordinatensysteme, ein Bild.**
     *
     * dagre rechnet für *alle* Knoten — auch für die, die längst woanders
     * stehen. Eine gespeicherte Position schlägt die berechnete
     * bedingungslos; ein neuer Knoten bekam damit die rohe dagre-Koordinate
     * aus einem Bild, in dem die gezogenen Knoten aus dagres Sicht noch in
     * ihren Auto-Slots sassen — und landete auf einem bestehenden Feature.
     *
     * `resolveCollisions` ist der fehlende Abgleich: gepinnte Knoten stehen,
     * wo sie stehen, alle anderen weichen **nach unten** aus. Nicht zur Seite,
     * weil die x-Achse im `LR`-Layout die Reihenfolge der Abhängigkeiten
     * trägt — ein Ausweichen nach rechts behauptete eine Abhängigkeit, die es
     * nicht gibt.
     */
    const roh = [
      ...features.map((f) => ({ id: f.id, kind: "feature" as const, feature: f })),
      ...[...ghostIds.entries()].map(([id, info]) => ({ id, kind: "ghost" as const, info })),
    ].map((n) => {
      const gespeichert = savedPositions[n.id];
      const auto = g.node(n.id);
      return {
        ...n,
        position: gespeichert ?? { x: auto.x - NODE_W / 2, y: auto.y - NODE_H / 2 },
        pinned: gespeichert != null,
      };
    });

    const entzerrt = resolveCollisions(roh, {
      width: NODE_W,
      height: NODE_H,
      gap: NODE_GAP,
    });

    for (const n of roh) {
      const position = entzerrt.get(n.id) ?? n.position;
      if (n.kind === "feature") {
        nodes.push({
          id: n.id,
          type: "feature",
          position,
          data: nodeData(n.feature),
        });
      } else {
        nodes.push({ id: n.id, type: "ghost", position, data: n.info satisfies GhostNodeData });
      }
    }
  }

  const edges: Edge[] = [];
  for (const d of dependencies) {
    let source: string;
    let target: string;
    if (d.offScopeRole === "from") {
      source = `ghost:from:${d.fromId}`;
      target = d.toId;
    } else if (d.offScopeRole === "to") {
      source = d.fromId;
      target = `ghost:to:${d.toId}`;
    } else {
      source = d.fromId;
      target = d.toId;
    }
    // Eine Kante, die gegen die Zeit läuft, ist ein Planungsfehler: etwas, das
    // später gebaut wird, hält etwas auf, das früher fertig sein soll. In der
    // Zeitachse fällt das ohnehin auf — hier bekommt es zusätzlich Gewicht.
    const backwards = layout === "pi" && pointsBackwards(d, columnOf);
    edges.push({
      id: d.id,
      source,
      target,
      type: "dependency",
      ...edgeVisual(d.type, backwards),
      data: {
        type: d.type,
        backwards,
        canChangeType: connectable,
        // Dazwischen nur, wo beide Enden im Bild sind und die Quelle ein Epic hat.
        canInsert: canCreate && d.offScopeRole === null && mitEpic.has(d.fromId),
      } satisfies DependencyEdgeData,
    });
  }

  /**
   * **Fünf Anschlüsse je Seite statt eines.**
   *
   * Die Datenbank lässt drei Abhängigkeiten je Paar zu
   * (`@@unique([fromId, toId, type])`), und die Linie ist eine reine Funktion
   * ihrer Endpunkte: zwei Kanten mit denselben Enden zeichneten ein
   * byte-gleiches `d` — deckungsgleich, und anklickbar war nur die oberste.
   */
  //
  // **Klammern in der Zeitachse.** Liegen beide Enden in derselben Bahn, kommt
  // die Kante von rechts wieder herein statt links — sie wird zur Klammer
  // neben der Bahn und läuft durch keinen Knoten dazwischen. `span` sagt, wie
  // viele Reihen sie überspannt; längere Klammern greifen weiter aus.
  const yById = new Map(nodes.map((n) => [n.id, n.position.y]));
  const anschluesse = assignHandles(
    edges.map((e) => {
      const cs = colOf.get(e.source);
      const ct = colOf.get(e.target);
      const sameColumn = cs != null && ct != null && cs === ct;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sameColumn,
        ...(sameColumn
          ? { span: Math.abs((rowOf.get(e.source) ?? 0) - (rowOf.get(e.target) ?? 0)) }
          : {}),
      };
    }),
    // Nach Lage: das oberste Gegenstück bekommt den obersten Anschluss.
    (id) => yById.get(id),
  );
  for (const e of edges) {
    const a = anschluesse.get(e.id);
    if (a) {
      e.sourceHandle = a.sourceHandle;
      e.targetHandle = a.targetHandle;
      if (a.bracketDepth != null) e.data = { ...(e.data ?? {}), bracketDepth: a.bracketDepth };
    }
  }

  return { nodes, edges, columns };
}

const EDGE_TYPES = { dependency: DependencyEdge };
