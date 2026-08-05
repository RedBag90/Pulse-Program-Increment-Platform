import type { GoalNode } from "@/server/views/ziele-view";
import type { RollupTrio } from "@/domain/goals-rollup";
import { Stat, StatStrip } from "@/components/ui/stat";
import { goalStatusTier, type GoalStatusTier } from "@/domain/goal-status";
import { formatEURPrefix } from "@/lib/formatting";

const TIER_BAR: Record<GoalStatusTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  neutral: "bg-slate-400",
};
const TIER_TEXT: Record<GoalStatusTier, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
};
/** Text-Legende je Tier (WCAG: Status nicht allein über Farbe vermitteln). */
const TIER_LABEL: Record<GoalStatusTier, string> = {
  green: "On track",
  amber: "At risk",
  rose: "Off track",
  neutral: "Ohne Status",
};
/** Reihenfolge im Verteilungs-Balken (on-track → at-risk → off-track → neutral). */
const TIER_ORDER: GoalStatusTier[] = ["green", "amber", "rose", "neutral"];

/**
 * Der „At-a-glance"-Gesundheits-Layer über dem Ziel-Baum: Ø-Fortschritt der
 * Top-Level-Themes, ihre Status-Verteilung und der €-Rollup (Planned/Realized/
 * Run-Rate) — rein aus den bereits geladenen `themes`/`tenantTrio`.
 */
export function GoalHealthStrip({
  themes,
  tenantTrio,
  showMoney = true,
}: {
  themes: GoalNode[];
  tenantTrio: RollupTrio;
  /** €-Rollup stammt aus Epic-KPIs (Portfolio) — im Free-Tenant ausgeblendet. */
  showMoney?: boolean;
}) {
  const withProgress = themes.filter((t) => t.progress != null);
  const avg =
    withProgress.length > 0
      ? withProgress.reduce((s, t) => s + (t.progress ?? 0), 0) / withProgress.length
      : null;
  const pct = avg != null ? Math.round(avg * 100) : null;

  const counts: Record<GoalStatusTier, number> = { green: 0, amber: 0, rose: 0, neutral: 0 };
  for (const t of themes) counts[goalStatusTier(t.status)] += 1;
  const total = themes.length || 1;

  return (
    <StatStrip>
      {/* Ø Fortschritt */}
      <div className="min-w-0 flex-1 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Ø Fortschritt
        </p>
        <p className="mt-1.5 font-mono text-2xl font-light leading-none tabular-nums">
          {pct != null ? `${pct} %` : "—"}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${pct ?? 0}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/* Status-Verteilung */}
      <div className="min-w-0 flex-1 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Status
        </p>
        <div className="mt-1.5 flex h-5 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] font-medium tabular-nums">
          {TIER_ORDER.map((tier) =>
            counts[tier] > 0 ? (
              <span key={tier} className={`inline-flex items-baseline gap-1 ${TIER_TEXT[tier]}`}>
                <span className="font-mono">{counts[tier]}</span>
                <span className="text-[11px] font-normal">{TIER_LABEL[tier]}</span>
              </span>
            ) : null,
          )}
          {themes.length === 0 && <span className="text-muted-foreground">—</span>}
        </div>
        <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-muted">
          {TIER_ORDER.map((tier) =>
            counts[tier] > 0 ? (
              <div
                key={tier}
                className={`h-full ${TIER_BAR[tier]}`}
                style={{ width: `${(counts[tier] / total) * 100}%` }}
                aria-hidden
              />
            ) : null,
          )}
        </div>
      </div>

      {showMoney && (
        <>
          <Stat label="Planned" value={formatEURPrefix(tenantTrio.planned)} />
          <Stat label="Realized" value={formatEURPrefix(tenantTrio.realized)} />
          <Stat label="Run-Rate" value={formatEURPrefix(tenantTrio.runRate)} />
        </>
      )}
    </StatStrip>
  );
}
