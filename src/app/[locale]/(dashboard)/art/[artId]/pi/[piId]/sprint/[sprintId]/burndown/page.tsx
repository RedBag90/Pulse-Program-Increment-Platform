import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string; piId: string; sprintId: string }>;
}

function dateDiffDays(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default async function BurndownPage({ params }: Props) {
  const { artId, piId, sprintId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const sprint = await db.sprint.findFirst({
    where: { id: sprintId, tenantId: principal.tenantId as TenantId },
    include: {
      team: { select: { name: true } },
      pi: { select: { name: true, art: { select: { name: true } } } },
      initiatives: {
        where: { level: InitiativeLevel.STORY, deletedAt: null },
        select: { id: true, title: true, status: true, storyPoints: true, updatedAt: true },
      },
    },
  });

  if (!sprint) notFound();

  const totalPoints = sprint.initiatives.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const completedPoints = sprint.initiatives
    .filter((i) => i.status === "completed")
    .reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const remainingPoints = totalPoints - completedPoints;

  const sprintDays = dateDiffDays(sprint.startDate, sprint.endDate);
  const today = new Date();
  const daysPassed = Math.min(sprintDays, Math.max(0, dateDiffDays(sprint.startDate, today)));

  // Build day-by-day burn (using story updatedAt as proxy for when completed)
  // Build array of day indices 0..sprintDays
  const days = Array.from({ length: sprintDays + 1 }, (_, i) => i);

  // For each day, calculate remaining = total - pts completed on or before that day
  const burnActual = days.map((day) => {
    const dayDate = new Date(sprint.startDate);
    dayDate.setDate(dayDate.getDate() + day);
    const ptsDone = sprint.initiatives
      .filter((s) => s.status === "completed" && new Date(s.updatedAt) <= dayDate)
      .reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
    return totalPoints - ptsDone;
  });

  // Ideal burn: linear from totalPoints on day 0 to 0 on last day
  const burnIdeal = days.map((day) =>
    Math.round(totalPoints - (totalPoints * day) / Math.max(1, sprintDays)),
  );

  // Chart dimensions
  const W = 600;
  const H = 260;
  const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  function xPos(day: number) {
    return PAD.left + (day / Math.max(1, sprintDays)) * chartW;
  }
  function yPos(pts: number) {
    return PAD.top + chartH - (pts / Math.max(1, totalPoints)) * chartH;
  }

  const idealPath = burnIdeal
    .map((pts, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(pts).toFixed(1)}`)
    .join(" ");

  const actualDays = burnActual.slice(0, daysPassed + 1);
  const actualPath = actualDays
    .map((pts, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(pts).toFixed(1)}`)
    .join(" ");

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
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
        <Link href={`/art/${artId}/pi/${piId}/sprint/${sprintId}`} className="hover:underline">
          {sprint.team.name} — Sprint {sprint.indexInPi}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Burn-down</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          Burn-down — {sprint.team.name}, Sprint {sprint.indexInPi}
        </h1>
        <p className="text-sm text-gray-500">
          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)} · {sprintDays} days
        </p>
      </div>

      {/* Stats */}
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
            {/* Y-axis gridlines and labels */}
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

            {/* X-axis labels (every 2 days) */}
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
                    {formatDate(d)}
                  </text>
                );
              })}

            {/* Today line */}
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

            {/* Ideal line */}
            <path
              d={idealPath}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />

            {/* Actual line */}
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

            {/* Legend */}
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

      {/* Story list */}
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
