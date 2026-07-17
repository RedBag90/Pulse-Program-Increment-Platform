"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { SectionSubNav } from "@/components/nav/section-sub-nav";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { oldToNewHref, segmentToTab } from "@/components/nav/layout-toggle-routes";

interface Props {
  artId: string;
  artName: string;
}

export function ArtSubNav({ artId, artName }: Props) {
  const pathname = usePathname();
  const root = `/art/${artId}`;
  const tabs = [
    { href: root, label: "Overview", segment: "" },
    { href: `${root}/features`, label: "Features", segment: "features" },
    { href: `${root}/pi`, label: "Program Increments", segment: "pi" },
    { href: `${root}/teams`, label: "Teams", segment: "teams" },
    { href: `${root}/velocity`, label: "Velocity", segment: "velocity" },
    { href: `${root}/impediments`, label: "Impediments", segment: "impediments" },
    { href: `${root}/settings`, label: "Settings", segment: "settings" },
    { href: `${root}/history`, label: "History", segment: "history" },
  ];
  const activeTab = segmentToTab(pathname, artId);

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted-foreground flex items-center gap-1">
        <Link href="/structure?tab=arts" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{artName}</span>
      </nav>

      <div className="flex items-center justify-between gap-3">
        <SectionSubNav ariaLabel="ART navigation" sectionRoot={root} tabs={tabs} />
        <LayoutToggle current="old" otherHref={oldToNewHref("art", artId, activeTab)} />
      </div>
    </div>
  );
}
