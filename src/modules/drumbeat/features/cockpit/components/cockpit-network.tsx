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
import { formatWsjf } from "@/modules/core/kernel/domain/wsjf";
import { FEATURE_STATUS_KEYS as STATUS_LABEL } from "@/modules/drumbeat/domain/status";
import { EdgeTypeMenu } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import {
  BracketTargetRow,
  EdgePathContext,
  HandleRow,
  useEdgePath,
  useEdgePaths,
  useFocusDimming,
  useLiveHandles,
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
  piOfColumn,
  columnAtPointer,
  columnDropState,
  type ColumnDropState,
  type SwimlaneColumn,
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
            <span className="shrink-0 font-medium">
              {t("drumbeat.ui.wsjfWert", { score: formatWsjf(f.wsjfComputed) })}
            </span>
          )}
        </div>
      </button>
      <HandleRow
        type="source"
        position={Position.Right}
        connectable={data.connectable}
        visible={data.connectable}
      />
      <BracketTargetRow />
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
    columns,
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
  // Anschlüsse nach der **Live**-Lage — nach dem Ziehen stimmt die Reihenfolge weiter.
  const liveEdges = useLiveHandles(nodes, edges);
  const sicht = useFocusDimming(nodes, liveEdges, hoverId);

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
    [layout, canUpdate, drag, pis, features, artId, baseNodes, setNodes, router, dragSaveTimers],
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
): { nodes: Node[]; edges: Edge[]; columns: SwimlaneColumn[] } {
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
  const ghostIds = new Map<string, { title: string; hint: string }>();

  for (const d of dependencies) {
    if (d.offScopeRole === "from") {
      const ghostId = `ghost:from:${d.fromId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Predecessor (off-scope)",
        });
      }
      if (featureIds.has(d.toId)) dagreKanten.push([ghostId, d.toId]);
    } else if (d.offScopeRole === "to") {
      const ghostId = `ghost:to:${d.toId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Successor (off-scope)",
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
        data: { feature: f, onOpen, connectable } satisfies FeatureNodeData,
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
