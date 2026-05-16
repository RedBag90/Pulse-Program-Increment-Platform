"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

const NAV_GROUPS = [
  {
    labelKey: "portfolio",
    items: [
      { href: "/portfolio", labelKey: "overview", exact: true },
      { href: "/portfolio/epics", labelKey: "epics" },
      { href: "/portfolio/value-streams", labelKey: "valueStreams" },
    ],
  },
  {
    labelKey: "programPlanning",
    items: [
      { href: "/art", labelKey: "arts" },
      { href: "/pi", labelKey: "programIncrements" },
      { href: "/feature", labelKey: "features" },
    ],
  },
  {
    labelKey: "teamExecution",
    items: [
      { href: "/team", labelKey: "teams" },
      { href: "/sprint", labelKey: "mySprints" },
    ],
  },
  {
    labelKey: "admin",
    items: [
      { href: "/admin/users", labelKey: "users" },
      { href: "/admin/integrations", labelKey: "integrations" },
      { href: "/admin/audit-log", labelKey: "auditLog" },
    ],
  },
] as const;

/** Whether a nav item is active, ignoring the locale prefix and matching on segment boundaries. */
function isActive(pathname: string, href: string, exact: boolean): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="w-56 shrink-0 border-r bg-white flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b">
        <span className="font-bold text-blue-800 text-lg tracking-tight">Pulse</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, labelKey, ...rest }) => {
                const exact = "exact" in rest ? rest.exact : false;
                const active = isActive(pathname, href, exact);
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
                    {t(labelKey)}
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
