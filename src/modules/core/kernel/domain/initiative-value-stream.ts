/**
 * **Der Wertstrom einer Initiative** — aus einer geladenen Zeile, ohne
 * Rückfrage an die Datenbank.
 *
 * Ein Feature trägt selbst keinen `valueStreamId` (die Spalte ist als „EPIC
 * only" dokumentiert und bei allen Features leer). Er kam bisher ausschließlich
 * vom Eltern-Epic. Sobald ein Feature ohne Epic bestehen darf, bricht diese
 * Ableitung — und zwar **still**: `memberOrVacuous` in `authorize.ts` behandelt
 * ein leeres Scope-Feld als „alles in Reichweite". Ein Feature ohne Wertstrom
 * erfüllte damit *jede* Wertstrom-Eingrenzung, statt keine.
 *
 * Der letzte Halt ist deshalb das **ART**. `Art.valueStreamId` ist NOT NULL —
 * die Ableitung ist damit total, sobald ein ART an der Zeile steht.
 *
 * Rein, kein I/O. Wohnt in Core, weil außer Work auch Risks und die
 * persönliche Inbox dieselbe Ableitung brauchen und nur Core für alle
 * importierbar ist (ADR-0013).
 */

export interface InitiativeValueStreamSource {
  /** Wertstrom des Eltern-Epics — `null`, wenn es keins gibt. */
  parentValueStreamId: string | null;
  /** Eigener Wertstrom der Zeile. Bei Epics gesetzt, bei Features nie. */
  ownValueStreamId: string | null;
  /**
   * Wertstrom des besitzenden ARTs.
   *
   * **Pflicht-Eigenschaft mit erlaubtem `null`-Wert** — ausdrücklich nicht
   * optional. Wer den Join im Query vergisst
   * (`art: { select: { valueStreamId: true } }`), scheitert an `tsc`, statt
   * still auf den alten, lückenhaften Zustand zurückzufallen. Das ist der
   * eigentliche Zweck dieser Signatur; der Rumpf ist trivial.
   */
  artValueStreamId: string | null;
}

/**
 * Elternteil zuerst, dann die eigene Spalte, zuletzt das ART.
 *
 * Die Reihenfolge ist kein Geschmack: mit dem Elternteil an erster Stelle
 * bleibt jede bestehende Zeile **unverändert** — das ART ist ein *zusätzlicher*
 * letzter Halt, keine Neuberechnung.
 */
export function resolveInitiativeValueStreamId(src: InitiativeValueStreamSource): string | null {
  return src.parentValueStreamId ?? src.ownValueStreamId ?? src.artValueStreamId;
}
