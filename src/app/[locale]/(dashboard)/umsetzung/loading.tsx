import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cockpit-Skeleton fuer den Navigations-Blank (ersetzt das grobe Gruppen-
 * `loading.tsx` bzw. `Suspense fallback={null}`). Spiegelt den Aufbau der
 * Shell: Header-Band · PI-Strip · Toolbar · Board-Raster.
 */
export default function UmsetzungLoading() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-background">
      {/* Header-Band */}
      <div className="space-y-2 border-b bg-surface-frame px-6 py-4">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      {/* PI-Strip */}
      <div className="flex gap-2 border-b bg-surface-frame px-6 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1" />
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-surface-frame px-6 py-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-56" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {/* Board-Raster */}
      <div
        className="grid flex-1 gap-2 px-6 pb-6 pt-4"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
