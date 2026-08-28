import { Skeleton } from "@/components/ui/skeleton";

/**
 * Issue-Register-Skeleton für den Navigations-Blank (statt Text „Lädt…").
 * Spiegelt den Aufbau: Header · Matrix/Vorschläge · Funnel · Toolbar · Tabelle.
 */
export default function IssuesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--page-max-w)] flex-col gap-6 px-6 py-8 md:px-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
