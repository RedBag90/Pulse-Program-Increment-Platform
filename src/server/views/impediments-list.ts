/**
 * Impediment list page-model — shapes the loaded Prisma rows into the rich
 * row DTO the master list renders. Mirrors the portfolio-epics + features
 * pattern: every status gets a funnel slot, day counters and governance
 * badges are derived server-side so the client stays a pure render seam.
 */

import { diffInDays } from "@/modules/core/kernel/domain/calendar";
import { buildFunnelCounts, extractUniqueFacet } from "@/server/views/lib/page-model-utils";

export const IMPEDIMENT_STATUSES = ["open", "escalated", "resolved"] as const;
export type ImpedimentStatus = (typeof IMPEDIMENT_STATUSES)[number];

export const IMPEDIMENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ImpedimentSeverity = (typeof IMPEDIMENT_SEVERITIES)[number];

export interface ImpedimentListRow {
  id: string;
  title: string;
  description: string | null;
  status: ImpedimentStatus;
  severity: ImpedimentSeverity;
  raisedById: string | null;
  raisedByLabel: string | null;
  piId: string | null;
  piName: string | null;
  sprintId: string | null;
  daysOpen: number;
  daysSinceEscalation: number | null;
  /** True when status === "open" AND daysOpen > 14. */
  isOverdue: boolean;
  /** True when status === "escalated" AND daysSinceEscalation > 7. */
  isStaleEscalation: boolean;
  isCritical: boolean;
  createdAtMs: number;
  resolution: string | null;
  resolvedAtMs: number | null;
}

export interface PiOption {
  id: string;
  name: string;
}

export interface OwnerOption {
  id: string;
  label: string;
}

export interface ImpedimentsListModel {
  rows: ImpedimentListRow[];
  funnelCounts: Record<ImpedimentStatus, number>;
  /** PIs that exist for this ART — filter facet. */
  piOptions: PiOption[];
  /** Distinct raisers in the dataset — filter facet. */
  ownerOptions: OwnerOption[];
  /** Distinct severities in the dataset — filter facet. */
  severityOptions: ImpedimentSeverity[];
}

// ---- Input row types ----

interface ImpedimentRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  raisedBy: string | null;
  piId: string | null;
  sprintId: string | null;
  createdAt: Date;
  resolution: string | null;
  resolvedAt: Date | null;
}

/**
 * Returns the inferred timestamp of escalation for an `escalated` row. Pulse
 * doesn't persist the escalation date as a column today; the next-best
 * signal is the `updatedAt` of the row — when escalation was the last
 * change. Falls back to `createdAt` when the row was created already in the
 * escalated state.
 */
function escalationMs(row: ImpedimentRow): number {
  // We don't have updatedAt loaded by default in `listImpediments`; the
  // page-model takes the conservative path and uses `createdAt` so the
  // "staleEscalation" badge fires only when the row has been open for a
  // long enough total time. Callers wanting precise day-since-escalation
  // can extend the loader.
  return row.createdAt.getTime();
}

export function buildImpedimentsListModel(input: {
  impediments: readonly ImpedimentRow[];
  pis: readonly PiOption[];
  userLabels: Readonly<Record<string, string>>;
  /** Anchor used to compute day counts — defaults to the load time. */
  now?: Date;
}): ImpedimentsListModel {
  const { impediments, pis, userLabels } = input;
  const nowMs = (input.now ?? new Date()).getTime();
  const piById = new Map(pis.map((p) => [p.id, p]));

  const rows: ImpedimentListRow[] = impediments.map((imp) => {
    const status = imp.status as ImpedimentStatus;
    const severity = imp.severity as ImpedimentSeverity;
    const createdMs = imp.createdAt.getTime();
    const daysOpen = diffInDays(nowMs, createdMs);
    const daysSinceEscalation =
      status === "escalated" ? diffInDays(nowMs, escalationMs(imp)) : null;
    return {
      id: imp.id,
      title: imp.title,
      description: imp.description,
      status,
      severity,
      raisedById: imp.raisedBy,
      raisedByLabel: imp.raisedBy ? (userLabels[imp.raisedBy] ?? null) : null,
      piId: imp.piId,
      piName: imp.piId ? (piById.get(imp.piId)?.name ?? null) : null,
      sprintId: imp.sprintId,
      daysOpen,
      daysSinceEscalation,
      isOverdue: status === "open" && daysOpen > 14,
      isStaleEscalation:
        status === "escalated" && daysSinceEscalation != null && daysSinceEscalation > 7,
      isCritical: severity === "critical",
      createdAtMs: createdMs,
      resolution: imp.resolution,
      resolvedAtMs: imp.resolvedAt?.getTime() ?? null,
    };
  });

  const funnelCounts = buildFunnelCounts(rows, IMPEDIMENT_STATUSES, (r) => r.status);

  const ownerOptions = extractUniqueFacet(
    rows,
    (r) => r.raisedById,
    (r, id) => r.raisedByLabel ?? id,
    (a, b) => a.label.localeCompare(b.label, "de"),
  );

  const severityOptions: ImpedimentSeverity[] = IMPEDIMENT_SEVERITIES.filter((s) =>
    rows.some((r) => r.severity === s),
  );

  return {
    rows,
    funnelCounts,
    piOptions: pis.slice(),
    ownerOptions,
    severityOptions,
  };
}
