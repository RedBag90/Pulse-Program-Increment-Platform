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
}

export interface BreakdownGraphEdge {
  id: string;
  source: string;
  target: string;
  type: DependencyEdgeType;
}

export interface BreakdownGraphModel {
  nodes: BreakdownGraphNode[];
  edges: BreakdownGraphEdge[];
  /** Anzahl Edges, die im Input vorkamen aber rausgefiltert wurden
   *  (Endpunkt nicht in `features`). Surfaces als Hinweis im UI. */
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
}

interface DependencyInput {
  id: string;
  fromId: string;
  toId: string;
  type: string;
}

function tierFor(wsjf: number | null): BreakdownGraphNode["wsjfTier"] {
  if (wsjf == null) return "unscored";
  if (wsjf >= 8) return "high";
  if (wsjf >= 4) return "medium";
  return "low";
}

function isValidEdgeType(t: string): t is DependencyEdgeType {
  return t === "blocks" || t === "depends_on" || t === "relates_to";
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
    wsjfTier: tierFor(f.wsjfComputed),
    wsjf: {
      bv: f.wsjfBusinessValue,
      tc: f.wsjfTimeCriticality,
      rr: f.wsjfRiskReduction,
      js: f.wsjfJobSize,
    },
  }));

  let dropped = 0;
  const edges: BreakdownGraphEdge[] = [];
  for (const d of dependencies) {
    if (!featureIds.has(d.fromId) || !featureIds.has(d.toId)) {
      dropped += 1;
      continue;
    }
    if (!isValidEdgeType(d.type)) {
      dropped += 1;
      continue;
    }
    edges.push({ id: d.id, source: d.fromId, target: d.toId, type: d.type });
  }

  return { nodes, edges, droppedEdgeCount: dropped };
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
  };
}
