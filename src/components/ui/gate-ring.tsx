/**
 * **Der Ring, der „das ist jetzt dran" sagt.**
 *
 * Dieselbe Form wie der aktuelle Punkt der Reifegrad-Leiter
 * (`epic-gate-ladder.tsx`: `border-primary bg-card`), nur kleiner und ohne den
 * Strich, der dort die Stufen verbindet. Wer die Leiter oben gesehen hat,
 * erkennt ihn unten wieder, ohne ihn zu lesen.
 *
 * Er stand zuerst als lokale Konstante in der Reiterschiene
 * (`entity-detail-shell.tsx`). Mit der zweiten Stelle — den Kacheln der
 * Epic-Overview — wäre daraus eine Abschrift geworden, und zwei Ringe, die sich
 * bei der nächsten Feinjustierung trennen. Hier ist einer.
 *
 * **`aria-hidden`, und das ist kein Versäumnis.** Die Aussage trägt der Text
 * daneben — das Reifegrad-Etikett am Reiter, der `title` an der Karte. Ein Ring,
 * den nur das Auge sieht, darf nichts behaupten, was nur er weiss.
 */
export function GateRing({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`size-2.5 shrink-0 rounded-full border-2 border-primary bg-card align-middle ${
        className ?? ""
      }`.trim()}
    />
  );
}
