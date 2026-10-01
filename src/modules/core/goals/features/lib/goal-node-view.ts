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

import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import {
  CONFIDENCE_MAX,
  isConfidenceValue,
  type ConfidenceValue,
} from "@/modules/core/goals/domain/goal-confidence";
import { keyResultProgress, isAtRisk } from "@/modules/core/goals/domain/goals-rollup";
import {
  goalTimeframe,
  goalTimeframeLabel,
  type GoalTimeframe,
} from "@/modules/core/goals/domain/goal-period";

/**
 * Normalisierter 0..1-Fortschritt für die Anzeige: bevorzugt den vom Loader
 * aufgelösten `progress` (respektiert die Fortschrittsquelle, ADR-0011); Fallback
 * für ein messbares Blatt ohne aufgelösten Wert ist `keyResultProgress`, sonst 0.
 */
export function goalNodeProgress(node: GoalNode): number {
  return node.progress ?? (node.isMeasurable ? keyResultProgress(node) : 0);
}

/**
 * **„3 / 5" statt „50 %"** — für Ziele, die per Faust-zu-Fünf gemessen werden.
 *
 * Der Fortschritt eines Confidence-Ziels ist rechnerisch ein ganz normaler
 * 0..1-Wert (`baseline = 1`, `target = 5`), und genau das ist die Gefahr: eine
 * 3 erscheint als „50 %", und wer das liest, denkt „halb fertig". Gemeint ist
 * „mittlere Zuversicht". Die Beschriftung stellt das richtig; die Leiste bleibt.
 *
 * `null` = kein Confidence-Ziel, es gilt die gewohnte Prozentanzeige.
 */
export function goalNodeConfidenceLabel(node: GoalNode): string | null {
  if (node.progressMode !== "confidence" || node.current == null) return null;
  return `${Math.round(node.current)} / ${CONFIDENCE_MAX}`;
}

/**
 * Wird das Ziel per Confidence Vote gemessen — **auch ohne abgegebenen Vote**?
 * Getrennt von `goalNodeConfidence`, weil ein Ziel ohne Vote sonst wie ein
 * Prozent-Ziel aussähe: „0 %" im Kreis und „Ziel 5 %", wo der Metriktyp noch
 * auf Prozent steht (die Skala setzt nur `baseline`/`target`).
 */
export function isConfidenceGoal(node: GoalNode): boolean {
  return node.progressMode === "confidence";
}

/**
 * Der Vote eines Confidence-Ziels als Stufe 1–5 — für die Hand. `null` = kein
 * Confidence-Ziel oder noch kein Vote; dann gilt die Prozentanzeige. Ein
 * übergeordnetes Ziel, das nur zusammenfasst, ist nie eines: sein Wert wäre
 * ein Durchschnitt, keine Hand.
 */
export function goalNodeConfidence(node: GoalNode): ConfidenceValue | null {
  if (node.progressMode !== "confidence" || node.current == null) return null;
  const v = Math.round(node.current);
  return isConfidenceValue(v) ? v : null;
}

/** Effektiver Zeitraum eines Knotens (Range gewinnt über Bucket) oder null. */
export function goalNodeTimeframe(node: GoalNode): GoalTimeframe | null {
  return goalTimeframe(node.period, node.periodStart, node.periodEnd);
}

/** Zeitraum-Label eines Knotens ("—" wenn kein Zeitraum gesetzt). */
export function goalNodeTimeframeLabel(node: GoalNode): string {
  return goalTimeframeLabel(goalNodeTimeframe(node));
}

/**
 * **Kurzform des Zeitraums für enge Stellen** (Badge im Ziele-Rad): ein Bucket
 * wie gewohnt („Q3 2026"), ein individueller Bereich nur mit Monat und Jahr in
 * der Sprache der Oberfläche — „Okt 26 – Mär 27" bzw. „Oct 26 – Mar 27"; im
 * selben Jahr „Jul – Sep 2026". Die Tage stehen im Tooltip und in der Tabelle.
 */
export function goalNodeTimeframeShort(node: GoalNode, locale: string): string | null {
  const tf = goalNodeTimeframe(node);
  if (!tf) return null;
  if (tf.kind === "bucket") return goalTimeframeLabel(tf);
  const monat = (d: Date) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
      .format(d)
      .replace(/\.$/, "");
  const sy = tf.start.getUTCFullYear();
  const ey = tf.end.getUTCFullYear();
  const sm = monat(tf.start);
  const em = monat(tf.end);
  if (sy === ey) return sm === em ? `${sm} ${ey}` : `${sm} – ${em} ${ey}`;
  return `${sm} ${String(sy).slice(2)} – ${em} ${String(ey).slice(2)}`;
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
