"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import { filterGoalBranches } from "@/modules/core/goals/domain/goal-tree-filter";
import {
  buildGoalPickerTree,
  type GoalPickerRow,
  type PickerTreeNode,
} from "@/modules/core/goals/features/lib/goal-picker-tree";
import { Input } from "@/components/ui/input";

/**
 * Einzel-Auswahl eines Ziels als **Baum** (Explorer-Stil: Einrückung + Auf-/
 * Zuklappen + Suche) — ersetzt die flache `<select>`-Liste, wenn viele Ziele
 * existieren. Vertrag bleibt ein `value: string` (goalId, "" = kein Ziel).
 */
export function GoalTreePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const goals = useEntityOptions<GoalPickerRow>(optionsEndpoint("goal"), true);
  const tree = useMemo(() => buildGoalPickerTree(goals.data), [goals.data]);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? filterGoalBranches(tree, (n) => n.name.toLowerCase().includes(q)) : tree),
    [tree, q],
  );
  // Bei aktiver Suche alles aufgeklappt zeigen (Treffer sichtbar machen).
  const effectiveCollapsed = q ? new Set<string>() : collapsed;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedName = useMemo(
    () => goals.data.find((g) => g.id === value)?.name ?? null,
    [goals.data, value],
  );

  return (
    <div className="space-y-1.5">
      <Input
        placeholder="Ziel suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border bg-background p-1">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex w-full items-center rounded px-2 py-1 text-left text-sm hover:bg-muted",
            value === "" && "bg-primary/10 font-medium",
          )}
        >
          Kein Ziel
        </button>
        {goals.loading && <p className="px-2 py-1 text-xs text-muted-foreground">Lade…</p>}
        {goals.error && <p className="px-2 py-1 text-xs text-destructive">{goals.error}</p>}
        {!goals.loading && q && shown.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">Kein Treffer.</p>
        )}
        {shown.map((node) => (
          <PickerRows
            key={node.id}
            node={node}
            depth={0}
            value={value}
            onChange={onChange}
            collapsed={effectiveCollapsed}
            toggle={toggle}
          />
        ))}
      </div>
      {selectedName && (
        <p className="text-[11px] text-muted-foreground">
          Gewählt: <span className="font-medium text-foreground">{selectedName}</span>
        </p>
      )}
    </div>
  );
}

function PickerRows({
  node,
  depth,
  value,
  onChange,
  collapsed,
  toggle,
}: {
  node: PickerTreeNode;
  depth: number;
  value: string;
  onChange: (id: string) => void;
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = !collapsed.has(node.id);
  return (
    <>
      <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Einklappen" : "Ausklappen"}
            className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onChange(node.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted",
            value === node.id && "bg-primary/10 font-medium",
          )}
        >
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {hasChildren &&
        isOpen &&
        node.children.map((c) => (
          <PickerRows
            key={c.id}
            node={c}
            depth={depth + 1}
            value={value}
            onChange={onChange}
            collapsed={collapsed}
            toggle={toggle}
          />
        ))}
    </>
  );
}
