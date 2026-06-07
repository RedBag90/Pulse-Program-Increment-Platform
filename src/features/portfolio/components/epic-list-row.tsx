"use client";

import { useActionState, startTransition } from "react";
import { AlertTriangle, Coins, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { STAGE_GATES } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import {
  STAGE_GATE_LABELS,
  SUB_STAGE_LABELS,
  STATUS_LABELS,
  STATUS_DOT,
} from "@/components/detail/initiative-labels";
import { advanceStageGateAction } from "@/features/portfolio/actions/stage-gate";
import { setEpicFlagAction, deleteEpicAction } from "@/features/portfolio/actions/epic";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApprovalPhasePill } from "@/features/portfolio/components/approval-phase-pill";
import type { EpicListRow } from "@/server/views/portfolio-epics-list";
import type { RagTier } from "@/domain/transformation-delta";

interface Props {
  row: EpicListRow;
  canEdit: boolean;
  canAdvance: boolean;
  stageGatesEnabled: boolean;
  /** Selection checkbox is wired by the parent — null hides the column. */
  selected: boolean | null;
  onToggleSelect?: (id: string) => void;
  /** Compact density hides cost + benefit + KPI columns; stacked second line covers them on `<lg`. */
  compact: boolean;
}

const STAGE_DOT: Record<string, string> = {
  L0: "bg-muted-foreground/40",
  L1: "bg-amber-400",
  L2: "bg-blue-400",
  L3: "bg-indigo-400",
  L4: "bg-primary",
  L5: "bg-emerald-500",
};

const KPI_BAR: Record<RagTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  done: "bg-emerald-600",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Format a € amount with k / M / B suffixes for dense table cells. */
function money(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M €`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${n} €`;
}

/**
 * One rich row of the portfolio epics list. Carries everything a portfolio
 * manager needs to decide without drilling into the detail page: stage-gate
 * dot, title link, owner, value stream, approval-phase pill, QS status pill,
 * economics (implementation cost + recurring benefit / year), KPI mini-bar
 * with progress %, governance badges, child-feature + pending-approval
 * counts. The "⋯" menu houses the per-row mutations (stage-gate advance /
 * retreat / steering toggle / budgeting toggle / delete) so the row stays
 * scannable and the actions stay one click away.
 */
export function EpicListRowComponent({
  row,
  canEdit,
  canAdvance,
  stageGatesEnabled,
  selected,
  onToggleSelect,
  compact,
}: Props) {
  const [stageGateState, stageGate, advancing] = useActionState(advanceStageGateAction, {});
  const [flagState, flag, flagging] = useActionState(setEpicFlagAction, {});
  const [deleteState, del, deleting] = useActionState(deleteEpicAction, {});
  const busy = advancing || flagging || deleting;

  const showMove = canAdvance && stageGatesEnabled;
  const stageIndex = STAGE_GATES.indexOf(row.stageGate as StageGate);
  const prev: StageGate | null = stageIndex > 0 ? (STAGE_GATES[stageIndex - 1] as StageGate) : null;
  const next: StageGate | null =
    stageIndex < STAGE_GATES.length - 1 ? (STAGE_GATES[stageIndex + 1] as StageGate) : null;

  // React 19 verlangt, dass useActionState-Dispatches außerhalb von
  // <form action=…> in startTransition gewrappt werden — sonst meckert
  // der Dev-Mode mit „called outside of a transition".
  function moveTo(toGate: StageGate | null) {
    if (!toGate) return;
    const fd = new FormData();
    fd.set("epicId", row.id);
    fd.set("toGate", toGate);
    startTransition(() => stageGate(fd));
  }

  function toggleFlag(which: "steering" | "budgeting") {
    const current = which === "steering" ? row.needsSteeringAttention : row.stagedForBudgeting;
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("flag", which);
    fd.set("value", current ? "false" : "true");
    startTransition(() => flag(fd));
  }

  function deleteRow() {
    if (
      !window.confirm(
        `Epic „${row.title}" löschen? Alle untergeordneten Features und Stories werden mitgelöscht.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("id", row.id);
    startTransition(() => del(fd));
  }

  const lastError = stageGateState.error ?? flagState.error ?? deleteState.error;

  return (
    <tr className="border-b align-middle hover:bg-muted/40">
      {selected !== null && (
        <td className="py-2 pl-3 pr-2 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(row.id)}
            className="size-4 rounded border-border"
            aria-label={`${row.title} auswählen`}
          />
        </td>
      )}

      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 shrink-0 rounded-full ${STAGE_DOT[row.stageGate] ?? "bg-muted-foreground/40"}`}
            title={
              row.subStage
                ? `${STAGE_GATE_LABELS[row.stageGate] ?? row.stageGate} · ${row.subStage} ${SUB_STAGE_LABELS[row.subStage]}`
                : (STAGE_GATE_LABELS[row.stageGate] ?? row.stageGate)
            }
            aria-hidden
          />
          {row.subStage && (
            <span
              className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground"
              title={SUB_STAGE_LABELS[row.subStage]}
            >
              {row.subStage}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <Link
              href={`/portfolio/epics/${row.id}`}
              className="block truncate font-medium text-primary hover:underline"
              title={row.title}
            >
              {row.title}
            </Link>
            {compact && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.ownerLabel ?? "ohne Owner"} · {row.valueStream?.name ?? "ohne Wertstrom"}
                {row.economics.implementationCost != null
                  ? ` · ${money(row.economics.implementationCost)}`
                  : ""}
              </p>
            )}
          </div>
          <GovernanceBadges row={row} />
        </div>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-sm text-muted-foreground">
          <span className="block max-w-[140px] truncate">{row.ownerLabel ?? "—"}</span>
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-sm text-muted-foreground">
          <span className="block max-w-[140px] truncate">{row.valueStream?.name ?? "—"}</span>
        </td>
      )}

      <td className="py-2 pr-3">
        <ApprovalPhasePill phase={row.approvalPhase} compact />
      </td>

      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${STATUS_DOT[row.status] ?? "bg-muted-foreground/40"}`}
          />
          <span className="text-muted-foreground">{STATUS_LABELS[row.status] ?? row.status}</span>
        </span>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {money(row.economics.implementationCost)}
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {row.economics.recurringBenefitYear != null ? (
            <>
              {money(row.economics.recurringBenefitYear)}
              <span className="text-[10px] text-muted-foreground/60">/Jahr</span>
            </>
          ) : (
            "—"
          )}
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3">
          {row.kpiProgress != null ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${row.kpiTier ? KPI_BAR[row.kpiTier] : "bg-primary"}`}
                  style={{ width: pct(row.kpiProgress) }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {pct(row.kpiProgress)}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {row.kpiCount === 0 ? "keine KPIs" : "—"}
            </span>
          )}
        </td>
      )}

      {(showMove || canEdit) && (
        <td className="py-2 pl-2 pr-3">
          <div className="flex items-center justify-end gap-1">
            {showMove && (
              <>
                <button
                  type="button"
                  onClick={() => moveTo(prev)}
                  disabled={busy || !prev}
                  className="inline-flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-30"
                  title={prev ? `Zurück zu ${STAGE_GATE_LABELS[prev] ?? prev}` : "Bereits L0"}
                  aria-label="Stage zurück"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTo(next)}
                  disabled={busy || !next}
                  className="inline-flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-30"
                  title={next ? `Weiter zu ${STAGE_GATE_LABELS[next] ?? next}` : "Bereits L5"}
                  aria-label="Stage weiter"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </>
            )}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={busy}
                    aria-label="Mehr"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-56">
                <ul className="flex flex-col gap-0.5 text-sm">
                  {canEdit && (
                    <>
                      <li>
                        <button
                          type="button"
                          onClick={() => toggleFlag("steering")}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                        >
                          <AlertTriangle className="size-3.5 text-amber-600" />
                          {row.needsSteeringAttention
                            ? "Steering-Markierung aufheben"
                            : "Für Steering markieren"}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => toggleFlag("budgeting")}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                        >
                          <Coins className="size-3.5 text-blue-600" />
                          {row.stagedForBudgeting
                            ? "Aus Budget-Vorbereitung entfernen"
                            : "Für Budget vorbereiten"}
                        </button>
                      </li>
                      <li className="my-1 border-t" />
                      <li>
                        <button
                          type="button"
                          onClick={deleteRow}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                        >
                          Löschen
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          {lastError && (
            <p role="alert" className="mt-1 text-[10px] text-destructive">
              {lastError}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}

function GovernanceBadges({ row }: { row: EpicListRow }) {
  const showSteering = row.needsSteeringAttention;
  const showBudget = row.stagedForBudgeting;
  const showApprovals = row.pendingApprovalsCount > 0;
  if (!showSteering && !showBudget && !showApprovals) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {showSteering && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-amber-100 text-amber-700"
          title="Für Steering markiert"
        >
          <AlertTriangle className="size-3" />
        </span>
      )}
      {showBudget && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-blue-100 text-blue-700"
          title="Für Budget vorbereitet"
        >
          <Coins className="size-3" />
        </span>
      )}
      {showApprovals && (
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-medium text-indigo-700"
          title={`${row.pendingApprovalsCount} offene Freigaben`}
        >
          {row.pendingApprovalsCount}
        </span>
      )}
    </span>
  );
}
