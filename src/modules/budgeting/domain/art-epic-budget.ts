/**
 * Die **Form** des ART-Epic-Budgets — was ein ART für ein Halbjahr hat.
 *
 * Sie steht hier und nicht beim Lader, weil sie nichts vom Laden weiß: Flächen,
 * Falter und Regeln sprechen über diese Form, ohne Prisma zu kennen.
 * `server/services/art-epic-budget.ts` beantwortet, **wie** man an sie kommt,
 * und reicht den Typ weiter, damit vorhandene Aufrufer nichts merken.
 *
 * Bis September 2026 gab es die Form zweimal: hier und als `ArtPot` — dieselben
 * Felder ohne `artId`, verbunden durch eine Funktion, die nur Felder abschrieb.
 * Der Löschtest war eindeutig, also ist sie weg.
 *
 * Rein, kein I/O.
 */

export interface ArtEpicBudget {
  artId: string;
  cycleKey: string;
  /** Zugesprochen: Σ der Awards auf den aktiven ART-Epic-Budget-Positionen. */
  total: number;
  /**
   * Vergeben: Σ der Zuteilungen an Epics **plus** der Reservierung für
   * ART-eigene Arbeit. Beides zehrt denselben Rahmen auf; eine Summe, die nur
   * die Epics zählte, wies „noch zu verteilen" zu hoch aus.
   */
  distributed: number;
  /** Davon an ART-Epics — `ArtEpicAllocation`. */
  distributedToEpics: number;
  /** Davon für ART-eigene Arbeit ohne Epic — `ArtOwnWorkAllocation`. */
  distributedToOwnWork: number;
  /** Rest — verfällt nicht und wandert nicht; er wird ausgewiesen. */
  remaining: number;
  /** Warum gerade nicht verteilt werden darf; `null` = offen. */
  closedReason: string | null;
}

/** Der Zustand eines ART-Rahmens, so weit ihn eine Fläche unterscheiden muss. */
export type PotState = "open" | "fully_distributed" | "closed" | "no_pot";

export interface PotStanding {
  state: PotState;
  /** Was noch zu vergeben ist. Bei `no_pot` null, nicht „0 von 0". */
  remaining: number;
  /** Rest ÷ Zugesprochen, 0..1 — `0`, solange es keinen Rahmen gibt. */
  share: number;
  /** Bei `closed` der Grund, sonst `null`. */
  reason: string | null;
}

/**
 * **Wie viel des Rahmens ist noch nicht vergeben?**
 *
 * Die vier Kacheln der ART-Übersicht — *Zugeteilt*, *Verbraucht*, *Gebunden*,
 * *Nicht begonnen* — beschreiben allesamt **dasselbe** Geld: das bereits an
 * Epics verteilte, aufgeschlüsselt nach seinem Zustand. Die Gegenseite, der
 * unverteilte Rest, stand nur im Reiter *Verteilen* — also dort, wo man schon
 * hingegangen sein muss, um zu erfahren, dass man hingehen sollte.
 *
 * Die Faltung steht hier und nicht in der Komponente, damit die
 * Fallunterscheidung prüfbar ist: eine Kachel soll **nie** zu etwas einladen,
 * was das Formular danach ablehnt.
 *
 * Die Reihenfolge der Zweige ist eine Entscheidung: ist alles verteilt, sagt
 * die Fläche das — auch bei gesperrtem Rahmen. Eine Sperre ist nur dann die
 * wichtigere Auskunft, wenn tatsächlich noch etwas offen ist.
 *
 * Rein, kein I/O.
 */
export function potStanding(pot: ArtEpicBudget | null): PotStanding {
  if (pot == null || pot.total <= 0) {
    return { state: "no_pot", remaining: 0, share: 0, reason: null };
  }
  const remaining = Math.max(0, pot.remaining);
  const share = remaining / pot.total;
  if (remaining === 0) return { state: "fully_distributed", remaining, share, reason: null };
  if (pot.closedReason != null) {
    return { state: "closed", remaining, share, reason: pot.closedReason };
  }
  return { state: "open", remaining, share, reason: null };
}
