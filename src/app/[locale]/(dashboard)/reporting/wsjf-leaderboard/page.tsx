import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

export default async function WsjfLeaderboardPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const features = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      wsjfComputed: true,
      art: { select: { name: true } },
      pi: { select: { name: true } },
    },
    orderBy: { wsjfComputed: { sort: "desc", nulls: "last" } },
  });

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">WSJF Leaderboard</h1>
        <p className="text-sm text-gray-500 mt-1">All features ranked by computed WSJF score</p>
      </div>

      {features.length === 0 ? (
        <p className="text-sm text-gray-400">No features yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">ART</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">PI</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">WSJF</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {features.map((f, i) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/feature/${f.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {f.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{f.art?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{f.pi?.name ?? "Backlog"}</td>
                  <td className="px-3 py-3 text-center font-semibold text-blue-800">
                    {f.wsjfComputed !== null ? Number(f.wsjfComputed).toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
