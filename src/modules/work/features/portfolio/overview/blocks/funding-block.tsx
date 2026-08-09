import { Link } from "@/i18n/navigation";
import { Wallet, ArrowRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  OverviewBudget,
  OverviewFundingPeriod,
  PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";

function eur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${Math.round(n)} €`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Per-Value-Stream colour assignments, applied by rank. Keeps the bar
 * deterministic without a tenant-scoped palette setting. Beyond six VS the
 * bar's "und weitere" segment collects the rest.
 */
const VS_PALETTE = [
  "bg-primary",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-cyan-500",
] as const;

const OVERFLOW_COLOR = "bg-muted-foreground/40";
const FREE_COLOR = "bg-muted";
const OVER_COLOR = "bg-red-500";

/**
 * Funding card on the Portfolio Mission Control — answers "are we within the
 * pool, and where does the money go?" for the current half-year. A stacked
 * horizontal bar carries the per-VS share with a free remainder; a short
 * forward-look strip places the current period in mid-term context.
 *
 * Reads the real pool from `Tenant.budgetPoolByPeriod` via `getBudgetingBoard`
 * — replacing the earlier fallback that always rendered 100 %.
 */
export function FundingBlock({ data }: { data: PortfolioOverview }) {
  const cur = data.funding.currentPeriod;
  const hasCurrentPool = cur !== null && cur.pool > 0;
  const overAllocated = cur !== null && cur.remaining < 0;

  return (
    <Card className="space-y-4 p-4">
      <header className="flex items-center gap-2">
        <Wallet className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Funding</h2>
      </header>

      {!hasCurrentPool ? (
        <EmptyFundingState data={data} />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {cur.label} · Pool {eur(cur.pool)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-medium tabular-nums",
                  overAllocated && "text-destructive",
                )}
              >
                {pct(cur.allocated / cur.pool)} alloziert
              </span>
            </div>

            <StackedFundingBar period={cur} budgets={data.budgets} />

            {overAllocated && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5" />
                {eur(Math.abs(cur.remaining))} über Pool
              </p>
            )}

            <FundingLegend period={cur} budgets={data.budgets} />
          </div>

          {data.funding.upcomingPeriods.length > 0 && (
            <UpcomingPeriodsStrip periods={data.funding.upcomingPeriods} />
          )}
        </>
      )}

      <Link
        href="/controlling/budgeting"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Participatory Budget <ArrowRight className="size-3" />
      </Link>
    </Card>
  );
}

function EmptyFundingState({ data }: { data: PortfolioOverview }) {
  // Distinguish "no pool yet" from "no budgets at all" — the user's next click
  // differs (set a pool vs. allocate to a VS).
  if (data.budgets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Budgets verteilt.{" "}
        <Link href="/controlling/budgeting" className="text-primary hover:underline">
          Budgeting öffnen →
        </Link>
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Für {data.funding.currentPeriodKey} ist noch kein Pool gesetzt.{" "}
      <Link href="/controlling/budgeting" className="text-primary hover:underline">
        Pool eintragen →
      </Link>
    </p>
  );
}

/** Ranks VS by current-period allocation desc and groups the long tail. */
function rankBudgets(budgets: OverviewBudget[], limit = VS_PALETTE.length) {
  const eligible = budgets.filter((b) => b.currentPeriod > 0);
  const sorted = [...eligible].sort((a, b) => b.currentPeriod - a.currentPeriod);
  if (sorted.length <= limit) return { top: sorted, overflow: 0 };
  const top = sorted.slice(0, limit);
  const overflow = sorted.slice(limit).reduce((s, b) => s + b.currentPeriod, 0);
  return { top, overflow };
}

function StackedFundingBar({
  period,
  budgets,
}: {
  period: OverviewFundingPeriod;
  budgets: OverviewBudget[];
}) {
  const denom = Math.max(period.pool, period.allocated, 1);
  const { top, overflow } = rankBudgets(budgets);
  const segments: { label: string; amount: number; color: string }[] = top.map((b, i) => ({
    label: b.name,
    amount: b.currentPeriod,
    color: VS_PALETTE[i] ?? OVERFLOW_COLOR,
  }));
  if (overflow > 0) {
    segments.push({ label: "weitere Wertströme", amount: overflow, color: OVERFLOW_COLOR });
  }

  const allocatedPart = Math.min(period.allocated, period.pool);
  const overPart = Math.max(0, period.allocated - period.pool);
  const freePart = Math.max(0, period.pool - period.allocated);

  return (
    <div
      className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${eur(period.allocated)} von ${eur(period.pool)} alloziert`}
    >
      {/* Allocated segments — each VS its own colour band. */}
      {segments.map((s, i) => {
        // Scale the segment to its share of the *allocated* part so the visible
        // segments add up to `allocatedPart / denom` of the bar.
        const widthPct =
          period.allocated === 0
            ? 0
            : (s.amount / period.allocated) * (allocatedPart / denom) * 100;
        if (widthPct <= 0) return null;
        return (
          <span
            key={i}
            className={s.color}
            style={{ width: `${widthPct}%` }}
            title={`${s.label}: ${eur(s.amount)}`}
          />
        );
      })}
      {/* Over-allocation band (red) — visible only when allocated > pool. */}
      {overPart > 0 && (
        <span
          className={OVER_COLOR}
          style={{ width: `${(overPart / denom) * 100}%` }}
          title={`Über Pool: ${eur(overPart)}`}
        />
      )}
      {/* Free remainder. */}
      {freePart > 0 && (
        <span
          className={FREE_COLOR}
          style={{ width: `${(freePart / denom) * 100}%` }}
          title={`Frei: ${eur(freePart)}`}
        />
      )}
    </div>
  );
}

function FundingLegend({
  period,
  budgets,
}: {
  period: OverviewFundingPeriod;
  budgets: OverviewBudget[];
}) {
  const { top, overflow } = rankBudgets(budgets);
  const freePart = Math.max(0, period.pool - period.allocated);

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
      {top.map((b, i) => (
        <li key={b.valueStreamId} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-sm", VS_PALETTE[i] ?? OVERFLOW_COLOR)} />
          <span className="truncate">
            {b.name} <span className="font-mono tabular-nums">{eur(b.currentPeriod)}</span>
          </span>
        </li>
      ))}
      {overflow > 0 && (
        <li className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-sm", OVERFLOW_COLOR)} />
          <span>
            weitere <span className="font-mono tabular-nums">{eur(overflow)}</span>
          </span>
        </li>
      )}
      {freePart > 0 && (
        <li className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-sm", FREE_COLOR, "border border-border")} />
          <span>
            Frei <span className="font-mono tabular-nums">{eur(freePart)}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

function UpcomingPeriodsStrip({ periods }: { periods: OverviewFundingPeriod[] }) {
  return (
    <div className="space-y-1.5 border-t pt-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Nächste Halbjahre
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {periods.map((p) => {
          const utilisation = p.pool > 0 ? Math.min(p.allocated / p.pool, 1) : 0;
          const over = p.pool > 0 && p.allocated > p.pool;
          return (
            <li key={p.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-medium">{p.label}</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    p.pool === 0
                      ? "text-muted-foreground/60"
                      : over
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {p.pool === 0 ? "Kein Pool" : pct(utilisation)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={over ? OVER_COLOR : "bg-primary/70"}
                  style={{ width: `${utilisation * 100}%`, height: "100%" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
