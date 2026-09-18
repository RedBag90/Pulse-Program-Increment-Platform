/**
 * **Der materialisierte Pfad einer Initiative.**
 *
 * Eine Wurzel (Epic — und künftig auch ein Feature ohne Epic) trägt ihre eigene
 * Id. Ein Kind hängt sich mit einem Trennzeichen an den Pfad seines Elternteils.
 *
 * Der Ausdruck stand bisher nur in `createInitiativeWithDerivedPath`. Er steht
 * hier, weil das Umhängen eines Features denselben Pfad neu bilden muss — und
 * zwar nach derselben Regel, nicht nach einer zweiten, die ihr ähnlich sieht.
 *
 * > **Bekannter Defekt, hier nicht behoben:** der Anwendungscode schreibt `.`,
 * > die gesäten Daten benutzen `/` (siehe
 * > `docs/backlog/initiative-path-separator-inconsistency.md`). Solange beides
 * > nebeneinander existiert, bleibt ein pfadbasierter Teilbaum-Filter
 * > unzuverlässig. Das Herausziehen ändert daran nichts — es macht die spätere
 * > Vereinheitlichung aber zu **einer** Stelle statt zu dreien.
 *
 * Rein, kein I/O.
 */

/** Das Trennzeichen zwischen zwei Pfadsegmenten. */
export const INITIATIVE_PATH_SEPARATOR = ".";

/**
 * Der Pfad einer Initiative aus dem Pfad ihres Elternteils und der eigenen Id.
 *
 * Ohne Elternteil ist es die eigene Id — das gilt für ein Epic und, sobald es
 * sie gibt, für ein eigenständiges Feature. Beide sind Wurzeln; die Ebene
 * unterscheidet sie, nicht der Pfad.
 */
export function derivedInitiativePath(
  parentPath: string | null | undefined,
  ownId: string,
): string {
  return parentPath ? `${parentPath}${INITIATIVE_PATH_SEPARATOR}${ownId}` : ownId;
}
