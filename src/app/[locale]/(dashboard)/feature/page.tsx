import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500 line-through",
};

export default async function FeaturesIndexPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const features = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    include: {
      art: { select: { id: true, name: true } },
      pi: { select: { id: true, name: true } },
    },
    orderBy: [{ wsjfComputed: { sort: "desc", nulls: "last" } }],
  });

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Features</h1>
        <p className="text-sm text-gray-500 mt-1">
          {features.length} feature{features.length !== 1 ? "s" : ""} across all ARTs · sorted by
          WSJF score
        </p>
      </div>

      {features.length === 0 ? (
        <p className="text-gray-500 text-sm">No features yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">ART</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">WSJF</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">PI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {features.map((feature) => (
                <tr key={feature.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/feature/${feature.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {feature.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{feature.art?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-center font-semibold text-blue-800">
                    {feature.wsjfComputed !== null ? Number(feature.wsjfComputed).toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        STATUS_COLORS[feature.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {feature.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {feature.pi?.name ?? "Backlog"}
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
