import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/epic";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateEpicDialog } from "@/features/portfolio/components/create-epic-dialog";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";

const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Funnel",
  L1: "L1 Reviewing",
  L2: "L2 Analyzing",
  L3: "L3 Portfolio Backlog",
  L4: "L4 Implementing",
  L5: "L5 Done",
};

export default async function EpicsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [epics, valueStreams] = await Promise.all([
    listEpics(db, principal.tenantId),
    listValueStreams(db, principal.tenantId),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("epic_owner") ||
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
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Title</th>
              <th className="pb-2 pr-4">Value Stream</th>
              <th className="pb-2 pr-4">Stage Gate</th>
              <th className="pb-2">Status</th>
              {canEdit && <th className="pb-2"></th>}
            </tr>
          </thead>
          <tbody>
            {epics.map((epic) => (
              <tr key={epic.id} className="border-b hover:bg-muted/50">
                <td className="py-2 pr-4">
                  <Link
                    href={`/portfolio/epics/${epic.id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {epic.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">{epic.valueStream?.name ?? "—"}</td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground">{epic.status}</td>
                {canEdit && (
                  <td className="py-2 pl-2">
                    <DeleteEpicButton id={epic.id} title={epic.title} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
