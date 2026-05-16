import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";
import { SprintRealtime } from "@/features/team/components/sprint-realtime";

interface Props {
  params: Promise<{ artId: string; piId: string; sprintId: string }>;
}

const STATUS_COLUMNS = [
  { key: "draft", label: "To Do", color: "bg-gray-50 border-gray-200" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-50 border-blue-200" },
  { key: "blocked", label: "Blocked", color: "bg-red-50 border-red-200" },
  { key: "completed", label: "Done", color: "bg-green-50 border-green-200" },
] as const;

type StatusKey = (typeof STATUS_COLUMNS)[number]["key"];

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SprintBoardPage({ params }: Props) {
  const { artId, piId, sprintId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const sprint = await db.sprint.findFirst({
    where: { id: sprintId, tenantId: principal.tenantId as TenantId },
    include: {
      team: { select: { id: true, name: true } },
      pi: { select: { id: true, name: true, art: { select: { name: true } } } },
      initiatives: {
        where: { level: InitiativeLevel.STORY, deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          storyPoints: true,
          parent: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sprint) notFound();

  // Group stories by status
  const byStatus = new Map<StatusKey, typeof sprint.initiatives>(
    STATUS_COLUMNS.map((col) => [col.key, []]),
  );

  for (const story of sprint.initiatives) {
    const key = STATUS_COLUMNS.find((c) => c.key === story.status)?.key ?? ("draft" as StatusKey);
    byStatus.get(key)!.push(story);
  }

  const totalPoints = sprint.initiatives.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
  const donePoints = (byStatus.get("completed") ?? []).reduce(
    (sum, s) => sum + (s.storyPoints ?? 0),
    0,
  );

  return (
    <main className="p-6 max-w-full space-y-6">
      <SprintRealtime sprintId={sprintId} />
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi`} className="hover:underline">
          {sprint.pi.art.name}
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi/${piId}`} className="hover:underline">
          {sprint.pi.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">
          {sprint.team.name} — Sprint {sprint.indexInPi}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">
            {sprint.team.name} — Sprint {sprint.indexInPi}
          </h1>
          <p className="text-sm text-gray-500">
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </p>
        </div>
        <Link
          href={`/art/${artId}/pi/${piId}/sprint/${sprintId}/burndown`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Burn-down →
        </Link>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">
            {donePoints}/{totalPoints}
          </p>
          <p className="text-xs text-gray-400">story points done</p>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const cards = byStatus.get(col.key) ?? [];
          return (
            <div key={col.key} className={`rounded-lg border ${col.color} p-3 space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">{col.label}</h2>
                <span className="text-xs text-gray-400">{cards.length}</span>
              </div>

              <div className="space-y-2 min-h-[120px]">
                {cards.map((story) => (
                  <div
                    key={story.id}
                    className="rounded-md bg-white border shadow-sm p-3 space-y-1"
                  >
                    <p className="text-sm font-medium text-gray-800 leading-snug">{story.title}</p>
                    {story.parent && (
                      <p className="text-[10px] text-gray-400 truncate">{story.parent.title}</p>
                    )}
                    {story.storyPoints !== null && (
                      <span className="inline-block text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {story.storyPoints} pts
                      </span>
                    )}
                  </div>
                ))}

                {cards.length === 0 && (
                  <p className="text-[11px] text-gray-300 text-center pt-4">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sprint.initiatives.length === 0 && (
        <p className="text-center text-sm text-gray-400">
          No stories assigned to this sprint yet. Assign stories from the{" "}
          <Link href={`/art/${artId}/features`} className="text-blue-600 hover:underline">
            features page
          </Link>
          .
        </p>
      )}
    </main>
  );
}
