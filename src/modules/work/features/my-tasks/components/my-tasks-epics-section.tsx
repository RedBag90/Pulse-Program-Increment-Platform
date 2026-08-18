"use client";

import { EpicsListTable } from "@/modules/work/features/portfolio/components/epics-list-table";
import type { EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";

interface Props {
  rows: EpicListRow[];
  canEdit: boolean;
  stageGatesEnabled: boolean;
  compact: boolean;
}

/**
 * Epic-Sektion auf /my-tasks. Verwendet direkt `<EpicsListTable>`
 * aus `/portfolio/epics` — wenn dort die Row-Logik wächst, zieht sie
 * automatisch hier mit. Read-only Selection (`selectedIds=null`) →
 * Checkbox-Spalte ist ausgeblendet; Bulk-Aktionen bleiben dem
 * `/portfolio/epics`-Surface vorbehalten.
 */
export function MyTasksEpicsSection({
  rows,
  canEdit,
  stageGatesEnabled,
  compact,
}: Props) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Epics
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <EpicsListTable
        rows={rows}
        canEdit={canEdit}
        stageGatesEnabled={stageGatesEnabled}
        group="flat"
        compact={compact}
        selectedIds={null}
        onToggleSelect={null}
        onToggleSelectAll={null}
      />
    </section>
  );
}
