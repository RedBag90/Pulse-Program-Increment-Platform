import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/domain/operating-model";
import { Sidebar } from "@/components/nav/sidebar";
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — fixed width on desktop */}
      <div className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <Sidebar userEmail={principal.email ?? ""} visibleHrefs={visibleHrefs} />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
