"use client";

import { useActionState, startTransition } from "react";
import { AlertTriangle, Coins, MoreHorizontal, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { STAGE_GATE_LABELS, SUB_STAGE_LABELS } from "@/components/detail/initiative-labels";
import {
  setEpicFlagAction,
  deleteEpicAction,
} from "@/modules/work/features/portfolio/actions/epic";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";
import type { RagTier } from "@/modules/work/domain/transformation-delta";

interface Props {
  row: EpicListRow;
  canEdit: boolean;
  /**
   * Wird von Tabelle/Shell durchgereicht (Bulk-Leiste nutzt es noch). Die Zeile
   * selbst steuert den Reifegrad nicht mehr manuell — sie zeigt stattdessen den
   * Nächster-Schritt-Hinweis; daher hier akzeptiert, aber ungenutzt.
   */
  canAdvance?: boolean;
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
  stageGatesEnabled,
  selected,
  onToggleSelect,
  compact,
}: Props) {
  const [flagState, flag, flagging] = useActionState(setEpicFlagAction, {});
  const [deleteState, del, deleting] = useActionState(deleteEpicAction, {});
  const busy = flagging || deleting;

  // Statt manueller Pfeile (die den Reifegrad ohne Vorleistung überspringen
  // ließen) zeigt die Zeile den nächsten notwendigen Schritt — dieselbe
  // `epicNextStep`-Guidance wie die Detailseite, serverseitig vorberechnet.
  // Nur wenn Stage Gates aktiv sind und ein Schritt aussteht (L5/fertig ⇒ null).
  const showNextStep = stageGatesEnabled && row.nextStep != null;
  const nextHref =
    row.nextStep?.cta?.kind === "link" ? row.nextStep.cta.href : `/portfolio/epics/${row.id}`;

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

  const lastError = flagState.error ?? deleteState.error;

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

      {/* Spalten „Phase" und „Status" sind seit dem Reifegrad-Modell v2
          redundant: Phase ist im Sub-Step-Badge neben dem Stage-Dot
          kodiert (L2.1/L2.2/…), Status ist die Kanban-Achse und gehört
          in die Detail-Sub-Header-Sicht, nicht in die Liste. */}

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

      {(showNextStep || canEdit) && (
        <td className="py-2 pl-2 pr-3">
          <div className="flex items-center justify-end gap-1">
            {showNextStep && row.nextStep && (
              <Link
                href={nextHref}
                title={`${row.nextStep.title} — ${row.nextStep.hint}`}
                className="inline-flex max-w-[11rem] items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <span className="truncate">{row.nextStep.title}</span>
                <ArrowRight className="size-3 shrink-0 opacity-60" aria-hidden />
              </Link>
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
