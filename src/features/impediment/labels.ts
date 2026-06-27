/**
 * German UI labels + Tailwind classes for Impediment state. Single source of
 * truth — three files (`impediment-list-row`, `impediments-filter-bar`,
 * `risks/impediments-overview-shell`) used to inline identical maps and they
 * had already started to drift (filter-bar omitted `SEVERITY_BADGE`).
 */

import type { ImpedimentSeverity, ImpedimentStatus } from "@/server/views/impediments-list";

export const SEVERITY_BADGE: Record<ImpedimentSeverity, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export const SEVERITY_LABEL: Record<ImpedimentSeverity, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

export const STATUS_DOT: Record<ImpedimentStatus, string> = {
  open: "bg-blue-400",
  escalated: "bg-purple-500",
  resolved: "bg-emerald-500",
};

export const STATUS_LABEL: Record<ImpedimentStatus, string> = {
  open: "Offen",
  escalated: "Eskaliert",
  resolved: "Aufgelöst",
};
