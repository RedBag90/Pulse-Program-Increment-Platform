import { summarizePiOverview, type PiOverviewSummary } from "@/modules/drumbeat/domain/pi-overview";

/**
 * PI Detail page-model — turns the loaded PI + impediments + candidate
 * Features into the render-ready shape the multi-ART detail page consumes.
 * Pure; mirrors `buildPlanningModel` / Portfolio Overview.
 *
 * Die Page beantwortet zwei Fragen:
 *   - "welche Features sind in diesem PI, gruppiert nach ART?"
 *   - "welche Features koennten in dieses PI landen, gruppiert nach ART?"
 *
 * Plus das `summary` (delegiert an `summarizePiOverview` aus `domain/`).
 * Team-/Objective-/Kapazitäts-Achsen sind mit dem Team-Rückbau entfallen.
 */

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

export interface PiDetailImpediment {
  status: string;
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
  impediments: PiDetailImpediment[];
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
  const { pi, impediments, candidates } = inputs;
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

  // Features in this PI grouped by their owning ART.
  const featuresByArt = new Map<string, PiDetailFeatureCard[]>();
  for (const f of pi.initiatives) {
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

  const summary = summarizePiOverview({
    features: pi.initiatives.map((f) => ({ status: f.status })),
    impediments: impediments.map((i) => ({ status: i.status })),
  });

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
