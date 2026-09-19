/**
 * **ART-eigene Arbeit** — der Teil des ART-Rahmens, der an keinem Epic hängt.
 *
 * Ein ART-Improvement-Budget finanziert alles, was das ART tut; `art-throughput.ts`
 * sagt das für den €-Satz seit jeher wörtlich. Verteilen liess es sich bis
 * hierher nur an **ART-Epics** — „noch zu verteilen" behauptete deshalb mehr
 * Freiheit, als da war.
 *
 * Einzelne Features zu budgetieren ist ausgeschlossen. Stattdessen **eine**
 * Zeile je Halbjahr, die der RTE beziffert — und daneben ein **Richtwert**, den
 * diese Datei rechnet: die eingeplante eigenständige Feature-Last mal dem
 * €-Satz dieses ARTs.
 *
 * Rein, kein I/O.
 */

/** Was die Fläche über die eigenständige Arbeit eines Halbjahres weiß. */
export interface OwnWorkGuide {
  /** Eigenständige Features, die in **diesem** Halbjahr per PI eingeplant sind. */
  featureCount: number;
  jobSize: number;
  /** Der €-Satz dieses ARTs — `null`, wenn keiner ableitbar ist. */
  rate: number | null;
  /**
   * Richtwert in Euro: `jobSize × rate`. `null` ohne Satz — dann steht auf der
   * Fläche „—" und nicht 0 €. Eine Null wäre eine Aussage, die niemand
   * getroffen hat.
   */
  ask: number | null;
}

/**
 * Der Richtwert für ART-eigene Arbeit.
 *
 * **Er ist eine Schätzung und keine Vorbelegung.** Gemessen ergibt Plant
 * Efficiency 169.559 € gegen 58.750 € offenen Rahmen: der Satz stammt aus zwei
 * Halbjahren mit 48 Job-Size-Punkten und schwankt bei jedem einzelnen Feature
 * erheblich. In ein Eingabefeld geschrieben wäre er unbrauchbar; daneben
 * gestellt ist er genau die Auskunft, die heute fehlt.
 */
export function ownWorkGuide(
  planned: { jobSize: number; count: number },
  rate: number | null,
): OwnWorkGuide {
  return {
    featureCount: planned.count,
    jobSize: planned.jobSize,
    rate,
    ask: rate == null ? null : planned.jobSize * rate,
  };
}

/**
 * Übersteigt der Richtwert, was vom Rahmen noch offen ist?
 *
 * Die Frage der Fläche, nicht des Formulars: sie hindert niemanden am
 * Reservieren, sie sagt nur, dass die eingeplante Arbeit nicht in den Rahmen
 * passt. Ohne Richtwert gibt es nichts zu vergleichen.
 */
export function ownWorkExceedsFrame(guide: OwnWorkGuide, remaining: number): boolean {
  return guide.ask != null && guide.ask > remaining;
}
