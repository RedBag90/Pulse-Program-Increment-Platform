"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

interface Props {
  piId: string;
}

export function PiSubNav({ piId }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: `/pi/${piId}`, label: "Overview", segment: "" },
    { href: `/pi/${piId}/board`, label: "Program Board", segment: "board" },
    { href: `/pi/${piId}/objectives`, label: "Objectives", segment: "objectives" },
    { href: `/pi/${piId}/dependencies`, label: "Dependencies", segment: "dependencies" },
  ] as const;

  return (
    <div className="border-b flex gap-0">
      {tabs.map(({ href, label, segment }) => {
        const active =
          segment === ""
            ? pathname.endsWith(`/pi/${piId}`)
            : pathname.endsWith(`/pi/${piId}/${segment}`);

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
  );
}
