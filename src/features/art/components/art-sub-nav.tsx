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
    { href: `/art/${artId}/features`, label: "Features" },
    { href: `/art/${artId}/pi`, label: "Program Increments" },
    { href: `/art/${artId}/teams`, label: "Teams" },
    { href: `/art/${artId}/velocity`, label: "Velocity" },
  ] as const;

  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{artName}</span>
      </nav>

      <div className="border-b flex gap-0">
        {tabs.map(({ href, label }) => {
          const segment = href.split(`/${artId}/`)[1] ?? "";
          const active = pathname.includes(`/${artId}/${segment}`);

          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
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
