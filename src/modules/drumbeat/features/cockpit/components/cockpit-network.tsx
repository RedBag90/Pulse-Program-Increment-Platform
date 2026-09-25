"use client";

import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type Connection,
  MarkerType,
  Controls,
  MiniMap,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import type {
  CockpitPiSlot,
  CockpitDependency,
  CockpitFeature,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { useDependencyEdgeEditing } from "@/modules/drumbeat/features/dependencies/hooks/use-dependency-edge-editing";
import { formatWsjf } from "@/modules/core/kernel/domain/wsjf";
import { FEATURE_STATUS_KEYS as STATUS_LABEL } from "@/modules/drumbeat/domain/status";
import { EdgeTypeMenu } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import { FeaturePickerPopover } from "@/modules/drumbeat/features/dependencies/components/feature-picker-popover";
import type { DependencyEdgeType } from "@/modules/drumbeat/server/views/breakdown-network-view";
import { NODE_W_COCKPIT } from "@/modules/drumbeat/domain/graph-constants";
import { swimlaneLayout, pointsBackwards } from "@/modules/drumbeat/domain/graph-layout";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EDGE_COLOR,
  STATUS_DOT_COCKPIT as STATUS_DOT,
} from "@/modules/drumbeat/features/cockpit/components/graph-palette";

/**
 * Netzplan-Sicht des Cockpits — flacher Network-Graph aller Features
 * im ART-Scope, Dependencies als gerichtete Kanten. Spiegelt das
 * Epic-Breakdown-Pattern; Editing-UX ist konsistent zum Epic-Breakdown:
 * Drag-Connect erzeugt neue Dep, Klick auf Edge oeffnet das gleiche
 * EdgeTypeMenu (Typ wechseln / loeschen). Cross-ART-Endpunkte werden
 * ueber einen + Knopf rechts oben angelegt (Source-Pick, dann
 * FeaturePickerPopover).
 *
 * Off-Scope-Endpunkte erscheinen als gestrichelte Ghost-Nodes am Rand.
 */
interface Props {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
  artId: string;
  canLinkDependency: boolean;
  /** Die PIs des Fensters — die Spalten der Zeitachse. */
  pis: CockpitPiSlot[];
  /** Das gewählte PI; seine Spalte wird hervorgehoben. */
  selectedPiId: string | null;
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
}

const LAYOUT_TABS = [
  { id: "pi" as const, label: "Zeitachse" },
  { id: "topology" as const, label: "Topologie" },
];

const NODE_W = NODE_W_COCKPIT;
const NODE_H = 64;

/**
 * Wie viele Knoten eine PI-Spalte untereinander stapelt, bevor sie eine
 * Nebenkolonne aufmacht. Acht Reihen sind gut 1000 px — eine Höhe, die auf
 * einen Bildschirm passt. Das vollste PI im Bestand hat 49 Features; ohne diese
 * Grenze wäre seine Spalte 6000 px hoch.
 */
const COLUMN_MAX_ROWS = 8;

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
};

type GhostNodeData = {
  title: string;
  hint: string;
};

/**
 * Style der React-Flow-Handles. `connectable=false` haelt sie komplett
 * versteckt (size-0). `connectable=true` zeigt einen kleinen dot beim
 * Group-Hover — User sieht erst beim Anvisieren des Knotens, wo er
 * ziehen kann.
 */
const HANDLE_HIDDEN = "!size-0 !border-none !bg-transparent";
const HANDLE_VISIBLE =
  "!size-2 !border !border-background !bg-foreground/60 !opacity-0 transition-opacity group-hover:!opacity-100";

const FeatureNode = memo(function FeatureNode({ data }: { data: FeatureNodeData }) {
  const f = data.feature;
  const handleClass = data.connectable ? HANDLE_VISIBLE : HANDLE_HIDDEN;
  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        isConnectable={data.connectable}
      />
      <button
        type="button"
        onClick={() => data.onOpen(f.id)}
        className="flex h-[64px] w-[200px] flex-col gap-1 rounded-md bg-card px-2.5 py-1.5 shadow-card
          text-left shadow-sm transition-shadow hover:shadow-md"
        title={f.title}
      >
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[f.status]}`} />
          <span className="line-clamp-2 text-xs font-medium leading-tight">{f.title}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-label text-muted-foreground">
          <span className="truncate">{STATUS_LABEL[f.status]}</span>
          {f.wsjfComputed != null && (
            <span className="shrink-0 font-medium">WSJF {formatWsjf(f.wsjfComputed)}</span>
          )}
        </div>
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        isConnectable={data.connectable}
      />
    </div>
  );
});

const GhostNode = memo(function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />
      <div
        className="flex h-[64px] w-[200px] flex-col justify-center gap-0.5 rounded-md border
          border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-left
          text-muted-foreground"
        title={`${data.hint}: ${data.title}`}
      >
        <span className="text-label uppercase tracking-[0.1em]">{data.hint}</span>
        <span className="line-clamp-2 text-xs font-medium leading-tight">{data.title}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />
    </div>
  );
});

/**
 * Der Spaltenkopf der Zeitachse — ein gewöhnlicher Knoten, nicht ziehbar und
 * nicht wählbar, wie im Epic-Breakdown. Die Spalte des gewählten PI wird
 * hervorgehoben, damit „wo bin ich" über Board und Netz gleich aussieht.
 */
const PiHeaderNode = memo(function PiHeaderNode({ data }: { data: PiHeaderData }) {
  return (
    <div
      className={`rounded-md px-3 py-1 text-center text-meta font-medium uppercase tracking-[0.1em] ${
        data.selected
          ? "bg-primary/10 text-foreground ring-1 ring-primary"
          : "bg-muted/60 text-muted-foreground"
      }`}
      style={{ width: NODE_W }}
    >
      {data.label}
    </div>
  );
});

const NODE_TYPES = {
  "pi-header": PiHeaderNode,
  feature: FeatureNode,
  ghost: GhostNode,
};

type EdgeAnchor = { depId: string; type: DependencyEdgeType; x: number; y: number };
type AddState = { sourceId: string; anchorX: number; anchorY: number };

export function CockpitNetwork({
  features,
  dependencies,
  artId,
  canLinkDependency,
  pis,
  selectedPiId,
}: Props) {
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor | null>(null);
  const [addState, setAddState] = useState<AddState | null>(null);
  const { error, callLink, callUnlink, callChangeType } = useDependencyEdgeEditing(
    artId,
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

  // dagre.layout ist der Hotspot — nur re-layouten, wenn sich Features,
  // Dependencies, der (stabile) openSlideOver-Handler oder die Link-Berechtigung
  // aendern.
  const layout: NetworkLayout = searchParams.get("nlayout") === "topology" ? "topology" : "pi";
  function setLayout(next: NetworkLayout) {
    const params = new URLSearchParams(searchParams.toString());
    // „pi" ist die Vorgabe — dann bleibt der Parameter aus der URL.
    if (next === "pi") params.delete("nlayout");
    else params.set("nlayout", next);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  const { nodes: baseNodes, edges } = useMemo(
    () =>
      buildLayoutedGraph(
        features,
        dependencies,
        openSlideOver,
        canLinkDependency,
        pis,
        selectedPiId,
        layout,
      ),
    [features, dependencies, openSlideOver, canLinkDependency, pis, selectedPiId, layout],
  );

  /**
   * **Ohne `onNodesChange` bewegt React Flow keinen Knoten.** Die Sicht reichte
   * `nodes` als reine Requisite herein; damit war der Graph fest verdrahtet —
   * Ziehen war nie möglich, auch nicht vor der Zeitachse. Dasselbe Muster wie im
   * Epic-Breakdown: `useNodesState` hält die Positionen, der Layout-Memo setzt
   * sie zurück, sobald sich Daten oder Anordnung ändern.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  useEffect(() => setNodes(baseNodes), [baseNodes, setNodes]);

  if (features.length === 0) {
    return (
      <EmptyState
        title={t("drumbeat.ui.keineFeaturesImZeitfenster")}
        body={t("drumbeat.ui.inDenPisDieses")}
        className="h-[420px]"
      />
    );
  }

  return (
    <div className="relative h-[calc(100vh-260px)] min-h-[400px] overflow-hidden rounded-lg border">
      {error && (
        <div className="absolute left-2 top-2 z-30 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
      {/* Der Umschalter sitzt links oben über der Leinwand — dieselbe Stelle,
          an der der Epic-Breakdown seinen hat. */}
      <div className="absolute left-3 top-3 z-20">
        <ToggleGroup
          value={layout}
          options={LAYOUT_TABS}
          onChange={setLayout}
          ariaLabel={t("drumbeat.ui.anordnungDesNetzes")}
          className="h-8 bg-card text-xs"
        />
      </div>

      {canLinkDependency && (
        <button
          type="button"
          onClick={() => setAddState({ sourceId: "", anchorX: 24, anchorY: 64 })}
          className="absolute right-3 top-3 z-20 rounded-md bg-card px-2.5 py-1 text-xs font-medium shadow-card hover:bg-muted/40"
          title={t("drumbeat.ui.crossArtDependencyAnlegen")}
        >
          {t("drumbeat.ui.crossArt")}
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        // In der Zeitachse **ist** die Position die Aussage — dort wird nicht
        // gezogen. In der Topologie ordnet dagre nur vor; wer umräumen will,
        // darf. Dieselbe Regel wie im Epic-Breakdown.
        nodesDraggable={layout === "topology"}
        nodesConnectable={canLinkDependency}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.15, minZoom: MIN_ZOOM }}
        minZoom={MIN_ZOOM}
        // React Flow bringt eigene, helle Farben mit (`dist/style.css`);
        // ohne `colorMode` verschwindet die Navigation im dunklen Modus.
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
        onConnect={(c: Connection) => {
          if (!canLinkDependency) return;
          if (!c.source || !c.target) return;
          // Drag-Connect von einem Feature-Knoten auf einen anderen.
          // Ghost-Knoten werden bewusst nicht connectable gemacht.
          callLink(c.source, c.target);
        }}
        onEdgeClick={(e, edge) => {
          if (!canLinkDependency) return;
          const d = depById(edge.id);
          if (!d) return;
          e.preventDefault();
          setEdgeAnchor({ depId: d.id, type: d.type, x: e.clientX, y: e.clientY });
        }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {edgeAnchor && (
        <div
          className="fixed z-50"
          style={{ left: edgeAnchor.x, top: edgeAnchor.y }}
          onMouseLeave={() => setEdgeAnchor(null)}
        >
          <EdgeTypeMenu
            currentType={edgeAnchor.type}
            onChange={(t) => callChangeType(edgeAnchor.depId, t)}
            onDelete={() => callUnlink(edgeAnchor.depId)}
            onClose={() => setEdgeAnchor(null)}
          />
        </div>
      )}

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
              callLink(addState.sourceId, targetId);
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
  connectable: boolean,
  pis: CockpitPiSlot[],
  selectedPiId: string | null,
  layout: NetworkLayout,
): { nodes: Node[]; edges: Edge[] } {
  const featureIds = new Set(features.map((f) => f.id));

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
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 80 });

  for (const f of features) {
    g.setNode(f.id, { width: NODE_W, height: NODE_H });
  }

  // Ghost-Knoten fuer Off-Scope-Endpunkte. Ein Ghost je
  // (richtung × off-scope-feature-id) — kein Duplikat wenn mehrere
  // Edges denselben externen Knoten treffen.
  const ghostIds = new Map<string, { title: string; hint: string }>();

  for (const d of dependencies) {
    if (d.offScopeRole === "from") {
      const ghostId = `ghost:from:${d.fromId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Predecessor (off-scope)",
        });
        g.setNode(ghostId, { width: NODE_W, height: NODE_H });
      }
      if (featureIds.has(d.toId)) g.setEdge(ghostId, d.toId);
    } else if (d.offScopeRole === "to") {
      const ghostId = `ghost:to:${d.toId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Successor (off-scope)",
        });
        g.setNode(ghostId, { width: NODE_W, height: NODE_H });
      }
      if (featureIds.has(d.fromId)) g.setEdge(d.fromId, ghostId);
    } else if (featureIds.has(d.fromId) && featureIds.has(d.toId)) {
      g.setEdge(d.fromId, d.toId);
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
    );
    const featureById = new Map(features.map((f) => [f.id, f]));

    for (const h of lay.headers) {
      const piId = h.col === 0 || h.col > pis.length ? null : pis[h.col - 1]?.id;
      nodes.push({
        id: `pihead:${h.col}`,
        type: "pi-header",
        position: { x: h.x, y: h.y },
        draggable: false,
        selectable: false,
        data: { label: h.label, selected: piId != null && piId === selectedPiId },
      });
    }
    for (const p of lay.features) {
      const f = featureById.get(p.id);
      if (!f) continue;
      nodes.push({
        id: f.id,
        type: "feature",
        position: { x: p.x, y: p.y },
        data: { feature: f, onOpen, connectable } satisfies FeatureNodeData,
      });
    }
    for (const gp of lay.ghosts) {
      const info = ghostIds.get(gp.id);
      if (!info) continue;
      nodes.push({ id: gp.id, type: "ghost", position: { x: gp.x, y: gp.y }, data: info });
    }
  } else {
    dagre.layout(g);
    for (const f of features) {
      const pos = g.node(f.id);
      nodes.push({
        id: f.id,
        type: "feature",
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
        data: { feature: f, onOpen, connectable } satisfies FeatureNodeData,
      });
    }
    for (const [ghostId, info] of ghostIds) {
      const pos = g.node(ghostId);
      nodes.push({
        id: ghostId,
        type: "ghost",
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
        data: info satisfies GhostNodeData,
      });
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
      type: "smoothstep",
      animated: d.type === "blocks",
      ...(backwards ? { label: "rückwärts" } : {}),
      style: {
        stroke: backwards ? "var(--destructive)" : EDGE_COLOR[d.type],
        strokeWidth: backwards ? 2.5 : 1.5,
        strokeDasharray: d.type === "relates_to" ? "4 4" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: backwards ? "var(--destructive)" : EDGE_COLOR[d.type],
      },
    });
  }

  return { nodes, edges };
}
