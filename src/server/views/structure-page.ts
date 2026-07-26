import type { StructureTree, StructureTimeline } from "@/server/services/structure";

/**
 * Structure page-model — flattens the VS → ART → Team tree into a single list
 * of indented rows for the left column, plus per-entity detail shapes the
 * right pane consumes. Timelines + unassigned ARTs fold into the same flat
 * list so the user has one place to scan everything (the old page split the
 * same data across three tabs).
 *
 * Each row carries gap signals — VS without Portfolio-Manager/finance approver, ART
 * without RTE, Team without Scrum Master / PO — so the user spots
 * incomplete structure from the row, not by drilling into a separate
 * "Overview" tab.
 */

export type NodeKind = "vs" | "art" | "team" | "timeline";

/** A flat-tree row in the left column. `depth` drives the left-padding indent. */
export interface StructureRow {
  kind: NodeKind;
  id: string;
  /** Parent row id, or null for top-level (VS + Timeline). Drives expand/collapse. */
  parentId: string | null;
  depth: number;
  /** Display label rendered in the row title. */
  label: string;
  /** Subtitle: e.g. "3 ARTs · 12 Teams" for a VS, "2 Sprints" for a Team. */
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
  budgetTotal: number | null;
  artCount: number;
  teamCount: number;
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
  piCadenceWeeks: number;
  piCount: number;
  teamCount: number;
  teamIds: string[];
}

/** Per-Team detail. */
export interface TeamDetail {
  kind: "team";
  id: string;
  name: string;
  artId: string;
  artName: string;
  headcount: number | null;
  targetVelocity: number | null;
  teamType: string | null;
  scrumMasterLabel: string | null;
  productOwnerLabel: string | null;
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

export type StructureDetail = VsDetail | ArtDetail | TeamDetail | TimelineDetail;

export interface StructurePageModel {
  rows: StructureRow[];
  vs: Map<string, VsDetail>;
  art: Map<string, ArtDetail>;
  team: Map<string, TeamDetail>;
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

export type StructureMode = "structure" | "timelines";

export function buildStructurePageModel(input: {
  /** Welche Knoten in der Liste erscheinen. `structure` = VS/ART/Team,
   *  `timelines` = Timelines. ART-Details (mit zugehoeriger Timeline-Anzeige)
   *  werden in beiden Modi befuellt, weil das ART-Detail-Pane in beiden
   *  faellen via Click-Through erreichbar ist. */
  mode: StructureMode;
  tree: StructureTree;
  timeline: StructureTimeline;
  userLabels: Readonly<Record<string, string>>;
  budgetTotals: Readonly<Record<string, number>>;
}): StructurePageModel {
  const { mode, tree, timeline, userLabels, budgetTotals } = input;

  // Build a userLabel lookup for ART.timelineId resolution (lookup against
  // the timeline tab's data).
  const timelineNameById = new Map<string, string>(timeline.timelines.map((t) => [t.id, t.name]));
  // Index ART → timelineId. The `tree` doesn't carry timelineId, so we look
  // it up via the `timeline.timelines[*].arts[*]` subscription list.
  const artTimelineId = new Map<string, string>();
  for (const t of timeline.timelines) {
    for (const a of t.arts) artTimelineId.set(a.id, t.id);
  }

  const rows: StructureRow[] = [];
  const vsDetails = new Map<string, VsDetail>();
  const artDetails = new Map<string, ArtDetail>();
  const teamDetails = new Map<string, TeamDetail>();
  const timelineDetails = new Map<string, TimelineDetail>();

  // VS / ART / Team rows. Im `timelines`-Mode bauen wir die Details
  // trotzdem auf (das ART-Detail-Pane wird ueber Click-Through aus
  // Timeline-Detail ebenfalls erreichbar gemacht), aber legen keine
  // Listen-Rows an.
  for (const vs of tree) {
    const artCount = vs.arts.length;
    const teamCount = vs.arts.reduce((acc, a) => acc + a.teams.length, 0);
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
        subtitle: `${artCount} ART${artCount === 1 ? "" : "s"} · ${teamCount} Team${teamCount === 1 ? "" : "s"}`,
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
      budgetTotal: budgetTotals[vs.id] ?? null,
      artCount,
      teamCount,
      artIds: vs.arts.map((a) => a.id),
    });

    for (const art of vs.arts) {
      const teamCountForArt = art.teams.length;
      const artGaps: string[] = [];
      if (!art.rteId) artGaps.push("Kein:e RTE");
      if (mode === "structure") {
        rows.push({
          kind: "art",
          id: art.id,
          parentId: vs.id,
          depth: 1,
          label: art.name,
          subtitle: `${teamCountForArt} Team${teamCountForArt === 1 ? "" : "s"} · ${art._count.pis} PIs`,
          gaps: artGaps,
        });
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
        piCadenceWeeks: art.piCadenceWeeks,
        piCount: art._count.pis,
        teamCount: teamCountForArt,
        teamIds: art.teams.map((t) => t.id),
      });

      for (const team of art.teams) {
        const teamGaps: string[] = [];
        if (!team.scrumMasterId) teamGaps.push("Kein:e Scrum Master:in");
        if (!team.productOwnerId) teamGaps.push("Kein:e PO");
        if (mode === "structure") {
          rows.push({
            kind: "team",
            id: team.id,
            parentId: art.id,
            depth: 2,
            label: team.name,
            subtitle: `${team.headcount ?? "—"} Personen`,
            gaps: teamGaps,
          });
        }
        teamDetails.set(team.id, {
          kind: "team",
          id: team.id,
          name: team.name,
          artId: art.id,
          artName: art.name,
          headcount: team.headcount,
          targetVelocity: team.targetVelocity,
          teamType: team.teamType,
          scrumMasterLabel: nameOrNull(team.scrumMasterId, userLabels),
          productOwnerLabel: nameOrNull(team.productOwnerId, userLabels),
        });
      }
    }
  }

  // Timeline-Rows + Details — nur im `timelines`-Modus in der Liste; die
  // Details bauen wir auch im structure-Modus auf, weil ART-Details auf
  // `timelineName` zeigen.
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
    team: 0,
    timeline: 0,
  };
  for (const r of rows) kindCounts[r.kind] += 1;

  return {
    rows,
    vs: vsDetails,
    art: artDetails,
    team: teamDetails,
    timeline: timelineDetails,
    unassignedArts: timeline.unassignedArts.map((a) => ({
      id: a.id,
      name: a.name,
      valueStreamName: a.valueStream?.name ?? null,
    })),
    kindCounts,
  };
}
