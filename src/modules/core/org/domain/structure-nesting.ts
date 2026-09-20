/**
 * **Welche Solution hängt an welchem ART — und welche an keinem sichtbaren?**
 *
 * Eine Zeile Fachlichkeit, die es zweimal gab: in der Organisations-Karte
 * (`structure-overview.ts`) und in der Rollenverteilung (`role-directory.ts`).
 * Beide lesen denselben Baum und beide zeigen Spalten mit Kacheln darin; wer
 * die Zuordnung zweimal schreibt, hat sie beim nächsten Sonderfall einmal
 * falsch.
 *
 * **Gefragt wird „ist ihr ART hier zu sehen", nicht „hat sie eins".** `artId`
 * ist seit September 2026 Pflicht — die alte Frage wäre also nie mehr wahr.
 * Der **Fall** bleibt aber: ein weich gelöschtes ART fällt aus `vs.arts`
 * heraus, seine Solutions zeigten dann auf einen Knoten, den niemand rendert,
 * und wären aus der Fläche verschwunden. Sie hängen deshalb direkt am
 * Wertstrom — der ohnehin ihre Heimat ist (ADR-0022), das ART nur ein Verweis.
 *
 * Rein, kein I/O.
 */

export interface Nested<S> {
  /** Solutions je sichtbarem ART, in Baumreihenfolge. */
  byArt: Map<string, S[]>;
  /** Solutions ohne sichtbaren ART — sie hängen am Wertstrom. */
  loose: S[];
}

export function nestSolutionsByArt<
  A extends { id: string },
  S extends { artId?: string | null },
>(vs: { arts: readonly A[]; solutions: readonly S[] }): Nested<S> {
  const shown = new Set(vs.arts.map((a) => a.id));
  const byArt = new Map<string, S[]>();
  const loose: S[] = [];

  for (const sol of vs.solutions) {
    const artId = sol.artId;
    if (artId != null && shown.has(artId)) byArt.set(artId, [...(byArt.get(artId) ?? []), sol]);
    else loose.push(sol);
  }

  return { byArt, loose };
}
