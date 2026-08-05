"use client";

import { useMemo, useRef, useState, startTransition, useActionState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Pencil,
  Plus,
  ChevronsDownUp,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalNode } from "@/server/views/ziele-view";
import { isAtRisk, keyResultProgress, type RollupTrio } from "@/domain/goals-rollup";
import { goalPeriodLabel } from "@/domain/goal-period";
import { filterGoalBranches } from "@/domain/goal-tree-filter";
import { reparentGoalNodeAction } from "@/features/ziele/actions/ziele";
import { HEAD_GOAL_ACCENT } from "@/features/ziele/lib/goal-accent";
import { GoalStatusPill } from "@/features/ziele/components/goal-status/goal-status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";

/** Drag-to-Reparent-Kontext, durch NodeRows → Row gereicht. */
interface DragCtx {
  canEdit: boolean;
  onStart: (node: GoalNode) => void;
  onDropOn: (target: GoalNode | null) => void;
  isValidTarget: (targetId: string) => boolean;
  overId: string | null;
  setOver: (id: string | null) => void;
}

/** Collapse-Kontext für den ein-/ausklappbaren Baum. */
interface TreeCtx {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  userLabels: Record<string, string>;
}

/** Enthält der Subtree von `n` die id `id`? (Client-Zyklus-Guard.) */
function subtreeHas(n: GoalNode, id: string): boolean {
  if (n.id === id) return true;
  return n.children.some((c) => subtreeHas(c, id));
}

/** Alle Knoten-Ids mit Kindern (Kandidaten fürs Einklappen). */
function collectParentIds(nodes: GoalNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children.length > 0) {
      acc.push(n.id);
      collectParentIds(n.children, acc);
    }
  }
  return acc;
}

/** „Off-track" = Drift (Run-Rate < 70 %) oder Status at_risk/off_track. */
function isOffTrack(n: GoalNode): boolean {
  return isAtRisk(n.trio) || n.status === "at_risk" || n.status === "off_track";
}

/** Sortierkriterium der Top-Level-Themes (Geschwister); „manual" = Server-Reihenfolge. */
type SortKey = "manual" | "progress" | "value" | "period" | "title";

/**
 * Strategie als hierarchische Tabelle — Default-Layout im Strategie-Tab.
 * Ein-/ausklappbarer Ziel-Baum: **Name (Held) · Owner · Status · Progress ·
 * Wert · Zeitraum · Aktionen**. Edit-Affordances nur bei `canEdit`.
 */
interface Props {
  themes: GoalNode[];
  canEdit: boolean;
  userLabels?: Record<string, string>;
}

export function StrategyTableView({ themes, canEdit, userLabels = {} }: Props) {
  const dragNode = useRef<GoalNode | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overTop, setOverTop] = useState(false);
  // Auf-/Zuklapp-Zustand überlebt einen Reload (Geräte-Ansichtspräferenz).
  const [collapsedIds, setCollapsedIds] = useLocalStorageState<string[]>("ziele:collapsed", []);
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const [offTrackOnly, setOffTrackOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [, reparentRun] = useActionState(reparentGoalNodeAction, {});

  const allParentIds = useMemo(() => collectParentIds(themes), [themes]);
  const visibleThemes = useMemo(
    () => (offTrackOnly ? filterGoalBranches(themes, isOffTrack) : themes),
    [themes, offTrackOnly],
  );
  // Sortierung betrifft nur die Top-Level-Themes; Kinder behalten ihre Reihenfolge.
  const sortedThemes = useMemo(() => {
    if (sortKey === "manual") return visibleThemes;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...visibleThemes].sort((a, b) => {
      switch (sortKey) {
        case "progress":
          return ((a.progress ?? -1) - (b.progress ?? -1)) * dir;
        case "value":
          return ((a.trio.realized ?? 0) - (b.trio.realized ?? 0)) * dir;
        case "period":
          return (a.period ?? "").localeCompare(b.period ?? "") * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        default:
          return 0;
      }
    });
  }, [visibleThemes, sortKey, sortDir]);
  const filtersActive = sortKey !== "manual" || offTrackOnly;

  const drag: DragCtx = {
    canEdit,
    onStart: (node) => {
      dragNode.current = node;
    },
    isValidTarget: (targetId) => {
      const src = dragNode.current;
      return !!src && src.id !== targetId && !subtreeHas(src, targetId);
    },
    onDropOn: (target) => {
      const src = dragNode.current;
      dragNode.current = null;
      setOverId(null);
      setOverTop(false);
      if (!src) return;
      if (target && (src.id === target.id || subtreeHas(src, target.id))) return;
      const fd = new FormData();
      fd.set("id", src.id);
      fd.set("newParentId", target?.id ?? "");
      startTransition(() => reparentRun(fd));
    },
    overId,
    setOver: setOverId,
  };

  const tree: TreeCtx = {
    collapsed,
    userLabels,
    toggle: (id) =>
      setCollapsedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
  };

  if (themes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">Noch keine Strategie definiert.</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Leg ein Theme (OKR-Statement) an und häng Unterziele dran.
        </p>
        {canEdit && (
          <div className="mt-4 flex justify-center">
            <NewLink entity="theme">+ Theme anlegen</NewLink>
          </div>
        )}
      </div>
    );
  }

  const allCollapsed = allParentIds.length > 0 && collapsed.size >= allParentIds.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border">
            <ToolbarButton
              onClick={() => setCollapsedIds(allParentIds)}
              disabled={allParentIds.length === 0 || allCollapsed}
              title="Alle einklappen"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden />
              Einklappen
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setCollapsedIds([])}
              disabled={collapsed.size === 0}
              title="Alle ausklappen"
              className="border-l"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
              Ausklappen
            </ToolbarButton>
          </div>
          <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
            <span className="text-[11px] font-medium text-muted-foreground">Sortieren</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-transparent text-xs font-medium focus:outline-none"
              aria-label="Sortierkriterium"
            >
              <option value="manual">Manuell</option>
              <option value="progress">Fortschritt</option>
              <option value="value">Wert</option>
              <option value="period">Zeitraum</option>
              <option value="title">Titel</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              disabled={sortKey === "manual"}
              aria-label={sortDir === "asc" ? "Aufsteigend" : "Absteigend"}
              title={sortDir === "asc" ? "Aufsteigend" : "Absteigend"}
              className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {sortDir === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </label>
          <button
            type="button"
            onClick={() => setOffTrackOnly((v) => !v)}
            aria-pressed={offTrackOnly}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              offTrackOnly
                ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            ⚠ Nur off-track
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSortKey("manual");
                setSortDir("desc");
                setOffTrackOnly(false);
              }}
              className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Zurücksetzen
            </button>
          )}
          {offTrackOnly && visibleThemes.length === 0 && (
            <span className="text-[11px] text-muted-foreground">Keine off-track-Ziele.</span>
          )}
        </div>
        {canEdit && <NewLink entity="theme">+ Theme (OKR)</NewLink>}
      </div>
      {canEdit && (
        <p className="text-[11px] text-muted-foreground">
          Klick öffnet den Editor · Zeile ziehen verschiebt das Ziel unter ein anderes.
        </p>
      )}
      {canEdit && (
        <div
          onDragOver={(e) => {
            if (dragNode.current) {
              e.preventDefault();
              setOverTop(true);
            }
          }}
          onDragLeave={() => setOverTop(false)}
          onDrop={(e) => {
            e.preventDefault();
            drag.onDropOn(null);
          }}
          className={cn(
            "rounded-md border border-dashed px-3 py-1.5 text-center text-[11px] text-muted-foreground transition-colors",
            overTop && "border-primary bg-primary/10 text-foreground",
          )}
        >
          ⇧ Hierher ziehen = auf oberste Ebene verschieben
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur">
            <tr>
              <Th>Name</Th>
              <Th className="w-14">Owner</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-44">Progress</Th>
              <Th className="w-32">Wert</Th>
              <Th className="w-20">Zeitraum</Th>
              {canEdit && <Th className="w-20">Aktionen</Th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedThemes.map((t) => (
              <NodeRows key={t.id} node={t} depth={0} canEdit={canEdit} drag={drag} tree={tree} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Rekursive Knoten-Zeilen — jeder Knoten rendert eine `Row`; Kinder folgen
 * rekursiv, es sei denn der Knoten ist eingeklappt.
 */
function NodeRows({
  node,
  depth,
  canEdit,
  drag,
  tree,
}: {
  node: GoalNode;
  depth: number;
  canEdit: boolean;
  drag: DragCtx;
  tree: TreeCtx;
}) {
  // Kompakter Inline-Suffix: nur der Beitrags-Anteil bei Unterzielen (die
  // Hierarchie-Ebene zeigt bereits Theme vs. Unterziel).
  const subtitle =
    depth > 0 && node.rollupWeight != null
      ? `trägt ${Math.round(node.contributionShare * 100)} %`
      : "";
  const progress = node.progress ?? (node.isMeasurable ? keyResultProgress(node) : 0);
  const hasChildren = node.children.length > 0;
  const isCollapsed = tree.collapsed.has(node.id);
  const ownerLabel = node.ownerId ? (tree.userLabels[node.ownerId] ?? null) : null;

  return (
    <>
      <Row
        node={node}
        drag={drag}
        depth={depth}
        title={node.title}
        subtitle={subtitle}
        drift={isAtRisk(node.trio)}
        href={`?entity=goal&id=${node.id}`}
        statusValue={node.status}
        checkinAt={node.latestCheckin?.at ?? null}
        progress={progress}
        trio={node.trio}
        period={node.period}
        canEdit={canEdit}
        ownerLabel={ownerLabel}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        onToggle={() => tree.toggle(node.id)}
        actions={
          canEdit ? (
            <RowActions
              editHref={`/ziele?entity=goal&id=${node.id}`}
              addChildHref={`/ziele?entity=goal&new=1&parent=${node.id}`}
            />
          ) : null
        }
      />
      {hasChildren &&
        !isCollapsed &&
        node.children.map((child) => (
          <NodeRows
            key={child.id}
            node={child}
            depth={depth + 1}
            canEdit={canEdit}
            drag={drag}
            tree={tree}
          />
        ))}
    </>
  );
}

interface RowProps {
  node: GoalNode;
  drag: DragCtx;
  depth: number;
  title: string;
  subtitle: string;
  drift: boolean;
  href: string;
  statusValue: string | null;
  checkinAt: string | null;
  progress: number;
  trio: RollupTrio;
  period: string | null;
  canEdit: boolean;
  ownerLabel: string | null;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  actions: React.ReactNode;
}

function Row({
  node,
  drag,
  depth,
  title,
  subtitle,
  drift,
  href,
  statusValue,
  checkinAt,
  progress,
  trio,
  period,
  canEdit,
  ownerLabel,
  hasChildren,
  isCollapsed,
  onToggle,
  actions,
}: RowProps) {
  const isOver = drag.overId === node.id;
  // Kopf-Ziele (Top-Level-Themes) tragen eine einheitliche hellblaue Schiene links
  // (inset shadow, robust gegen border-collapse) — kein pro-Theme-Regenbogen mehr.
  const isHead = depth === 0;
  return (
    <tr
      className={cn(
        "group align-middle hover:bg-muted/40",
        isOver && "outline outline-2 -outline-offset-2 outline-primary",
      )}
      style={isHead ? { boxShadow: `inset 3px 0 0 0 ${HEAD_GOAL_ACCENT}` } : undefined}
      draggable={drag.canEdit}
      onDragStart={(e) => {
        if (!drag.canEdit) return;
        drag.onStart(node);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (drag.canEdit && drag.isValidTarget(node.id)) {
          e.preventDefault();
          if (!isOver) drag.setOver(node.id);
        }
      }}
      onDragLeave={() => isOver && drag.setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        drag.onDropOn(node);
      }}
    >
      <Td>
        <div className="flex min-w-0 items-center">
          {/* Tiefen-Linien: ein vertikaler Guide je Einrück-Stufe. */}
          {Array.from({ length: depth }).map((_unused, i) => (
            <span
              key={i}
              className="w-[18px] shrink-0 self-stretch border-l border-border/40"
              aria-hidden
            />
          ))}
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Ausklappen" : "Einklappen"}
              className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")}
                aria-hidden
              />
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden />
          )}
          <Link
            href={href as never}
            scroll={false}
            className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
          >
            <span className="truncate text-sm font-medium">{title}</span>
            {drift && (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                title="Run-Rate < 70 % vom Planned"
              >
                ⚠
              </span>
            )}
            {depth === 0 && node.valueStreams.length > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                {node.valueStreams.slice(0, 2).map((v) => (
                  <Badge
                    key={v.id}
                    variant="secondary"
                    className="max-w-[8rem] truncate"
                    title={`Wertstrom: ${v.name}`}
                  >
                    {v.name}
                  </Badge>
                ))}
                {node.valueStreams.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{node.valueStreams.length - 2}
                  </span>
                )}
              </span>
            )}
            {subtitle && (
              <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                {subtitle}
              </span>
            )}
          </Link>
        </div>
      </Td>
      <Td>
        <OwnerAvatar label={ownerLabel} head={isHead} />
      </Td>
      <Td>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <GoalStatusPill status={statusValue} />
          {checkinAt && (
            <span className="text-[11px] text-muted-foreground">{relativeGoalTime(checkinAt)}</span>
          )}
        </span>
      </Td>
      <Td>
        <ProgressBar value={progress} />
      </Td>
      <Td>
        <TrioBadge trio={trio} />
      </Td>
      <Td className="text-xs text-muted-foreground">{period ? goalPeriodLabel(period) : "—"}</Td>
      {canEdit && <Td>{actions}</Td>}
    </tr>
  );
}

function OwnerAvatar({ label, head }: { label: string | null; head?: boolean }) {
  if (!label) return <span className="text-[11px] text-muted-foreground/50">—</span>;
  const initials = (label.split("@")[0] ?? label).slice(0, 2).toUpperCase();
  return (
    <Avatar size="sm" title={label}>
      <AvatarFallback
        className={cn("text-[10px] font-medium", head && "bg-primary/10 text-primary")}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function RowActions({
  editHref,
  addChildHref,
}: {
  editHref: string;
  addChildHref?: string | null;
}) {
  return (
    // Sichtbar bei Hover ODER Tastatur-Fokus (fokussierbar trotz opacity-0);
    // Trefferflächen ≥32px für Maus/Touch/Tastatur.
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 group-focus-within:opacity-100">
      {addChildHref && (
        <Link
          href={addChildHref as never}
          scroll={false}
          className="inline-flex h-8 items-center gap-1 rounded-md border bg-card px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Unterziel hinzufügen"
          aria-label="Unterziel hinzufügen"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Unterziel
        </Link>
      )}
      <Link
        href={editHref as never}
        scroll={false}
        className="grid size-8 place-items-center rounded-md border bg-card hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Bearbeiten"
        aria-label="Bearbeiten"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function NewLink({ entity, children }: { entity: "theme"; children: React.ReactNode }) {
  return (
    <Link
      href={`/ziele?entity=${entity}&new=1` as never}
      scroll={false}
      className="inline-flex items-center gap-1 rounded-md border border-dashed bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      <Plus className="h-3 w-3" aria-hidden />
      {children}
    </Link>
  );
}

// ── Status + Progress + €-Trio ───────────────────────────────────────

/** Compact relative time ("vor 3 Tagen") for the last check-in. */
function relativeGoalTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diffMs / 86_400_000);
  if (day <= 0) return "heute";
  if (day === 1) return "gestern";
  if (day < 30) return `vor ${day} Tagen`;
  const mon = Math.floor(day / 30);
  return `vor ${mon} Monat${mon === 1 ? "" : "en"}`;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            value >= 0.7
              ? "from-emerald-600 to-emerald-400"
              : value >= 0.3
                ? "from-amber-600 to-amber-400"
                : "from-rose-600 to-rose-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

/** €-Ratio einzeilig realized/planned; Details im Tooltip. */
function TrioBadge({ trio }: { trio: RollupTrio }) {
  if (trio.planned === 0 && trio.realized === 0) {
    return <span className="text-[11px] text-muted-foreground/50">—</span>;
  }
  return (
    <span
      className="whitespace-nowrap font-mono text-[11px] tabular-nums"
      title={`Planned €${eur(trio.planned)} · Realized €${eur(trio.realized)} · Run-Rate €${eur(trio.runRate)}`}
    >
      €{compact(trio.realized)}
      <span className="text-muted-foreground"> / €{compact(trio.planned)}</span>
    </span>
  );
}

function eur(n: number): string {
  return Math.round(n).toLocaleString("de-DE");
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-left font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card",
        className,
      )}
    >
      {children}
    </button>
  );
}
