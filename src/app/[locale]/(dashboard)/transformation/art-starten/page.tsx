import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantApprovers } from "@/modules/work/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listTimelines } from "@/server/services/timeline";
import { StartArtForm } from "@/features/transformation/components/start-art-form";
import { Page, PageHeader } from "@/components/layout";

/**
 * Guided "launch an ART" wizard — lowers the activation energy of standing up a
 * train: one form creates the ART, sets its cadence and RTE, and plans the first
 * PI. Gated by the `art.create` capability (tenant admin).
 */
export default async function StartArtPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("art.create", { tenantId: principal.tenantId }, principal).allow;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [valueStreams, approvers, userLabels, timelines] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    listTimelines(db, principal.tenantId),
  ]);

  const rteUsers = approvers
    .filter((a) => a.roles.includes("rte"))
    .map((a) => ({ id: a.userId, label: userLabels[a.userId] ?? a.userId }));

  return (
    <Page>
      <PageHeader
        title="ART starten"
        subtitle="Richte einen Agile Release Train in einem Schritt ein — Timeline-Anschluss, RTE und erstes PI inklusive."
      />

      <StartArtForm
        canManage={canManage}
        valueStreams={valueStreams.map((v) => ({ id: v.id, label: v.name }))}
        rteUsers={rteUsers}
        timelines={timelines.map((t) => ({
          id: t.id,
          name: t.name,
        }))}
      />
    </Page>
  );
}
