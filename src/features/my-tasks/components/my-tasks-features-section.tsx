"use client";

import { FeaturesListTable } from "@/modules/core/org/features/art/components/features-list-table";
import type { FeatureListRow } from "@/server/views/features-list";

interface Props {
  rows: FeatureListRow[];
  canEdit: boolean;
  showWsjf: boolean;
  compact: boolean;
}

/**
 * Feature-Sektion auf /my-tasks. Verwendet direkt `<FeaturesListTable>`
 * aus `/art/[artId]/features` (jetzt `artId` pro Row, statt pro Page).
 * Wie bei der Epic-Sektion: read-only Selection, keine Bulk-PI-Picker
 * — die wandert im Bedarfsfall in einen eigenen PR.
 */
export function MyTasksFeaturesSection({ rows, canEdit, showWsjf, compact }: Props) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Features
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <FeaturesListTable
        rows={rows}
        canEdit={canEdit}
        showWsjf={showWsjf}
        compact={compact}
        group="flat"
        selectedIds={null}
        onToggleSelect={null}
        onToggleSelectAll={null}
      />
    </section>
  );
}
