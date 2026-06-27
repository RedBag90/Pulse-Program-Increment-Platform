"use client";

import { SectionSubNav } from "@/components/nav/section-sub-nav";

interface Props {
  piId: string;
}

export function PiSubNav({ piId }: Props) {
  const root = `/pi/${piId}`;
  return (
    <SectionSubNav
      ariaLabel="PI navigation"
      sectionRoot={root}
      tabs={[
        { href: root, label: "Overview", segment: "" },
        { href: `${root}/board`, label: "Program Board", segment: "board" },
        { href: `${root}/dependencies`, label: "Dependencies", segment: "dependencies" },
      ]}
    />
  );
}
