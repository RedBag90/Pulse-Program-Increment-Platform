import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";
import { SprintRealtime } from "@/features/team/components/sprint-realtime";

interface Props {
  params: Promise<{ sprintId: string }>;
  searchParams: Promise<{ view?: string }>;
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

function formatShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function dateDiffDays(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function SprintBoardPage({ params, searchParams }: Props) {
  const { sprintId } = await params;
  const { view } = await searchParams;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const sprint = await db.sprint.findFirst({
    where: { id: sprintId, tenantId: principal.tenantId as TenantId },
    include: {
      team: { select: { id: true, name: true } },
      pi: { select: { id: true, name: true, art: { select: { id: true, name: true } } } },
      initiatives: {
        where: { level: InitiativeLevel.STORY, deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          storyPoints: true,
          updatedAt: true,
          parent: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sprint) notFound();

  const isBurndown = view === "burndown";

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: "ARTs", href: "/art" },
        { label: sprint.pi.art.name, href: `/art/${sprint.pi.art.id}` },
        { label: sprint.pi.name, href: `/pi/${sprint.pi.id}` },
        { label: `${sprint.team.name} — Sprint ${sprint.indexInPi}` },
      ]}
    />
  );

  const viewTabs = (
    <div className="border-b flex gap-0">
      <Link
        href={`/sprint/${sprintId}`}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          !isBurndown
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
        }`}
      >
        Board
      </Link>
      <Link
        href={`/sprint/${sprintId}?view=burndown`}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          isBurndown
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
        }`}
      >
        Burn-down
      </Link>
    </div>
  );

  // ---- Burn-down view ----
  if (isBurndown) {
    const totalPoints = sprint.initiatives.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const completedPoints = sprint.initiatives
      .filter((i) => i.status === "completed")
      .reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const remainingPoints = totalPoints - completedPoints;

    const sprintDays = dateDiffDays(sprint.startDate, sprint.endDate);
    const today = new Date();
    const daysPassed = Math.min(sprintDays, Math.max(0, dateDiffDays(sprint.startDate, today)));

    const days = Array.from({ length: sprintDays + 1 }, (_, i) => i);

    const burnActual = days.map((day) => {
      const dayDate = new Date(sprint.startDate);
      dayDate.setDate(dayDate.getDate() + day);
      const ptsDone = sprint.initiatives
        .filter((s) => s.status === "completed" && new Date(s.updatedAt) <= dayDate)
        .reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
      return totalPoints - ptsDone;
    });

    const burnIdeal = days.map((day) =>
      Math.round(totalPoints - (totalPoints * day) / Math.max(1, sprintDays)),
    );

    const W = 600;
    const H = 260;
    const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const xPos = (day: number) => PAD.left + (day / Math.max(1, sprintDays)) * chartW;
    const yPos = (pts: number) => PAD.top + chartH - (pts / Math.max(1, totalPoints)) * chartH;

    const idealPath = burnIdeal
      .map((pts, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(pts).toFixed(1)}`)
      .join(" ");

    const actualDays = burnActual.slice(0, daysPassed + 1);
    const actualPath = actualDays
      .map((pts, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(pts).toFixed(1)}`)
      .join(" ");

    return (
      <main className="p-8 max-w-4xl mx-auto space-y-6">
        <SprintRealtime sprintId={sprintId} />
        {breadcrumbs}
        {viewTabs}

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            Burn-down — {sprint.team.name}, Sprint {sprint.indexInPi}
          </h1>
          <p className="text-sm text-gray-500">
            {formatShort(sprint.startDate)} – {formatShort(sprint.endDate)} · {sprintDays} days
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 text-center space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-800">{totalPoints} pts</p>
          </div>
          <div className="rounded-lg border p-4 text-center space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-green-700">{completedPoints} pts</p>
          </div>
          <div className="rounded-lg border p-4 text-center space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
            <p className="text-2xl font-bold text-blue-700">{remainingPoints} pts</p>
          </div>
        </div>

        {totalPoints === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
            No story points assigned to this sprint yet.
          </div>
        ) : (
          <div className="rounded-lg border p-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full max-w-[600px] mx-auto"
              aria-label="Sprint burn-down chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const pts = Math.round(totalPoints * pct);
                const y = yPos(pts);
                return (
                  <g key={pct}>
                    <line
                      x1={PAD.left}
                      y1={y}
                      x2={W - PAD.right}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                    />
                    <text x={PAD.left - 6} y={y + 4} fontSize={10} textAnchor="end" fill="#9ca3af">
                      {pts}
                    </text>
                  </g>
                );
              })}

              {days
                .filter((d) => d % 2 === 0 || d === sprintDays)
                .map((day) => {
                  const d = new Date(sprint.startDate);
                  d.setDate(d.getDate() + day);
                  return (
                    <text
                      key={day}
                      x={xPos(day)}
                      y={H - PAD.bottom + 14}
                      fontSize={9}
                      textAnchor="middle"
                      fill="#9ca3af"
                    >
                      {formatShort(d)}
                    </text>
                  );
                })}

              {daysPassed > 0 && daysPassed < sprintDays && (
                <line
                  x1={xPos(daysPassed)}
                  y1={PAD.top}
                  x2={xPos(daysPassed)}
                  y2={H - PAD.bottom}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              )}

              <path
                d={idealPath}
                fill="none"
                stroke="#d1d5db"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />

              {actualPath && (
                <path
                  d={actualPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              <g transform={`translate(${PAD.left + 8}, ${PAD.top + 8})`}>
                <line
                  x1={0}
                  y1={6}
                  x2={18}
                  y2={6}
                  stroke="#d1d5db"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
                <text x={22} y={10} fontSize={10} fill="#6b7280">
                  Ideal
                </text>
                <line x1={60} y1={6} x2={78} y2={6} stroke="#3b82f6" strokeWidth={2.5} />
                <text x={82} y={10} fontSize={10} fill="#3b82f6">
                  Actual
                </text>
              </g>
            </svg>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Stories ({sprint.initiatives.length})</h2>
          {sprint.initiatives.length > 0 && (
            <div className="rounded-lg border divide-y text-sm">
              {sprint.initiatives.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-gray-800">{s.title}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                    {s.storyPoints !== null && <span>{s.storyPoints} pts</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 ${s.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  // ---- Board view ----
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
      {breadcrumbs}
      {viewTabs}

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
          <Link
            href={`/art/${sprint.pi.art.id}/features`}
            className="text-blue-600 hover:underline"
          >
            features page
          </Link>
          .
        </p>
      )}
    </main>
  );
}
