import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export interface DetailTab {
  key: string;
  label: string;
}

/** Narrows an arbitrary `?tab=` value to a known tab key, defaulting to the first tab. */
export function resolveTab(tabs: readonly DetailTab[], raw: string | undefined): string {
  return tabs.some((t) => t.key === raw) ? (raw as string) : (tabs[0]?.key ?? "");
}

interface Props {
  /** Where the "back" link points, e.g. `/capacity`. Omit on a top-level hub. */
  backHref?: string;
  backLabel?: string;
  title: string;
  /** Optional pill next to the title. A string is wrapped in the default muted
   *  pill; a node (e.g. a colored status pill) is rendered as-is. */
  badge?: ReactNode;
  tabs: readonly DetailTab[];
  activeTab: string;
  /** Detail route without query, e.g. `/value-streams/<id>`; tab links append `?tab=`. */
  basePath: string;
  headerActions?: ReactNode;
  /** Optional right-hand zone (e.g. an activity feed). When set the layout is
   *  three-zone; omitted it stays two-zone. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Generic detail layout — header on top, then a left tab rail, the center
 * content, and an optional right-hand `aside` zone. The page passes the active
 * tab's content as `children`; the shell owns navigation. Shared by the Epic,
 * Feature, and Capacity-Planning (Value Stream / ART / Team) detail pages.
 */
export function EntityDetailShell({
  backHref,
  backLabel,
  title,
  badge,
  tabs,
  activeTab,
  basePath,
  headerActions,
  aside,
  children,
}: Props) {
  return (
    <div className="flex flex-col">
      <header className="border-b px-6 py-4">
        {backHref && backLabel && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        )}
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {badge &&
            (typeof badge === "string" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{badge}</span>
            ) : (
              badge
            ))}
          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>
      </header>

      <div className="flex min-h-[70vh]">
        <nav aria-label="Bereiche" className="w-48 shrink-0 border-r p-3">
          <ul className="space-y-0.5">
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <li key={tab.key}>
                  <Link
                    href={`${basePath}?tab=${tab.key}`}
                    aria-current={active ? "page" : undefined}
                    className={`block border-l-2 rounded-r-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>

        {aside}
      </div>
    </div>
  );
}
