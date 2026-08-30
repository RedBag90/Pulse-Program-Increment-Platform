/**
 * Geschätzte/tatsächliche Stage-Gate-Progression eines Epics über die Zeit.
 *
 * Für jede Reifegrad-Phase gibt es ein **effektives Übergangsdatum = Actual ??
 * Estimate**: liegt der tatsächliche Wechsel schon vor (Actual gesetzt), zählt er
 * (rückwirkend real); sonst der geschätzte (Estimate → vorausschauend). Daraus
 * ergibt sich je Kalendermonat der Status, in dem das Epic gerade ist — Grundlage
 * der Cash-Flow-Gruppierung „Nach Status".
 *
 * Rein, kein I/O. Das Phase→Gate-Mapping ist hier lokal gehalten (kein Import aus
 * der Feature-Schicht).
 */

import { monthStart, parseIsoMonth } from "@/modules/core/kernel/domain/calendar";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import { parseTimeline, type TimelineEstimatePhase } from "@/modules/work/domain/timeline";

/** Ein Stage-Übergang: ab diesem (effektiven) Monat gilt `gate`. */
export interface StageTransition {
  gate: StageGate;
  /** Monatsanfang (UTC) des effektiven Übergangs. */
  month: Date;
}

/**
 * Roh-Eingaben je Epic: die automatischen Actual-Spalten (Initiative) + die
 * manuellen Actuals/Estimates aus dem Timeline-JSON. Alle Daten als ISO
 * `yyyy-mm-dd` oder `null`/undefined.
 */
export interface EpicStageTimelineInput {
  createdAt: string;
  selectedForDetailingAt: string | null;
  hypothesisApprovedAt: string | null;
  selectedForAnalyzingAt: string | null;
  businessCaseApprovedAt: string | null;
  implementationStartedAt: string | null;
  impactRecognizedAt: string | null;
  /** Stored `timeline` JSON (estimates + actuals; nur backlog/implementation-Actuals). */
  timeline: unknown;
}

/** Phase → Gate + Estimate-Key (Actual-Quelle wird in `buildEpicStageTimeline` gewählt). */
const PHASE_GATE: { gate: StageGate; estimate: TimelineEstimatePhase }[] = [
  { gate: "L1", estimate: "detailing" },
  { gate: "L1", estimate: "hypothesis" },
  { gate: "L2", estimate: "analyzing" },
  { gate: "L2", estimate: "business_case" },
  { gate: "L3", estimate: "backlog" },
  { gate: "L4", estimate: "implementation_started" },
  { gate: "L4", estimate: "implementation" },
  { gate: "L5", estimate: "done" },
];

/**
 * Baut die nach **Datum** aufsteigend sortierte Übergangsliste. Je Phase gilt das
 * effektive Datum = Actual ?? Estimate; Phasen ohne Datum entfallen.
 *
 * L0 = `createdAt`, aber **nur wenn es vor dem frühesten fachlichen Gate liegt**.
 * Bei nachträglich gepflegten Ist-Daten (Portfolio-Import, Seed) ist die Zeile
 * jünger als die Gates, die sie beschreibt — ein L0-Punkt hinter L5 trägt dann
 * keine Information und liest sich als Rücksprung. L0 ist ohnehin der
 * Grundzustand, den `stageAtMonth` ohne jeden Übergang liefert.
 *
 * Die Liste ist **nicht** monoton in der Gate-Achse: out-of-order gepflegte
 * Estimates (L4 vor L2) bleiben in ihrer Datumsfolge stehen. `stageAtMonth`
 * trägt dem Rechnung, indem es das höchste erreichte Gate nimmt.
 */
export function buildEpicStageTimeline(input: EpicStageTimelineInput): StageTransition[] {
  const tl = parseTimeline(input.timeline);
  // Actual je Phase (Spalte bzw. Timeline-Actual-JSON).
  const actualByEstimate: Partial<Record<TimelineEstimatePhase, string | null>> = {
    detailing: input.selectedForDetailingAt,
    hypothesis: input.hypothesisApprovedAt,
    analyzing: input.selectedForAnalyzingAt,
    business_case: input.businessCaseApprovedAt,
    backlog: tl.actuals.backlog ?? null,
    implementation_started: input.implementationStartedAt,
    implementation: tl.actuals.implementation ?? null,
    done: input.impactRecognizedAt,
  };

  const points: StageTransition[] = [];
  for (const p of PHASE_GATE) {
    const iso = actualByEstimate[p.estimate] ?? tl.estimates[p.estimate] ?? null;
    const m = iso ? parseIsoMonth(iso) : null;
    if (m) points.push({ gate: p.gate, month: m });
  }

  const l0 = parseIsoMonth(input.createdAt);
  const earliest = points.reduce<number | null>(
    (min, p) => (min == null || p.month.getTime() < min ? p.month.getTime() : min),
    null,
  );
  if (l0 && (earliest == null || l0.getTime() <= earliest)) {
    points.push({ gate: "L0", month: l0 });
  }

  return points.sort((a, b) => a.month.getTime() - b.month.getTime());
}

/**
 * Status (Stage-Gate) im gegebenen Monat: das **höchste** Gate, dessen effektives
 * Datum ≤ dem Monat liegt. Vor jedem Übergang → „L0".
 *
 * Bewusst das Maximum und nicht der zeitlich letzte Übergang: der Reifegrad ist
 * eine Ratsche. Ein Epic, das L5 erreicht hat, darf in einem späteren Monat nicht
 * auf L0 zurückfallen, nur weil ein Punkt mit späterem Datum ein niedrigeres Gate
 * trägt (nachgetragenes `createdAt`, out-of-order gepflegtes Estimate).
 */
export function stageAtMonth(timeline: StageTransition[], monthDate: Date): StageGate {
  const target = monthStart(monthDate).getTime();
  let rank = 0; // L0 = Grundzustand vor dem ersten Übergang
  for (const t of timeline) {
    if (t.month.getTime() > target) break; // aufsteigend sortiert
    const i = STAGE_GATES.indexOf(t.gate);
    if (i > rank) rank = i;
  }
  return STAGE_GATES[rank]!;
}
