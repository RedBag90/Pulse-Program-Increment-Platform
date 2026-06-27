"use client";

import { Link } from "@/i18n/navigation";
import { SectionSubNav } from "@/components/nav/section-sub-nav";

interface Props {
  teamId: string;
  teamName: string;
  artId: string;
  artName: string;
}

export function TeamSubNav({ teamId, teamName, artId, artName }: Props) {
  const root = `/team/${teamId}`;
  const tabs = [
    { href: `${root}/settings`, label: "Settings", segment: "settings" },
    { href: `${root}/history`, label: "History", segment: "history" },
  ];

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

      <SectionSubNav ariaLabel="Team navigation" sectionRoot={root} tabs={tabs} />
    </div>
  );
}
