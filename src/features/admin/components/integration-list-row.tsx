"use client";

import type { IntegrationListItem, IntegrationKind } from "@/server/views/admin-integrations";

interface Props {
  item: IntegrationListItem;
  selected: boolean;
  onSelect: (kind: IntegrationKind) => void;
}

/**
 * Compact row for one integration. Square icon (initial) + name + subtitle +
 * connection pill + mapping-count badge. Matches the visual rhythm of the
 * goals + users list rows so the admin surfaces feel like one product.
 */
export function IntegrationListRow({ item, selected, onSelect }: Props) {
  const bg = item.kind === "jira" ? "bg-blue-600" : "bg-blue-800";
  const initial = item.kind === "jira" ? "J" : "A";
  return (
    <button
      type="button"
      onClick={() => onSelect(item.kind)}
      className={`group w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded text-sm font-bold text-white ${bg}`}
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
            item.connected ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}
        >
          {item.connected ? "verbunden" : "getrennt"}
        </span>
      </div>
      {item.connected && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {item.mappingCount === 0
            ? "Keine Mappings"
            : `${item.mappingCount} Mapping${item.mappingCount === 1 ? "" : "s"}`}
        </p>
      )}
    </button>
  );
}
