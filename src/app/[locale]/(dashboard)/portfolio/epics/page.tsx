import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/epic";
import { listValueStreams } from "@/server/services/value-stream";
import { getTenantPractices } from "@/server/services/target-model";
import { CreateEpicDialog } from "@/features/portfolio/components/create-epic-dialog";
import { EpicsStageGateTable } from "@/features/portfolio/components/epics-stage-gate-table";
import { redirect } from "next/navigation";

export default async function EpicsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [epics, valueStreams, practices] = await Promise.all([
    listEpics(db, principal.tenantId),
    listValueStreams(db, principal.tenantId),
    getTenantPractices(db, principal.tenantId),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("epic_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  // Advancing a stage gate mirrors the `epic.approve` policy (portfolio / VMO).
  const canAdvance =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("vmo") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Epics</h1>
        {canEdit && (
          <CreateEpicDialog
            valueStreams={valueStreams.map((vs) => ({ id: vs.id, name: vs.name }))}
          />
        )}
      </div>

      {epics.length === 0 ? (
        <p className="text-muted-foreground text-sm">No epics yet.</p>
      ) : (
        <EpicsStageGateTable
          epics={epics.map((e) => ({
            id: e.id,
            title: e.title,
            stageGate: e.stageGate,
            status: e.status,
            valueStream: e.valueStream,
          }))}
          canEdit={canEdit}
          canAdvance={canAdvance}
          stageGatesEnabled={practices.stageGates}
          tenantId={principal.tenantId}
        />
      )}
    </main>
  );
}
