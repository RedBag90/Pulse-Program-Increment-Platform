/**
 * Ladezustand der Knoten-Fläche — ein Skelett in der Form dessen, was kommt,
 * kein Spinner.
 *
 * Der Baum steht dabei schon: er lebt im Layout und wird beim Navigieren
 * zwischen Knoten nicht neu gerendert. Sichtbar wechselt also nur die rechte
 * Spalte, und genau die skizziert dieses Gerüst — Titel, Reiterzeile, zwei
 * Blöcke.
 */
export default function StructureNodeLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Wird geladen">
      <div className="h-7 w-64 rounded bg-muted" />
      <div className="flex gap-3 border-b pb-2">
        {[64, 56, 72, 48].map((w) => (
          <div key={w} className="h-4 rounded bg-muted" style={{ width: w }} />
        ))}
      </div>
      <div className="h-28 rounded-lg border bg-muted/40" />
      <div className="h-44 rounded-lg border bg-muted/40" />
    </div>
  );
}
