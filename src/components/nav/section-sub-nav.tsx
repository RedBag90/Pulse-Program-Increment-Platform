"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Page-route section sub-nav — the underline-active-state tab row used by ART,
 * PI, and Team detail pages. Active state is derived from `pathname.endsWith`
 * for the overview entry (`segment === ""`) and `pathname.includes` for the
 * deeper segments, so the row stays lit on deeper sub-pages of the same
 * section (e.g. `/art/{id}/teams/{teamId}` still highlights "Teams").
 *
 * Three near-identical inline copies of this lived in `pi-sub-nav.tsx`,
 * `art-sub-nav.tsx`, and `team-sub-nav.tsx`; concentrating the row here means
 * a styling change (e.g. switching the active accent) flips once, not three
 * times.
 */

export interface SectionTab {
  href: string;
  label: string;
  /** Pathname tail used to detect "is this tab active?". Empty string = the
   *  section's root URL (overview). */
  segment: string;
}

interface Props {
  tabs: ReadonlyArray<SectionTab>;
  /** Section root used to anchor the overview-match (`pathname.endsWith(root)`). */
  sectionRoot: string;
  /** Accessible label for the underlying `<nav>`. */
  ariaLabel?: string;
}

export function SectionSubNav({ tabs, sectionRoot, ariaLabel }: Props) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="border-b flex gap-0">
      {tabs.map(({ href, label, segment }) => {
        const active =
          segment === ""
            ? pathname.endsWith(sectionRoot)
            : pathname.includes(`${sectionRoot}/${segment}`);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
