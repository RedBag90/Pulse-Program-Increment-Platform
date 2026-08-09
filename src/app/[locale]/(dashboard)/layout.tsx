import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getActiveTargetModel } from "@/server/services/target-model";
import { listUserTenants } from "@/server/services/tenant";
import { effectivePractices } from "@/modules/core/kernel/domain/operating-model";
import {
  moduleForPath,
  firstEnabledHome,
  type ModuleKey,
} from "@/modules/core/kernel/domain/modules";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { Topbar } from "@/components/nav/topbar";
import { CreateMenu } from "@/app/[locale]/(dashboard)/_components/create-menu";

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

  // Ist der aktive Tenant gesperrt/archiviert, ist keine Arbeit darin möglich —
  // raus auf die Sperr-Seite (außerhalb dieses Layouts, kein Redirect-Loop).
  if (principal.tenantStatus !== "active") redirect(`/${locale}/suspended`);

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
  const [targetModel, tenants] = await Promise.all([
    getActiveTargetModel(db, principal.tenantId),
    listUserTenants(db, principal.id),
  ]);
  const practices = effectivePractices(targetModel);

  // Drei Achsen (alle blenden aus): practice/capability wie bisher; das Modul-
  // Entitlement blendet nicht freigeschaltete Module komplett aus — kein
  // Upsell-Schloss mehr, gesperrte Module tauchen gar nicht in der Nav auf.
  const isPersonal = principal.tenantKind === "personal";
  const visibleHrefs = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => {
      if (item.practice && !practices[item.practice]) return false;
      if (
        item.capability &&
        !authorize(item.capability, { tenantId: principal.tenantId }, principal).allow
      )
        return false;
      // Privater Free-Bereich: Core-Inboxen (My Tasks / My Approvals) ausblenden
      // — im Solo-/nur-Ziele-Tenant nutzlos. Der Route-Guard (moduleAllowed)
      // bleibt separat, /start-Bootstrap + Deep-Links funktionieren weiter.
      if (isPersonal && moduleForPath(item.href) === "core") return false;
      return moduleAllowed(item.href, principal.enabledModules);
    })
    .map((item) => item.href);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* Top navigation bar (replaces the desktop sidebar; mobile uses the drawer) */}
      <Topbar
        userEmail={principal.email ?? ""}
        visibleHrefs={visibleHrefs}
        tenants={tenants}
        activeTenantId={principal.tenantId}
        isPlatformAdmin={principal.isPlatformAdmin}
        createSlot={<CreateMenu />}
      />
      <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
