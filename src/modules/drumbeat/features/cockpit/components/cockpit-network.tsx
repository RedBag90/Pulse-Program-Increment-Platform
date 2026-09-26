"use client";

import { useTranslations } from "next-intl";
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  Background,
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
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
import {
  EdgePathContext,
  HandleRow,
  useEdgePath,
  useEdgePaths,
} from "@/modules/drumbeat/features/cockpit/components/network-shared";
import { assignHandles } from "@/modules/drumbeat/domain/graph-handles";
import { resolveCollisions } from "@/modules/drumbeat/domain/graph-collision";
import { detectCycle } from "@/modules/core/kernel/domain/dependency-graph";
import { PiJobSize } from "@/modules/drumbeat/features/cockpit/components/pi-job-size";
import { FeaturePickerPopover } from "@/modules/drumbeat/features/dependencies/components/feature-picker-popover";
import type { DependencyEdgeType } from "@/modules/drumbeat/server/views/breakdown-network-view";
import { NODE_W_COCKPIT } from "@/modules/drumbeat/domain/graph-constants";
import {
  swimlaneLayout,
  pointsBackwards,
  columnAt,
  piOfColumn,
} from "@/modules/drumbeat/domain/graph-layout";
import { toast } from "sonner";
import { setFeaturePiAction } from "@/modules/work/features/feature/actions/feature";
import { setFeaturePi } from "@/modules/work/features/feature/lib/feature-actions-client";
import {
  saveArtGraphLayoutAction,
  clearArtGraphLayoutAction,
} from "@/modules/drumbeat/features/cockpit/actions/art-graph-layout";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { LayoutGrid } from "lucide-react";
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
  /**
   * ART-scopes `feature.update` — ob Features per Zug in ein anderes PI dürfen.
   *
   * Das Recht kam bisher nicht bis hierher; der Netzplan kannte nur
   * `canLinkDependency`. In der Zeitachse **ist** die Position die Aussage —
   * also wird sie dort jetzt auch gesetzt, nicht nur gelesen.
   */
  canUpdate: boolean;
  /**
   * Von Hand gezogene Positionen, je Feature — nur für die Topologie.
   *
   * Sie schlagen die berechnete Anordnung. Genau daraus entstand der gemeldete
   * Befund: dagre rechnet für **alle** Knoten, auch für die längst woanders
   * stehenden, und ein neuer Knoten bekam die rohe Koordinate aus einem Bild,
   * das er nicht kannte — und landete auf einem bestehenden Feature.
   * `resolveCollisions` ist der fehlende Abgleich.
   */
  savedPositions: Record<string, { x: number; y: number }>;
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
  /** Das PI hinter dieser Bahn; `null` für Backlog und die Geisterspalte. */
  pi: CockpitPiSlot | null;
}

const LAYOUT_TABS = [
  { id: "pi" as const, label: "Zeitachse" },
  { id: "topology" as const, label: "Topologie" },
];

const NODE_W = NODE_W_COCKPIT;
const NODE_H = 64;
/** Luft zwischen zwei Boxen, bevor sie als kollidierend gelten. */
const NODE_GAP = 24;

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

const FeatureNode = memo(function FeatureNode({ data }: { data: FeatureNodeData }) {
  // Der Übersetzer stand in dieser Datei erst 80 Zeilen weiter unten, im
  // Hauptbauteil — deshalb zeichnete der Knoten den Schlüssel roh
  // (`drumbeat.featureStatus.inProgress`) unter jeden Titel.
  const t = useTranslations();
  const f = data.feature;
  return (
    // **Feste Box aus den Konstanten.** `NODE_W`/`NODE_H` und die
    // Tailwind-Literale `w-[200px] h-[64px]` stimmten überein — aber nur
    // zufällig, nichts verband sie. Die Kantenrechnung setzt die Höhe voraus;
    // wäre sie inhaltsabhängig, sässen die Brücken daneben.
    <div className="group relative" style={{ width: NODE_W, height: NODE_H }}>
      <HandleRow
        type="target"
        position={Position.Left}
        connectable={data.connectable}
        visible={data.connectable}
      />
      <button
        type="button"
        onClick={() => data.onOpen(f.id)}
        className="flex h-full w-full flex-col gap-1 rounded-md bg-card px-2.5 py-1.5 shadow-card
          text-left shadow-sm transition-shadow hover:shadow-md"
        title={f.title}
      >
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[f.status]}`} />
          <span className="line-clamp-2 text-xs font-medium leading-tight">{f.title}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-label text-muted-foreground">
          <span className="truncate">{t(STATUS_LABEL[f.status])}</span>
          {f.wsjfComputed != null && (
            <span className="shrink-0 font-medium">WSJF {formatWsjf(f.wsjfComputed)}</span>
          )}
        </div>
      </button>
      <HandleRow
        type="source"
        position={Position.Right}
        connectable={data.connectable}
        visible={data.connectable}
      />
    </div>
  );
});

const GhostNode = memo(function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <div className="relative" style={{ width: NODE_W, height: NODE_H }}>
      <HandleRow type="target" position={Position.Left} connectable={false} visible={false} />
      <div
        className="flex h-full w-full flex-col justify-center gap-0.5 rounded-md border
          border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-left
          text-muted-foreground"
        title={`${data.hint}: ${data.title}`}
      >
        <span className="text-label uppercase tracking-[0.1em]">{data.hint}</span>
        <span className="line-clamp-2 text-xs font-medium leading-tight">{data.title}</span>
      </div>
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
      {/* Die Bahn trägt jetzt auch, wie viel Arbeit in ihr liegt. */}
      {data.pi && (
        <div className="mt-0.5 normal-case tracking-normal">
          <PiJobSize pi={data.pi} />
        </div>
      )}
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
  canUpdate,
  savedPositions,
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
  const { error, callLink, callUnlink, callChangeType, callRelink } = useDependencyEdgeEditing(
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

  const {
    nodes: baseNodes,
    edges,
    bands,
  } = useMemo(
    () =>
      buildLayoutedGraph(
        features,
        dependencies,
        openSlideOver,
        canLinkDependency,
        pis,
        selectedPiId,
        layout,
        savedPositions,
      ),
    [
      features,
      dependencies,
      openSlideOver,
      canLinkDependency,
      pis,
      selectedPiId,
      layout,
      savedPositions,
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

  /** Speicher-Entprellung je Knoten — wie im Epic-Breakdown. */
  const dragSaveTimers = useMemo<Map<string, ReturnType<typeof setTimeout>>>(() => new Map(), []);

  /**
   * **Die Linien aller Kanten, einmal berechnet — samt Brücken.**
   *
   * Über die **Live**-Positionen (`nodes`), nicht über das Layout-Ergebnis:
   * sonst stünden die Bögen nach jedem Ziehen falsch.
   */
  const edgePaths = useEdgePaths(nodes, edges, { width: NODE_W, height: NODE_H });

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
        if (!canUpdate) return;
        if (node.id.startsWith("pihead:")) return;
        // Je Knoten entprellt: mehrere kleine Korrekturen werden ein Speichern.
        const laufend = dragSaveTimers.get(node.id);
        if (laufend) clearTimeout(laufend);
        dragSaveTimers.set(
          node.id,
          setTimeout(() => {
            dragSaveTimers.delete(node.id);
            const fd = new FormData();
            fd.set("artId", artId);
            fd.set(
              "positions",
              JSON.stringify([{ initiativeId: node.id, x: node.position.x, y: node.position.y }]),
            );
            startTransition(async () => {
              const res = await saveArtGraphLayoutAction({}, fd);
              if (res?.error) toast.error(res.error);
            });
          }, 400),
        );
        return;
      }

      if (layout !== "pi" || !canUpdate) return;
      if (!node.id || node.id.startsWith("pihead:") || node.id.startsWith("ghost:")) return;

      const col = columnAt(node.position.x, bands);
      if (col == null) return;
      const zielPi = piOfColumn(col, pis);
      // Die Geisterspalte ist kein Ziel — dorthin zu ziehen sagt nichts.
      if (zielPi === undefined) return;

      const jetzt = features.find((f) => f.id === node.id)?.piId ?? null;
      if (zielPi === jetzt) return;

      startTransition(async () => {
        const res = await setFeaturePi(setFeaturePiAction, {
          featureIds: [node.id],
          piId: zielPi ?? "",
          artId,
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
    [layout, canUpdate, bands, pis, features, artId, baseNodes, setNodes, router, dragSaveTimers],
  );
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
        {/*
          Nur in der Topologie, nur mit Recht, und nur wenn es überhaupt etwas
          zu verwerfen gibt — sonst wäre der Knopf ein Versprechen ohne Wirkung.
          Ohne ihn gäbe es nur Anlegen und Überschreiben: wer sein Bild einmal
          verzogen hat, käme nie zur Rechnung zurück.
        */}
        {layout === "topology" && canUpdate && Object.keys(savedPositions).length > 0 && (
          <ConfirmMutateForm
            action={clearArtGraphLayoutAction}
            fields={{ artId }}
            label={t("drumbeat.ui.neuAnordnen")}
            pendingLabel="…"
            confirmPrompt={t("drumbeat.ui.neuAnordnenFrage")}
            icon={<LayoutGrid className="mr-1 size-3.5" />}
            size="sm"
          />
        )}
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
      <EdgePathContext.Provider value={edgePaths}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
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
      </EdgePathContext.Provider>

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
  savedPositions: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[]; bands: number[] } {
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
  /**
   * Die linken Kanten der PI-Bahnen — nur in der Zeitachse belegt.
   *
   * Sie machen die Geste erst möglich: wohin ein Knoten gezogen wurde, ist
   * eine x-Koordinate; welche Bahn das ist, weiss nur das Layout. Die
   * Spaltenbreite hängt davon ab, wie voll die Spalte ist, eine feste
   * Schrittweite wäre geraten.
   */
  let bands: number[] = [];
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
    bands = lay.bands;
    const featureById = new Map(features.map((f) => [f.id, f]));

    for (const h of lay.headers) {
      // Backlog (Spalte 0) und die Geisterspalte (rechts) sind keine PIs.
      const pi = h.col === 0 || h.col > pis.length ? null : (pis[h.col - 1] ?? null);
      nodes.push({
        id: `pihead:${h.col}`,
        type: "pi-header",
        position: { x: h.x, y: h.y },
        draggable: false,
        selectable: false,
        data: { label: h.label, selected: pi != null && pi.id === selectedPiId, pi },
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
          data: { feature: n.feature, onOpen, connectable } satisfies FeatureNodeData,
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
      type: "hopped",
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

  /**
   * **Fünf Anschlüsse je Seite statt eines.**
   *
   * Die Datenbank lässt drei Abhängigkeiten je Paar zu
   * (`@@unique([fromId, toId, type])`), und die Linie ist eine reine Funktion
   * ihrer Endpunkte: zwei Kanten mit denselben Enden zeichneten ein
   * byte-gleiches `d` — deckungsgleich, und anklickbar war nur die oberste.
   */
  const anschluesse = assignHandles(
    edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  );
  for (const e of edges) {
    const a = anschluesse.get(e.id);
    if (a) {
      e.sourceHandle = a.sourceHandle;
      e.targetHandle = a.targetHandle;
    }
  }

  return { nodes, edges, bands };
}

/**
 * **Die Kante, die über andere hüpft.**
 *
 * Der Netzplan nutzte bis September 2026 den eingebauten `"smoothstep"` und
 * rief `getSmoothStepPath` nie selbst auf — damit gab es keine Stelle, an der
 * sich eine Brücke einsetzen liesse. Die Komponente rechnet denselben Pfad und
 * nimmt, wenn vorhanden, die Fassung mit Brücken aus dem Context.
 *
 * Dass Kanten sich kreuzen, lässt sich in einem Abhängigkeitsgraphen nicht
 * vermeiden. Dass man es **sieht**, schon: ohne Zeichen ist eine Kreuzung von
 * einer Verzweigung nicht zu unterscheiden.
 */
const HoppedEdge = memo(function HoppedEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [eigener, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset: 32,
    borderRadius: 16,
  });
  const d = useEdgePath(id) ?? eigener;
  return (
    <>
      <BaseEdge
        id={id}
        path={d}
        style={props.style}
        {...(props.markerEnd != null ? { markerEnd: props.markerEnd } : {})}
      />
      {props.label != null && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="pointer-events-none rounded-full bg-destructive/15 px-1.5 py-0.5 text-label font-medium text-destructive"
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

const EDGE_TYPES = { hopped: HoppedEdge };
