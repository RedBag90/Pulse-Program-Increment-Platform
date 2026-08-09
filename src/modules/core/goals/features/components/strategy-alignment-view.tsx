"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { goalDetailHref } from "@/modules/core/goals/features/lib/goal-href";
import {
  goalNodeProgress,
  goalNodeTimeframe,
  goalNodeOwner,
  goalInitials,
} from "@/modules/core/goals/features/lib/goal-node-view";
import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import { goalStatusColor } from "@/modules/core/goals/domain/goal-status";
import { goalTimeframeLabel } from "@/modules/core/goals/domain/goal-period";
import { GoalStatusPill } from "@/modules/core/goals/features/components/goal-status/goal-status-pill";

/**
 * Alignment-Karten-Baum — Ziele als Karten mit Fortschritts-Ring, Status-Pill und
 * Owner, ein-/ausklappbar in Eltern-Kind-Struktur (Konnektoren links). Rein lesend
 * — Klick öffnet das Ziel im Drawer.
 */

function Ring({ value, status }: { value: number; status: string | null }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0" aria-hidden>
      <circle cx="17" cy="17" r={r} fill="none" className="stroke-muted" strokeWidth="4" />
      <circle
        cx="17"
        cy="17"
        r={r}
        fill="none"
        stroke={goalStatusColor(status)}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 17 17)"
      />
      <text
        x="17"
        y="20.5"
        textAnchor="middle"
        className="fill-foreground font-mono text-[9px] font-semibold"
      >
        {Math.round(value * 100)}
      </text>
    </svg>
  );
}

function GoalCard({
  node,
  depth,
  userLabels,
  collapsed,
  onToggle,
}: {
  node: GoalNode;
  depth: number;
  userLabels: Record<string, string>;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const kids = node.children;
  const hasKids = kids.length > 0;
  const isOpen = !collapsed.has(node.id);
  const owner = goalNodeOwner(node, userLabels);
  const sp = useSearchParams();
  const tf = goalNodeTimeframe(node);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md",
          depth === 0 && "border-l-4",
        )}
        style={depth === 0 ? { borderLeftColor: goalStatusColor(node.status) } : undefined}
      >
        {hasKids ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Einklappen" : "Ausklappen"}
            className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90")} />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <Ring value={goalNodeProgress(node)} status={node.status} />
        <Link
          href={goalDetailHref(sp, node.id) as never}
          scroll={false}
          className="min-w-0 flex-1 hover:underline"
        >
          <div className="truncate text-sm font-medium">{node.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <GoalStatusPill status={node.status} />
            {tf && <span>{goalTimeframeLabel(tf)}</span>}
            {hasKids && (
              <span>
                · {kids.length} Unterziel{kids.length === 1 ? "" : "e"}
              </span>
            )}
          </div>
        </Link>
        {owner && (
          <span
            title={owner}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
          >
            {goalInitials(owner)}
          </span>
        )}
      </div>

      {hasKids && isOpen && (
        <div className="mt-2.5 ml-[22px] flex flex-col gap-2.5 pl-5">
          {kids.map((k) => (
            <div
              key={k.id}
              className={cn(
                "relative",
                // Vertikaler Stamm (│): überbrückt den gap-2.5 nach oben; durchgehend
                // an mittleren Kindern (├), beim letzten Kind gestoppt am Ellbogen (└).
                "before:absolute before:-left-5 before:-top-2.5 before:w-px before:bg-border before:content-['']",
                "before:h-[calc(100%_+_0.625rem)] last:before:h-[calc(26px_+_0.625rem)]",
                // Horizontaler Ellbogen (─) zur Ring-/Kartenmitte.
                "after:absolute after:-left-5 after:top-[26px] after:h-px after:w-5 after:bg-border after:content-['']",
              )}
            >
              <GoalCard
                node={k}
                depth={depth + 1}
                userLabels={userLabels}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StrategyAlignmentView({
  themes,
  userLabels = {},
}: {
  themes: GoalNode[];
  userLabels?: Record<string, string>;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const onToggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (themes.length === 0) {
    return (
      <div className="grid h-56 place-items-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        Noch keine Ziele im Scope.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {themes.map((t) => (
        <GoalCard
          key={t.id}
          node={t}
          depth={0}
          userLabels={userLabels}
          collapsed={collapsed}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
