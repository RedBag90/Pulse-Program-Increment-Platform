/**
 * PI overview aggregation — pure. Rolls the data of a Program Increment
 * (features, impediments) into the headline metrics shown on the PI detail
 * page. Team-derived capacity and PI objectives were removed with the Team
 * concept; the budget/WSJF capacity lives separately in `pi-capacity.ts`.
 */

export interface PiOverviewInput {
  features: ReadonlyArray<{ status: string }>;
  impediments: ReadonlyArray<{ status: string }>;
}

export interface PiOverviewSummary {
  impediments: { open: number; escalated: number };
  featureStatus: { status: string; count: number }[];
}

export function summarizePiOverview(input: PiOverviewInput): PiOverviewSummary {
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
    impediments: { open, escalated },
    featureStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}
