"use client";

import { ArrowRight, Network, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  STATUS_DOT as INITIATIVE_STATUS_DOT,
  STATUS_LABELS as INITIATIVE_STATUS_LABELS,
} from "@/components/detail/initiative-labels";
import type { DependencyListRow, DependencyType } from "@/server/views/dependencies-list";

interface Props {
  row: DependencyListRow;
  selected: boolean | null;
  onToggleSelect?: ((id: string) => void) | undefined;
  compact: boolean;
}

const TYPE_BADGE: Record<DependencyType, string> = {
  blocks: "bg-red-50 text-red-700 border-red-200",
  depends_on: "bg-amber-50 text-amber-700 border-amber-200",
  relates_to: "bg-muted text-muted-foreground border-border",
};

const TYPE_DOT: Record<DependencyType, string> = {
  blocks: "bg-red-500",
  depends_on: "bg-amber-500",
  relates_to: "bg-muted-foreground/40",
};

const TYPE_LABEL: Record<DependencyType, string> = {
  blocks: "blockiert",
  depends_on: "hängt ab von",
  relates_to: "bezieht sich auf",
};

/**
 * One rich row of the dependencies list. Replaces the per-from-feature
 * adjacency block of the old page with a single horizontal row carrying
 * both endpoints, the type pill, the to-status pill, governance badges
 * (cross-ART, critical-path) and a day counter.
 */
export function DependencyListRowComponent({ row, selected, onToggleSelect, compact }: Props) {
  return (
    <tr className="border-b align-middle hover:bg-muted/40">
      {selected !== null && (
        <td className="py-2 pl-3 pr-2 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(row.id)}
            className="size-4 rounded border-border"
            aria-label="Dependency auswählen"
          />
        </td>
      )}

      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 shrink-0 rounded-full ${TYPE_DOT[row.type]}`}
            title={TYPE_LABEL[row.type]}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <FromToEndpoints row={row} compact={compact} />
          </div>
          <RowBadges row={row} />
        </div>
      </td>

      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${TYPE_BADGE[row.type]}`}
        >
          {TYPE_LABEL[row.type]}
        </span>
      </td>

      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${INITIATIVE_STATUS_DOT[row.to.status] ?? "bg-muted-foreground/40"}`}
          />
          <span className="text-muted-foreground">
            {INITIATIVE_STATUS_LABELS[row.to.status] ?? row.to.status}
          </span>
        </span>
      </td>

      {!compact && (
        <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
          {row.daysOpen}d
        </td>
      )}
    </tr>
  );
}

function FromToEndpoints({ row, compact }: { row: DependencyListRow; compact: boolean }) {
  return (
    <div className={compact ? "space-y-0.5" : "flex flex-wrap items-center gap-2"}>
      <EndpointLink
        id={row.from.id}
        title={row.from.title}
        artName={row.from.artName}
        inPi={row.from.inPi}
      />
      <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <EndpointLink
        id={row.to.id}
        title={row.to.title}
        artName={row.to.artName}
        inPi={row.to.inPi}
      />
    </div>
  );
}

function EndpointLink({
  id,
  title,
  artName,
  inPi,
}: {
  id: string;
  title: string;
  artName: string | null;
  inPi: boolean;
}) {
  if (!id) {
    return <span className="text-xs text-muted-foreground/60">{title}</span>;
  }
  return (
    <span className="inline-flex max-w-[180px] items-center gap-1.5">
      {inPi && (
        <span className="rounded bg-blue-100 px-1 text-[9px] font-medium text-blue-700">PI</span>
      )}
      <Link
        href={`/feature/${id}`}
        className="block truncate text-sm font-medium text-primary hover:underline"
        title={title}
      >
        {title}
      </Link>
      {artName && (
        <span className="text-[10px] text-muted-foreground" title={artName}>
          · {artName}
        </span>
      )}
    </span>
  );
}

function RowBadges({ row }: { row: DependencyListRow }) {
  if (!row.isCrossArt && !row.isCriticalPath) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {row.isCriticalPath && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-red-100 text-red-700"
          title="Kritischer Pfad (blockiert ein Feature im aktiven PI)"
        >
          <ShieldAlert className="size-3" />
        </span>
      )}
      {row.isCrossArt && (
        <span
          className="inline-flex size-5 items-center justify-center rounded bg-indigo-100 text-indigo-700"
          title="Cross-ART"
        >
          <Network className="size-3" />
        </span>
      )}
    </span>
  );
}
