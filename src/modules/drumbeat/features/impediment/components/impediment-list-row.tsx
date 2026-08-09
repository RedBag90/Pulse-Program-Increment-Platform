"use client";

import { useState } from "react";
import { AlertOctagon, Clock, Flame, MoreHorizontal } from "lucide-react";
import {
  escalateImpedimentAction,
  resolveImpedimentAction,
} from "@/modules/drumbeat/features/impediment/actions/impediment";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { ImpedimentListRow, ImpedimentStatus } from "@/server/views/impediments-list";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  STATUS_DOT,
  STATUS_LABEL,
} from "@/modules/drumbeat/features/impediment/labels";

interface Props {
  row: ImpedimentListRow;
  artId: string;
  canEscalate: boolean;
  canResolve: boolean;
  selected: boolean | null;
  onToggleSelect?: ((id: string) => void) | undefined;
  compact: boolean;
}

const STATUS_FUNNEL_DOT: Record<ImpedimentStatus, string> = {
  open: "bg-blue-400",
  escalated: "bg-purple-500",
  resolved: "bg-emerald-500",
};

/**
 * One rich row of the impediment list. Mirrors `feature-list-row.tsx` /
 * `epic-list-row.tsx`: checkbox · status dot · title · severity pill ·
 * status pill · days-open + days-since-escalation numeric columns ·
 * governance badges (critical / overdue / stale escalation) · Popover
 * row menu with single-item escalate / resolve.
 */
export function ImpedimentListRowComponent({
  row,
  artId,
  canEscalate,
  canResolve,
  selected,
  onToggleSelect,
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  async function escalate() {
    setBusy(true);
    setError(null);
    const res = await escalateImpedimentAction(row.id, artId);
    if (res.error) setError(res.error);
    setBusy(false);
  }

  async function resolve() {
    if (resolution.trim() === "") return;
    setBusy(true);
    setError(null);
    const res = await resolveImpedimentAction(row.id, artId, resolution);
    if (res.error) setError(res.error);
    else {
      setResolveOpen(false);
      setResolution("");
    }
    setBusy(false);
  }

  const canEdit = canEscalate || canResolve;

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
            className={`inline-block size-2 shrink-0 rounded-full ${STATUS_FUNNEL_DOT[row.status]}`}
            title={STATUS_LABEL[row.status]}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="block truncate text-sm font-medium" title={row.title}>
              {row.title}
            </p>
            {compact && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.raisedByLabel ?? "Unbekannt"} · {row.piName ?? "Backlog"}
              </p>
            )}
          </div>
          <RowBadges row={row} />
        </div>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-sm text-muted-foreground">
          <span className="block max-w-[140px] truncate" title={row.raisedByLabel ?? ""}>
            {row.raisedByLabel ?? "—"}
          </span>
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-sm text-muted-foreground">
          <span className="block max-w-[140px] truncate">{row.piName ?? "—"}</span>
        </td>
      )}

      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${SEVERITY_BADGE[row.severity]}`}
        >
          {SEVERITY_LABEL[row.severity]}
        </span>
      </td>

      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`size-1.5 rounded-full ${STATUS_DOT[row.status]}`} />
          <span className="text-muted-foreground">{STATUS_LABEL[row.status]}</span>
        </span>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {row.daysOpen}d
        </td>
      )}

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {row.daysSinceEscalation != null ? `${row.daysSinceEscalation}d` : "—"}
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
              <PopoverContent align="end" className="w-64">
                <ul className="flex flex-col gap-0.5 text-sm">
                  {canEscalate && row.status === "open" && (
                    <li>
                      <button
                        type="button"
                        onClick={escalate}
                        disabled={busy}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                      >
                        <AlertOctagon className="size-3.5 text-purple-600" /> Eskalieren
                      </button>
                    </li>
                  )}
                  {canResolve && row.status !== "resolved" && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setResolveOpen((v) => !v)}
                        disabled={busy}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                      >
                        <span className="text-emerald-600">✓</span> Auflösen…
                      </button>
                    </li>
                  )}
                  {resolveOpen && canResolve && row.status !== "resolved" && (
                    <li className="space-y-2 px-2 py-2">
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Wie wurde es gelöst?"
                        rows={3}
                        maxLength={2000}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || resolution.trim() === ""}
                        onClick={resolve}
                      >
                        Speichern
                      </Button>
                    </li>
                  )}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          {error && (
            <p role="alert" className="mt-1 text-[10px] text-destructive">
              {error}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}

function RowBadges({ row }: { row: ImpedimentListRow }) {
  if (!row.isCritical && !row.isOverdue && !row.isStaleEscalation) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {row.isCritical && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-red-100 text-red-700"
          title="Kritische Schwere"
        >
          <Flame className="size-3" />
        </span>
      )}
      {row.isOverdue && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-amber-100 text-amber-700"
          title="Länger als 14 Tage offen"
        >
          <Clock className="size-3" />
        </span>
      )}
      {row.isStaleEscalation && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-purple-100 text-purple-700"
          title="Eskalation > 7 Tage ohne Auflösung"
        >
          <AlertOctagon className="size-3" />
        </span>
      )}
    </span>
  );
}
