/**
 * Die sechs Phasen eines Budgeting-Zeitraums — die Orientierung „wo stehe ich".
 *
 * Ersetzt `views/budget-process-rail.ts`. Die alte Leiste beschrieb einen
 * Ablauf, den es so nicht mehr gibt (Zonen-Erfassung, €/ART-Detailplanung), und
 * leitete ihren Zustand aus `Tenant.activeBudgetCycle` ab — einem einzelnen
 * aktiven Zyklus, während das Kachel-Modell mehrere koexistieren lässt. Ihre
 * Links zeigten auf Routen, die inzwischen Redirects sind: wer auf Schritt 4
 * klickte, landete auf Schritt 0.
 *
 * Diese Leiste leitet alles aus **einer** Kachel ab und verlinkt auf den
 * Reiter, der den Schritt trägt.
 */

import { type RoundStatus } from "@/modules/budgeting/domain/round-status";

export const PERIOD_TABS = ["setup", "verteilung", "ergebnis"] as const;
export type PeriodTab = (typeof PERIOD_TABS)[number];

export const PHASE_STATES = ["done", "current", "open", "blocked"] as const;
export type PhaseState = (typeof PHASE_STATES)[number];

export interface PeriodPhase {
  key: string;
  label: string;
  state: PhaseState;
  /** Der Reiter, auf dem dieser Schritt bearbeitet wird. */
  tab: PeriodTab;
  /** Warum der Schritt (noch) nicht drankommt — nur bei `blocked`. */
  blockedBy?: string;
}

export interface PeriodPhaseFacts {
  status: RoundStatus;
  poolTotal: number;
  hasTimeframe: boolean;
  candidateCount: number;
  /** Gruppen mit mindestens einem Mitglied. */
  staffedGroupCount: number;
  groupCount: number;
  submittedCount: number;
  /** Für diesen Zeitraum wurde ein Budget-Plan eingefroren. */
  hasRevision: boolean;
}

/** Reihenfolge der Runden-Status, für „mindestens so weit". */
const ORDER: RoundStatus[] = ["draft", "running", "decided", "closed"];
const atLeast = (s: RoundStatus, min: RoundStatus): boolean =>
  ORDER.indexOf(s) >= ORDER.indexOf(min);

/**
 * Die sechs Phasen mit Zustand. `current` ist die **erste** Phase, die weder
 * erledigt noch blockiert ist — daraus liest der Nutzer, was als Nächstes
 * dran ist, ohne dass irgendwo ein Zeiger gespeichert werden müsste.
 */
export function periodPhases(f: PeriodPhaseFacts): PeriodPhase[] {
  const started = atLeast(f.status, "running");
  const distributionClosed = atLeast(f.status, "decided");
  const finalized = f.status === "closed";

  // Der Start ist der Abschluss des Setups: seine Guards lassen ihn nur zu, wenn
  // Rahmen, Ballot und Gruppen stehen. Eine laufende Kachel deshalb nicht wieder
  // auf „Phase 1" zurückfallen lassen, bloß weil jemand später einen Kandidaten
  // entfernt hat.
  const raw: Array<Omit<PeriodPhase, "state"> & { done: boolean; blockedBy?: string }> = [
    {
      key: "rahmen",
      label: "Rahmen",
      tab: "setup",
      done: started || (f.poolTotal > 0 && f.hasTimeframe),
    },
    {
      key: "ballot",
      label: "Ballot",
      tab: "setup",
      done: started || f.candidateCount > 0,
    },
    {
      key: "gruppen",
      label: "Beteiligte & Gruppen",
      tab: "setup",
      done: started || f.staffedGroupCount > 0,
    },
    {
      // Der Start ist ein eigener Übergang, kein Nebeneffekt des Gruppen-
      // Schritts: er friert den Ballot ein und schaltet die Verteilung frei.
      // Ohne ihn zählte die Leiste an Position 4 schon „Verteilen", während die
      // Setup-Checkliste dort „Runde starten" führte — derselbe Schritt mit
      // zwei Nummern.
      key: "start",
      label: "Runde starten",
      tab: "setup",
      done: started,
      ...(f.candidateCount > 0 && f.staffedGroupCount > 0
        ? {}
        : { blockedBy: "Erst mit Kandidaten auf dem Ballot und einer besetzten Gruppe." }),
    },
    {
      key: "verteilen",
      label: "Verteilen",
      tab: "verteilung",
      // Das Schließen der Verteilung beendet die Phase — unabhängig davon, wie
      // viele Gruppen tatsächlich eingereicht haben (die Deadline darf sie
      // überholen).
      done: distributionClosed || (f.groupCount > 0 && f.submittedCount >= f.groupCount),
      ...(started ? {} : { blockedBy: "Die Runde ist noch nicht gestartet." }),
    },
    {
      key: "finalisieren",
      label: "Finalisieren",
      tab: "ergebnis",
      done: finalized,
      ...(distributionClosed ? {} : { blockedBy: "Die Verteilung ist noch nicht geschlossen." }),
    },
    {
      key: "protokoll",
      label: "Protokoll",
      tab: "ergebnis",
      done: f.hasRevision,
      ...(finalized ? {} : { blockedBy: "Erst nach der Finalisierung." }),
    },
  ];

  let currentTaken = false;
  return raw.map(({ done, blockedBy, ...rest }) => {
    if (done) return { ...rest, state: "done" as const };
    if (blockedBy !== undefined) return { ...rest, state: "blocked" as const, blockedBy };
    if (!currentTaken) {
      currentTaken = true;
      return { ...rest, state: "current" as const };
    }
    return { ...rest, state: "open" as const };
  });
}

/** Die Phase, an der gerade gearbeitet wird — für Kachel-Karte und Gallery. */
export function currentPhase(phases: readonly PeriodPhase[]): PeriodPhase | null {
  return phases.find((p) => p.state === "current") ?? null;
}

/**
 * Kurzlabel für die Kachel-Karte: „Phase 4 · Verteilen", bzw. der
 * Abschluss-Hinweis, wenn alles erledigt ist.
 */
export function phaseSummary(phases: readonly PeriodPhase[]): string {
  const i = phases.findIndex((p) => p.state === "current");
  if (i === -1) {
    return phases.every((p) => p.state === "done")
      ? "abgeschlossen"
      : (phases.find((p) => p.state === "blocked")?.label ?? "—");
  }
  return `Phase ${i + 1} · ${phases[i]!.label}`;
}
