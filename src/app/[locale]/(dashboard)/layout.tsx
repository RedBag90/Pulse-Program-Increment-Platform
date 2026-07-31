import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/domain/operating-model";
import { moduleForPath, firstEnabledHome, type ModuleKey } from "@/domain/modules";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { Topbar } from "@/components/nav/topbar";

/** Ob ein Pfad/Item mit dem Entitlement-Set des Tenants nutzbar ist (fail-closed). */
function moduleAllowed(path: string, enabled: readonly ModuleKey[]): boolean {
  const mod = moduleForPath(path);
  return mod === "core" || (mod !== null && enabled.includes(mod));
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  // Modul-Route-Guard (Entitlement-Achse, fail-closed): Deep-Links auf nicht
  // freigeschaltete Module landen auf dem Home des ersten erlaubten Moduls.
  // Der Pfad kommt als `x-pathname` aus der Middleware; fehlt der Header
  // (defensiv), greifen weiterhin Nav-Filter + Action-Gate.
  const requestPath = (await headers()).get("x-pathname");
  if (requestPath && !moduleAllowed(requestPath, principal.enabledModules)) {
    redirect(`/${locale}${firstEnabledHome(principal.enabledModules)}`);
  }

  // Tailor the navigation to the tenant's target operating model (which
  // practices/levels are in scope) and the principal's capabilities.
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = effectivePractices(await getActiveTargetModel(db, principal.tenantId));

  // Drei Achsen: practice/capability verstecken (wie bisher); das Modul-
  // Entitlement sperrt sichtbar — gesperrte Items wandern in `lockedHrefs`
  // und werden ausgegraut mit 🔒 gerendert (Upsell), nicht entfernt.
  const renderable = NAV_GROUPS.flatMap((group) => group.items).filter((item) => {
    if (item.practice && !practices[item.practice]) return false;
    if (
      item.capability &&
      !authorize(item.capability, { tenantId: principal.tenantId }, principal).allow
    )
      return false;
    return true;
  });
  const visibleHrefs: string[] = [];
  const lockedHrefs: string[] = [];
  for (const item of renderable) {
    (moduleAllowed(item.href, principal.enabledModules) ? visibleHrefs : lockedHrefs).push(
      item.href,
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* Top navigation bar (replaces the desktop sidebar; mobile uses the drawer) */}
      <Topbar
        userEmail={principal.email ?? ""}
        visibleHrefs={visibleHrefs}
        lockedHrefs={lockedHrefs}
      />
      <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
