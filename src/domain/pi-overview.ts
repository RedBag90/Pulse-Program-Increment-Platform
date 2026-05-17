/**
 * PI overview aggregation — pure. Rolls the data of a Program Increment
 * (sprints/stories, features, objectives, impediments) into the headline
 * metrics shown on the PI detail page.
 */

/** Story statuses that count as delivered for the velocity figure. */
const DONE_STATUSES = new Set(["done", "completed"]);

export interface PiOverviewInput {
  sprints: ReadonlyArray<{
    /** Target velocity of the sprint's team, or null when unknown. */
    teamTargetVelocity: number | null;
    stories: ReadonlyArray<{ storyPoints: number | null; status: string }>;
  }>;
  features: ReadonlyArray<{ status: string }>;
  objectives: ReadonlyArray<{ committed: boolean; confidence: number | null }>;
  impediments: ReadonlyArray<{ status: string }>;
}

export interface PiOverviewSummary {
  velocity: { plannedPoints: number; completedPoints: number };
  capacity: { plannedCapacity: number; sprintCount: number };
  objectives: { total: number; committed: number; avgConfidence: number | null };
  impediments: { open: number; escalated: number };
  featureStatus: { status: string; count: number }[];
}

export function summarizePiOverview(input: PiOverviewInput): PiOverviewSummary {
  let plannedPoints = 0;
  let completedPoints = 0;
  let plannedCapacity = 0;
  for (const sprint of input.sprints) {
    plannedCapacity += sprint.teamTargetVelocity ?? 0;
    for (const story of sprint.stories) {
      const points = story.storyPoints ?? 0;
      plannedPoints += points;
      if (DONE_STATUSES.has(story.status)) completedPoints += points;
    }
  }

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
    velocity: { plannedPoints, completedPoints },
    capacity: { plannedCapacity, sprintCount: input.sprints.length },
    objectives: { total: input.objectives.length, committed, avgConfidence },
    impediments: { open, escalated },
    featureStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}
