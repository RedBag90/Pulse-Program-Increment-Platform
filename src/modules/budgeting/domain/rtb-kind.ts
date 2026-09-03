/**
 * Die **Art** einer Run-the-Business-Position.
 *
 * `run` ist der laufende Betrieb — das heutige Verhalten und der Default.
 * `art_change` ist der **Veränderungsrahmen** eines ARTs: der Topf, aus dem er
 * seine ART-Epics finanziert.
 *
 * Beide gehen denselben Weg über den Ballot und werden dort mitverteilt: der
 * Wertstrom entscheidet in der Kachel, **wie groß** der Rahmen ist, der ART
 * danach, **wofür**. Getrennt gehalten werden sie, weil sonst Veränderungsarbeit
 * aus dem Betriebstopf bezahlt würde — und vier bestehende Flächen unwahr
 * wären: die Grow-/Run-Kacheln der Solution, der Run-Anteil am Wertstrom, die
 * Ballot-Gliederung und Guardrail 2.
 *
 * Rein, kein I/O.
 */

export const RTB_KINDS = ["run", "art_change"] as const;
export type RtbKind = (typeof RTB_KINDS)[number];

export const RTB_KIND_LABELS: Record<RtbKind, string> = {
  run: "Betrieb",
  art_change: "Veränderungsrahmen",
};

/** Unbekanntes oder fehlendes Kind → Betrieb; das ist der Bestand. */
export function rtbKindOrDefault(raw: string | null | undefined): RtbKind {
  return raw != null && (RTB_KINDS as readonly string[]).includes(raw) ? (raw as RtbKind) : "run";
}

/** Zählt diese Art als Grow (Veränderung) statt als Run (Betrieb)? */
export function isChangeKind(raw: string | null | undefined): boolean {
  return rtbKindOrDefault(raw) === "art_change";
}
