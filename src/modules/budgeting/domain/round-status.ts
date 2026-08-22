/**
 * Status-Maschine der PB-Runde (Spec §13).
 *
 * `draft → running → decided → closed` — strikt vorwärts. In jedem Status ist
 * ein anderer Teil editierbar; die DB-abhängigen Guards (Topf > 0, ≥3 Gruppen,
 * alle Gruppen erfasst, alle Streuzonen entschieden) liegen im Service, hier nur
 * die reine Übergangs-Validität.
 *
 * Rein, kein I/O.
 */

export type RoundStatus = "draft" | "running" | "decided" | "closed";

export const ROUND_STATUSES = ["draft", "running", "decided", "closed"] as const satisfies readonly RoundStatus[];

export const ROUND_TRANSITIONS: Record<RoundStatus, readonly RoundStatus[]> = {
  draft: ["running"],
  running: ["decided"],
  decided: ["closed"],
  closed: [],
};

/** True, wenn `to` ein erlaubter nächster Status von `from` ist. */
export function canTransitionRound(from: RoundStatus, to: RoundStatus): boolean {
  return ROUND_TRANSITIONS[from].includes(to);
}

/** Welche Fläche ist in diesem Status editierbar? (UI-/Guard-Hilfe.) */
export interface RoundEditability {
  frame: boolean; // Rahmen, Pflichtvorhaben, Gruppen
  capture: boolean; // Gruppen-Erfassung, Report-out
  decide: boolean; // Streuzonen-Entscheidung
}

export function roundEditability(status: RoundStatus): RoundEditability {
  return {
    frame: status === "draft",
    capture: status === "running",
    decide: status === "decided",
  };
}
