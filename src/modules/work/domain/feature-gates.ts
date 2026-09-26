import {
  BUDGET_DECISION_GATE,
  GATES_AFTER_BUDGET_DECISION,
} from "@/modules/work/domain/stage-gate";

/**
 * **Die beiden Tore am Feature: einplanen und starten.**
 *
 * Beide hängen an derselben Schwelle, und zwar an der Entscheidung über das
 * Geld: erst ab **L3 „Budget alloziert"** gibt es an einem Epic etwas zu
 * planen und zu tun. Vorher ist jede Terminzusage eine Zusage über Arbeit, die
 * noch niemand bezahlt hat.
 *
 * 1. **Einplanen** (`featurePlanningBlockedKey`) — ein Feature bekommt ein PI.
 *    Neu seit September 2026: bis dahin war nur der *Start* gesperrt, und die
 *    Meldung dort lautete sogar „bitte erst einplanen" — einplanen war also
 *    die Voraussetzung des Starts, nicht selbst geregelt. Damit standen
 *    Features unter L3 in der Planungsübersicht und liessen sich terminieren.
 * 2. **Starten** (`featureStartBlockedKey`) — ein Feature geht in Umsetzung.
 *    Dafür braucht es zusätzlich einen Termin.
 *
 * Ein **eigenständiges Feature** hängt an keinem Epic. Für es gibt es kein
 * Portfolio-Tor, auf das man warten könnte: das Tor prüft eine
 * Finanzierungsentscheidung, die hier niemand trifft. Es ist also frei planbar
 * und startbar.
 *
 * Rein, kein I/O. Der Service lädt den Reifegrad des Epics und reicht ihn
 * herein. Beide Funktionen geben **Katalog-Schlüssel** zurück, keine Sätze
 * (ADR-0024, Regel 2) — sie reisen als `reason` eines `DomainError` bis in die
 * Oberfläche, und dort wird übersetzt.
 */

/**
 * Hat das Epic die Investitionsentscheidung hinter sich (L3 oder später)?
 *
 * **Eine Definition, nicht zwei.** Hier stand bis September 2026 ein eigenes
 * `IMPLEMENTING_GATES = ["L3", "L4", "L5"]` — wörtlich
 * `[BUDGET_DECISION_GATE, ...GATES_AFTER_BUDGET_DECISION]`, nur ohne den
 * Bezug. Zwei Listen, die dasselbe meinen, laufen irgendwann auseinander; in
 * dieser Codebasis ist genau das schon mehrfach schiefgegangen.
 */
export function budgetDecided(stageGate: string | null): boolean {
  return (
    stageGate === BUDGET_DECISION_GATE ||
    (GATES_AFTER_BUDGET_DECISION as readonly string[]).includes(stageGate ?? "")
  );
}

/**
 * Die Reifegrade, ab denen sich Features einplanen lassen — als **Liste**, für
 * Abfragen, die keine Funktion aufrufen können.
 *
 * Abgeleitet, nicht abgeschrieben: dieselbe Schwelle wie {@link budgetDecided},
 * nur in der Form, die eine `where`-Klausel braucht.
 */
export const PLANNABLE_GATES: readonly string[] = [
  BUDGET_DECISION_GATE,
  ...GATES_AFTER_BUDGET_DECISION,
];

export interface FeatureGateInput {
  /** Eltern-Epic; `null` = eigenständiges Feature. */
  parentId: string | null;
  /**
   * Reifegrad des Eltern-Epics. `null` bedeutet **nicht gefunden** — ein
   * gelöschtes oder unlesbares Epic blockiert, statt durchzuwinken. Bei
   * `parentId === null` wird der Wert nicht gelesen.
   */
  parentStageGate: string | null;
}

export interface FeatureStartInput extends FeatureGateInput {
  /** PI-Zuordnung des Features; `null` = Backlog. */
  piId: string | null;
}

/**
 * Darf dieses Feature **eingeplant** werden? `null`, wenn nichts dagegen
 * spricht — sonst der Katalog-Schlüssel des Grundes.
 */
export function featurePlanningBlockedKey(input: FeatureGateInput): string | null {
  if (input.parentId === null) return null;
  if (!budgetDecided(input.parentStageGate)) return "work.errors.epicNotBudgetDecided";
  return null;
}

/**
 * Darf dieses Feature **gestartet** werden? `null`, wenn nichts dagegen
 * spricht — sonst der Katalog-Schlüssel des Grundes.
 *
 * Der fehlende Termin wird zuerst gemeldet: er ist der Schritt, der dem Start
 * unmittelbar vorausgeht.
 */
export function featureStartBlockedKey(input: FeatureStartInput): string | null {
  if (input.piId === null) return "work.errors.featureNotScheduled";
  return featurePlanningBlockedKey(input) === null ? null : "work.errors.epicNotImplementing";
}
