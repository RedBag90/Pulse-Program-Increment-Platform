"use client";

import { useActionState } from "react";
import { ClipboardList, MoreHorizontal, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { STATUS_DOT, STATUS_LABELS } from "@/components/detail/initiative-labels";
import { deleteFeatureAction, setFeaturePiAction } from "@/features/art/actions/feature";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WsjfScoreDialog } from "@/features/art/components/wsjf-score-dialog";
import type { FeatureListRow, WsjfTier } from "@/server/views/features-list";

interface Props {
  row: FeatureListRow;
  artId: string;
  canEdit: boolean;
  selected: boolean | null;
  onToggleSelect?: ((id: string) => void) | undefined;
  compact: boolean;
}

const STATUS_FUNNEL_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  approved: "bg-blue-400",
  in_progress: "bg-primary",
  completed: "bg-emerald-500",
};

const TIER_BADGE: Record<WsjfTier, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground/70",
};

const TIER_LABEL: Record<WsjfTier, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
  none: "—",
};

function pctFromWsjf(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

/**
 * One rich row of the feature backlog list. Mirrors `epic-list-row.tsx` —
 * checkbox · status dot · title link · Epic chip · status pill · WSJF tier
 * badge · AC count · governance badges · chevron / Popover row menu. The
 * single-row "move to backlog" / PI re-assign is in the row menu;
 * multi-feature PI moves go through the bulk-action bar.
 */
export function FeatureListRowComponent({
  row,
  artId,
  canEdit,
  selected,
  onToggleSelect,
  compact,
}: Props) {
  const [deleteState, del, deleting] = useActionState(deleteFeatureAction, {});
  const [moveState, move, moving] = useActionState(setFeaturePiAction, {});
  const busy = deleting || moving;

  function removeRow() {
    if (
      !window.confirm(
        `Feature „${row.title}" löschen? Alle untergeordneten Stories werden mitgelöscht.`,
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("artId", artId);
    del(fd);
  }

  function moveToBacklog() {
    const fd = new FormData();
    fd.append("featureIds", row.id);
    fd.set("piId", "");
    fd.set("artId", artId);
    move(fd);
  }

  const lastError = deleteState.error ?? moveState.error;

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
            className={`inline-block size-2 shrink-0 rounded-full ${STATUS_FUNNEL_DOT[row.status] ?? "bg-muted-foreground/40"}`}
            title={STATUS_LABELS[row.status] ?? row.status}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/feature/${row.id}`}
              className="block truncate font-medium text-primary hover:underline"
              title={row.title}
            >
              {row.title}
            </Link>
            {compact && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.epic?.title ?? "ohne Epic"} · {row.pi?.name ?? "Backlog"}
              </p>
            )}
          </div>
          <RowBadges row={row} />
        </div>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-sm">
          {row.epic ? (
            <Link
              href={`/portfolio/epics/${row.epic.id}`}
              className="block max-w-[160px] truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
              title={row.epic.title}
            >
              {row.epic.title}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-sm">
          <span className="block max-w-[120px] truncate text-xs text-muted-foreground">
            {row.pi?.name ?? "Backlog"}
          </span>
        </td>
      )}

      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${STATUS_DOT[row.status] ?? "bg-muted-foreground/40"}`}
          />
          <span className="text-muted-foreground">{STATUS_LABELS[row.status] ?? row.status}</span>
        </span>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${TIER_BADGE[row.wsjfTier]}`}
          >
            {TIER_LABEL[row.wsjfTier]}
            <span className="text-foreground/80">{pctFromWsjf(row.wsjfComputed)}</span>
          </span>
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {row.acceptanceCriteriaCount}
        </td>
      )}

      {canEdit && (
        <td className="py-2 pl-2 pr-3">
          <div className="flex items-center justify-end gap-1">
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
                  <li>
                    <WsjfScoreRowMenuItem row={row} artId={artId} />
                  </li>
                  {row.pi && (
                    <li>
                      <button
                        type="button"
                        onClick={moveToBacklog}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                      >
                        ← In Backlog verschieben
                      </button>
                    </li>
                  )}
                  <li className="my-1 border-t" />
                  <li>
                    <button
                      type="button"
                      onClick={removeRow}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                    >
                      Löschen
                    </button>
                  </li>
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

function RowBadges({ row }: { row: FeatureListRow }) {
  const showBlocked = row.isBlocked;
  const showNoAc = row.acceptanceCriteriaCount === 0 && row.status !== "draft";
  if (!showBlocked && !showNoAc) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {showBlocked && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-red-100 text-red-700"
          title="Blockiert durch andere Features"
        >
          <ShieldAlert className="size-3" />
        </span>
      )}
      {showNoAc && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-amber-100 text-amber-700"
          title="Noch keine Akzeptanzkriterien"
        >
          <ClipboardList className="size-3" />
        </span>
      )}
    </span>
  );
}

/**
 * Wraps `<WsjfScoreDialog>` as a row-menu entry that opens the existing
 * dialog. Replaces the inline-on-table-cell trigger of the old layout.
 */
function WsjfScoreRowMenuItem({ row, artId }: { row: FeatureListRow; artId: string }) {
  return (
    <div className="px-2 py-1.5">
      <WsjfScoreDialog
        featureId={row.id}
        artId={artId}
        current={{
          bv: row.wsjfBusinessValue,
          tc: row.wsjfTimeCriticality,
          rr: row.wsjfRiskReduction,
          js: row.wsjfJobSize,
        }}
      />
    </div>
  );
}
