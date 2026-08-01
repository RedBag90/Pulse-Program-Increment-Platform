import type { ReactNode } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/server/auth/platform";
import { PlatformTabs } from "@/features/platform/components/platform-tabs";

/**
 * Plattform-Admin-Chrome (Roadmap P1). EIGENE Route-Gruppe `(platform)` —
 * NICHT unter `(dashboard)`: dort würde der Modul-Route-Guard `/platform` als
 * unregistriertes Segment fail-closed sperren. Eigenes Layout mit hartem
 * `requirePlatformAdmin`-Guard (globale, tenant-blinde Rolle; kein
 * tenant_admin-Fast-Path), eigener Topbar + route-basierten Tabs, ohne
 * tenant-scoped Modul-Gating.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const principal = await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex shrink-0 flex-col border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-12 items-center gap-4 px-4 md:px-6">
          <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary">
              <Shield className="size-4 text-primary-foreground" strokeWidth={2.5} />
            </span>
            Plattform-Verwaltung
          </span>
          <div className="flex-1" />
          <span className="hidden text-xs text-muted-foreground md:inline">{principal.email}</span>
          <Link
            href="/start"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Zurück zur App
          </Link>
        </div>
        <div className="px-4 md:px-6">
          <PlatformTabs />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
