import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/domain/operating-model";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { Topbar } from "@/components/nav/topbar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  // Tailor the navigation to the tenant's target operating model (which
  // practices/levels are in scope) and the principal's capabilities.
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = effectivePractices(await getActiveTargetModel(db, principal.tenantId));

  const visibleHrefs = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => {
      if (item.practice && !practices[item.practice]) return false;
      if (
        item.capability &&
        !authorize(item.capability, { tenantId: principal.tenantId }, principal).allow
      )
        return false;
      return true;
    })
    .map((item) => item.href);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top navigation bar (replaces the desktop sidebar; mobile uses the drawer) */}
      <Topbar userEmail={principal.email ?? ""} visibleHrefs={visibleHrefs} />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
