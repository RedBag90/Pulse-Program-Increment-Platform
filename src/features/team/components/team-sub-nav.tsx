"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { SectionSubNav } from "@/components/nav/section-sub-nav";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { oldToNewHref, segmentToTab } from "@/components/nav/layout-toggle-routes";

interface Props {
  teamId: string;
  teamName: string;
  artId: string;
  artName: string;
}

export function TeamSubNav({ teamId, teamName, artId, artName }: Props) {
  const pathname = usePathname();
  const root = `/team/${teamId}`;
  const tabs = [
    { href: `${root}/settings`, label: "Settings", segment: "settings" },
    { href: `${root}/history`, label: "History", segment: "history" },
  ];

  const activeTab = segmentToTab(pathname, teamId);

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted-foreground flex items-center gap-1">
        <Link href="/structure?tab=arts" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/teams`} className="hover:underline">
          {artName}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{teamName}</span>
      </nav>

      <div className="flex items-center justify-between gap-3">
        <SectionSubNav ariaLabel="Team navigation" sectionRoot={root} tabs={tabs} />
        <LayoutToggle current="old" otherHref={oldToNewHref("team", teamId, activeTab)} />
      </div>
    </div>
  );
}
