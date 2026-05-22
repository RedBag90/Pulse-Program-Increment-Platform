import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getFeature } from "@/server/services/feature";
import { listStories } from "@/server/services/story";
import { listInitiativeHistory } from "@/server/services/initiative";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { InitiativeActivitySidebar } from "@/components/detail/initiative-activity-sidebar";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { FeatureOverviewTab } from "@/features/art/components/feature-overview-tab";
import { CreateStoryDialog } from "@/features/story/components/create-story-dialog";
import { DeleteFeatureButton } from "@/features/art/components/delete-feature-button";
import { DeleteStoryButton } from "@/features/story/components/delete-story-button";
import { LinkDependencyDialog } from "@/features/dependencies/components/link-dependency-dialog";
import { UnlinkDependencyButton } from "@/features/dependencies/components/unlink-dependency-button";
import { PermissionGate } from "@/components/auth/permission-gate";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { FeatureId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ featureId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const FEATURE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "stories", label: "Stories" },
  { key: "dependencies", label: "Dependencies" },
  { key: "history", label: "History" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-foreground/80",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-primary/80",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default async function FeatureDetailPage({ params, searchParams }: Props) {
  const { featureId } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(FEATURE_TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const feature = await getFeature(db, principal.tenantId, featureId as FeatureId);
  if (!feature) notFound();

  const artId = feature.art?.id ?? "";

  const [{ items: stories }, availableSprints, historyEvents] = await Promise.all([
    listStories(db, principal.tenantId as TenantId, featureId as FeatureId),
    feature.piId
      ? db.sprint.findMany({
          where: { piId: feature.piId, tenantId: principal.tenantId as TenantId },
          include: { team: { select: { name: true } } },
          orderBy: [{ teamId: "asc" }, { indexInPi: "asc" }],
        })
      : Promise.resolve([]),
    listInitiativeHistory(db, principal.tenantId, featureId),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("rte") ||
    principal.roles.includes("feature_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

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

  const activityEvents = historyEvents.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  const completedStories = stories.filter((s) => s.status === "completed").length;

  return (
    <EntityDetailShell
      backHref={`/art/${artId}/features`}
      backLabel={`Zurück zu ${feature.art?.name ?? "ART"}`}
      title={feature.title}
      badge={STATUS_LABELS[feature.status] ?? feature.status}
      tabs={FEATURE_TABS}
      activeTab={activeTab}
      basePath={`/feature/${featureId}`}
      headerActions={
        canEdit ? (
          <DeleteFeatureButton id={featureId} artId={artId} title={feature.title} />
        ) : undefined
      }
      aside={<InitiativeActivitySidebar events={activityEvents} />}
    >
      {activeTab === "overview" && (
        <FeatureOverviewTab
          feature={{
            id: feature.id,
            title: feature.title,
            description: feature.description,
            stageGate: feature.stageGate,
            status: feature.status,
            ownerId: feature.ownerId,
            updatedAt: feature.updatedAt,
            artId,
            artName: feature.art?.name ?? "—",
            parentEpic: feature.parent
              ? { id: feature.parent.id, title: feature.parent.title }
              : null,
            pi: feature.pi
              ? {
                  name: feature.pi.name,
                  startDate: feature.pi.startDate,
                  endDate: feature.pi.endDate,
                }
              : null,
            acceptanceCriteria: feature.acceptanceCriteria,
            wsjf: {
              bv: feature.wsjfBusinessValue,
              tc: feature.wsjfTimeCriticality,
              rr: feature.wsjfRiskReduction,
              js: feature.wsjfJobSize,
              computed: feature.wsjfComputed !== null ? Number(feature.wsjfComputed) : null,
            },
          }}
          childCount={stories.length}
          completedChildCount={completedStories}
          canEdit={canEdit}
        />
      )}

      {activeTab === "stories" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Stories ({stories.length})</h2>
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
            <p className="text-sm text-muted-foreground/60">
              No stories yet. Break this feature into stories.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {stories.map((story) => (
                <div key={story.id} className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">{story.title}</span>
                    {story.sprint && (
                      <p className="text-xs text-muted-foreground/60">
                        {story.sprint.team.name} — Sprint {story.sprint.indexInPi}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {story.storyPoints !== null && (
                      <span className="font-medium">{story.storyPoints} pts</span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 ${STATUS_COLORS[story.status] ?? "bg-muted text-foreground/80"}`}
                    >
                      {story.status}
                    </span>
                    {canEdit && (
                      <DeleteStoryButton id={story.id} artId={artId} title={story.title} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "dependencies" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Dependencies</h2>
            <PermissionGate action="dependency.link" resource={{ artId }}>
              <LinkDependencyDialog
                fromId={featureId}
                artId={artId}
                candidates={dependencyCandidates}
              />
            </PermissionGate>
          </div>
          {dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">No dependencies linked.</p>
          ) : (
            <div className="divide-y rounded-lg border">
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
                  <div key={dep.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        label === "blocks" || label === "blocked by"
                          ? "bg-red-100 text-red-700"
                          : label === "relates to"
                            ? "bg-muted text-muted-foreground"
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
      )}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">History</h2>
          {activityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Historie.</p>
          ) : (
            <ul className="divide-y rounded border">
              {activityEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{e.action}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleString("de-DE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </EntityDetailShell>
  );
}
