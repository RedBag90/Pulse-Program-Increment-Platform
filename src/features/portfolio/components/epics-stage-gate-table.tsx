"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { advanceStageGateAction } from "@/features/portfolio/actions/stage-gate";
import { useKanbanRealtime } from "@/features/portfolio/hooks/use-kanban-realtime";
import { STAGE_GATES } from "@/domain/stage-gate";
import {
  STAGE_GATE_LABELS,
  STATUS_LABELS,
  STATUS_DOT,
} from "@/components/detail/initiative-labels";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { Link } from "@/i18n/navigation";

type Gate = (typeof STAGE_GATES)[number];

export interface EpicRow {
  id: string;
  title: string;
  stageGate: string;
  status: string;
  valueStream: { name: string } | null;
}

interface Props {
  epics: EpicRow[];
  /** May delete epics (`epic.delete`). */
  canEdit: boolean;
  /** May advance/retreat a stage gate (`epic.approve`). */
  canAdvance: boolean;
  /** Stage gates are part of the tenant's target operating model. */
  stageGatesEnabled: boolean;
  tenantId: string;
}

/**
 * Epics overview as a "tabular Kanban": one aligned table whose rows are grouped
 * into collapsible sections per stage gate (the same division as the Portfolio
 * Übersicht board). Reuses the board's move action — moving an epic re-homes it
 * to the adjacent section — plus the shared labels/colors and delete control.
 */
export function EpicsStageGateTable({
  epics: initialEpics,
  canEdit,
  canAdvance,
  stageGatesEnabled,
  tenantId,
}: Props) {
  useKanbanRealtime(tenantId);
  const [, startTransition] = useTransition();
  const [, action] = useActionState(advanceStageGateAction, {});
  const [epics, setOptimistic] = useOptimistic(
    initialEpics,
    (current, { epicId, toGate }: { epicId: string; toGate: Gate }) =>
      current.map((e) => (e.id === epicId ? { ...e, stageGate: toGate } : e)),
  );

  // Open gates that currently hold epics; collapse the empty ones by default.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STAGE_GATES.map((g) => [g, initialEpics.some((e) => e.stageGate === g)])),
  );
  const toggle = (g: string) => setOpen((prev) => ({ ...prev, [g]: !prev[g] }));

  const moveEpic = (epicId: string, toGate: Gate) => {
    startTransition(() => {
      setOptimistic({ epicId, toGate });
      const fd = new FormData();
      fd.set("epicId", epicId);
      fd.set("toGate", toGate);
      void action(fd);
    });
  };

  const showMove = canAdvance && stageGatesEnabled;
  const showActions = showMove || canEdit;
  const colCount = 3 + (showActions ? 1 : 0);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 pr-4">Title</th>
          <th className="pb-2 pr-4">Value Stream</th>
          <th className="pb-2 pr-4">Status</th>
          {showActions && <th className="pb-2" />}
        </tr>
      </thead>
      {STAGE_GATES.map((gate, gateIdx) => {
        const rows = epics.filter((e) => e.stageGate === gate);
        const isOpen = open[gate] ?? false;
        const prev = gateIdx > 0 ? STAGE_GATES[gateIdx - 1] : null;
        const next = gateIdx < STAGE_GATES.length - 1 ? STAGE_GATES[gateIdx + 1] : null;
        return (
          <tbody key={gate}>
            <tr className="border-b bg-muted/30">
              <td colSpan={colCount} className="py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(gate)}
                  className="flex w-full items-center gap-2 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {STAGE_GATE_LABELS[gate] ?? gate}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {rows.length}
                  </span>
                </button>
              </td>
            </tr>

            {isOpen && rows.length === 0 && (
              <tr className="border-b">
                <td colSpan={colCount} className="py-2 pl-6 text-muted-foreground">
                  Keine Epics
                </td>
              </tr>
            )}

            {isOpen &&
              rows.map((epic) => (
                <tr key={epic.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4 pl-6">
                    <Link
                      href={`/portfolio/epics/${epic.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {epic.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {epic.valueStream?.name ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${STATUS_DOT[epic.status] ?? "bg-muted-foreground/40"}`}
                      />
                      <span className="text-muted-foreground">
                        {STATUS_LABELS[epic.status] ?? epic.status}
                      </span>
                    </span>
                  </td>
                  {showActions && (
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        {showMove && prev && (
                          <button
                            type="button"
                            onClick={() => moveEpic(epic.id, prev)}
                            className="inline-flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                            title={`Move to ${STAGE_GATE_LABELS[prev] ?? prev}`}
                          >
                            <ChevronLeft className="size-3.5" />
                          </button>
                        )}
                        {showMove && next && (
                          <button
                            type="button"
                            onClick={() => moveEpic(epic.id, next)}
                            className="inline-flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                            title={`Move to ${STAGE_GATE_LABELS[next] ?? next}`}
                          >
                            <ChevronRight className="size-3.5" />
                          </button>
                        )}
                        {canEdit && <DeleteEpicButton id={epic.id} title={epic.title} />}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        );
      })}
    </table>
  );
}
