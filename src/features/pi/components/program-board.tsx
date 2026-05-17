"use client";

import type { ReactNode } from "react";
import { useState, useRef, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { assignSprintAction } from "@/features/story/actions/assign-sprint";

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
  wsjfComputed: number | null;
}

interface Team {
  id: string;
  name: string;
  targetVelocity: number | null;
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
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DROP_HIGHLIGHT = "bg-accent";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function dayCount(start: Date, end: Date): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
}

function sumPoints(stories: Story[]): number {
  return stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
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

  const storiesOf = (sprintId: string): Story[] => sprintStories.get(sprintId) ?? [];

  function moveStory(storyId: string, fromSprintId: string, toSprintId: string) {
    if (fromSprintId === toSprintId) return;
    const targetSprint = sprints.find((s) => s.id === toSprintId);
    if (!targetSprint) return;

    // Optimistic update: move the story immediately in local state.
    setSprintStories((prev) => {
      const next = new Map(prev);
      const story = (prev.get(fromSprintId) ?? []).find((s) => s.id === storyId);
      if (!story) return prev;
      next.set(
        fromSprintId,
        (next.get(fromSprintId) ?? []).filter((s) => s.id !== storyId),
      );
      next.set(toSprintId, [...(next.get(toSprintId) ?? []), story]);
      return next;
    });

    // Persist via server action; revert optimistic update on failure.
    startTransition(async () => {
      const result = await assignSprintAction(storyId, toSprintId, artId, targetSprint.teamId);
      if (result.error) {
        setSprintStories((prev) => {
          const next = new Map(prev);
          const story = (prev.get(toSprintId) ?? []).find((s) => s.id === storyId);
          if (!story) return prev;
          next.set(
            toSprintId,
            (next.get(toSprintId) ?? []).filter((s) => s.id !== storyId),
          );
          next.set(fromSprintId, [...(next.get(fromSprintId) ?? []), story]);
          return next;
        });
      }
    });
  }

  const visibleFeatures = features.filter(
    (f) => statusFilter === "all" || f.status === statusFilter,
  );

  /** Σ story points booked into sprint `idx` across the visible teams. */
  const columnTotal = (idx: number): number =>
    visibleTeams.reduce((sum, team) => {
      const sprint = sprintMap.get(team.id)?.get(idx);
      return sum + (sprint ? sumPoints(storiesOf(sprint.id)) : 0);
    }, 0);
  const grandTotal = sprintIndices.reduce((sum, idx) => sum + columnTotal(idx), 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className={SELECT_CLASS}
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
          className={SELECT_CLASS}
        >
          <option value="all">All feature statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <span className="text-xs text-muted-foreground">
          {visibleTeams.length} team{visibleTeams.length !== 1 ? "s" : ""} · drag stories between
          sprints
        </span>
      </div>

      {/* Sprint matrix */}
      {teams.length === 0 ? (
        <EmptyState>
          Dieser ART hat noch keine Teams.{" "}
          <Link href={`/art/${artId}/teams`} className="text-primary hover:underline">
            Teams verwalten
          </Link>
        </EmptyState>
      ) : sprints.length === 0 ? (
        <EmptyState>
          Dieses Program Increment hat noch keine Sprints. Sprints werden für geplante PIs mit Teams
          automatisch erzeugt.
        </EmptyState>
      ) : visibleTeams.length === 0 ? (
        <EmptyState>Kein Team entspricht dem Filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[150px] border-r bg-muted/50 px-4 py-3 text-left font-semibold">
                  Team
                </th>
                {sprintIndices.map((idx) => {
                  const anySprint = sprints.find((s) => s.indexInPi === idx);
                  return (
                    <th
                      key={idx}
                      className="min-w-[170px] border-r px-3 py-3 text-center font-semibold"
                    >
                      <div>Sprint {idx}</div>
                      {anySprint && (
                        <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {formatDate(anySprint.startDate)} – {formatDate(anySprint.endDate)} ·{" "}
                          {dayCount(anySprint.startDate, anySprint.endDate)} Tage
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="min-w-[90px] border-l px-3 py-3 text-center font-semibold">
                  Gesamt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleTeams.map((team) => {
                const teamTotal = sprintIndices.reduce((sum, idx) => {
                  const sprint = sprintMap.get(team.id)?.get(idx);
                  return sum + (sprint ? sumPoints(storiesOf(sprint.id)) : 0);
                }, 0);
                return (
                  <tr key={team.id}>
                    <td className="sticky left-0 z-10 border-r bg-background px-4 py-4 align-top font-medium">
                      {team.name}
                      <p className="text-xs font-normal text-muted-foreground">
                        Velocity {team.targetVelocity ?? "—"}
                      </p>
                    </td>
                    {sprintIndices.map((idx) => {
                      const sprint = sprintMap.get(team.id)?.get(idx);
                      if (!sprint) {
                        return (
                          <td key={idx} className="border-r align-top">
                            <div className="flex min-h-[96px] items-center justify-center">
                              <span className="text-xs text-muted-foreground/30">—</span>
                            </div>
                          </td>
                        );
                      }
                      const stories = storiesOf(sprint.id);
                      const load = sumPoints(stories);
                      const capacity = team.targetVelocity ?? 0;
                      const pct = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
                      const over = capacity > 0 && load > capacity;

                      return (
                        <td
                          key={idx}
                          className="border-r px-2 py-2 align-top"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add(DROP_HIGHLIGHT);
                          }}
                          onDragLeave={(e) => e.currentTarget.classList.remove(DROP_HIGHLIGHT)}
                          onDrop={(e) => {
                            e.currentTarget.classList.remove(DROP_HIGHLIGHT);
                            if (!draggingStory.current) return;
                            moveStory(
                              draggingStory.current.storyId,
                              draggingStory.current.fromSprintId,
                              sprint.id,
                            );
                            draggingStory.current = null;
                          }}
                        >
                          <div className="min-h-[96px] space-y-1.5">
                            {/* Capacity / load */}
                            <div className="space-y-0.5">
                              <p className="text-right text-[10px] text-muted-foreground">
                                {load} / {capacity > 0 ? capacity : "—"} Pkt
                              </p>
                              {capacity > 0 && (
                                <div className="h-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              )}
                            </div>
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
                                className="cursor-grab rounded border border-border bg-card px-2 py-1.5 text-xs shadow-sm transition-colors hover:border-ring active:cursor-grabbing"
                              >
                                <p className="line-clamp-2 font-medium">{story.title}</p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_COLOR[story.status] ?? STATUS_COLOR["draft"]!}`}
                                  >
                                    {story.status}
                                  </span>
                                  {story.storyPoints !== null && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {story.storyPoints}p
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-l px-3 py-4 text-center align-top font-semibold">
                      {teamTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="sticky left-0 z-10 border-r bg-muted/50 px-4 py-2.5">Gesamt</td>
                {sprintIndices.map((idx) => (
                  <td key={idx} className="border-r px-3 py-2.5 text-center">
                    {columnTotal(idx)}
                  </td>
                ))}
                <td className="border-l px-3 py-2.5 text-center">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Features section with status filter applied */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          Features in {piName} ({visibleFeatures.length})
        </h2>
        {visibleFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No features match the filter.{" "}
            <Link href={`/art/${artId}/features`} className="text-primary hover:underline">
              Manage features
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFeatures.map((f) => {
              const colorClass = STATUS_COLOR[f.status] ?? STATUS_COLOR["draft"]!;
              const score = f.wsjfComputed !== null ? f.wsjfComputed.toFixed(1) : null;
              return (
                <Link
                  key={f.id}
                  href={`/feature/${f.id}`}
                  className="group rounded-lg border p-3 transition-colors hover:border-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">
                      {f.title}
                    </span>
                    {score !== null && (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {score}
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] ${colorClass}`}
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
