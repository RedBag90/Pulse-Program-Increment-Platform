/**
 * Wer welchen Knoten der Struktur-Fläche **öffnen** darf.
 *
 * Bis zum Struktur-Umbau prüfte der Scope nur das Bearbeiten: ein auf einen
 * Wertstrom eingegrenzter Nutzer konnte jeden anderen lesen. An einer so
 * prominenten Fläche ist das eine Entscheidung, die getroffen sein will.
 *
 * Die Regel: der **Baum zeigt alles** — Orientierung über die eigene Grenze
 * hinaus ist nötig, sonst versteht niemand Abhängigkeiten. Die **Fläche** eines
 * fremden Knotens zeigt nur „Allgemein", schreibgeschützt.
 *
 * Der Fall, der bei einer zu engen Regel zuerst bricht, ist der RTE: sein ART
 * liegt in einem Wertstrom, den er nicht „besitzt" — trotzdem muss er ihn
 * öffnen können. Deshalb gilt ein Wertstrom als offen, sobald einer *seiner*
 * ARTs im Scope steht.
 */

/** Was von `PrincipalScopes` gebraucht wird. Leeres Array = alles im Scope. */
export interface AccessScopes {
  valueStreamIds: readonly string[];
  artIds: readonly string[];
}

/** Darf dieser Wertstrom-Knoten vollständig geöffnet werden? */
export function canOpenValueStream(
  scopes: AccessScopes,
  valueStream: { id: string; artIds: readonly string[] },
): boolean {
  if (scopes.valueStreamIds.length === 0 && scopes.artIds.length === 0) return true;
  if (scopes.valueStreamIds.includes(valueStream.id)) return true;
  // Der RTE-Fall: der Wertstrom seines ARTs bleibt offen.
  return valueStream.artIds.some((id) => scopes.artIds.includes(id));
}

/** Darf dieser ART-Knoten vollständig geöffnet werden? */
export function canOpenArt(
  scopes: AccessScopes,
  art: { id: string; valueStreamId: string },
): boolean {
  if (scopes.artIds.includes(art.id)) return true;
  if (scopes.artIds.length > 0) return false;
  // Ohne ART-Scope entscheidet der Wertstrom — ein Wertstrom-Verantwortlicher
  // kommt an jeden ART seines Wertstroms.
  return scopes.valueStreamIds.length === 0 || scopes.valueStreamIds.includes(art.valueStreamId);
}
