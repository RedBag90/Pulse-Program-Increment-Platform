/**
 * **Darf dieses Feature in die Umsetzung?**
 *
 * Zwei Bedingungen, und die zweite ist der Grund, warum es diese Datei gibt:
 *
 * 1. Ein Feature braucht ein PI. Ohne Termin gibt es keinen Start.
 * 2. Hängt es an einem Epic, muss dieses mindestens **L3** erreicht haben —
 *    dort ist das Budget alloziert, vorher gibt es nichts umzusetzen.
 *
 * Ein **eigenständiges Feature** hängt an keinem Epic. Für es gibt es kein
 * Portfolio-Tor, auf das man warten könnte: das Tor prüft eine
 * Finanzierungsentscheidung, die hier niemand trifft. Es ist also frei
 * startbar, sobald es terminiert ist.
 *
 * Genau das galt bisher schon — aber **aus Versehen**: die Tor-Prüfung stand
 * innerhalb einer `if (feature.parentId)`-Klammer, und was ausserhalb lag,
 * wurde nie geprüft. Aus dem Versehen wird hier eine Aussage, die man lesen
 * und testen kann.
 *
 * Rein, kein I/O. Der Service lädt den Reifegrad des Epics und reicht ihn
 * herein.
 */

/** Reifegrade, ab denen ein Epic in der Umsetzung ist. */
const IMPLEMENTING_GATES = ["L3", "L4", "L5"] as const;

export interface FeatureStartInput {
  /** PI-Zuordnung des Features; `null` = Backlog. */
  piId: string | null;
  /** Eltern-Epic; `null` = eigenständiges Feature. */
  parentId: string | null;
  /**
   * Reifegrad des Eltern-Epics. `null` bedeutet **nicht gefunden** — ein
   * gelöschtes oder unlesbares Epic blockiert, statt durchzuwinken. Bei
   * `parentId === null` wird der Wert nicht gelesen.
   */
  parentStageGate: string | null;
}

/**
 * Der Grund, warum nicht gestartet werden darf — oder `null`, wenn nichts
 * dagegen spricht. Der Text ist die Meldung an den Nutzer und wörtlich der,
 * den der Service bisher erzeugt hat.
 */
export function featureStartBlockedReason(input: FeatureStartInput): string | null {
  if (input.piId === null) {
    return "Feature ist keinem PI zugewiesen — bitte erst einplanen";
  }
  if (input.parentId === null) return null;
  if (!IMPLEMENTING_GATES.includes(input.parentStageGate as (typeof IMPLEMENTING_GATES)[number])) {
    return (
      "Epic noch nicht in Implementation (mind. L3 Budget alloziert nötig) — " +
      "Feature kann noch nicht gestartet werden"
    );
  }
  return null;
}
