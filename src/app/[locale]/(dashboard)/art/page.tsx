import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export default async function ArtPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [arts, valueStreams] = await Promise.all([
    listArts(db, principal.tenantId),
    listValueStreams(db, principal.tenantId),
  ]);

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  const vsOptions = valueStreams.map((vs) => ({ id: vs.id, name: vs.name }));

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agile Release Trains</h1>
        {canEdit && <CreateArtDialog valueStreams={vsOptions} />}
      </div>

      {arts.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No ARTs yet. Create one to start planning Program Increments.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arts.map((art) => (
            <Link
              key={art.id}
              href={`/art/${art.id}/features`}
              className="block border rounded-lg p-5 space-y-2 hover:shadow-sm hover:border-blue-300 transition-colors"
            >
              <h2 className="font-semibold">{art.name}</h2>
              <p className="text-sm text-gray-500">Value Stream: {art.valueStream.name}</p>
              {art.piCadenceWeeks && (
                <p className="text-sm text-gray-500">PI Cadence: {art.piCadenceWeeks} weeks</p>
              )}
              <p className="text-xs text-gray-400">
                {art._count.pis} PI{art._count.pis !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
