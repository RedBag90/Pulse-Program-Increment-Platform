"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

interface Props {
  teamId: string;
  teamName: string;
  artId: string;
  artName: string;
}

export function TeamSubNav({ teamId, teamName, artId, artName }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: `/team/${teamId}`, label: "Backlog", segment: "" },
    { href: `/team/${teamId}/settings`, label: "Settings", segment: "settings" },
    { href: `/team/${teamId}/history`, label: "History", segment: "history" },
  ] as const;

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

      <div className="border-b flex gap-0">
        {tabs.map(({ href, label, segment }) => {
          const active =
            segment === ""
              ? pathname.endsWith(`/team/${teamId}`)
              : pathname.includes(`/team/${teamId}/${segment}`);

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
