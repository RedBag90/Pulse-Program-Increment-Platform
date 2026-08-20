"use client";

import { usePathname } from "@/i18n/navigation";
import { SectionSubNav } from "@/components/nav/section-sub-nav";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { oldToNewHref, segmentToTab } from "@/components/nav/layout-toggle-routes";

interface Props {
  piId: string;
}

export function PiSubNav({ piId }: Props) {
  const pathname = usePathname();
  const root = `/pi/${piId}`;
  const activeTab = segmentToTab(pathname, piId);

  return (
    <div className="flex items-center justify-between gap-3">
      <SectionSubNav
        ariaLabel="PI navigation"
        sectionRoot={root}
        tabs={[
          { href: root, label: "Overview", segment: "" },
          { href: `${root}/dependencies`, label: "Dependencies", segment: "dependencies" },
        ]}
      />
      <LayoutToggle current="old" otherHref={oldToNewHref("pi", piId, activeTab)} />
    </div>
  );
}
