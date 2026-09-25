/**
 * Page-Model fuer die Netzplan-Ansicht im Breakdown-Tab (Roadmap-N1).
 *
 * Reine Transformation: nimmt die Child-Features eines Epics + die
 * Dependencies (gefiltert auf scope = nur Edges zwischen Features
 * desselben Epics) und liefert eine Render-fertige Node-+-Edge-Liste
 * fuer die ReactFlow-Canvas.
 *
 * Layout (x/y) wird hier **nicht** berechnet — dagre laeuft erst
 * client-seitig im Browser, weil die Knoten-Groesse erst dort steht.
 */

import type { Initiative } from "@/generated/prisma";
import { wsjfTier } from "@/modules/drumbeat/domain/wsjf";
import { classifyScopedEdges } from "@/modules/drumbeat/domain/graph-scope";

export type DependencyEdgeType = "blocks" | "depends_on" | "relates_to";

export interface BreakdownGraphNode {
  id: string;
  title: string;
  status: string;
  artName: string;
  /** "feature" | "enabler" | null — treibt das Badge im Custom-Node. */
  featureType: string | null;
  wsjfComputed: number | null;
  wsjfTier: "high" | "medium" | "low" | "unscored";
  /** Raw-WSJF-Komponenten — fuer den Refine-Dialog im Netzplan. */
  wsjf: {
    bv: number | null;
    tc: number | null;
    rr: number | null;
    js: number | null;
  };
  /** PI-Zuordnung (null = Backlog). Treibt den PI-Bahnen-Layout. */
  piId: string | null;
}

export interface BreakdownGraphEdge {
  id: string;
  source: string;
  target: string;
  type: DependencyEdgeType;
}

/**
 * Ghost-Node fuer einen Cross-Epic-Endpunkt (Roadmap-P6). Wird im
 * Netzplan als gestrichelter, gedimmter Knoten links (predecessor) bzw.
 * rechts (successor) der internen Features gerendert. Klick navigiert
 * zum externen Feature-Detail.
 */
/**
 * **Die Id eines Geisters trägt seine Rolle.**
 *
 * Sie war bis September 2026 die **rohe** Initiative-Id. Ein Feature, das für
 * dieses Epic zugleich Vorgänger *und* Nachfolger ist, ergab damit zwei
 * Einträge mit **derselben** Id — und zwei ReactFlow-Knoten mit einer Id sind
 * ein Knoten. Der Kommentar hier räumte es sogar ein („werden zweimal
 * gerendert"); tatsächlich überschrieb der zweite den ersten.
 *
 * Das Cockpit macht es seit jeher so (`ghost:from:…`). Die Kanten-Endpunkte
 * auf der externen Seite tragen dieselbe Id — sonst zeigte die Kante ins Leere.
 */
export const ghostId = (role: "predecessor" | "successor", initiativeId: string): string =>
  `ghost:${role}:${initiativeId}`;

export interface BreakdownGhostNode {
  /** Rollen-behaftet, siehe {@link ghostId} — **nicht** die Initiative-Id. */
  id: string;
  /** Die echte Initiative dahinter — für Verweise auf ihre Detailseite. */
  initiativeId: string;
  title: string;
  /** Titel des Parent-Epics. null wenn der Initiative-Parent fehlt
   *  (sollte in der Praxis nicht vorkommen, defensiv). */
  epicTitle: string | null;
  epicId: string | null;
  /** "predecessor" wenn der externe Knoten Source einer Edge in dieses
   *  Epic ist; "successor" wenn er Target einer Edge aus diesem Epic ist. */
  role: "predecessor" | "successor";
}

export interface BreakdownGraphModel {
  nodes: BreakdownGraphNode[];
  edges: BreakdownGraphEdge[];
  /** Cross-Epic-Endpunkte (Roadmap-P6). */
  ghostNodes: BreakdownGhostNode[];
  /** Anzahl Edges, die wegen ungueltigem Type verworfen wurden. */
  droppedEdgeCount: number;
}

interface BreakdownFeatureInput {
  id: string;
  title: string;
  status: string;
  artName: string;
  featureType: string | null;
  wsjfComputed: number | null;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  piId: string | null;
}

interface DependencyInput {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  /** Info ueber die Endpunkte — fuer Ghost-Nodes (P6). Optional, weil
   *  Aufrufer ohne Cross-Epic-Scope (Tests) keine Joins brauchen. */
  from?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  to?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
}

export function buildBreakdownGraph(input: {
  features: readonly BreakdownFeatureInput[];
  dependencies: readonly DependencyInput[];
}): BreakdownGraphModel {
  const { features, dependencies } = input;

  const featureIds = new Set(features.map((f) => f.id));

  const nodes: BreakdownGraphNode[] = features.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    artName: f.artName,
    featureType: f.featureType,
    wsjfComputed: f.wsjfComputed,
    wsjfTier: wsjfTier(f.wsjfComputed),
    wsjf: {
      bv: f.wsjfBusinessValue,
      tc: f.wsjfTimeCriticality,
      rr: f.wsjfRiskReduction,
      js: f.wsjfJobSize,
    },
    piId: f.piId,
  }));

  // Scope-Klassifikation zentral (graph-scope): verwirft ungueltige Types +
  // Edges mit beiden Endpunkten off-scope. `dropped` = wieviele so wegfielen.
  const scoped = classifyScopedEdges(dependencies, featureIds);
  const dropped = dependencies.length - scoped.length;
  const edges: BreakdownGraphEdge[] = [];
  const ghostMap = new Map<string, BreakdownGhostNode>();
  for (const s of scoped) {
    const d = s.edge;
    let source = d.fromId;
    let target = d.toId;
    if (s.offScopeEndpoint?.side === "from") {
      // Source ist extern → Ghost-Predecessor
      source = ghostId("predecessor", d.fromId);
      if (!ghostMap.has(source)) {
        ghostMap.set(source, {
          id: source,
          initiativeId: d.fromId,
          title: d.from?.title ?? "Externes Feature",
          epicTitle: d.from?.parent?.title ?? null,
          epicId: d.from?.parent?.id ?? null,
          role: "predecessor",
        });
      }
    } else if (s.offScopeEndpoint?.side === "to") {
      target = ghostId("successor", d.toId);
      if (!ghostMap.has(target)) {
        ghostMap.set(target, {
          id: target,
          initiativeId: d.toId,
          title: d.to?.title ?? "Externes Feature",
          epicTitle: d.to?.parent?.title ?? null,
          epicId: d.to?.parent?.id ?? null,
          role: "successor",
        });
      }
    }
    edges.push({
      id: d.id,
      source,
      target,
      type: d.type as DependencyEdgeType,
    });
  }

  return {
    nodes,
    edges,
    ghostNodes: Array.from(ghostMap.values()),
    droppedEdgeCount: dropped,
  };
}

/**
 * Helper: aus Prisma-Initiative-Rows (Feature-Level) das schmalere
 * `BreakdownFeatureInput`-Shape ableiten. Damit kann die Page die
 * Initiative-Rows ohne Doppel-Mapping reichen.
 */
export function toBreakdownFeatureInput(
  row: Pick<
    Initiative,
    | "id"
    | "title"
    | "status"
    | "featureType"
    | "wsjfComputed"
    | "wsjfBusinessValue"
    | "wsjfTimeCriticality"
    | "wsjfRiskReduction"
    | "wsjfJobSize"
    | "piId"
  > & {
    artName: string | null;
  },
): BreakdownFeatureInput {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    artName: row.artName ?? "—",
    featureType: row.featureType,
    wsjfComputed: row.wsjfComputed != null ? Number(row.wsjfComputed) : null,
    wsjfBusinessValue: row.wsjfBusinessValue,
    wsjfTimeCriticality: row.wsjfTimeCriticality,
    wsjfRiskReduction: row.wsjfRiskReduction,
    wsjfJobSize: row.wsjfJobSize,
    piId: row.piId,
  };
}
