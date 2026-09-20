"use client";

import { useState } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import { ROAM_DOT, ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import { ExposureBadge, RoamBadge } from "@/modules/risks/features/lib/issue-badges";
import { CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";
import { buildIssueTree, type TreeNode } from "@/modules/risks/domain/issue-tree";
import { EmptyState } from "@/components/ui/empty-state";
import { TableGroupRow, TableMoreRow } from "@/components/ui/table-group-row";
import { groupIssues, type IssueGroupAxis } from "@/modules/risks/domain/issue-grouping";
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
  /** Achse, nach der gebündelt wird. `"flach"` = ein Rumpf, wie bisher. */
  group?: IssueGroupAxis;
  /**
   * Die **aufgeklappten** Heads — `"alle"` öffnet jeden. Voreingestellt ist die
   * leere Menge: bei 148 Issues trugen zwei Heads 75 Zeilen, und alles stand
   * offen. Zu beginnen halbiert die Liste, ohne eine Zeile zu verstecken: die
   * Zahl der Nachfahren steht am Head.
   */
  expanded?: ReadonlySet<string> | "alle";
  onToggleRow?: (id: string) => void;
}

/**
 * Wie viele **Wurzelzeilen** je Gruppe gerendert werden, bevor „+ n weitere"
 * übernimmt. Dieselbe Zahl wie sonst im Haus (`paginate.ts` `DEFAULT_PAGE_SIZE`,
 * Audit-Log `PAGE_SIZE`). Kinder eines aufgeklappten Heads zählen **nicht** mit:
 * wer ihn öffnet, will ihn ganz sehen.
 */
const ROW_LIMIT = 50;

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Spaltenbreiten. Ohne `table-fixed` + feste Breiten richtet der Browser die
 * Name-Spalte nach ihrem Inhalt aus statt umgekehrt — dann greift das
 * `truncate` am Titel nicht, und die hinteren Spalten werden aus dem
 * `overflow-x-auto`-Container geschoben ("Faellig" faellt raus). Name traegt
 * bewusst keine Breite: sie nimmt den Rest.
 */
function ColGroup({ compact }: { compact: boolean }) {
  return (
    <colgroup>
      <col />
      <col style={{ width: "6rem" }} />
      <col style={{ width: "6.5rem" }} />
      {!compact && <col style={{ width: "7rem" }} />}
      {!compact && <col style={{ width: "10rem" }} />}
      {!compact && <col style={{ width: "12rem" }} />}
      {!compact && <col style={{ width: "6.5rem" }} />}
    </colgroup>
  );
}

export function IssuesListTable({
  rows,
  compact,
  dnd = null,
  group = "flach",
  expanded = EMPTY_SET,
  onToggleRow = () => {},
}: Props) {
  // Wie viele Wurzeln eine Gruppe schon zeigt. Rein eine Anzeigefrage — sie
  // gehört nicht in die URL, anders als Filter, Sortierung oder Gruppierung.
  const [shown, setShown] = useState<Record<string, number>>({});
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(EMPTY_SET);

  if (rows.length === 0) {
    return <EmptyState title="Keine Issues" body="Für diese Filter gibt es keine Issues." />;
  }
  const forest = buildIssueTree(rows);
  const colCount = compact ? 3 : 7;
  const groups =
    group === "flach"
      ? [{ key: "", label: "", items: forest }]
      : groupIssues(forest, group, (n) => n.row);

  return (
    <div className={TREE_CONTAINER}>
      <table
        className={`w-full table-fixed text-sm ${compact ? "min-w-[420px]" : "min-w-[1040px]"}`}
      >
        <ColGroup compact={compact} />
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
        {groups.map((g) => {
          const grouped = group !== "flach";
          const open = !closedGroups.has(g.key);
          const limit = shown[g.key] ?? ROW_LIMIT;
          const sichtbar = open ? g.items.slice(0, limit) : [];
          const rest = g.items.length - sichtbar.length;
          return (
            <tbody key={g.key || "flach"} className="divide-y">
              {grouped && (
                <TableGroupRow
                  label={g.label}
                  count={g.items.length}
                  open={open}
                  colSpan={colCount}
                  onToggle={() =>
                    setClosedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.key)) next.delete(g.key);
                      else next.add(g.key);
                      return next;
                    })
                  }
                />
              )}
              {grouped && open && g.items.length === 0 && (
                <tr className="border-b">
                  <td colSpan={colCount} className="py-2 pl-9 text-meta text-muted-foreground">
                    Keine Issues in dieser Gruppe
                  </td>
                </tr>
              )}
              {sichtbar.map((node) => (
                <TreeRows
                  key={node.row.id}
                  node={node}
                  cols={[]}
                  compact={compact}
                  dnd={dnd}
                  allRows={rows}
                  expanded={expanded}
                  onToggle={onToggleRow}
                />
              ))}
              {open && rest > 0 && (
                <TableMoreRow
                  remaining={rest}
                  colSpan={colCount}
                  indent={grouped ? "pl-9" : "pl-3"}
                  onMore={() => setShown((prev) => ({ ...prev, [g.key]: limit + ROW_LIMIT }))}
                />
              )}
            </tbody>
          );
        })}
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
  expanded,
  onToggle,
}: {
  node: TreeNode<IssueListRow>;
  cols: boolean[];
  compact: boolean;
  dnd: IssueTreeDnd | null;
  allRows: IssueListRow[];
  expanded: ReadonlySet<string> | "alle";
  onToggle: (id: string) => void;
}) {
  const isCollapsed = expanded !== "alle" && !expanded.has(node.row.id);
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
            expanded={expanded}
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
  // **Erst rechnen, wenn jemand hinsieht.** Diese Liste entstand im Rumpf der
  // Komponente — also je Zeile und je Rendervorgang, auch ungeöffnet. Bei 148
  // Zeilen waren das 21.904 Ahnen-Läufe pro Rendervorgang, und es ist der einzige
  // Pfad der Fläche, der quadratisch mit der Zahl der Issues wächst.
  const [open, setOpen] = useState(false);
  const targets = open ? allRows.filter((r) => dnd.canReparentTo(row.id, r.id)) : [];
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={`${row.title} verschieben`}
        className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/row:opacity-100"
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
    <span className="ml-2 inline-flex items-center gap-2 text-meta text-muted-foreground">
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
      className={`group/row ${TREE_ROW} cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset ${dropInsideRing(
        !!drop?.isOver,
      )} ${row.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
      style={{ boxShadow: rowShadow({ head: depth === 0 }) }}
    >
      <td className={`${TREE_TD} relative`}>
        {/* Hier lag bis September 2026 ein 3-px-Streifen in der ROAM-Farbe —
            Farbe ohne Wort, zwei Spalten neben der Pille, die dasselbe mit Wort
            sagt (ADR-0021 §1). Der linke Rand gehört jetzt allein der
            Head-Schiene (`rowShadow`), und die wird dadurch erst lesbar. */}
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
              className="mr-1 shrink-0 rounded-sm px-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {collapsed ? "▸" : "▾"}
            </button>
          )}
          <span className="min-w-0 truncate text-sm font-medium" title={row.title}>
            {row.title}
          </span>
          {row.displayNumber && (
            <span className="ml-1.5 shrink-0 text-meta tabular-nums text-muted-foreground">
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
          {/* Ohne Pille: die Kategorie hat keine Ordnung und trug in allen vier
              Ausprägungen dasselbe Grau — eine Pille, die eine Skala vortäuscht
              und keine ist. */}
          {row.category ? CATEGORY_LABELS[row.category as RiskCategory] : "—"}
        </td>
      )}
      {!compact && (
        <td className={`${TREE_TD} text-muted-foreground`}>
          <span className="block truncate" title={row.ownerLabel ?? undefined}>
            {row.ownerLabel ?? "—"}
          </span>
        </td>
      )}
      {!compact && (
        <td className={`${TREE_TD} text-muted-foreground`}>
          <span className="block truncate" title={row.initiative?.title ?? undefined}>
            {row.initiative?.title ?? "—"}
          </span>
        </td>
      )}
      {!compact && (
        <td
          className={`${TREE_TD} whitespace-nowrap tabular-nums ${
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
