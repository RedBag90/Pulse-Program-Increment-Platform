import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

function eur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${Math.round(n)} €`;
}

/**
 * Per-Value-Stream breakdown of allocations — used in the Hero variant where
 * a single funding stat doesn't carry enough signal. Bar width relative to
 * the largest VS so the ranking is read-at-a-glance.
 */
export function FundingSnapshotTable({ data }: { data: PortfolioOverview }) {
  if (data.budgets.length === 0) {
    return (
      <Card className="space-y-2 p-4">
        <SectionLabel>Funding-Snapshot</SectionLabel>
        <p className="text-sm text-muted-foreground">
          Noch keine Budgets verteilt.{" "}
          <Link href="/controlling/budgeting" className="text-primary hover:underline">
            Budgeting öffnen →
          </Link>
        </p>
      </Card>
    );
  }

  const max = Math.max(...data.budgets.map((b) => b.total), 1);
  const ranked = [...data.budgets].sort((a, b) => b.total - a.total);

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Funding-Snapshot</SectionLabel>
      <ul className="space-y-2">
        {ranked.map((b) => {
          const widthPct = (b.total / max) * 100;
          return (
            <li key={b.valueStreamId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium">{b.name}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {eur(b.total)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
