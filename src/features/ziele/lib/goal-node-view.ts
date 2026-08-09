/**
 * Präsentations-Ableitungen eines **Goal-Knotens** — die _eine_ Stelle, die aus
 * den rohen `GoalNode`-Feldern (`period`/`periodStart`/`periodEnd`, `progress`/
 * `isMeasurable`/`baseline`/`target`/`current`, `ownerId`, `status`, `trio`) die
 * Anzeige-Fakten ableitet, die alle Ziel-Ansichten (Tabelle, Netzplan, Roadmap,
 * Alignment) und der Drawer brauchen. Vorher hat jede Ansicht diese Fakten
 * eigenständig neu berechnet — mit Abweichungen (Netzplan-Progressmathematik,
 * drei `initials`-Varianten, vier Zeitraum-Label-Gabeln). Diese Fakten sind rein
 * und werden hier zusammengezogen; die Domain-Helfer (`goal-period`,
 * `goals-rollup`, `goal-status`) bleiben die Quelle, hier wird nur komponiert.
 */

import type { GoalNode } from "@/server/views/ziele-view";
import { keyResultProgress, isAtRisk } from "@/modules/core/goals/domain/goals-rollup";
import { goalTimeframe, goalTimeframeLabel, type GoalTimeframe } from "@/modules/core/goals/domain/goal-period";

/**
 * Normalisierter 0..1-Fortschritt für die Anzeige: bevorzugt den vom Loader
 * aufgelösten `progress` (respektiert die Fortschrittsquelle, ADR-0011); Fallback
 * für ein messbares Blatt ohne aufgelösten Wert ist `keyResultProgress`, sonst 0.
 */
export function goalNodeProgress(node: GoalNode): number {
  return node.progress ?? (node.isMeasurable ? keyResultProgress(node) : 0);
}

/** Effektiver Zeitraum eines Knotens (Range gewinnt über Bucket) oder null. */
export function goalNodeTimeframe(node: GoalNode): GoalTimeframe | null {
  return goalTimeframe(node.period, node.periodStart, node.periodEnd);
}

/** Zeitraum-Label eines Knotens ("—" wenn kein Zeitraum gesetzt). */
export function goalNodeTimeframeLabel(node: GoalNode): string {
  return goalTimeframeLabel(goalNodeTimeframe(node));
}

/** Owner-Anzeigename aus der Label-Map; null wenn kein/unbekannter Owner. */
export function goalNodeOwner(node: GoalNode, userLabels: Record<string, string>): string | null {
  return node.ownerId ? (userLabels[node.ownerId] ?? null) : null;
}

/**
 * Initialen aus einem Anzeigenamen ODER einer E-Mail: der `@`-Suffix entfällt,
 * zwei Wörter → zwei Initialen, sonst die ersten zwei Zeichen. Eine kanonische
 * Variante statt der drei zuvor divergierenden (Avatar war je Ansicht verschieden).
 */
export function goalInitials(label: string): string {
  const parts = (label.split("@")[0] ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  return (parts[0] ?? "").slice(0, 2).toUpperCase();
}

/** Run-Rate-Drift (⚠-Badge): der €-Trio des Knotens liegt unter der Schwelle. */
export function isGoalDrifting(node: GoalNode): boolean {
  return isAtRisk(node.trio);
}

/** „Off-track" für den Filter: Drift ODER Status `at_risk`/`off_track`. */
export function isGoalOffTrack(node: GoalNode): boolean {
  return isAtRisk(node.trio) || node.status === "at_risk" || node.status === "off_track";
}
