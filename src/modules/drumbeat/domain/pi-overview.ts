/**
 * PI overview aggregation — pure. Rolls the data of a Program Increment
 * (teams, features, objectives, impediments) into the headline metrics
 * shown on the PI detail page.
 *
 * Nach dem Wegfall von Story + Sprint-Planning gibt es keine punkte-
 * basierte Velocity mehr. Die Kapazitaet entsteht aus den Team-
 * `targetVelocity` × Anzahl synthetischer Sprints (PI-Dauer / 14 Tage,
 * Default-Cadence 2 Wochen).
 */

const SPRINT_CADENCE_DAYS = 14;

export interface PiOverviewInput {
  teams: ReadonlyArray<{ targetVelocity: number | null }>;
  /** PI duration in days — used to derive sprint multiplier for capacity. */
  piDurationDays: number;
  features: ReadonlyArray<{ status: string }>;
  objectives: ReadonlyArray<{ committed: boolean; confidence: number | null }>;
  impediments: ReadonlyArray<{ status: string }>;
}

export interface PiOverviewSummary {
  capacity: { plannedCapacity: number };
  objectives: { total: number; committed: number; avgConfidence: number | null };
  impediments: { open: number; escalated: number };
  featureStatus: { status: string; count: number }[];
}

export function summarizePiOverview(input: PiOverviewInput): PiOverviewSummary {
  const sprintMultiplier = Math.max(1, Math.round(input.piDurationDays / SPRINT_CADENCE_DAYS));
  const plannedCapacity = input.teams.reduce(
    (sum, t) => sum + (t.targetVelocity ?? 0) * sprintMultiplier,
    0,
  );

  let committed = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  for (const obj of input.objectives) {
    if (obj.committed) committed += 1;
    if (obj.confidence !== null) {
      confidenceSum += obj.confidence;
      confidenceCount += 1;
    }
  }
  const avgConfidence =
    confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 10) / 10 : null;

  let open = 0;
  let escalated = 0;
  for (const imp of input.impediments) {
    if (imp.status === "open") open += 1;
    else if (imp.status === "escalated") escalated += 1;
  }

  const statusCounts = new Map<string, number>();
  for (const feature of input.features) {
    statusCounts.set(feature.status, (statusCounts.get(feature.status) ?? 0) + 1);
  }

  return {
    capacity: { plannedCapacity },
    objectives: { total: input.objectives.length, committed, avgConfidence },
    impediments: { open, escalated },
    featureStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}
