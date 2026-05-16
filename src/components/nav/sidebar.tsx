"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

const NAV_GROUPS = [
  {
    label: "Portfolio",
    items: [
      { href: "/portfolio", label: "Overview", exact: true },
      { href: "/portfolio/epics", label: "Epics" },
      { href: "/portfolio/value-streams", label: "Value Streams" },
    ],
  },
  {
    label: "Delivery",
    items: [{ href: "/art", label: "ARTs & PI Planning" }],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/integrations", label: "Integrations" },
      { href: "/admin/audit-log", label: "Audit Log" },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-white flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b">
        <span className="font-bold text-blue-800 text-lg tracking-tight">Pulse</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, ...rest }) => {
                const exact = "exact" in rest ? rest.exact : false;
                const active = exact
                  ? pathname === href || pathname.endsWith(href)
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
                    {itemLabel}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
