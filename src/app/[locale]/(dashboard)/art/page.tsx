import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { DeleteArtButton } from "@/features/art/components/delete-art-button";
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
            <div
              key={art.id}
              className="border rounded-lg p-5 space-y-3 hover:shadow-sm transition-shadow"
            >
              <div className="space-y-1">
                <h2 className="font-semibold">{art.name}</h2>
                <p className="text-sm text-gray-500">Value Stream: {art.valueStream.name}</p>
                {art.piCadenceWeeks && (
                  <p className="text-sm text-gray-500">PI Cadence: {art.piCadenceWeeks} weeks</p>
                )}
                <p className="text-xs text-gray-400">
                  {art._count.pis} PI{art._count.pis !== 1 ? "s" : ""}
                </p>
              </div>
              {canEdit && (
                <div className="pt-1">
                  <DeleteArtButton id={art.id} name={art.name} />
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t">
                <Link
                  href={`/art/${art.id}/features`}
                  className="flex-1 text-center rounded-md bg-gray-50 hover:bg-blue-50 hover:text-blue-700 px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  Features
                </Link>
                <Link
                  href={`/art/${art.id}/pi`}
                  className="flex-1 text-center rounded-md bg-gray-50 hover:bg-blue-50 hover:text-blue-700 px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  PI Planning
                </Link>
                <Link
                  href={`/art/${art.id}/teams`}
                  className="flex-1 text-center rounded-md bg-gray-50 hover:bg-blue-50 hover:text-blue-700 px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  Teams
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
