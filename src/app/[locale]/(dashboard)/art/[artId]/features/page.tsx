import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listFeatures } from "@/server/services/feature";
import { listEpics } from "@/server/services/initiative";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { FeatureFilters } from "@/features/art/components/feature-filters";
import { WsjfScoreDialog } from "@/features/art/components/wsjf-score-dialog";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ status?: string; piId?: string }>;
}

export default async function FeaturesPage({ params, searchParams }: Props) {
  const { artId } = await params;
  const { status, piId } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [art, allFeatures, epics, pis] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listFeatures(db, principal.tenantId, artId as ArtId),
    listEpics(db, principal.tenantId),
    db.programIncrement.findMany({
      where: { tenantId: principal.tenantId, artId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!art) notFound();

  // Apply client-side filters (avoids extra DB queries for simple cases)
  const features = allFeatures.filter((f) => {
    if (status && f.status !== status) return false;
    if (piId === "backlog" && f.piId !== null) return false;
    if (piId && piId !== "backlog" && f.piId !== piId) return false;
    return true;
  });

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const epicOptions = epics.map((e) => ({ id: e.id, title: e.title }));

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Feature Backlog</h1>
          <p className="text-sm text-gray-500 mt-1">
            {features.length} feature{features.length !== 1 ? "s" : ""} · sorted by WSJF score
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FeatureFilters pis={pis} currentStatus={status ?? ""} currentPiId={piId ?? ""} />
          {canEdit && <CreateFeatureDialog artId={artId} epics={epicOptions} />}
        </div>
      </div>

      {features.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">
            {allFeatures.length > 0
              ? "No features match the current filters."
              : "No features yet. Create one to start prioritizing the backlog."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                <th
                  className="text-center px-3 py-3 font-medium text-gray-600 w-10"
                  title="Business Value"
                >
                  BV
                </th>
                <th
                  className="text-center px-3 py-3 font-medium text-gray-600 w-10"
                  title="Time Criticality"
                >
                  TC
                </th>
                <th
                  className="text-center px-3 py-3 font-medium text-gray-600 w-10"
                  title="Risk Reduction"
                >
                  RR
                </th>
                <th
                  className="text-center px-3 py-3 font-medium text-gray-600 w-10"
                  title="Job Size"
                >
                  JS
                </th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">WSJF</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">PI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {features.map((feature) => {
                const rank = allFeatures.findIndex((f) => f.id === feature.id) + 1;
                return (
                  <tr key={feature.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/art/${artId}/features/${feature.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {feature.title}
                      </Link>
                      {feature.parent && (
                        <p className="text-xs text-gray-400 mt-0.5">Epic: {feature.parent.title}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">
                      {feature.wsjfBusinessValue ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">
                      {feature.wsjfTimeCriticality ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">
                      {feature.wsjfRiskReduction ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">
                      {feature.wsjfJobSize ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {canEdit ? (
                        <WsjfScoreDialog
                          featureId={feature.id}
                          artId={artId}
                          current={{
                            bv: feature.wsjfBusinessValue,
                            tc: feature.wsjfTimeCriticality,
                            rr: feature.wsjfRiskReduction,
                            js: feature.wsjfJobSize,
                          }}
                        />
                      ) : (
                        <span className="font-semibold text-blue-800">
                          {feature.wsjfComputed !== null
                            ? Number(feature.wsjfComputed).toFixed(2)
                            : "—"}
                        </span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
