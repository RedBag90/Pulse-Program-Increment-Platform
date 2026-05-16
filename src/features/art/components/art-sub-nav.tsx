"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

interface Props {
  artId: string;
  artName: string;
}

export function ArtSubNav({ artId, artName }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: `/art/${artId}`, label: "Overview", segment: "" },
    { href: `/art/${artId}/features`, label: "Features", segment: "features" },
    { href: `/art/${artId}/pi`, label: "Program Increments", segment: "pi" },
    { href: `/art/${artId}/teams`, label: "Teams", segment: "teams" },
    { href: `/art/${artId}/velocity`, label: "Velocity", segment: "velocity" },
    { href: `/art/${artId}/impediments`, label: "Impediments", segment: "impediments" },
  ] as const;

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted-foreground flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{artName}</span>
      </nav>

      <div className="border-b flex gap-0">
        {tabs.map(({ href, label, segment }) => {
          const active =
            segment === ""
              ? pathname.endsWith(`/art/${artId}`)
              : pathname.includes(`/art/${artId}/${segment}`);

          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
