"use client";

import { useRef, useState, startTransition, useActionState } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import type { GoalNode, ZieleTreeTheme } from "@/server/views/ziele-view";
import { isAtRisk, keyResultProgress, type RollupTrio } from "@/domain/goals-rollup";
import { goalPeriodLabel } from "@/domain/goal-period";
import { reparentGoalNodeAction } from "@/features/ziele/actions/ziele";
import { GoalStatusPill } from "@/features/ziele/components/goal-status/goal-status-pill";

/** Drag-to-Reparent-Kontext, durch NodeRows → Row gereicht. */
interface DragCtx {
  canEdit: boolean;
  onStart: (node: GoalNode) => void;
  onDropOn: (target: GoalNode | null) => void;
  isValidTarget: (targetId: string) => boolean;
  overId: string | null;
  setOver: (id: string | null) => void;
}

/** Enthält der Subtree von `n` die id `id`? (Client-Zyklus-Guard.) */
function subtreeHas(n: GoalNode, id: string): boolean {
  if (n.id === id) return true;
  return n.children.some((c) => subtreeHas(c, id));
}

/**
 * Strategie als hierarchische Tabelle — Default-Layout im Strategie-Tab.
 *
 * Zwei Ebenen: **Theme** (OKR-Statement) + **Key Results**. Spalten:
 * `# · Name (incl. Narrativ + Confidence + Drift) · Status · Progress ·
 * €-Trio · Time period · Aktionen`. Edit-Affordances erscheinen nur
 * wenn `canEdit=true` (Strategie-Modul); im Ziele-Modul ist die Sicht
 * read-only.
 */
interface Props {
  themes: ZieleTreeTheme[];
  canEdit: boolean;
}

export function StrategyTableView({ themes, canEdit }: Props) {
  const dragNode = useRef<GoalNode | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overTop, setOverTop] = useState(false);
  const [, reparentRun] = useActionState(reparentGoalNodeAction, {});

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

  if (themes.length === 0) {
    return (
      <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10">
        <div className="max-w-md text-center">
          <p className="font-medium">Noch keine Strategie definiert.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Leg ein Theme (OKR-Statement) an und haeng Unterziele dran.
          </p>
          {canEdit && (
            <div className="mt-4 flex justify-center">
              <NewLink entity="theme">+ Theme anlegen</NewLink>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Klick öffnet den Editor · Zeile ziehen verschiebt das Ziel unter ein anderes.
          </p>
          <NewLink entity="theme">+ Theme (OKR)</NewLink>
        </div>
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
          className={`rounded-md border border-dashed px-3 py-1.5 text-center text-[11px] text-muted-foreground transition-colors ${
            overTop ? "border-primary bg-primary/10" : ""
          }`}
        >
          ⇧ Hierher ziehen = auf oberste Ebene verschieben
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th className="w-10">#</Th>
              <Th>Name</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-48">Progress</Th>
              <Th className="w-40">€ Planned / Realized</Th>
              <Th className="w-28">Time period</Th>
              {canEdit && <Th className="w-24">Aktionen</Th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {themes.map((t, ti) => (
              <NodeRows
                key={t.id}
                node={t}
                depth={0}
                index={ti + 1}
                canEdit={canEdit}
                drag={drag}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Rekursive Knoten-Zeilen — ersetzt die alten fixen 2 Ebenen (Theme + KR).
 * Jeder Knoten rendert eine `Row` (mit tiefen-abhängiger Einrückung) und
 * darunter rekursiv seine Kinder. „+"-Affordance je Knoten: ein Unterziel
 * anhängen (Messbarkeit über die Fortschrittsquelle im Drawer).
 */
function NodeRows({
  node,
  depth,
  index,
  canEdit,
  drag,
}: {
  node: GoalNode;
  depth: number;
  index: number;
  canEdit: boolean;
  drag: DragCtx;
}) {
  // Ein Begriff „Ziel"; Top-Level bleibt „Theme (OKR)". Kein O/KR-Split mehr.
  const kindLabel = depth === 0 ? "Theme (OKR)" : "Ziel";
  const subtitle =
    depth > 0 && node.rollupWeight != null
      ? `${kindLabel} · trägt ${Math.round(node.contributionShare * 100)} %`
      : kindLabel;
  const progress = node.progress ?? (node.isMeasurable ? keyResultProgress(node) : 0);
  return (
    <>
      <Row
        node={node}
        drag={drag}
        depth={depth}
        index={index}
        title={node.title}
        subtitle={subtitle}
        narrative={node.narrative}
        confidence={node.confidence}
        drift={isAtRisk(node.trio)}
        href={`?entity=goal&id=${node.id}`}
        statusValue={node.status}
        checkinAt={node.latestCheckin?.at ?? null}
        progress={progress}
        trio={node.trio}
        period={node.period}
        canEdit={canEdit}
        actions={
          canEdit ? (
            <RowActions
              editHref={`/strategy?entity=goal&id=${node.id}`}
              addChildHref={`/strategy?entity=goal&new=1&parent=${node.id}`}
            />
          ) : null
        }
      />
      {node.children.map((child, i) => (
        <NodeRows
          key={child.id}
          node={child}
          depth={depth + 1}
          index={i + 1}
          canEdit={canEdit}
          drag={drag}
        />
      ))}
    </>
  );
}

interface RowProps {
  node: GoalNode;
  drag: DragCtx;
  depth: number;
  index: number;
  title: string;
  subtitle: string;
  narrative: string | null;
  confidence: number | null;
  drift: boolean;
  href: string;
  statusValue: string | null;
  checkinAt: string | null;
  progress: number;
  trio: RollupTrio;
  period: string | null;
  canEdit: boolean;
  actions: React.ReactNode;
}

function Row({
  node,
  drag,
  depth,
  index,
  title,
  subtitle,
  narrative,
  confidence,
  drift,
  href,
  statusValue,
  checkinAt,
  progress,
  trio,
  period,
  canEdit,
  actions,
}: RowProps) {
  const indent = depth * 20 + 8;
  const isOver = drag.overId === node.id;
  return (
    <tr
      className={`group hover:bg-muted/30 ${isOver ? "outline outline-2 -outline-offset-2 outline-primary" : ""}`}
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
      <Td className="text-[10px] text-muted-foreground tabular-nums">{index}</Td>
      <Td>
        <Link
          href={href as never}
          scroll={false}
          className="block hover:underline"
          style={{ paddingLeft: indent }}
        >
          <span className="flex items-center gap-2">
            {depth > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{title}</span>
                {drift && (
                  <span
                    className="shrink-0 rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800"
                    title="Run-Rate < 70 % vom Planned"
                  >
                    ⚠
                  </span>
                )}
                {confidence != null && (
                  <span
                    className="shrink-0 text-[11px] text-muted-foreground"
                    title="Confidence (Fist-of-Five)"
                  >
                    {"★".repeat(confidence)}
                    {"☆".repeat(5 - confidence)}
                  </span>
                )}
              </span>
              <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {subtitle}
              </span>
              {narrative && (
                <span className="block truncate text-[10px] text-muted-foreground/80">
                  {narrative}
                </span>
              )}
            </span>
          </span>
        </Link>
      </Td>
      <Td>
        <span className="flex items-center gap-2">
          <GoalStatusPill status={statusValue} />
          {checkinAt && (
            <span className="text-[10px] text-muted-foreground">{relativeGoalTime(checkinAt)}</span>
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

function RowActions({
  editHref,
  addChildHref,
}: {
  editHref: string;
  addChildHref?: string | null;
}) {
  return (
    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
      {addChildHref && (
        <Link
          href={addChildHref as never}
          scroll={false}
          className="grid h-7 place-items-center rounded-md border bg-card px-1.5 text-[9px] font-semibold text-muted-foreground hover:bg-muted"
          title="Unterziel hinzufügen"
          aria-label="Unterziel hinzufügen"
        >
          ＋Unterziel
        </Link>
      )}
      <Link
        href={editHref as never}
        scroll={false}
        className="grid size-7 place-items-center rounded-md border bg-card hover:bg-muted"
        title="Bearbeiten"
        aria-label="Bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function NewLink({ entity, children }: { entity: "theme"; children: React.ReactNode }) {
  return (
    <Link
      href={`/strategy?entity=${entity}&new=1` as never}
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
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            value >= 0.7 ? "bg-emerald-500/80" : value >= 0.3 ? "bg-amber-500/80" : "bg-rose-500/80"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {pct} %
      </span>
    </div>
  );
}

function TrioBadge({ trio }: { trio: RollupTrio }) {
  if (trio.planned === 0 && trio.realized === 0) {
    return <span className="text-[10px] text-muted-foreground/60">—</span>;
  }
  return (
    <span
      className="inline-block rounded-md border bg-background px-1.5 py-0.5 text-[11px] tabular-nums"
      title={`Planned €${Math.round(trio.planned).toLocaleString("de-DE")} · Realized €${Math.round(trio.realized).toLocaleString("de-DE")} · Run-Rate €${Math.round(trio.runRate).toLocaleString("de-DE")}`}
    >
      €{compact(trio.planned)} / €{compact(trio.realized)}
    </span>
  );
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left ${className ?? ""}`}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
