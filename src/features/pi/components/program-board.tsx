"use client";

import { useState, useRef, useTransition } from "react";
import { Link } from "@/i18n/navigation";

interface Story {
  id: string;
  title: string;
  status: string;
  storyPoints: number | null;
}

interface Sprint {
  id: string;
  indexInPi: number;
  startDate: Date;
  endDate: Date;
  teamId: string;
  team: { id: string; name: string };
  initiatives: Story[];
}

interface Feature {
  id: string;
  title: string;
  status: string;
  wsjfComputed: number | null | { toNumber: () => number };
}

interface Team {
  id: string;
  name: string;
}

interface Props {
  artId: string;
  piId: string;
  piName: string;
  teams: Team[];
  sprints: Sprint[];
  features: Feature[];
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function ProgramBoard({ artId, piId: _piId, piName, teams, sprints, features }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sprintStories, setSprintStories] = useState<Map<string, Story[]>>(
    () => new Map(sprints.map((s) => [s.id, s.initiatives])),
  );
  const [, startTransition] = useTransition();

  const draggingStory = useRef<{ storyId: string; fromSprintId: string } | null>(null);

  const sprintIndices = [...new Set(sprints.map((s) => s.indexInPi))].sort((a, b) => a - b);

  const visibleTeams = selectedTeam === "all" ? teams : teams.filter((t) => t.id === selectedTeam);

  // Build sprint lookup: teamId → index → sprint
  const sprintMap = new Map<string, Map<number, Sprint>>();
  for (const sprint of sprints) {
    if (!sprintMap.has(sprint.teamId)) sprintMap.set(sprint.teamId, new Map());
    sprintMap.get(sprint.teamId)!.set(sprint.indexInPi, sprint);
  }

  function moveStory(storyId: string, fromSprintId: string, toSprintId: string) {
    if (fromSprintId === toSprintId) return;

    startTransition(() => {
      setSprintStories((prev) => {
        const next = new Map(prev);
        const fromStories = (next.get(fromSprintId) ?? []).filter((s) => s.id !== storyId);
        const story = (prev.get(fromSprintId) ?? []).find((s) => s.id === storyId);
        if (!story) return prev;
        next.set(fromSprintId, fromStories);
        next.set(toSprintId, [...(next.get(toSprintId) ?? []), story]);
        return next;
      });

      // Fire server update
      void fetch(`/api/v1/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintId: toSprintId }),
      });
    });
  }

  const visibleFeatures = features.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All feature statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <span className="text-xs text-gray-400">
          {visibleTeams.length} team{visibleTeams.length !== 1 ? "s" : ""} · drag stories between
          sprints
        </span>
      </div>

      {/* Sprint matrix */}
      {visibleTeams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No teams match the current filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 border-r px-4 py-3 text-left font-semibold text-gray-700 min-w-[140px]">
                  Team
                </th>
                {sprintIndices.map((idx) => {
                  const anyTeamSprint = sprints.find((s) => s.indexInPi === idx);
                  return (
                    <th
                      key={idx}
                      className="border-r px-3 py-3 text-center font-semibold text-gray-700 min-w-[160px]"
                    >
                      <div>Sprint {idx}</div>
                      {anyTeamSprint && (
                        <div className="text-xs font-normal text-gray-400 mt-0.5">
                          {formatDate(anyTeamSprint.startDate)} –{" "}
                          {formatDate(anyTeamSprint.endDate)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleTeams.map((team) => (
                <tr key={team.id}>
                  <td className="sticky left-0 z-10 bg-white border-r px-4 py-4 font-medium text-gray-800 align-top">
                    {team.name}
                  </td>
                  {sprintIndices.map((idx) => {
                    const sprint = sprintMap.get(team.id)?.get(idx);
                    const stories = sprint ? (sprintStories.get(sprint.id) ?? []) : [];
                    const pts = stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

                    return (
                      <td
                        key={idx}
                        className="border-r px-2 py-2 align-top"
                        onDragOver={(e) => {
                          if (!sprint) return;
                          e.preventDefault();
                          e.currentTarget.classList.add("bg-blue-50");
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove("bg-blue-50");
                        }}
                        onDrop={(e) => {
                          e.currentTarget.classList.remove("bg-blue-50");
                          if (!sprint || !draggingStory.current) return;
                          moveStory(
                            draggingStory.current.storyId,
                            draggingStory.current.fromSprintId,
                            sprint.id,
                          );
                          draggingStory.current = null;
                        }}
                      >
                        {sprint ? (
                          <div className="min-h-[80px] space-y-1">
                            {pts > 0 && (
                              <p className="text-[10px] text-gray-400 text-right">{pts} pts</p>
                            )}
                            {stories.map((story) => (
                              <div
                                key={story.id}
                                draggable
                                onDragStart={() => {
                                  draggingStory.current = {
                                    storyId: story.id,
                                    fromSprintId: sprint.id,
                                  };
                                }}
                                onDragEnd={() => {
                                  draggingStory.current = null;
                                }}
                                className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:border-blue-300 transition-colors"
                              >
                                <p className="font-medium text-gray-800 line-clamp-2">
                                  {story.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${STATUS_COLOR[story.status] ?? STATUS_COLOR["draft"]!}`}
                                  >
                                    {story.status}
                                  </span>
                                  {story.storyPoints !== null && (
                                    <span className="text-[10px] text-gray-400">
                                      {story.storyPoints}p
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="min-h-[80px] flex items-center justify-center">
                            <span className="text-[10px] text-gray-200">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Features section with status filter applied */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">
          Features in {piName} ({visibleFeatures.length})
        </h2>
        {visibleFeatures.length === 0 ? (
          <p className="text-sm text-gray-400">
            No features match the filter.{" "}
            <Link href={`/art/${artId}/features`} className="text-blue-600 hover:underline">
              Manage features
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFeatures.map((f) => {
              const colorClass = STATUS_COLOR[f.status] ?? STATUS_COLOR["draft"]!;
              const score =
                f.wsjfComputed !== null
                  ? typeof f.wsjfComputed === "object"
                    ? f.wsjfComputed.toNumber().toFixed(1)
                    : Number(f.wsjfComputed).toFixed(1)
                  : null;
              return (
                <Link
                  key={f.id}
                  href={`/art/${artId}/features/${f.id}`}
                  className="rounded-lg border p-3 hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 line-clamp-2">
                      {f.title}
                    </span>
                    {score !== null && (
                      <span className="shrink-0 text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {score}
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}
                  >
                    {f.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
