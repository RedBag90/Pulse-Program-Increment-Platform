/**
 * Reserve — der Rest, der sich nicht mehr sinnvoll verteilen lässt (D-03/F-03).
 *
 * Das Budget wird so weit wie möglich verteilt; ein Rest **unterhalb des
 * günstigsten Epics** kann kein Vorhaben mehr finanzieren und geht als Reserve
 * in die Folgerunde. Die Reserve wird nicht unterjährig frei vergeben.
 *
 * Rein, kein I/O.
 */

/**
 * Hier stand ein zweites `computeReserve` — mit `fullyDistributed`, also der
 * Regel „der Rest unter dem günstigsten Epic ist keiner mehr" (D-03/F-03).
 * **Es hatte keinen Aufrufer**, nur einen Test; die Finalisierung rechnet mit
 * `computeReserve` aus `domain/finalize.ts`, das bloss subtrahiert.
 *
 * Entfernt (REQ-13). Zwei gleichnamige Funktionen mit verschiedener Bedeutung
 * sind schlimmer als eine fehlende Regel: die eine sieht aus, als sei sie in
 * Kraft. Wird die Schwelle gebraucht, kommt sie mit einem Aufrufer zurück.
 */

/**
 * Trägt die Reserve additiv in den Topf der Folgerunde. Bewusst nur der Betrag —
 * vertagte Epics kommen manuell via Prüfauftrag zurück.
 */
export function carryReserveForward(nextPool: number, reserve: number): number {
  return nextPool + Math.max(0, reserve);
}

/** Eine abgeschlossene Kachel, soweit der Reserve-Übertrag sie kennt. */
export interface ClosedRoundReserve {
  cycleKey: string;
  startDate: Date | null;
  reserveAmount: number;
}

/**
 * Wählt die Kachel, deren Reserve in eine neu angelegte Kachel wandert: die
 * **zeitlich vorherige** abgeschlossene Kachel mit offener Reserve.
 *
 * Bewusst nicht „die mit dem höchsten `cycleKey`" — seit dem Kachel-Modell
 * koexistieren mehrere/zukünftige Kacheln je Cycle, und `cycleKey` lexikografisch
 * zu sortieren zog die Reserve einer *späteren* Kachel in eine *frühere*.
 *
 * `start` = Start-Termin der neuen Kachel; ist er bekannt, zählen nur Kacheln, die
 * davor beginnen. Ohne `start` (Legacy-Pfad ohne Zeitraum) die jüngste überhaupt.
 * Kein Kandidat → `null`.
 */
export function pickCarriedReserve(
  closed: ClosedRoundReserve[],
  start: Date | null,
): { amount: number; fromCycleKey: string } | null {
  const candidates = closed.filter(
    (r) =>
      r.reserveAmount > 0 &&
      (start == null || (r.startDate != null && r.startDate.getTime() < start.getTime())),
  );
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => {
    const at = a.startDate?.getTime() ?? -Infinity;
    const bt = b.startDate?.getTime() ?? -Infinity;
    if (bt !== at) return bt > at ? b : a;
    return b.cycleKey.localeCompare(a.cycleKey) > 0 ? b : a;
  });

  return { amount: best.reserveAmount, fromCycleKey: best.cycleKey };
}
