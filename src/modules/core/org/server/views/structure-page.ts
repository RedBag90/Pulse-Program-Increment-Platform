import type {
  StructureTree,
  StructureTimeline,
} from "@/modules/core/org/server/services/structure";

/**
 * Structure page-model — flattens the VS → ART tree into a single list of
 * indented rows for the left column, plus per-entity detail shapes the right
 * pane consumes. Timelines + unassigned ARTs fold into the same flat list so
 * the user has one place to scan everything (the old page split the same data
 * across three tabs).
 *
 * Each row carries gap signals — VS without Portfolio-Manager/finance approver,
 * ART without RTE — so the user spots incomplete structure from the row, not by
 * drilling into a separate "Overview" tab.
 */

/**
 * Die Knotenarten des Modells. Es bedient zwei Flächen: der Organisations-Baum
 * unter `/structure` zeigt `vs`/`art`/`solution`, die Kadenz-Fläche unter
 * `/structure/timelines` zeigt `timeline`. Deshalb die Vereinigung statt zweier
 * Typen — die Zeilenform ist in beiden dieselbe.
 */
export type NodeKind = "vs" | "art" | "timeline" | "solution";

/** A flat-tree row in the left column. `depth` drives the left-padding indent. */
export interface StructureRow {
  kind: NodeKind;
  id: string;
  /** Parent row id, or null for top-level (VS + Timeline). Drives expand/collapse. */
  parentId: string | null;
  depth: number;
  /** Display label rendered in the row title. */
  label: string;
  /** Subtitle: e.g. "3 ARTs" for a VS, "2 PIs" for an ART. */
  subtitle: string;
  /** Gap signals (e.g. "Kein RTE"). Drives the 🛑 badge on the row. */
  gaps: string[];
}

/** Per-VS detail. */
export interface VsDetail {
  kind: "vs";
  id: string;
  name: string;
  description: string | null;
  vmoLabel: string | null;
  financeApproverLabel: string | null;
  artCount: number;
  artIds: string[];
}

/** Per-ART detail. */
export interface ArtDetail {
  kind: "art";
  id: string;
  name: string;
  description: string | null;
  valueStreamId: string;
  valueStreamName: string;
  rteLabel: string | null;
  timelineId: string | null;
  timelineName: string | null;
  piCount: number;
}

/** Per-Timeline detail. */
export interface TimelineDetail {
  kind: "timeline";
  id: string;
  name: string;
  pis: { id: string; name: string; startDate: string; endDate: string; status: string }[];
  subscribedArts: { id: string; name: string; valueStreamName: string | null }[];
  unassignedArts: { id: string; name: string; valueStreamName: string | null }[];
}

export type StructureDetail = VsDetail | ArtDetail | TimelineDetail;

export interface StructurePageModel {
  rows: StructureRow[];
  vs: Map<string, VsDetail>;
  art: Map<string, ArtDetail>;
  timeline: Map<string, TimelineDetail>;
  /** All ARTs not yet joined to a Timeline — surfaced under each Timeline detail. */
  unassignedArts: { id: string; name: string; valueStreamName: string | null }[];
  /** Counts for the kind-filter chips. */
  kindCounts: Record<NodeKind, number>;
}

function nameOrNull(id: string | null, labels: Readonly<Record<string, string>>): string | null {
  if (!id) return null;
  return labels[id] ?? id;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const HORIZON_SHORT: Record<string, string> = {
  h0: "H0 · Decommissioning",
  h1: "H1 · Investing",
  h2: "H2 · Emerging",
  h3: "H3 · R&D",
};

/** Eine Solution als Baum-Zeile — unter ihrem ART, sonst unter dem Wertstrom. */
function solutionRow(
  sol: { id: string; name: string; horizon: string },
  parentId: string,
  depth: number,
): StructureRow {
  return {
    kind: "solution",
    id: sol.id,
    parentId,
    depth,
    label: sol.name,
    subtitle: HORIZON_SHORT[sol.horizon] ?? sol.horizon,
    gaps: [],
  };
}

export type StructureMode = "structure" | "timelines";

export function buildStructurePageModel(input: {
  /** Welche Knoten in der Liste erscheinen. `structure` = VS/ART,
   *  `timelines` = Timelines. ART-Details (mit zugehoeriger Timeline-Anzeige)
   *  werden in beiden Modi befuellt, weil das ART-Detail-Pane in beiden
   *  faellen via Click-Through erreichbar ist. */
  mode: StructureMode;
  tree: StructureTree;
  timeline: StructureTimeline;
  userLabels: Readonly<Record<string, string>>;
}): StructurePageModel {
  const { mode, tree, timeline, userLabels } = input;

  const timelineNameById = new Map<string, string>(timeline.timelines.map((t) => [t.id, t.name]));
  const artTimelineId = new Map<string, string>();
  for (const t of timeline.timelines) {
    for (const a of t.arts) artTimelineId.set(a.id, t.id);
  }

  const rows: StructureRow[] = [];
  const vsDetails = new Map<string, VsDetail>();
  const artDetails = new Map<string, ArtDetail>();
  const timelineDetails = new Map<string, TimelineDetail>();

  for (const vs of tree) {
    const artCount = vs.arts.length;
    const vsGaps: string[] = [];
    if (!vs.vmoId) vsGaps.push("Kein:e Portfolio Manager");
    if (!vs.financeApproverId) vsGaps.push("Kein:e Finance-Approver:in");
    if (mode === "structure") {
      rows.push({
        kind: "vs",
        id: vs.id,
        parentId: null,
        depth: 0,
        label: vs.name,
        subtitle: `${artCount} ART${artCount === 1 ? "" : "s"}`,
        gaps: vsGaps,
      });
    }
    vsDetails.set(vs.id, {
      kind: "vs",
      id: vs.id,
      name: vs.name,
      description: vs.description ?? null,
      vmoLabel: nameOrNull(vs.vmoId, userLabels),
      financeApproverLabel: nameOrNull(vs.financeApproverId, userLabels),
      artCount,
      artIds: vs.arts.map((a) => a.id),
    });

    const solutionsOfArt = new Map<string, typeof vs.solutions>();
    for (const sol of vs.solutions) {
      if (sol.artId == null) continue;
      solutionsOfArt.set(sol.artId, [...(solutionsOfArt.get(sol.artId) ?? []), sol]);
    }

    for (const art of vs.arts) {
      const artGaps: string[] = [];
      if (!art.rteId) artGaps.push("Kein:e RTE");
      if (mode === "structure") {
        rows.push({
          kind: "art",
          id: art.id,
          parentId: vs.id,
          depth: 1,
          label: art.name,
          subtitle: `${art._count.pis} PI${art._count.pis === 1 ? "" : "s"}`,
          gaps: artGaps,
        });
        for (const sol of solutionsOfArt.get(art.id) ?? []) {
          rows.push(solutionRow(sol, art.id, 2));
        }
      }
      const tid = artTimelineId.get(art.id) ?? null;
      artDetails.set(art.id, {
        kind: "art",
        id: art.id,
        name: art.name,
        description: art.description ?? null,
        valueStreamId: vs.id,
        valueStreamName: vs.name,
        rteLabel: nameOrNull(art.rteId, userLabels),
        timelineId: tid,
        timelineName: tid ? (timelineNameById.get(tid) ?? null) : null,
        piCount: art._count.pis,
      });
    }

    // Ohne ART hängt die Solution direkt am Wertstrom — sie trägt immer einen,
    // `artId` ist optional. Sie unterschlagen hieße, sie unauffindbar machen.
    if (mode === "structure") {
      for (const sol of vs.solutions) {
        if (sol.artId != null) continue;
        rows.push(solutionRow(sol, vs.id, 1));
      }
    }
  }

  for (const t of timeline.timelines) {
    if (mode === "timelines") {
      rows.push({
        kind: "timeline",
        id: t.id,
        parentId: null,
        depth: 0,
        label: t.name,
        subtitle: `${t.programIncrements.length} PIs · ${t.arts.length} ARTs`,
        gaps: [],
      });
    }
    timelineDetails.set(t.id, {
      kind: "timeline",
      id: t.id,
      name: t.name,
      pis: t.programIncrements.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: isoDay(p.startDate),
        endDate: isoDay(p.endDate),
        status: p.status,
      })),
      subscribedArts: t.arts.map((a) => ({
        id: a.id,
        name: a.name,
        valueStreamName: a.valueStream?.name ?? null,
      })),
      unassignedArts: timeline.unassignedArts.map((a) => ({
        id: a.id,
        name: a.name,
        valueStreamName: a.valueStream?.name ?? null,
      })),
    });
  }

  const kindCounts: Record<NodeKind, number> = {
    vs: 0,
    art: 0,
    timeline: 0,
    solution: 0,
  };
  for (const r of rows) kindCounts[r.kind] += 1;

  return {
    rows,
    vs: vsDetails,
    art: artDetails,
    timeline: timelineDetails,
    unassignedArts: timeline.unassignedArts.map((a) => ({
      id: a.id,
      name: a.name,
      valueStreamName: a.valueStream?.name ?? null,
    })),
    kindCounts,
  };
}
