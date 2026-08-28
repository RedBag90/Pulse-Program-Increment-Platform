import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadDependenciesOverview } from "@/modules/drumbeat/server/views/dependencies-overview";
import { DependenciesOverviewShell } from "@/modules/drumbeat/features/dependencies/components/dependencies-overview-shell";
import { Page } from "@/components/layout";

/**
 * Cross-PI Abhängigkeits-Übersicht. Scope: alle Dependencies, deren
 * From- oder To-Endpunkt ein Feature in einem ART im Zugriff des Principals ist.
 * Das Daten-Laden lebt im Modul-Loader (`loadDependenciesOverview`, ADR-0013);
 * die Page komponiert nur Auth + Shell.
 */
export default async function DependenciesOverviewPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { artIds, model } = await loadDependenciesOverview(
    db,
    principal.tenantId,
    principal.scopes.artIds,
  );

  if (artIds.length === 0) {
    return (
      <Page>
        <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Keine ARTs im Zugriff. Bitte einen Admin um Scope-Zuweisung.
          </p>
        </div>
      </Page>
    );
  }

  const canBulk = hasCapability(principal, "dependency.unlink", {
    tenantId: principal.tenantId,
    artId: artIds[0]!,
  });

  return (
    <Suspense fallback={null}>
      <DependenciesOverviewShell model={model} canBulk={canBulk} />
    </Suspense>
  );
}
