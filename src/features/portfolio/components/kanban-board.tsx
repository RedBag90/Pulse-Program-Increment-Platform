"use client";

import { useActionState, useOptimistic, useTransition, useRef } from "react";
import { advanceStageGateAction } from "@/features/portfolio/actions/stage-gate";
import { useKanbanRealtime } from "@/features/portfolio/hooks/use-kanban-realtime";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STAGE_GATES = [
  { key: "L0", label: "Funnel" },
  { key: "L1", label: "Reviewing" },
  { key: "L2", label: "Analyzing" },
  { key: "L3", label: "Portfolio Backlog" },
  { key: "L4", label: "Implementing" },
  { key: "L5", label: "Done" },
] as const;

type Gate = (typeof STAGE_GATES)[number]["key"];

const NEXT_GATE: Record<Gate, Gate | null> = {
  L0: "L1",
  L1: "L2",
  L2: "L3",
  L3: "L4",
  L4: "L5",
  L5: null,
};

const PREV_GATE: Record<Gate, Gate | null> = {
  L0: null,
  L1: "L0",
  L2: "L1",
  L3: "L2",
  L4: "L3",
  L5: "L4",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-blue-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/20",
};

export interface KanbanEpic {
  id: string;
  title: string;
  stageGate: string;
  status: string;
  valueStream: { name: string } | null;
}

interface KanbanBoardProps {
  epics: KanbanEpic[];
  canEdit: boolean;
  tenantId: string;
}

export function KanbanBoard({ epics: initialEpics, canEdit, tenantId }: KanbanBoardProps) {
  useKanbanRealtime(tenantId);
  const [, startTransition] = useTransition();
  const [_state, action] = useActionState(advanceStageGateAction, {});
  const [epics, setOptimisticEpics] = useOptimistic(
    initialEpics,
    (current, { epicId, toGate }: { epicId: string; toGate: Gate }) =>
      current.map((e) => (e.id === epicId ? { ...e, stageGate: toGate } : e)),
  );

  const draggingId = useRef<string | null>(null);
  const dragOverGate = useRef<Gate | null>(null);

  const moveEpic = (epicId: string, toGate: Gate) => {
    startTransition(() => {
      setOptimisticEpics({ epicId, toGate });
      const fd = new FormData();
      fd.set("epicId", epicId);
      fd.set("toGate", toGate);
      void action(fd);
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-4">
        {STAGE_GATES.map(({ key, label }) => {
          const columnEpics = epics.filter((e) => e.stageGate === key);
          return (
            <div
              key={key}
              className="w-56 flex-shrink-0"
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                dragOverGate.current = key as Gate;
                e.currentTarget.classList.add("ring-2", "ring-primary", "ring-inset", "rounded-xl");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove(
                  "ring-2",
                  "ring-primary",
                  "ring-inset",
                  "rounded-xl",
                );
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove(
                  "ring-2",
                  "ring-primary",
                  "ring-inset",
                  "rounded-xl",
                );
                if (!canEdit) return;
                const epicId = draggingId.current;
                const toGate = dragOverGate.current;
                if (!epicId || !toGate) return;
                const epic = epics.find((ep) => ep.id === epicId);
                if (epic && epic.stageGate !== toGate) moveEpic(epicId, toGate);
                draggingId.current = null;
                dragOverGate.current = null;
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {label}
                </span>
                <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
                  {columnEpics.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-24 rounded-xl bg-muted/40 p-2 transition-colors">
                {columnEpics.map((epic) => {
                  const prev = PREV_GATE[key as Gate];
                  const next = NEXT_GATE[key as Gate];
                  return (
                    <div
                      key={epic.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        draggingId.current = epic.id;
                        e.dataTransfer.effectAllowed = "move";
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                        draggingId.current = null;
                      }}
                      className={`bg-card border border-border rounded-lg p-3 space-y-2 shadow-sm transition-shadow hover:shadow-md ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {/* Status dot + title */}
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-1.5 size-1.5 rounded-full shrink-0 ${STATUS_DOT[epic.status] ?? "bg-muted-foreground/40"}`}
                        />
                        <Link
                          href={`/portfolio/epics/${epic.id}`}
                          className="text-xs font-medium leading-snug hover:text-primary transition-colors line-clamp-2"
                        >
                          {epic.title}
                        </Link>
                      </div>

                      {/* Value stream */}
                      {epic.valueStream && (
                        <p className="text-[10px] text-muted-foreground truncate pl-3.5">
                          {epic.valueStream.name}
                        </p>
                      )}

                      {/* Navigation buttons */}
                      {canEdit && (
                        <div className="flex gap-1 pt-0.5">
                          {prev && (
                            <button
                              type="button"
                              onClick={() => moveEpic(epic.id, prev)}
                              className="size-5 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                              title={`Move to ${prev}`}
                            >
                              <ChevronLeft className="size-3" />
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              onClick={() => moveEpic(epic.id, next)}
                              className="size-5 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                              title={`Move to ${next}`}
                            >
                              <ChevronRight className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {columnEpics.length === 0 && (
                  <div className="h-16 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/50">Empty</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
