/**
 * Default-Loading-UI fuer alle Dashboard-Routen. Next.js wickelt jede Page
 * in eine Suspense-Grenze und zeigt dieses Skelett, waehrend das Server-
 * Rendering laeuft — Navigation fuehlt sich sofort an, statt blank zu sein.
 *
 * Bewusst generisch gehalten: drei Block-Platzhalter im Layout-Raster, die
 * den meisten Pulse-Pages (Master-Detail / Liste-Detail) aehneln. Einzelne
 * Routen koennen ein praziseres `loading.tsx` direkt im Routen-Ordner
 * ablegen, das hier ueberschreibt.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
