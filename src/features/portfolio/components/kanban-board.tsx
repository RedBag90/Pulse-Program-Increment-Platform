"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { advanceStageGateAction } from "@/features/portfolio/actions/stage-gate";
import { useKanbanRealtime } from "@/features/portfolio/hooks/use-kanban-realtime";
import { Link } from "@/i18n/navigation";

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
      <div className="flex gap-4 min-w-max pb-4">
        {STAGE_GATES.map(({ key, label }) => {
          const columnEpics = epics.filter((e) => e.stageGate === key);
          return (
            <div key={key} className="w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                  {columnEpics.length}
                </span>
              </div>
              <div className="space-y-2 min-h-24">
                {columnEpics.map((epic) => {
                  const prev = PREV_GATE[key as Gate];
                  const next = NEXT_GATE[key as Gate];
                  return (
                    <div
                      key={epic.id}
                      className="bg-white border rounded-lg p-3 shadow-sm space-y-1"
                    >
                      <Link
                        href={`/portfolio/epics/${epic.id}`}
                        className="text-sm font-medium text-blue-700 hover:underline block"
                      >
                        {epic.title}
                      </Link>
                      {epic.valueStream && (
                        <p className="text-xs text-gray-500">{epic.valueStream.name}</p>
                      )}
                      {canEdit && (
                        <div className="flex gap-1 pt-1">
                          {prev && (
                            <button
                              type="button"
                              onClick={() => moveEpic(epic.id, prev)}
                              className="text-xs text-gray-500 hover:text-gray-700 border rounded px-1.5 py-0.5"
                              title={`Move to ${prev}`}
                            >
                              ←
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              onClick={() => moveEpic(epic.id, next)}
                              className="text-xs text-gray-500 hover:text-gray-700 border rounded px-1.5 py-0.5"
                              title={`Move to ${next}`}
                            >
                              →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
