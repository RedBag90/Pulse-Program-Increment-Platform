import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";

/**
 * **Wer darf Budget tragen — und wer muss?**
 *
 * Das Kanban managt die Epics; bei der Vergabe haben **laufende Epics Vorrang**.
 * Daraus folgen zwei Richtungen, und beide sind eine Aussage über den laufenden
 * Zyklus:
 *
 *  - **Wer Geld trägt, steht mindestens auf L3.1.** Vorher gibt es nichts zu
 *    finanzieren: im Funnel ist es eine Idee, in der Hypothese eine Vermutung,
 *    in der Analyse-Einplanung eine Absicht, im Business Case eine Rechnung, die
 *    noch niemand freigegeben hat. Erst die Freigabe des Lean Business Case
 *    macht aus dem Vorhaben eine Investitionsentscheidung.
 *  - **Wer in Umsetzung ist, hat Geld.** Ein Epic, an dem gerade gebaut wird und
 *    das im laufenden Zyklus nichts bekommen hat, ist eine Lücke — entweder in
 *    der Vergabe oder in den Daten.
 *
 * Die Regel stand bisher an drei Stellen in drei Fassungen: zweimal im
 * Demo-Seed (einmal als `gate === "L0" || gate === "L1" ? 0 : …`, einmal gar
 * nicht), und in `seed-large` als Kommentar an einer Zyklus-Tabelle. Sie hier zu
 * versammeln ist der Punkt: eine Regel, die nur in Kommentaren steht, wird beim
 * nächsten Umbau wieder gebrochen.
 *
 * Rein, kein I/O.
 */

/** Der früheste Schritt, ab dem ein Epic Budget tragen darf. */
export const FIRST_FUNDABLE_STEP: GateStep = "L2";

/**
 * Der Schritt, der Budget im laufenden Zyklus **verlangt**: `"L4"` ist L4.1,
 * „wird umgesetzt". L4.2 („fertig gemeldet") und L5 („Impact bestätigt") dürfen
 * Geld tragen, brauchen es aber nicht mehr — sie können im Zeitraum fertig
 * geworden sein oder lange davor.
 */
const RUNNING_STEP: GateStep = "L4";

export function mayHoldAllocation(step: GateStep): boolean {
  return GATE_STEPS.indexOf(step) >= GATE_STEPS.indexOf(FIRST_FUNDABLE_STEP);
}

export function requiresCurrentAllocation(step: GateStep): boolean {
  return step === RUNNING_STEP;
}

/** Ein Epic, so weit die Regel es kennen muss. */
export interface AllocationFacts {
  id: string;
  title: string;
  step: GateStep;
  /** Betrag im geprüften Zyklus — aus **beiden** Töpfen zusammen. */
  amountInCycle: number;
}

export type AllocationViolationKind = "funded_too_early" | "running_without_budget";

export interface AllocationViolation extends AllocationFacts {
  kind: AllocationViolationKind;
  reason: string;
}

/**
 * Die Verstöße gegen beide Richtungen, mit Namen — damit ein Seed **laut**
 * scheitert statt still falsche Daten zu schreiben, so wie `assertGateHistory`
 * es für die Reifegrad-Historie tut.
 */
export function allocationRuleViolations(
  epics: readonly AllocationFacts[],
  cycleKey: string,
): AllocationViolation[] {
  const out: AllocationViolation[] = [];
  for (const e of epics) {
    if (e.amountInCycle > 0 && !mayHoldAllocation(e.step)) {
      out.push({
        ...e,
        kind: "funded_too_early",
        reason: `trägt ${e.amountInCycle} € in ${cycleKey}, steht aber erst auf ${e.step} — Budget gibt es erst ab ${FIRST_FUNDABLE_STEP}`,
      });
    }
    if (e.amountInCycle <= 0 && requiresCurrentAllocation(e.step)) {
      out.push({
        ...e,
        kind: "running_without_budget",
        reason: `ist in Umsetzung (${e.step}), hat in ${cycleKey} aber kein Budget — laufende Epics haben bei der Vergabe Vorrang`,
      });
    }
  }
  return out;
}

/** Die Verstöße als lesbarer Block — für die Ausgabe eines scheiternden Seeds. */
export function formatAllocationViolations(violations: readonly AllocationViolation[]): string {
  return violations.map((v) => `  · „${v.title}" ${v.reason}`).join("\n");
}
