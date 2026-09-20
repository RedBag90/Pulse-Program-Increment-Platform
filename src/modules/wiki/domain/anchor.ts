/**
 * Ein Anker-Slug, der auch mit Umlauten und Punkten stabil bleibt.
 *
 * Stand bis September 2026 privat in `guide-view.tsx`. Mit der zweiten Ansicht
 * (den Rollen-Blaettern) braucht ihn eine zweite Datei — und ein zweites Mal
 * hingeschrieben waere er genau die Sorte Parallelliste, vor der die
 * Nachbardateien warnen: zwei Fassungen, die sich bei der naechsten Umlaut-Regel
 * trennen, und kaputte Sprungziele faellt niemandem auf.
 *
 * Rein, kein JSX.
 */
export function anchorId(prefix: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}
