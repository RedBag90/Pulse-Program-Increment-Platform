import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ProgramIncrementsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pis = await db.programIncrement.findMany({
    where: { tenantId: principal.tenantId as TenantId },
    include: {
      art: { select: { id: true, name: true } },
      _count: { select: { sprints: true, initiatives: true } },
    },
    orderBy: [{ startDate: "desc" }],
  });

  const byArt = new Map<string, { artName: string; pis: typeof pis }>();
  for (const pi of pis) {
    if (!byArt.has(pi.art.id)) byArt.set(pi.art.id, { artName: pi.art.name, pis: [] });
    byArt.get(pi.art.id)!.pis.push(pi);
  }

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Program Increments</h1>
        <p className="text-sm text-gray-500 mt-1">All PIs across your Agile Release Trains</p>
      </div>

      {pis.length === 0 ? (
        <p className="text-gray-500 text-sm">No Program Increments yet.</p>
      ) : (
        <div className="space-y-6">
          {[...byArt.entries()].map(([artId, { artName, pis: artPis }]) => (
            <section key={artId} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {artName}
              </h2>
              <div className="space-y-2">
                {artPis.map((pi) => (
                  <Link
                    key={pi.id}
                    href={`/pi/${pi.id}`}
                    className="block border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h3 className="font-semibold">{pi.name}</h3>
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
                          className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${
                            STATUS_BADGE[pi.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {pi.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
