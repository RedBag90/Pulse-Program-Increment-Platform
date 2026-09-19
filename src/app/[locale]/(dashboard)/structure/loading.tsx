/**
 * Ladezustand des Struktur-Bereichs — ein Skelett in der Form dessen, was
 * kommt, kein Spinner.
 *
 * Es gilt seit dem Wegfall des verschachtelten Layouts für **alle** Flächen des
 * Bereichs, die keines eigenen haben: die Karte, die Tabelle und die drei
 * Knotenarten. Deshalb ist es bewusst neutral — Kopfzeile, Werkzeugleiste, zwei
 * Blöcke —, statt die Reiter einer Knotenseite zu skizzieren.
 */
export default function StructureLoading() {
  return (
    <div className="animate-pulse space-y-4 p-6" aria-busy="true" aria-label="Wird geladen">
      <div className="h-7 w-64 rounded-sm bg-muted" />
      <div className="flex gap-2">
        <div className="h-8 w-40 rounded-lg bg-muted" />
        <div className="h-8 w-44 rounded-lg bg-muted" />
      </div>
      <div className="h-36 rounded-lg bg-muted/50" />
      <div className="h-36 rounded-lg bg-muted/50" />
    </div>
  );
}
