import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listFeatures } from "@/server/services/feature";
import { listEpics } from "@/server/services/initiative";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

export default async function FeaturesPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [art, features, epics] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listFeatures(db, principal.tenantId, artId as ArtId),
    listEpics(db, principal.tenantId),
  ]);

  if (!art) notFound();

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const epicOptions = epics.map((e) => ({ id: e.id, title: e.title }));

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Feature Backlog</h1>
          <p className="text-sm text-gray-500 mt-1">Sorted by WSJF score (highest first)</p>
        </div>
        {canEdit && <CreateFeatureDialog artId={artId} epics={epicOptions} />}
      </div>

      {features.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No features yet. Create one to start prioritizing the backlog.
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-8">BV</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-8">TC</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-8">RR</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-8">JS</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-16">WSJF</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">PI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {features.map((feature, i) => (
                <tr key={feature.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 text-xs mt-0.5 w-5 shrink-0">#{i + 1}</span>
                      <div>
                        <Link
                          href={`/art/${artId}/features/${feature.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {feature.title}
                        </Link>
                        {feature.parent && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Epic: {feature.parent.title}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {feature.wsjfBusinessValue ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {feature.wsjfTimeCriticality ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {feature.wsjfRiskReduction ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {feature.wsjfJobSize ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-semibold text-blue-800">
                      {feature.wsjfComputed !== null
                        ? Number(feature.wsjfComputed).toFixed(2)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700">
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
