"use client";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Props {
  /** Which layout is currently rendered. */
  current: "old" | "new";
  /** Pfad in den anderen Modus (inkl. `?tab=` oder Segment). */
  otherHref: string;
}

/**
 * Pill-Toggle, der zwischen der alten Section-Sub-Nav-Page und der neuen
 * Tab-Detail-Shell-Variante umschaltet. Sitzt auf beiden Layouts in der
 * Page-Header-Zeile, damit man im selben "Tab"-Inhalt das Skelett vergleichen
 * kann (Teams alt ↔ Teams neu).
 *
 * Wenn das neue Layout sich durchsetzt: Toggle + diese Komponente loeschen,
 * alte Routen als Redirects.
 */
export function LayoutToggle({ current, otherHref }: Props) {
  const router = useRouter();
  const switchTo = current === "old" ? "new" : "old";

  return (
    <div
      role="group"
      aria-label="Layout"
      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5 text-xs"
    >
      <span className="px-2 py-0.5 text-muted-foreground">Layout:</span>
      <button
        type="button"
        aria-pressed={current === "old"}
        onClick={() => current === "old" || router.push(otherHref)}
        className={cn(
          "rounded-full px-2.5 py-0.5 transition-colors",
          current === "old"
            ? "bg-background font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Old
      </button>
      <button
        type="button"
        aria-pressed={current === "new"}
        onClick={() => current === "new" || router.push(otherHref)}
        className={cn(
          "rounded-full px-2.5 py-0.5 transition-colors",
          current === "new"
            ? "bg-background font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        New
      </button>
      {/* Hint fuer Voice-over — sagt was beim Click passiert. */}
      <span className="sr-only">Wechsel zu {switchTo === "old" ? "Old" : "New"}-Layout</span>
    </div>
  );
}
