import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import {
  STAGE_GATE_LABEL,
  type PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";

function relativeDays(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

/**
 * Top 5 recently touched epics, sorted by `updatedAt`. Stand-in for a proper
 * AuditEvent stream — fast, but it shows "last touched" rather than the kind
 * of change. Enough to spot momentum.
 */
export function RecentActivityBlock({ data }: { data: PortfolioOverview }) {
  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Recent Activity</SectionLabel>
      {data.recentActivity.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {data.recentActivity.map((e) => {
            const gate =
              STAGE_GATE_LABEL[e.stageGate as keyof typeof STAGE_GATE_LABEL] ?? e.stageGate;
            return (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  <Link
                    href={`/portfolio/epics/${e.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {e.title}
                  </Link>
                  <span className="text-xs text-muted-foreground"> — {gate}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDays(e.updatedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
