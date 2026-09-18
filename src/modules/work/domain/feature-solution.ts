/**
 * **Welche Solution gehört zu diesem Feature?**
 *
 * Bis hierhin war die Antwort immer „die des Eltern-Epics". Das genügt nicht
 * mehr: ein **eigenständiges Feature** hat kein Epic, von dem es erben könnte —
 * und ein Feature soll ohnehin sagen dürfen, in welche Solution es geliefert
 * wird, denn genau das ist im klassischen SAFe der Bezug.
 *
 * Die Regel ist eine Zeile: **die eigene, sonst die des Epics.** Eine eigene
 * Zuordnung überschreibt also, aber sie ist nie Pflicht — wer nichts setzt,
 * bekommt weiter das, was er vorher bekam.
 *
 * Die Solution selbst wohnt in Core (ADR-0022, „Eine Solution ist Struktur").
 * Die **Verknüpfung** zwischen Arbeit und Solution bleibt Work — deshalb steht
 * diese Funktion hier und nicht daneben.
 *
 * Rein, kein I/O.
 */

export interface FeatureSolutionSource<T> {
  /** Eigene Zuordnung des Features. */
  own: T | null | undefined;
  /** Zuordnung seines Eltern-Epics; `null`, wenn es keins gibt. */
  parent: T | null | undefined;
}

export function resolveFeatureSolution<T>(src: FeatureSolutionSource<T>): T | null {
  return src.own ?? src.parent ?? null;
}
