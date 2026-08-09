"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { goalDetailHref } from "@/features/ziele/lib/goal-href";
import { goalNodeProgress, goalNodeTimeframe } from "@/features/ziele/lib/goal-node-view";
import { flattenGoalTree } from "@/modules/core/goals/domain/goal-tree-filter";
import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import { goalTimeframeLabel, currentGoalPeriod } from "@/modules/core/goals/domain/goal-period";
import type { GoalTimeframe } from "@/modules/core/goals/domain/goal-period";
import { goalStatusTier, goalStatusColor, goalStatusLabel } from "@/modules/core/goals/domain/goal-status";
import type { GoalStatusTier } from "@/modules/core/goals/domain/goal-status";

/**
 * Roadmap / Zeitachse — Ziele als Balken über einer Quartals-Achse. Position &
 * Breite folgen dem **Umsetzungszeitraum**: Bucket (Quartal/Halbjahr/Ganzjahr)
 * oder individueller Start–Ende-Bereich (auf Monatsgenauigkeit platziert).
 * Gruppiert in **Theme-Lanes** (Top-Level-Ziel + Unterziele darunter). Farbe =
 * Status, „heute"-Linie. Rein lesend — Klick öffnet das Ziel im Drawer.
 */

const TIER_BAR: Record<GoalStatusTier, string> = {
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground border-border",
};

type FlatRow = { node: GoalNode; depth: number };

/** Monate seit Jahresbeginn `minYear` (Tages-gebrochen) — gemeinsame Achse. */
function monthsFrom(minYear: number, d: Date): number {
  return (d.getUTCFullYear() - minYear) * 12 + d.getUTCMonth() + (d.getUTCDate() - 1) / 30;
}

/** Balken-Position (links/breite in %) aus dem Umsetzungszeitraum. */
function placeTimeframe(
  tf: GoalTimeframe,
  minYear: number,
  totalQ: number,
): { left: number; width: number } {
  const totalMonths = totalQ * 3;
  const left = Math.max(0, (monthsFrom(minYear, tf.start) / totalMonths) * 100);
  const right = Math.min(100, (monthsFrom(minYear, tf.end) / totalMonths) * 100);
  return { left, width: Math.max(1.5, right - left) };
}

/** Kurz-Tag im Balken: „Q3"/„H1"/„FY" (Bucket) oder leer (individueller Bereich). */
function shortTag(tf: GoalTimeframe): string {
  if (tf.kind === "range") return "";
  return tf.key.includes("-") ? (tf.key.split("-")[1] ?? "") : "FY";
}

const LABEL_W = 220;

export function StrategyRoadmapView({ themes }: { themes: GoalNode[] }) {
  const sp = useSearchParams();
  const { minYear, totalQ, todayFrac } = useMemo(() => {
    const years: number[] = [];
    const collect = (nodes: GoalNode[]): void => {
      for (const n of nodes) {
        const tf = goalNodeTimeframe(n);
        if (tf) {
          years.push(tf.start.getUTCFullYear(), new Date(tf.end.getTime() - 1).getUTCFullYear());
        }
        collect(n.children);
      }
    };
    collect(themes);
    const cur = currentGoalPeriod().year;
    const minY = Math.min(cur, ...(years.length ? years : [cur]));
    const maxY = Math.max(cur, ...(years.length ? years : [cur]));
    const total = (maxY - minY + 1) * 4;
    const now = new Date();
    const tGlobalQ = (now.getFullYear() - minY) * 4 + Math.floor(now.getMonth() / 3);
    const within = ((now.getMonth() % 3) + now.getDate() / 30) / 3;
    const frac = Math.max(0, Math.min(1, (tGlobalQ + within) / total));
    return { minYear: minY, totalQ: total, todayFrac: frac };
  }, [themes]);

  if (themes.length === 0) {
    return (
      <div className="grid h-56 place-items-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        Noch keine Ziele im Scope.
      </div>
    );
  }

  const seg = `${100 / totalQ}%`;
  const gridBg = `repeating-linear-gradient(to right, transparent 0, transparent calc(${seg} - 1px), var(--border) calc(${seg} - 1px), var(--border) ${seg})`;
  const cols = Array.from({ length: totalQ }, (_, i) => ({
    year: minYear + Math.floor(i / 4),
    q: (i % 4) + 1,
  }));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-3 shadow-sm">
      <div className="relative" style={{ minWidth: LABEL_W + totalQ * 68 }}>
        {/* Kopf: Quartals-Spalten */}
        <div className="flex items-end pb-1.5">
          <div style={{ width: LABEL_W }} className="flex-none" />
          <div
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${totalQ}, minmax(0, 1fr))` }}
          >
            {cols.map((c, i) => (
              <div
                key={i}
                className="border-l pl-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Q{c.q}
                <span className="ml-1 text-muted-foreground/70">’{String(c.year).slice(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* „heute"-Linie über alle Zeilen */}
        {todayFrac > 0 && todayFrac < 1 && (
          <div
            className="pointer-events-none absolute bottom-0 top-6 z-[3] w-px bg-primary"
            style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayFrac})` }}
          >
            <span className="absolute -top-0.5 left-1 text-[9px] font-bold uppercase tracking-wide text-primary">
              heute
            </span>
          </div>
        )}

        {/* Lanes je Top-Level-Theme */}
        {themes.map((theme, ti) => {
          const rows: FlatRow[] = flattenGoalTree([theme]);
          return (
            <div key={theme.id} className={cn(ti > 0 && "mt-1 border-t pt-1")}>
              {rows.map(({ node, depth }) => {
                const tf = goalNodeTimeframe(node);
                const pl = tf ? placeTimeframe(tf, minYear, totalQ) : null;
                const tier = goalStatusTier(node.status);
                const pct = Math.round(goalNodeProgress(node) * 100);
                return (
                  <Link
                    key={node.id}
                    href={goalDetailHref(sp, node.id) as never}
                    scroll={false}
                    className="flex min-h-[34px] items-center rounded-md hover:bg-muted/40"
                  >
                    <div
                      style={{ width: LABEL_W, paddingLeft: 8 + depth * 16 }}
                      className={cn(
                        "flex-none truncate pr-3 text-[13px]",
                        depth === 0 ? "font-medium" : "text-foreground",
                      )}
                    >
                      {depth > 0 && <span className="text-muted-foreground">↳ </span>}
                      {node.title}
                    </div>
                    <div className="relative h-[34px] flex-1" style={{ backgroundImage: gridBg }}>
                      {pl && tf ? (
                        <div
                          title={`${node.title} · ${goalStatusLabel(node.status)} · ${goalTimeframeLabel(tf)}`}
                          className={cn(
                            "absolute top-[5px] flex h-6 items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-[11px] font-medium shadow-xs",
                            TIER_BAR[tier],
                          )}
                          style={{ left: `${pl.left}%`, width: `${pl.width}%` }}
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: goalStatusColor(node.status) }}
                          />
                          {shortTag(tf)}
                          <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums opacity-80">
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60">
                          ohne Zeitraum
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
