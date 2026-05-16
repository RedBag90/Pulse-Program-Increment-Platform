import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listPis } from "@/server/services/pi";
import { CreatePiDialog } from "@/features/pi/components/create-pi-dialog";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PiListPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [art, pis] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listPis(db, principal.tenantId, artId as ArtId),
  ]);

  if (!art) notFound();

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        {" / "}
        <span className="text-gray-800 font-medium">{art.name}</span>
        {" / Program Increments"}
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{art.name} — Program Increments</h1>
          {art.piCadenceWeeks && (
            <p className="text-sm text-gray-500 mt-1">PI cadence: {art.piCadenceWeeks} weeks</p>
          )}
        </div>
        {canEdit && <CreatePiDialog artId={artId} />}
      </div>

      {pis.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No PIs yet. Create one to start planning iterations.
        </p>
      ) : (
        <div className="space-y-3">
          {pis.map((pi) => {
            const badge = STATUS_BADGE[pi.status] ?? "bg-gray-100 text-gray-700";
            return (
              <Link
                key={pi.id}
                href={`/art/${artId}/pi/${pi.id}`}
                className="block border rounded-lg p-5 hover:shadow-sm hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold">{pi.name}</h2>
                    <p className="text-sm text-gray-500">
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    <span>
                      {pi._count.sprints} sprint{pi._count.sprints !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {pi._count.initiatives} feature{pi._count.initiatives !== 1 ? "s" : ""}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${badge}`}
                    >
                      {pi.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
