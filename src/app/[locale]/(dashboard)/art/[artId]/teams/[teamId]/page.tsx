import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { BacklogStoryRow } from "@/features/team/components/backlog-story-row";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string; teamId: string }>;
  searchParams: Promise<{ piId?: string; featureId?: string }>;
}

export default async function TeamBacklogPage({ params, searchParams }: Props) {
  const { artId, teamId } = await params;
  const { piId: filterPiId, featureId: filterFeatureId } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [team, art, unassignedStories, sprints, pis] = await Promise.all([
    db.team.findFirst({ where: { id: teamId, tenantId: principal.tenantId as TenantId } }),
    db.art.findFirst({ where: { id: artId, tenantId: principal.tenantId as TenantId } }),
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId as TenantId,
        level: InitiativeLevel.STORY,
        deletedAt: null,
        sprintId: null,
        ...(filterPiId ? { piId: filterPiId } : {}),
        ...(filterFeatureId ? { parentId: filterFeatureId } : {}),
      },
      include: {
        parent: { select: { id: true, title: true, artId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.sprint.findMany({
      where: { teamId, tenantId: principal.tenantId as TenantId },
      include: { pi: { select: { id: true, name: true } } },
      orderBy: [{ piId: "asc" }, { indexInPi: "asc" }],
    }),
    db.programIncrement.findMany({
      where: { artId, tenantId: principal.tenantId as TenantId },
      orderBy: { startDate: "desc" },
    }),
  ]);

  if (!team || !art) notFound();

  const sprintOptions = sprints.map((s) => ({
    id: s.id,
    indexInPi: s.indexInPi,
    piName: s.pi.name,
  }));

  const storyRows = unassignedStories.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    storyPoints: s.storyPoints,
    parentTitle: s.parent?.title ?? null,
  }));

  const totalPoints = unassignedStories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/art/${artId}/teams`} className="text-sm text-gray-400 hover:underline">
              Teams
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold">{team.name} — Backlog</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {unassignedStories.length} unassigned stor{unassignedStories.length !== 1 ? "ies" : "y"}{" "}
            · {totalPoints} pts
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3 flex-wrap">
        <select
          name="piId"
          defaultValue={filterPiId ?? ""}
          onChange={(e) => {
            const url = new URL(window.location.href);
            if (e.target.value) url.searchParams.set("piId", e.target.value);
            else url.searchParams.delete("piId");
            window.location.href = url.toString();
          }}
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All PIs</option>
          {pis.map((pi) => (
            <option key={pi.id} value={pi.id}>
              {pi.name}
            </option>
          ))}
        </select>

        {filterPiId && (
          <Link
            href={`/art/${artId}/teams/${teamId}`}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            Clear filters
          </Link>
        )}
      </form>

      {unassignedStories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No unassigned stories
          {filterPiId ? " for this PI" : ""}. All stories are in a sprint.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Story</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-16">Pts</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-28">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-52">
                  Assign Sprint
                </th>
              </tr>
            </thead>
            <tbody>
              {storyRows.map((story) => (
                <BacklogStoryRow
                  key={story.id}
                  story={story}
                  sprints={sprintOptions}
                  artId={artId}
                  teamId={teamId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
