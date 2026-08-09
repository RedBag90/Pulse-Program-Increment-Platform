import type { DomainError } from "@/modules/core/kernel/domain/errors";

/**
 * Per-action overrides for `formatDomainError`. Each field replaces the
 * default for one error shape; everything else falls through.
 */
export interface DisplayOverrides {
  /** Replaces the default message when the error is `not_found`. */
  notFound?: string;
  /** Replaces `e.reason` when the error is `conflict`. */
  conflict?: string;
  /** Used when the error kind has no specific default (catch-all). */
  fallback?: string;
}

const GERMAN_RESOURCE: Record<string, string> = {
  Initiative: "Initiative",
  Epic: "Epic",
  Feature: "Feature",
  Story: "Story",
  Task: "Aufgabe",
  ProgramIncrement: "Program Increment",
  Pi: "Program Increment",
  Sprint: "Sprint",
  Team: "Team",
  Art: "ART",
  ValueStream: "Wertstrom",
  Timeline: "Timeline",
  PiStandard: "PI-Standard",
  Impediment: "Impediment",
  Dependency: "Abhängigkeit",
  BudgetAllocation: "Budget-Zuteilung",
  TransformationGoal: "Ziel",
  KpiValue: "KPI-Wert",
  Tenant: "Mandant",
};

function localizeResourceType(rt: string): string {
  return GERMAN_RESOURCE[rt] ?? rt;
}

/**
 * Maps a `DomainError` to a user-facing string. The seam every action
 * action-factory used to re-implement inline now lives here exactly once.
 *
 * Defaults (no overrides):
 *   - `conflict`           → `e.reason` (the domain message)
 *   - `not_found`          → `"<Resource> nicht gefunden"` (German label table)
 *   - `forbidden`          → `"Keine Berechtigung"`
 *   - `tenant_mismatch`    → `"Mandantenzuordnung passt nicht"`
 *   - `validation`         → `"Eingabe ungültig"` (rare — field errors normally surface separately)
 *   - `hierarchy_violation` → `e.detail`
 *
 * Per-action overrides allow Custom-coping where the default copy is too
 * generic (e.g. "Story nicht gefunden" reads better than "Feature nicht gefunden"
 * for a story action that fails to find its parent Feature).
 */
export function formatDomainError(e: DomainError, overrides: DisplayOverrides = {}): string {
  switch (e.kind) {
    case "conflict":
      return overrides.conflict ?? e.reason;
    case "not_found":
      return overrides.notFound ?? `${localizeResourceType(e.resourceType)} nicht gefunden`;
    case "forbidden":
      return overrides.fallback ?? "Keine Berechtigung";
    case "tenant_mismatch":
      return overrides.fallback ?? "Mandantenzuordnung passt nicht";
    case "validation":
      return overrides.fallback ?? "Eingabe ungültig";
    case "hierarchy_violation":
      return overrides.fallback ?? e.detail;
    case "pyramid_violated":
      return overrides.fallback ?? "KPI ist bereits an einen anderen Key Result gebunden";
  }
}
