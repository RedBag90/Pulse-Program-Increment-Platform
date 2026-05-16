"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/portfolio/epics", label: "Epics" },
  { href: "/portfolio/value-streams", label: "Value Streams" },
  { href: "/art", label: "ARTs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-log", label: "Audit Log" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-white flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b">
        <span className="font-bold text-blue-800 text-lg tracking-tight">Pulse</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active =
            href === "/portfolio"
              ? pathname === "/portfolio" || pathname.endsWith("/portfolio")
              : pathname.includes(href);
          return (
            <Link
              key={href}
              href={href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-blue-50 text-blue-800 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
