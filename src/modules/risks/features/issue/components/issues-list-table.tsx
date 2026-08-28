"use client";

import { useState } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import {
  ROAM_DOT,
  ROAM_STATUSES,
  normalizeRoamStatus,
  type RoamStatus,
} from "@/modules/core/kernel/domain/roam";
import { ExposureBadge, RoamBadge, CategoryBadge } from "@/modules/risks/features/lib/issue-badges";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";
import { buildIssueTree, type TreeNode } from "@/modules/risks/domain/issue-tree";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { IssueTreeDnd } from "@/modules/risks/features/issue/components/issue-tree-dnd";
import {
  TREE_CONTAINER,
  TREE_THEAD,
  TREE_TH,
  TREE_TD,
  TREE_ROW,
  rowShadow,
  dropInsideRing,
} from "@/modules/risks/features/issue/components/tree-table-style";

interface Props {
  rows: IssueListRow[];
  compact: boolean;
  /** When set, rows are draggable (reparent) + drop targets (become child). */
  dnd?: IssueTreeDnd | null;
}

export function IssuesListTable({ rows, compact, dnd = null }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return <EmptyState title="Keine Issues" body="Für diese Filter gibt es keine Issues." />;
  }
  const forest = buildIssueTree(rows);

  return (
    <div className={TREE_CONTAINER}>
      <table className="w-full text-sm">
        <thead className={TREE_THEAD}>
          <tr>
            <th className={TREE_TH}>Name</th>
            <th className={TREE_TH}>Exposure</th>
            <th className={TREE_TH}>ROAM</th>
            {!compact && <th className={TREE_TH}>Kategorie</th>}
            {!compact && <th className={TREE_TH}>Owner</th>}
            {!compact && <th className={TREE_TH}>Arbeitselement</th>}
            {!compact && <th className={TREE_TH}>Fällig</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {forest.map((node) => (
            <TreeRows
              key={node.row.id}
              node={node}
              cols={[]}
              compact={compact}
              dnd={dnd}
              allRows={rows}
              collapsed={collapsed}
              onToggle={toggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Recursively renders a node + its descendants. `cols` encodes the Explorer
 * connectors: cols[i] (i < len-1) = a vertical line continues in that column;
 * cols[len-1] = this node has more siblings (├ vs └).
 */
function TreeRows({
  node,
  cols,
  compact,
  dnd,
  allRows,
  collapsed,
  onToggle,
}: {
  node: TreeNode<IssueListRow>;
  cols: boolean[];
  compact: boolean;
  dnd: IssueTreeDnd | null;
  allRows: IssueListRow[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isCollapsed = collapsed.has(node.row.id);
  return (
    <>
      <Row
        row={node.row}
        cols={cols}
        hasChildren={node.children.length > 0}
        compact={compact}
        dnd={dnd}
        allRows={allRows}
        collapsed={isCollapsed}
        onToggle={onToggle}
      />
      {!isCollapsed &&
        node.children.map((child, idx) => (
          <TreeRows
            key={child.row.id}
            node={child}
            cols={[...cols, idx < node.children.length - 1]}
            compact={compact}
            dnd={dnd}
            allRows={allRows}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

/**
 * Tastatur-/Maus-Menü als a11y-Alternative zum Reparent-Drag: „Auf oberste
 * Ebene" + „Verschieben unter → …" (zyklus-gefiltert über `canReparentTo`).
 */
function ReparentMenu({
  row,
  allRows,
  dnd,
}: {
  row: IssueListRow;
  allRows: IssueListRow[];
  dnd: IssueTreeDnd;
}) {
  const targets = allRows.filter((r) => dnd.canReparentTo(row.id, r.id));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${row.title} verschieben`}
        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => dnd.reparentTo(row.id, { kind: "root" })}>
          Auf oberste Ebene
        </DropdownMenuItem>
        {targets.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Verschieben unter</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {targets.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => dnd.reparentTo(row.id, { kind: "issue", id: t.id })}
                >
                  {t.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Box-drawing prefix for the Explorer connectors. */
function connectorPrefix(cols: boolean[]): string {
  let s = "";
  for (let i = 0; i < cols.length; i++) {
    const last = i === cols.length - 1;
    if (last) s += cols[i] ? "├─ " : "└─ ";
    else s += cols[i] ? "│  " : "   ";
  }
  return s;
}

function RollupBadges({ row }: { row: IssueListRow }) {
  const r = row.rollup;
  if (!r) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        {ROAM_STATUSES.filter((s) => r.roamCounts[s] > 0).map((s) => (
          <span key={s} className="inline-flex items-center gap-0.5">
            <span className={`size-1.5 rounded-full ${ROAM_DOT[s]}`} />
            {r.roamCounts[s]}
          </span>
        ))}
      </span>
      <span className="uppercase tracking-wider">
        {r.spannedEpics} Epic{r.spannedEpics === 1 ? "" : "s"}
      </span>
      <span>· {r.descendantCount}</span>
    </span>
  );
}

function Row({
  row,
  cols,
  hasChildren,
  compact,
  dnd,
  allRows,
  collapsed,
  onToggle,
}: {
  row: IssueListRow;
  cols: boolean[];
  hasChildren: boolean;
  compact: boolean;
  dnd: IssueTreeDnd | null;
  allRows: IssueListRow[];
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  const { push } = useUrlState();
  const depth = cols.length;
  const due = row.targetResolutionDate ? row.targetResolutionDate.slice(0, 10) : "—";
  const dragProps = dnd ? dnd.dragProps(row.id) : {};
  const drop = dnd ? dnd.dropProps({ kind: "issue", id: row.id }) : null;
  const openDrawer = () => {
    if (dnd?.consumeDidDrag()) return;
    push({ issue: row.id });
  };
  return (
    <tr
      {...dragProps}
      {...(drop
        ? { onDragOver: drop.onDragOver, onDragLeave: drop.onDragLeave, onDrop: drop.onDrop }
        : {})}
      role="button"
      tabIndex={0}
      aria-label={`Issue öffnen: ${row.title}`}
      onClick={openDrawer}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrawer();
        }
      }}
      className={`group/row ${TREE_ROW} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${dropInsideRing(
        !!drop?.isOver,
      )} ${row.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
      style={{ boxShadow: rowShadow({ head: depth === 0 }) }}
    >
      <td className={`${TREE_TD} relative`}>
        {/* Linker Streifen = ROAM-Status (nicht Exposure — die Achsen sind farblich getrennt). */}
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-[3px] ${ROAM_DOT[normalizeRoamStatus(row.roamStatus)]}`}
        />
        <span className="flex min-w-0 items-center">
          {depth > 0 && (
            <span className="whitespace-pre font-mono text-xs text-muted-foreground/70">
              {connectorPrefix(cols)}
            </span>
          )}
          {hasChildren && (
            <button
              type="button"
              aria-label={collapsed ? "Aufklappen" : "Zuklappen"}
              aria-expanded={!collapsed}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(row.id);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="mr-1 shrink-0 rounded px-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {collapsed ? "▸" : "▾"}
            </button>
          )}
          <span className="truncate text-sm font-medium">{row.title}</span>
          {row.displayNumber && (
            <span className="ml-1.5 shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {row.displayNumber}
            </span>
          )}
          {hasChildren && <RollupBadges row={row} />}
          {dnd && (
            <span
              className="ml-auto pl-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <ReparentMenu row={row} allRows={allRows} dnd={dnd} />
            </span>
          )}
        </span>
      </td>
      <td className={TREE_TD}>
        {row.band ? (
          <ExposureBadge band={row.band as ExposureBand} />
        ) : (
          <span className="text-xs text-muted-foreground">unbewertet</span>
        )}
      </td>
      <td className={TREE_TD}>
        <RoamBadge status={row.roamStatus as RoamStatus} />
      </td>
      {!compact && (
        <td className={`${TREE_TD} text-muted-foreground`}>
          {row.category ? <CategoryBadge category={row.category as RiskCategory} /> : "—"}
        </td>
      )}
      {!compact && <td className={`${TREE_TD} text-muted-foreground`}>{row.ownerLabel ?? "—"}</td>}
      {!compact && (
        <td className={`${TREE_TD} text-muted-foreground`}>{row.initiative?.title ?? "—"}</td>
      )}
      {!compact && (
        <td
          className={`${TREE_TD} tabular-nums ${
            row.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
          }`}
        >
          {row.isOverdue && (
            <span title="überfällig" aria-label="überfällig">
              ⚑{" "}
            </span>
          )}
          {due}
        </td>
      )}
    </tr>
  );
}
