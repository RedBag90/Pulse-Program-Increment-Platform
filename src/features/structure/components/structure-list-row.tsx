"use client";

import { AlertTriangle, Calendar, Network, Users, Zap } from "lucide-react";
import type { StructureRow, NodeKind } from "@/modules/core/org/server/views/structure-page";

interface Props {
  row: StructureRow;
  selected: boolean;
  onSelect: (kind: NodeKind, id: string) => void;
}

const KIND_ICON: Record<NodeKind, React.ComponentType<{ className?: string }>> = {
  vs: Network,
  art: Zap,
  team: Users,
  timeline: Calendar,
};

const KIND_LABEL: Record<NodeKind, string> = {
  vs: "Wertstrom",
  art: "ART",
  team: "Team",
  timeline: "Timeline",
};

/**
 * One tree-flat row — the same compact row shape used elsewhere, plus a
 * depth-indent (`paddingLeft`) and a kind icon. Gap signals fold into the
 * 🛑 badge so the user can spot missing-RTE etc. from the list without
 * opening the detail pane.
 */
export function StructureListRow({ row, selected, onSelect }: Props) {
  const Icon = KIND_ICON[row.kind];
  return (
    <button
      type="button"
      onClick={() => onSelect(row.kind, row.id)}
      className={`group w-full rounded-md border bg-card p-2.5 text-left transition-colors hover:bg-muted/50 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      style={{ paddingLeft: `${0.625 + row.depth * 1}rem` }}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.label}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            <span className="opacity-60">{KIND_LABEL[row.kind]}</span>
            {row.subtitle && ` · ${row.subtitle}`}
          </p>
        </div>
        {row.gaps.length > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
            title={row.gaps.join(", ")}
          >
            <AlertTriangle className="size-3" /> {row.gaps.length}
          </span>
        )}
      </div>
    </button>
  );
}
