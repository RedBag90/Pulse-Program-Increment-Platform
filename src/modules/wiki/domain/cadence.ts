/**
 * Der **Rhythmus** einer Anleitung — wie oft man den Ablauf durchlaeuft.
 *
 * Das ist die Ordnung des Hubs, und sie ist eine Aussage, keine Sortierung: die
 * elf Ablaeufe haengen zeitlich zusammen. Wer den Bogen einmal gesehen hat,
 * weiss, wo er anfangen muss — eine alphabetische Liste sagt das nicht.
 *
 * Rein, kein I/O.
 */

export const CADENCES = ["einmalig", "je_idee", "je_halbjahr", "je_pi", "querschnitt"] as const;

export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABEL: Record<Cadence, string> = {
  einmalig: "Einmalig",
  je_idee: "Je Idee",
  je_halbjahr: "Je Halbjahr",
  je_pi: "Je PI",
  querschnitt: "Querschnitt",
};

/** Die Unterzeile am Bogen — sie sagt, *warum* der Takt so ist. */
export const CADENCE_HINT: Record<Cadence, string> = {
  einmalig: "beim Aufsetzen",
  je_idee: "ein Vorhaben",
  je_halbjahr: "der Geld-Takt",
  je_pi: "der Liefer-Takt",
  querschnitt: "jederzeit",
};
