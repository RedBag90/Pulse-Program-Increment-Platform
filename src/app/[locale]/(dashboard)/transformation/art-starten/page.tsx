import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/server/services/value-stream";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { StartArtForm } from "@/features/transformation/components/start-art-form";

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

  const [valueStreams, approvers, userLabels] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const rteUsers = approvers
    .filter((a) => a.roles.includes("rte"))
    .map((a) => ({ id: a.userId, label: userLabels[a.userId] ?? a.userId }));

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">ART starten</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Richte einen Agile Release Train in einem Schritt ein — Kadenz, RTE und erstes PI
          inklusive.
        </p>
      </header>

      <StartArtForm
        canManage={canManage}
        valueStreams={valueStreams.map((v) => ({ id: v.id, label: v.name }))}
        rteUsers={rteUsers}
      />
    </div>
  );
}
