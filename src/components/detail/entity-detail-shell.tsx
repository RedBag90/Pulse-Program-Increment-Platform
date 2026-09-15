import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs, type Crumb } from "@/components/nav/breadcrumbs";

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
  /**
   * Der Pfad hierher. Gesetzt, ersetzt er den einzeiligen Zurück-Link: eine
   * Detailseite liegt in einer Hierarchie, und ein Pfeil sagt nur „irgendwohin
   * zurueck". `backHref`/`backLabel` bleiben der Rueckfall fuer Flaechen, die
   * ihren Pfad (noch) nicht kennen.
   */
  breadcrumb?: Crumb[];
  /**
   * Die Zeile unter dem Titel: Reifegrad, Klasse, Horizont, Owner — der Stand
   * auf einen Blick, bevor irgendein Reiter geoeffnet ist. Frueher stand davon
   * nichts im Kopf, und der Stand war erst im Unterkopf zu finden.
   */
  badges?: ReactNode;
  tabs: readonly DetailTab[];
  activeTab: string;
  /** Detail route **without query**, e.g. `/structure/value-stream/<id>`; tab
   *  links append `?tab=`. Wer hier eine Query anhängt, erzeugt ein zweites
   *  `?` — der Tab-Parameter kommt dann nie an. Für zusätzliche Parameter gibt
   *  es `tabQuery`. */
  basePath: string;
  /** Parameter, die beim Reiterwechsel erhalten bleiben — etwa das gewählte
   *  Halbjahr einer Budgetfläche. Werden hinter `?tab=` gehängt. */
  tabQuery?: Record<string, string>;
  /** Wenn gesetzt, werden Tabs als Buttons gerendert und der Caller
   *  managed den Tab-State selber — z. B. im Slide-Over, wo wir keine
   *  Navigation wollen. Wenn undefined: Tabs sind Links (Standalone-
   *  Detail-Pages-Verhalten). */
  onTabChange?: (key: string) => void;
  headerActions?: ReactNode;
  /** Sub-Header zwischen Titel-Zeile und Tabs. Z.B. auf der Epic-Detail-
   *  Seite die Reifegrad-/Aktivitäts-Balken. Tab-unabhängig sichtbar. */
  subHeader?: ReactNode;
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
  breadcrumb,
  badges,
  tabs,
  activeTab,
  basePath,
  tabQuery,
  onTabChange,
  headerActions,
  subHeader,
  aside,
  children,
}: Props) {
  const tabSuffix = Object.entries(tabQuery ?? {})
    .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
    .join("");
  return (
    <div className="flex flex-col">
      <header className="border-b bg-surface-frame px-6 py-4">
        {breadcrumb && breadcrumb.length > 0 ? (
          <Breadcrumbs items={breadcrumb} />
        ) : (
          backHref &&
          backLabel && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
          )
        )}
        <div className="mt-2 flex items-start gap-3">
          <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {badge &&
            (typeof badge === "string" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{badge}</span>
            ) : (
              badge
            ))}
          {headerActions && <div className="ml-auto shrink-0">{headerActions}</div>}
        </div>
        {badges && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
      </header>

      {subHeader && <div className="border-b bg-surface-frame px-6 py-4">{subHeader}</div>}

      {/* Unter `lg` klappt die Hülle auf: die Reiterleiste wird eine waagerechte
          Leiste, die Aktivitätsspalte rutscht unter den Inhalt. Vorher standen
          eine feste `w-48` und eine feste `w-72` nebeneinander ohne Umbruch —
          unterhalb von ~1100 px blieb für die Mitte kaum etwas übrig. */}
      <div className="flex min-h-[70vh] flex-col lg:flex-row">
        <nav
          aria-label="Bereiche"
          data-tour="entity-tab-rail"
          className="w-full shrink-0 border-b bg-surface-frame p-2 lg:w-48 lg:border-b-0 lg:border-r lg:p-3"
        >
          {/* `overflow-x-auto` gilt nur waagerecht: in der senkrechten Schiene
              beschnitte der Scrollbereich sonst den Fokus-Ring, und ein zu
              langer Name verschwände in einem Bereich, den niemand als
              scrollbar erkennt. */}
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-x-visible">
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              // `lg:truncate` statt `truncate`: unterhalb von `lg` sind die
              // Reiter Flex-Elemente, und ein `overflow-hidden` setzte dort
              // ihr `min-width: auto` auf 0 — sie quetschten sich zu
              // Auslassungspunkten zusammen, statt die Leiste scrollen zu
              // lassen. Ab `lg` ist die Schiene ~141 px breit; dort ist ein
              // „…" die ehrliche Notbremse. Die Namen selbst hält der Wächter
              // in `entity-detail-shell-tabs.test.tsx` kurz genug.
              const cls = `block w-full whitespace-nowrap text-left rounded-md px-3 py-1.5 text-sm transition-colors lg:truncate lg:rounded-l-none lg:rounded-r-md lg:border-l-2 ${
                active
                  ? "bg-primary/10 font-medium text-primary lg:border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground lg:border-transparent"
              }`;
              return (
                <li key={tab.key}>
                  {onTabChange ? (
                    <button
                      type="button"
                      onClick={() => onTabChange(tab.key)}
                      aria-current={active ? "page" : undefined}
                      title={tab.label}
                      className={cls}
                    >
                      {tab.label}
                    </button>
                  ) : (
                    <Link
                      href={`${basePath}?tab=${tab.key}${tabSuffix}`}
                      aria-current={active ? "page" : undefined}
                      title={tab.label}
                      className={cls}
                    >
                      {tab.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto bg-background p-4 sm:p-6">{children}</main>

        {aside}
      </div>
    </div>
  );
}
