/**
 * Page-Model fuer den PI-Workspace (Roadmap-P2.A · Overview-Tab).
 *
 * Buendelt PI-Stammdaten + Features-Burnup + Objectives-Confidence +
 * Impediments/Risks-Counter zu einem render-fertigen Shape. Reine
 * Funktion — kein DB-Zugriff. Aufgerufen von der Page mit
 * vorgeladenen Rohdaten.
 */

export type PiStatus = "planned" | "active" | "completed";

export interface PiObjectiveInput {
  committed: boolean;
  confidence: number | null;
}

export interface PiFeatureInput {
  status: string;
  wsjfJobSize: number | null;
}

export interface PiImpedimentInput {
  status: string;
  roamStatus: string;
}

export interface PiWorkspaceInput {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  artId: string | null;
  artName: string | null;
  timelineName: string | null;
  /** Snapshot-Datum, gegen das `daysRemaining` berechnet wird. Default = `new Date()`. */
  now?: Date;
  features: PiFeatureInput[];
  objectives: PiObjectiveInput[];
  impediments: PiImpedimentInput[];
  /** Platzhalter bis Risk-Register (Roadmap-P5). */
  riskCount?: number;
}

export interface FeatureBurnup {
  total: number;
  completed: number;
  /** Job-Size-Summe ueber alle Features. */
  jobSizeTotal: number;
  /** Job-Size-Summe der `completed` Features. */
  jobSizeCompleted: number;
  /** Anteil 0..1 nach Job-Size; null wenn jobSizeTotal === 0. */
  progress: number | null;
}

export interface ObjectiveConfidence {
  /** Anzahl Objectives mit Confidence-Vote. */
  voted: number;
  /** Anzahl committed Objectives ueberhaupt. */
  committed: number;
  /** Durchschnitt (1..5) ueber voted Objectives; null wenn voted === 0. */
  average: number | null;
}

export interface PiWorkspaceModel {
  id: string;
  name: string;
  status: PiStatus | string;
  startDate: Date;
  endDate: Date;
  art: { id: string; name: string } | null;
  timelineName: string | null;
  /** Verbleibende Tage bis Ende; negativ wenn schon ueberschritten. */
  daysRemaining: number;
  featureBurnup: FeatureBurnup;
  objectiveConfidence: ObjectiveConfidence;
  impediments: {
    total: number;
    escalated: number;
    /** Impediments mit roamStatus === "open" — Closure-Blocker. */
    unroamed: number;
  };
  riskCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  // Beide auf UTC-Mitternacht normieren, damit Sommer-/Winterzeit nicht
  // springt.
  const aMid = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bMid = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bMid - aMid) / DAY_MS);
}

export function computeFeatureBurnup(features: PiFeatureInput[]): FeatureBurnup {
  let total = 0;
  let completed = 0;
  let jobSizeTotal = 0;
  let jobSizeCompleted = 0;
  for (const f of features) {
    total += 1;
    const js = f.wsjfJobSize ?? 0;
    jobSizeTotal += js;
    if (f.status === "completed") {
      completed += 1;
      jobSizeCompleted += js;
    }
  }
  const progress = jobSizeTotal > 0 ? jobSizeCompleted / jobSizeTotal : null;
  return { total, completed, jobSizeTotal, jobSizeCompleted, progress };
}

export function computeObjectiveConfidence(objectives: PiObjectiveInput[]): ObjectiveConfidence {
  let committed = 0;
  let voted = 0;
  let sum = 0;
  for (const o of objectives) {
    if (!o.committed) continue;
    committed += 1;
    if (o.confidence != null) {
      voted += 1;
      sum += o.confidence;
    }
  }
  const average = voted > 0 ? sum / voted : null;
  return { voted, committed, average };
}

export function buildPiWorkspaceModel(input: PiWorkspaceInput): PiWorkspaceModel {
  const now = input.now ?? new Date();
  const daysRemaining = daysBetween(now, input.endDate);

  const escalated = input.impediments.filter((i) => i.status === "escalated").length;
  const unroamed = input.impediments.filter((i) => i.roamStatus === "open").length;

  return {
    id: input.id,
    name: input.name,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    art: input.artId && input.artName != null ? { id: input.artId, name: input.artName } : null,
    timelineName: input.timelineName,
    daysRemaining,
    featureBurnup: computeFeatureBurnup(input.features),
    objectiveConfidence: computeObjectiveConfidence(input.objectives),
    impediments: {
      total: input.impediments.length,
      escalated,
      unroamed,
    },
    riskCount: input.riskCount ?? 0,
  };
}
