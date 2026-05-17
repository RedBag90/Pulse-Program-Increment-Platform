import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * Capacity Planning landing — the home for defining the portfolio structure.
 * Lists Value Streams; each drills down into its ARTs and Teams.
 */
export default async function CapacityPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const streams = await listValueStreams(db, principal.tenantId);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Capacity Planning</h1>
          {canEdit && <CreateValueStreamDialog />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Wertströme, ihre ARTs und Teams definieren.
        </p>
      </div>

      {streams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Value Streams. Lege einen an, um die Struktur aufzubauen.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((vs) => (
            <Link
              key={vs.id}
              href={`/capacity/value-streams/${vs.id}`}
              className="block space-y-2 rounded-lg border p-5 transition-colors hover:bg-muted/50"
            >
              <h2 className="font-semibold">{vs.name}</h2>
              {vs.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{vs.description}</p>
              )}
              <p className="text-xs text-muted-foreground/60">
                {vs.arts.length} ART{vs.arts.length !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
