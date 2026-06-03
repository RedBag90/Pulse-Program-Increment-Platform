import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type OverviewView = "mission" | "hero" | "executive";

export const OVERVIEW_VIEWS: { key: OverviewView; label: string }[] = [
  { key: "mission", label: "Mission Control" },
  { key: "hero", label: "Hero" },
  { key: "executive", label: "Executive" },
];

/** Defaults to `mission` when the query value is missing or unrecognised. */
export function resolveOverviewView(raw: string | undefined): OverviewView {
  return OVERVIEW_VIEWS.some((v) => v.key === raw) ? (raw as OverviewView) : "mission";
}

/**
 * Three-tab segmented control for the Portfolio overview. The variants are
 * staged in parallel so the user can compare; once a preferred one emerges,
 * the other two should be removed in a follow-up.
 */
export function ViewSwitcher({ current }: { current: OverviewView }) {
  return (
    <nav
      aria-label="Übersicht-Variante"
      className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs"
    >
      {OVERVIEW_VIEWS.map((v) => {
        const active = v.key === current;
        return (
          <Link
            key={v.key}
            href={`/portfolio?view=${v.key}`}
            className={cn(
              "rounded px-2.5 py-1 transition-colors",
              active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
