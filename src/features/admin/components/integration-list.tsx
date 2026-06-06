"use client";

import { IntegrationListRow } from "@/features/admin/components/integration-list-row";
import type { IntegrationListItem, IntegrationKind } from "@/server/views/admin-integrations";
import type { Selection } from "@/features/admin/components/integrations-selection";

interface Props {
  items: IntegrationListItem[];
  selection: Selection;
  onSelect: (kind: IntegrationKind) => void;
}

/**
 * Left column of the integrations page — renders the (currently two) row
 * items. Mirrors `user-list.tsx`; kept distinct because the row shape and
 * empty-state copy differ.
 */
export function IntegrationList({ items, selection, onSelect }: Props) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.kind}>
          <IntegrationListRow
            item={item}
            selected={selection.kind === "integration" && selection.integration === item.kind}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
