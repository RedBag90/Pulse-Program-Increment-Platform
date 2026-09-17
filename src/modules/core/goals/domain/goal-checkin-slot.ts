/**
 * Was aus dem **Tages-Slot** eines Ziels wird, wenn an diesem Tag noch etwas
 * dazukommt — **als reine Regel**.
 *
 * Ein Ziel hat pro Tag genau einen Check-in. „Status aktualisieren" und
 * „Fortschritt aktualisieren" teilen sich diesen Slot, und bisher schrieb jeder
 * von beiden ihn **vollständig** neu: `recordGoalProgress` setzte hart
 * `status: null, note: null, sections: null`. Wer morgens „At risk — Lieferant
 * springt ab" schrieb und nachmittags den Ist-Wert nachtrug, verlor beides. Der
 * Wert war da, die Begründung weg.
 *
 * Die Regel dahinter ist keine technische: **ein nachgetragener Wert widerruft
 * keine Aussage.** Wer den Status zurücknehmen will, nimmt ihn zurück; wer eine
 * Zahl nachträgt, trägt eine Zahl nach.
 *
 * Deshalb unterscheidet der Slot zwei Dinge, die vorher eins waren:
 *
 *  - **nicht gesagt** (`undefined`) — bleibt stehen.
 *  - **ausdrücklich geleert** (`null`) — wird gelöscht.
 *
 * Das ist dieselbe Drei-Wege-Entscheidung, die `FieldReader` an der
 * FormData-Grenze trifft (`server/http/form-data.ts`): anwesend / abwesend /
 * geleert. Sie hört dort nur nicht auf.
 *
 * Rein, kein I/O.
 */

/** One block of a structured status update (Asana-style composer). */
export interface GoalSection {
  title: string;
  body: string;
}

/** Der Inhalt eines Tages-Slots, so wie er in der Zeile steht. */
export interface CheckinSlot {
  status: string | null;
  value: number | null;
  progress: number | null;
  note: string | null;
  sections: GoalSection[] | null;
}

/**
 * Was ein Schreiber am Slot ändern will. **Weggelassen heißt „nicht angefasst"**
 * — nicht „auf null setzen". Für `value`/`progress` gilt dasselbe, damit ein
 * reines Status-Update den eingefrorenen Wert des Tages nicht verliert.
 */
export type CheckinPatch = Partial<CheckinSlot>;

/** Der leere Slot: was ein neuer Tag mitbringt, bevor jemand etwas sagt. */
export const EMPTY_SLOT: CheckinSlot = {
  status: null,
  value: null,
  progress: null,
  note: null,
  sections: null,
};

/**
 * `existing = null` heißt: an diesem Tag gab es noch nichts. Dann ist jedes
 * nicht gesagte Feld `null` — es gibt nichts zu bewahren.
 *
 * Leere Sektionen (`[]`) zählen als **nichts**, nicht als „gelöscht": der
 * Composer schickt ein leeres Array, wenn der Autor alle Blöcke wieder entfernt
 * hat, und ein leeres Array in der Spalte wäre ein Eintrag, der aussieht wie
 * einer und keiner ist.
 */
export function mergeCheckinSlot(existing: CheckinSlot | null, patch: CheckinPatch): CheckinSlot {
  const base = existing ?? EMPTY_SLOT;
  return {
    status: patch.status !== undefined ? patch.status : base.status,
    value: patch.value !== undefined ? patch.value : base.value,
    progress: patch.progress !== undefined ? patch.progress : base.progress,
    note: patch.note !== undefined ? emptyToNull(patch.note) : base.note,
    sections: patch.sections !== undefined ? nonEmptySections(patch.sections) : base.sections,
  };
}

function emptyToNull(note: string | null): string | null {
  return note != null && note.trim() !== "" ? note : null;
}

function nonEmptySections(sections: GoalSection[] | null): GoalSection[] | null {
  return sections != null && sections.length > 0 ? sections : null;
}
