/**
 * Impediments-Overview page-model — cross-ART. Primärer Funnel ist der
 * ROAM-Status (PR 3 / Closure-Wizard); der Workflow-Status (open /
 * escalated / resolved) bleibt als zweite Filter-Achse erhalten. Jeder
 * Row trägt ART und PI als Filter-Kontext.
 */

export const ROAM_STATUSES = ["open", "resolved", "owned", "accepted", "mitigated"] as const;
export type RoamStatus = (typeof ROAM_STATUSES)[number];

export const IMPEDIMENT_WORKFLOW_STATUSES = ["open", "escalated", "resolved"] as const;
export type ImpedimentWorkflowStatus = (typeof IMPEDIMENT_WORKFLOW_STATUSES)[number];

export const IMPEDIMENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ImpedimentSeverity = (typeof IMPEDIMENT_SEVERITIES)[number];

export interface ImpedimentOverviewRow {
  id: string;
  title: string;
  description: string | null;
  status: ImpedimentWorkflowStatus;
  roamStatus: RoamStatus;
  severity: ImpedimentSeverity;
  raisedById: string | null;
  raisedByLabel: string | null;
  art: { id: string; name: string };
  pi: { id: string; name: string } | null;
  daysOpen: number;
  isCritical: boolean;
  isOverdue: boolean;
  createdAtMs: number;
  resolvedAtMs: number | null;
}

export interface ArtOption {
  id: string;
  name: string;
}

export interface PiOption {
  id: string;
  name: string;
}

export interface OwnerOption {
  id: string;
  label: string;
}

export interface ImpedimentsOverviewModel {
  rows: ImpedimentOverviewRow[];
  /** Funnel-Counts pro ROAM-Status. Jeder Slot existiert, auch wenn 0. */
  roamFunnelCounts: Record<RoamStatus, number>;
  artOptions: ArtOption[];
  piOptions: PiOption[];
  ownerOptions: OwnerOption[];
  severityOptions: ImpedimentSeverity[];
}

// ---- Input row types ----

interface ImpedimentInput {
  id: string;
  title: string;
  description: string | null;
  status: string;
  roamStatus: string;
  severity: string;
  raisedBy: string | null;
  artId: string;
  piId: string | null;
  createdAt: Date;
  resolution: string | null;
  resolvedAt: Date | null;
}

interface ArtInput {
  id: string;
  name: string;
}

interface PiInput {
  id: string;
  name: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PLACEHOLDER_ART: ArtOption = { id: "", name: "—" };

function diffDays(later: number, earlier: number): number {
  return Math.max(0, Math.floor((later - earlier) / MS_PER_DAY));
}

function normaliseRoam(raw: string): RoamStatus {
  return (ROAM_STATUSES as readonly string[]).includes(raw) ? (raw as RoamStatus) : "open";
}

export function buildImpedimentsOverviewModel(input: {
  impediments: readonly ImpedimentInput[];
  arts: readonly ArtInput[];
  pis: readonly PiInput[];
  userLabels: Readonly<Record<string, string>>;
  /** Anchor für day-counts, default = now. */
  now?: Date;
}): ImpedimentsOverviewModel {
  const { impediments, arts, pis, userLabels } = input;
  const nowMs = (input.now ?? new Date()).getTime();
  const artById = new Map(arts.map((a) => [a.id, a] as const));
  const piById = new Map(pis.map((p) => [p.id, p] as const));

  const rows: ImpedimentOverviewRow[] = impediments.map((imp) => {
    const status = imp.status as ImpedimentWorkflowStatus;
    const roamStatus = normaliseRoam(imp.roamStatus);
    const severity = imp.severity as ImpedimentSeverity;
    const createdMs = imp.createdAt.getTime();
    const daysOpen = diffDays(nowMs, createdMs);
    const art = artById.get(imp.artId);
    const pi = imp.piId ? (piById.get(imp.piId) ?? null) : null;
    return {
      id: imp.id,
      title: imp.title,
      description: imp.description,
      status,
      roamStatus,
      severity,
      raisedById: imp.raisedBy,
      raisedByLabel: imp.raisedBy ? (userLabels[imp.raisedBy] ?? null) : null,
      art: art ? { id: art.id, name: art.name } : PLACEHOLDER_ART,
      pi: pi ? { id: pi.id, name: pi.name } : null,
      daysOpen,
      isCritical: severity === "critical",
      isOverdue: status === "open" && daysOpen > 14,
      createdAtMs: createdMs,
      resolvedAtMs: imp.resolvedAt?.getTime() ?? null,
    };
  });

  const roamFunnelCounts = Object.fromEntries(ROAM_STATUSES.map((s) => [s, 0])) as Record<
    RoamStatus,
    number
  >;
  for (const r of rows) roamFunnelCounts[r.roamStatus] += 1;

  const usedArtIds = new Set(rows.map((r) => r.art.id).filter(Boolean));
  const artOptions = arts
    .filter((a) => usedArtIds.has(a.id))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const usedPiIds = new Set(rows.map((r) => r.pi?.id).filter((id): id is string => !!id));
  const piOptions = pis
    .filter((p) => usedPiIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const ownerMap = new Map<string, string>();
  for (const r of rows) {
    if (r.raisedById && !ownerMap.has(r.raisedById)) {
      ownerMap.set(r.raisedById, r.raisedByLabel ?? r.raisedById);
    }
  }
  const ownerOptions = [...ownerMap]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  const severityOptions = IMPEDIMENT_SEVERITIES.filter((s) => rows.some((r) => r.severity === s));

  return {
    rows,
    roamFunnelCounts,
    artOptions,
    piOptions,
    ownerOptions,
    severityOptions,
  };
}
