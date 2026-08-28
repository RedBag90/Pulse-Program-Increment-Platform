import { cn } from "@/lib/utils";

/**
 * Geteiltes Skeleton-Primitive — ein `animate-pulse`-Platzhalter. Ersetzt die
 * verstreuten Ad-hoc-`animate-pulse`-Divs und speist flächenspezifische
 * `loading.tsx`-Dateien (z. B. das Cockpit), statt `Suspense fallback={null}`.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
