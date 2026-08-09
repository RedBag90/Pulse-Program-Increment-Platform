"use client";

import { Network } from "lucide-react";
import { StructureListRow } from "@/features/structure/components/structure-list-row";
import type { StructureRow, NodeKind } from "@/modules/core/org/server/views/structure-page";
import type { Selection } from "@/features/structure/components/structure-selection";

interface Props {
  rows: StructureRow[];
  selection: Selection;
  onSelect: (kind: NodeKind, id: string) => void;
}

/**
 * Left column: the tree-flat list. Each row is depth-indented; clicking
 * selects it (the shell pushes `?selected=`). Empty state nudges toward
 * adding a Value Stream first.
 */
export function StructureList({ rows, selection, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Network className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Noch keine Struktur — Filter prüfen oder Wertstrom anlegen.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={`${row.kind}_${row.id}`}>
          <StructureListRow
            row={row}
            selected={selection.kind === row.kind && "id" in selection && selection.id === row.id}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
