import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getFeature } from "@/server/services/feature";
import { listStories } from "@/server/services/story";
import { CreateStoryDialog } from "@/features/story/components/create-story-dialog";
import { DeleteFeatureButton } from "@/features/art/components/delete-feature-button";
import { DeleteStoryButton } from "@/features/story/components/delete-story-button";
import { LinkDependencyDialog } from "@/features/dependencies/components/link-dependency-dialog";
import { UnlinkDependencyButton } from "@/features/dependencies/components/unlink-dependency-button";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { FeatureId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ featureId: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500 line-through",
};

export default async function FeatureDetailPage({ params }: Props) {
  const { featureId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const feature = await getFeature(db, principal.tenantId, featureId as FeatureId);
  if (!feature) notFound();

  const artId = feature.art?.id ?? "";

  const [{ items: stories }, availableSprints] = await Promise.all([
    listStories(db, principal.tenantId as TenantId, featureId as FeatureId),
    feature.piId
      ? db.sprint.findMany({
          where: { piId: feature.piId, tenantId: principal.tenantId as TenantId },
          include: { team: { select: { name: true } } },
          orderBy: [{ teamId: "asc" }, { indexInPi: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("art_full_editor") ||
    principal.roles.includes("feature_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const wsjfComputed = feature.wsjfComputed !== null ? Number(feature.wsjfComputed) : null;
  const costOfDelay =
    (feature.wsjfBusinessValue ?? 0) +
    (feature.wsjfTimeCriticality ?? 0) +
    (feature.wsjfRiskReduction ?? 0);

  const dependencies = await db.dependency.findMany({
    where: {
      tenantId: principal.tenantId,
      OR: [{ fromId: featureId }, { toId: featureId }],
    },
    include: {
      from: { select: { id: true, title: true, level: true } },
      to: { select: { id: true, title: true, level: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const statusCls = STATUS_COLORS[feature.status] ?? "bg-gray-100 text-gray-700";

  // Other features in the same ART — candidates to depend on.
  const dependencyCandidates = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      artId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      id: { not: featureId },
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: feature.art?.name ?? "ART", href: `/art/${artId}/features` },
          { label: feature.title },
        ]}
      />

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <h1 className="text-2xl font-semibold flex-1">{feature.title}</h1>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium shrink-0 ${statusCls}`}
          >
            {feature.status}
          </span>
          {canEdit && <DeleteFeatureButton id={featureId} artId={artId} title={feature.title} />}
        </div>
        {feature.parent && (
          <p className="text-sm text-gray-500">
            Parent Epic:{" "}
            <Link
              href={`/portfolio/epics/${feature.parent.id}`}
              className="text-blue-700 hover:underline"
            >
              {feature.parent.title}
            </Link>
          </p>
        )}
        {feature.pi && (
          <p className="text-sm text-gray-500">
            Program Increment: <span className="font-medium text-gray-700">{feature.pi.name}</span>
          </p>
        )}
        {!feature.pi && (
          <p className="text-sm text-amber-600">Not yet assigned to a PI (Backlog)</p>
        )}
      </div>

      {/* Description */}
      {feature.description && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{feature.description}</p>
        </section>
      )}

      {/* WSJF Score */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">WSJF Score</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              ["Business Value", feature.wsjfBusinessValue],
              ["Time Criticality", feature.wsjfTimeCriticality],
              ["Risk Reduction / OE", feature.wsjfRiskReduction],
              ["Job Size", feature.wsjfJobSize],
            ] as [string, number | null][]
          ).map(([label, value]) => (
            <div key={label} className="border rounded-lg p-3 text-center space-y-1">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-800">{value ?? "—"}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div>
            <p className="text-xs text-gray-500">Cost of Delay</p>
            <p className="text-xl font-semibold text-gray-800">{costOfDelay}</p>
          </div>
          <div className="text-gray-400 text-xl">÷</div>
          <div>
            <p className="text-xs text-gray-500">Job Size</p>
            <p className="text-xl font-semibold text-gray-800">{feature.wsjfJobSize ?? "—"}</p>
          </div>
          <div className="text-gray-400 text-xl">=</div>
          <div>
            <p className="text-xs text-gray-500">WSJF Score</p>
            <p className="text-3xl font-bold text-blue-800">
              {wsjfComputed !== null ? wsjfComputed.toFixed(2) : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Acceptance Criteria */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Acceptance Criteria</h2>
        {feature.acceptanceCriteria.length === 0 ? (
          <p className="text-sm text-gray-400">No acceptance criteria defined yet.</p>
        ) : (
          <ul className="space-y-2">
            {feature.acceptanceCriteria.map((criterion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Stories ({stories.length})</h2>
          <CreateStoryDialog
            featureId={featureId}
            artId={artId}
            sprints={availableSprints.map((s) => ({
              id: s.id,
              indexInPi: s.indexInPi,
              team: { name: s.team.name },
            }))}
          />
        </div>
        {stories.length === 0 ? (
          <p className="text-sm text-gray-400">No stories yet. Break this feature into stories.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {stories.map((story) => (
              <div key={story.id} className="px-4 py-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">{story.title}</span>
                  {story.sprint && (
                    <p className="text-xs text-gray-400">
                      {story.sprint.team.name} — Sprint {story.sprint.indexInPi}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {story.storyPoints !== null && (
                    <span className="font-medium">{story.storyPoints} pts</span>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 ${STATUS_COLORS[story.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {story.status}
                  </span>
                  {canEdit && <DeleteStoryButton id={story.id} artId={artId} title={story.title} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dependencies */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Dependencies</h2>
          {canEdit && (
            <LinkDependencyDialog
              fromId={featureId}
              artId={artId}
              candidates={dependencyCandidates}
            />
          )}
        </div>
        {dependencies.length === 0 ? (
          <p className="text-sm text-gray-400">No dependencies linked.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {dependencies.map((dep) => {
              const isOutgoing = dep.fromId === featureId;
              const other = isOutgoing ? dep.to : dep.from;
              const label = isOutgoing
                ? dep.type === "blocks"
                  ? "blocks"
                  : dep.type === "depends_on"
                    ? "depends on"
                    : "relates to"
                : dep.type === "blocks"
                  ? "blocked by"
                  : dep.type === "depends_on"
                    ? "required by"
                    : "relates to";

              return (
                <div key={dep.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      label === "blocks" || label === "blocked by"
                        ? "bg-red-100 text-red-700"
                        : label === "relates to"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {label}
                  </span>
                  <span>{other.title}</span>
                  {canEdit && (
                    <span className="ml-auto">
                      <UnlinkDependencyButton
                        fromId={dep.fromId}
                        toId={dep.toId}
                        type={dep.type as "blocks" | "depends_on" | "relates_to"}
                        artId={artId}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
