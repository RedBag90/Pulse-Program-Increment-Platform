"use client";

import { Link } from "@/i18n/navigation";
import { SectionSubNav } from "@/components/nav/section-sub-nav";

interface Props {
  artId: string;
  artName: string;
}

export function ArtSubNav({ artId, artName }: Props) {
  const root = `/art/${artId}`;
  const tabs = [
    { href: root, label: "Overview", segment: "" },
    { href: `${root}/features`, label: "Features", segment: "features" },
    { href: `${root}/pi`, label: "Program Increments", segment: "pi" },
    { href: `${root}/velocity`, label: "Velocity", segment: "velocity" },
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
        <span className="text-foreground font-medium">{artName}</span>
      </nav>

      <SectionSubNav ariaLabel="ART navigation" sectionRoot={root} tabs={tabs} />
    </div>
  );
}
