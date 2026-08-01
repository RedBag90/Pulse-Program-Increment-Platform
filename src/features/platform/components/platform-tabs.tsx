"use client";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Route-basierte Tabs des Plattform-Admin-Bereichs. Jeder Tab ist eine eigene
 * `(platform)`-Route; der aktive Tab ergibt sich aus dem (locale-gestrippten)
 * Pfad. Kein URL-State-Toggle — die vier Flächen sind eigenständige Seiten.
 */
const TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/users", label: "Nutzer" },
  { href: "/platform/join-requests", label: "Anfragen" },
  { href: "/platform/provision-requests", label: "Tenant-Anfragen" },
];

export function PlatformTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Plattform-Verwaltung" className="flex gap-1 text-sm">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const cls = active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 font-medium transition-colors ${cls}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
