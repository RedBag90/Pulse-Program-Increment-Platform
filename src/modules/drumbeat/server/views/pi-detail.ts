/**
 * PI Detail page-model — turns the loaded PI + open-issue count + candidate
 * Features into the render-ready shape the multi-ART detail page consumes.
 * Pure; mirrors the Portfolio Overview builder.
 *
 * Die Page beantwortet zwei Fragen:
 *   - "welche Features sind in diesem PI, gruppiert nach ART?"
 *   - "welche Features koennten in dieses PI landen, gruppiert nach ART?"
 *
 * Plus das `summary` (offene Issues + Feature-Status-Verteilung), das inline
 * aus `pi.initiatives` mitgezählt wird. Team-/Objective-/Kapazitäts-Achsen
 * sind mit dem Team-Rückbau entfallen.
 */

/**
 * Headline metrics for the PI detail page: open (roamStatus "open") Issues in
 * the PI's ARTs, plus the Feature-status distribution. Consumed by the
 * `PiOverviewSummary` component.
 */
export interface PiOverviewSummary {
  openIssues: number;
  featureStatus: { status: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Structural input row types — minimal shape the builder reads.
// ---------------------------------------------------------------------------

export interface PiDetailArt {
  id: string;
  name: string;
}

export interface PiDetailTimeline {
  id: string;
  name: string;
  arts: PiDetailArt[];
}

export interface PiDetailFeatureRow {
  id: string;
  title: string;
  status: string;
  wsjfComputed: number | string | { toNumber(): number } | null;
  artId: string | null;
}

export interface PiDetailPi {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  timeline: PiDetailTimeline | null;
  initiatives: PiDetailFeatureRow[];
}

export interface PiDetailCandidateRow {
  id: string;
  title: string;
  wsjfComputed: number | string | { toNumber(): number } | null;
  artId: string | null;
  pi: { name: string } | null;
}

// ---------------------------------------------------------------------------
// Output shape.
// ---------------------------------------------------------------------------

export interface PiDetailFeatureCard {
  id: string;
  title: string;
  status: string;
  wsjfComputed: number | null;
}

export interface PiDetailCandidate {
  id: string;
  title: string;
  wsjfComputed: number | null;
  currentPiName: string | null;
}

export interface PiDetailModel {
  pi: { id: string; name: string; status: string; startDate: Date; endDate: Date };
  timeline: PiDetailTimeline;
  arts: PiDetailArt[];
  /** First subscribed ART — used as the auth scope for click-throughs. */
  primaryArt: PiDetailArt;
  featuresByArt: Map<string, PiDetailFeatureCard[]>;
  candidatesByArt: Map<string, PiDetailCandidate[]>;
  summary: PiOverviewSummary;
}

// ---------------------------------------------------------------------------
// Inputs + builder.
// ---------------------------------------------------------------------------

export interface PiDetailInputs {
  pi: PiDetailPi;
  /** Offene Issues (roamStatus "open") in den ARTs dieses PI — vorab gezählt. */
  openIssues: number;
  candidates: PiDetailCandidateRow[];
}

function toNumber(v: number | string | { toNumber(): number } | null): number | null {
  if (v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return v.toNumber();
}

/**
 * Builds the PI Detail page-model. Returns `null` when the PI's Timeline has
 * no subscribed ARTs — the page surfaces that as a not-found, keeping the
 * "primaryArt is always defined" invariant for downstream consumers.
 */
export function buildPiDetailModel(inputs: PiDetailInputs): PiDetailModel | null {
  const { pi, openIssues, candidates } = inputs;
  const timeline = pi.timeline;
  if (!timeline) return null;
  const arts = timeline.arts;
  const primaryArt = arts[0];
  if (!primaryArt) return null;

  // Group candidates by ART — each Features sub-card should only see its pool.
  const candidatesByArt = new Map<string, PiDetailCandidate[]>();
  for (const c of candidates) {
    if (!c.artId) continue;
    const list = candidatesByArt.get(c.artId) ?? [];
    list.push({
      id: c.id,
      title: c.title,
      wsjfComputed: toNumber(c.wsjfComputed),
      currentPiName: c.pi?.name ?? null,
    });
    candidatesByArt.set(c.artId, list);
  }

  // Features in this PI grouped by their owning ART. The status distribution
  // for the overview summary is folded into the same pass — counted across all
  // initiatives (orphans without an ART included), before the ART grouping.
  const featuresByArt = new Map<string, PiDetailFeatureCard[]>();
  const statusCounts = new Map<string, number>();
  for (const f of pi.initiatives) {
    statusCounts.set(f.status, (statusCounts.get(f.status) ?? 0) + 1);
    if (!f.artId) continue;
    const list = featuresByArt.get(f.artId) ?? [];
    list.push({
      id: f.id,
      title: f.title,
      status: f.status,
      wsjfComputed: toNumber(f.wsjfComputed),
    });
    featuresByArt.set(f.artId, list);
  }

  const summary: PiOverviewSummary = {
    openIssues,
    featureStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };

  return {
    pi: {
      id: pi.id,
      name: pi.name,
      status: pi.status,
      startDate: pi.startDate,
      endDate: pi.endDate,
    },
    timeline,
    arts,
    primaryArt,
    featuresByArt,
    candidatesByArt,
    summary,
  };
}
