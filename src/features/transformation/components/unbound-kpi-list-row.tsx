"use client";

import { Link2Off } from "lucide-react";
import type { KpiEditorData } from "@/server/views/transformation-goals";

interface Props {
  kpi: KpiEditorData;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One unbound KPI in the "Ohne Ziel" group at the bottom of the list. Same
 * scan-line as the goal rows but with a small unlink icon to make the
 * unbound status visible at a glance. Clicking opens the KPI editor in the
 * right pane with an "Einem Ziel zuordnen" picker pre-rendered.
 */
export function UnboundKpiListRow({ kpi, selected, onSelect }: Props) {
  const unit = kpi.metricUnit ?? "";
  return (
    <button
      type="button"
      onClick={() => onSelect(kpi.id)}
      className={`flex w-full items-start gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <Link2Off className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{kpi.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {kpi.current ?? "—"} / {kpi.target} {unit}
        </p>
      </div>
    </button>
  );
}
