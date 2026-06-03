import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import {
  STAGE_GATES,
  STAGE_GATE_LABEL,
  type PortfolioOverview,
} from "@/server/services/portfolio-overview";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Flow & Pipeline block — surfaces the oldest card per stage gate as a slow-
 * down signal, and a coarse Funnel→Done conversion ratio over the last 90 days
 * as a single-number throughput proxy.
 */
export function FlowPipelineBlock({ data }: { data: PortfolioOverview }) {
  const gatesWithOldest = STAGE_GATES.filter((g) => data.oldestPerGate[g] !== null);
  const barFilled = Math.max(0, Math.min(10, Math.round(data.funnelConversion * 10)));

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Flow &amp; Pipeline</SectionLabel>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Älteste Karte je Stage
        </p>
        {gatesWithOldest.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Karten im Funnel.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {gatesWithOldest.map((g) => {
              const oldest = data.oldestPerGate[g]!;
              return (
                <li key={g} className="flex items-baseline justify-between gap-3">
                  <span className="truncate">
                    <span className="text-muted-foreground">{STAGE_GATE_LABEL[g]}: </span>
                    <Link
                      href={`/portfolio/epics/${oldest.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {oldest.title}
                    </Link>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {oldest.daysSinceUpdate}d
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Conversion Funnel → Done (90 Tage)
        </p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-3 rounded-sm ${i < barFilled ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <span className="font-mono text-xs tabular-nums">{pct(data.funnelConversion)}</span>
        </div>
      </div>
    </Card>
  );
}
