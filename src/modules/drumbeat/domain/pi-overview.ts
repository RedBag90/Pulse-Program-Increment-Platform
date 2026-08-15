/**
 * PI overview aggregation — pure. Rolls the data of a Program Increment
 * (features, open issues) into the headline metrics shown on the PI detail
 * page. Team-derived capacity and PI objectives were removed with the Team
 * concept; the budget/WSJF capacity lives separately in `pi-capacity.ts`.
 *
 * `openIssues` = offene (roamStatus "open") Einträge aus dem vereinten
 * Issue-Register für die ARTs dieses PI — vom Loader vorab gezählt.
 */

export interface PiOverviewInput {
  features: ReadonlyArray<{ status: string }>;
  openIssues: number;
}

export interface PiOverviewSummary {
  openIssues: number;
  featureStatus: { status: string; count: number }[];
}

export function summarizePiOverview(input: PiOverviewInput): PiOverviewSummary {
  const statusCounts = new Map<string, number>();
  for (const feature of input.features) {
    statusCounts.set(feature.status, (statusCounts.get(feature.status) ?? 0) + 1);
  }

  return {
    openIssues: input.openIssues,
    featureStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}
