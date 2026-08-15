"use client";

import { useUrlState } from "@/lib/hooks/use-url-state";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import { ROAM_DOT, ROAM_LABELS, ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import { BAND_BADGE, BAND_LABEL, CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";
import { buildIssueTree, type TreeNode } from "@/modules/risks/domain/issue-tree";
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
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        Keine Issues für diese Filter.
      </div>
    );
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
            <TreeRows key={node.row.id} node={node} cols={[]} compact={compact} dnd={dnd} />
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
}: {
  node: TreeNode<IssueListRow>;
  cols: boolean[];
  compact: boolean;
  dnd: IssueTreeDnd | null;
}) {
  return (
    <>
      <Row row={node.row} cols={cols} hasChildren={node.children.length > 0} compact={compact} dnd={dnd} />
      {node.children.map((child, idx) => (
        <TreeRows
          key={child.row.id}
          node={child}
          cols={[...cols, idx < node.children.length - 1]}
          compact={compact}
          dnd={dnd}
        />
      ))}
    </>
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
}: {
  row: IssueListRow;
  cols: boolean[];
  hasChildren: boolean;
  compact: boolean;
  dnd: IssueTreeDnd | null;
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
      onClick={openDrawer}
      className={`${TREE_ROW} cursor-pointer ${dropInsideRing(!!drop?.isOver)} ${
        row.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""
      }`}
      style={{ boxShadow: rowShadow({ head: depth === 0 }) }}
    >
      <td className={TREE_TD}>
        <span className="flex min-w-0 items-center">
          {depth > 0 && (
            <span className="whitespace-pre font-mono text-xs text-muted-foreground/70">
              {connectorPrefix(cols)}
            </span>
          )}
          <span className="truncate text-sm font-medium">{row.title}</span>
          {row.displayNumber && (
            <span className="ml-1.5 shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {row.displayNumber}
            </span>
          )}
          {hasChildren && <RollupBadges row={row} />}
        </span>
      </td>
      <td className={TREE_TD}>
        {row.band ? (
          <span className={`rounded px-1.5 py-0.5 text-xs ${BAND_BADGE[row.band as ExposureBand]}`}>
            {BAND_LABEL[row.band as ExposureBand]}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">unbewertet</span>
        )}
      </td>
      <td className={TREE_TD}>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`size-2 rounded-full ${ROAM_DOT[row.roamStatus as RoamStatus]}`} />
          {ROAM_LABELS[row.roamStatus as RoamStatus] ?? row.roamStatus}
        </span>
      </td>
      {!compact && (
        <td className={`${TREE_TD} text-muted-foreground`}>
          {row.category ? CATEGORY_LABELS[row.category as RiskCategory] : "—"}
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
          {due}
        </td>
      )}
    </tr>
  );
}
