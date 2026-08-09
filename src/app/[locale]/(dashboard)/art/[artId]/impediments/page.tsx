import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listImpediments } from "@/server/services/impediment";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildImpedimentsListModel } from "@/server/views/impediments-list";
import { ArtSubNav } from "@/modules/core/org/features/art/components/art-sub-nav";
import { Page } from "@/components/layout";
import { ImpedimentsListShell } from "@/features/impediment/components/impediments-list-shell";
import type { TenantId, ArtId } from "@/modules/core/kernel/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

/**
 * Impediment list — rich filterable list with a status funnel header,
 * severity / PI / owner facets, and bulk resolve / escalate actions.
 * Replaces the old section-by-status layout.
 */
export default async function ImpedimentsPage({ params }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [art, { items: impediments }, pis, userLabels] = await Promise.all([
    db.art.findFirst({
      where: { id: artId, tenantId: principal.tenantId },
      select: { id: true, name: true },
    }),
    listImpediments(db, principal.tenantId as TenantId, artId as ArtId, {}),
    db.programIncrement.findMany({
      where: { tenantId: principal.tenantId, artId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  if (!art) redirect("/structure?tab=arts");

  const canCreate = hasCapability(principal, "impediment.create", {
    tenantId: principal.tenantId,
    artId,
  });
  const canEscalate = hasCapability(principal, "impediment.escalate", {
    tenantId: principal.tenantId,
    artId,
  });
  const canResolve = hasCapability(principal, "impediment.resolve", {
    tenantId: principal.tenantId,
    artId,
  });

  const model = buildImpedimentsListModel({
    impediments: impediments.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      severity: i.severity,
      raisedBy: i.raisedBy,
      piId: i.piId,
      sprintId: null,
      createdAt: i.createdAt,
      resolution: i.resolution,
      resolvedAt: i.resolvedAt,
    })),
    pis,
    userLabels,
  });

  // ImpedimentsListShell owns its own funnel/filter padding, so the page
  // wrapper runs flush. The ArtSubNav above sits inside the flush container.
  return (
    <Page variant="flush">
      <ArtSubNav artId={artId} artName={art.name} />
      <Suspense fallback={null}>
        <ImpedimentsListShell
          model={model}
          artId={artId}
          canCreate={canCreate}
          canEscalate={canEscalate}
          canResolve={canResolve}
        />
      </Suspense>
    </Page>
  );
}
