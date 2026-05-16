import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import { EditValueStreamDialog } from "@/features/portfolio/components/edit-value-stream-dialog";
import { DeleteValueStreamButton } from "@/features/portfolio/components/delete-value-stream-button";
import { redirect } from "next/navigation";

export default async function ValueStreamsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const streams = await listValueStreams(db, principal.tenantId);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Value Streams</h1>
        {canEdit && <CreateValueStreamDialog />}
      </div>

      {streams.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No value streams yet. Create one to start organizing your portfolio.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((vs) => (
            <div key={vs.id} className="border rounded-lg p-5 space-y-2 hover:shadow-sm">
              <h2 className="font-semibold">{vs.name}</h2>
              {vs.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{vs.description}</p>
              )}
              {vs.budgetAmount && (
                <p className="text-sm text-gray-500">
                  Budget: {vs.budgetAmount.toString()} {vs.budgetCurrency}
                </p>
              )}
              <p className="text-xs text-gray-400">
                {vs.arts.length} ART{vs.arts.length !== 1 ? "s" : ""}
              </p>
              {canEdit && (
                <div className="flex items-center gap-3 pt-1">
                  <EditValueStreamDialog
                    id={vs.id}
                    name={vs.name}
                    description={vs.description}
                    budgetAmount={vs.budgetAmount?.toString() ?? null}
                    budgetCurrency={vs.budgetCurrency}
                  />
                  <DeleteValueStreamButton id={vs.id} name={vs.name} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
