import { Link } from "@/i18n/navigation";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { PORTFOLIO_WIP_LIMITS } from "@/modules/work/features/portfolio/overview/wip-limits";

/**
 * Top 3 "risks" — blocked epics, oldest stale epic, and any overfull stage
 * gate. Mirrors `TopWinsBlock` for visual symmetry on the executive page.
 */
export function TopRisksBlock({ data }: { data: PortfolioOverview }) {
  const risks: { key: string; label: string; href?: string }[] = [];

  for (const blocked of data.blockedEpics.slice(0, 1)) {
    risks.push({
      key: `blocked-${blocked.id}`,
      label: `„${blocked.title}" blockiert`,
      href: `/portfolio/epics/${blocked.id}`,
    });
  }

  const oldest = [...data.staleEpics].sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)[0];
  if (oldest) {
    risks.push({
      key: `stale-${oldest.id}`,
      label: `„${oldest.title}" ${oldest.daysSinceUpdate} Tage still`,
      href: `/portfolio/epics/${oldest.id}`,
    });
  }

  for (const gate of STAGE_GATES) {
    const limit = PORTFOLIO_WIP_LIMITS[gate];
    const count = data.epicsByGate[gate].length;
    if (limit !== null && count > limit) {
      risks.push({
        key: `wip-${gate}`,
        label: `${STAGE_SHORT[gate]} überfüllt (${count} / ${limit})`,
      });
      break; // surface only the first overfull stage to keep the list to 3
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Top-Risiken</SectionLabel>
      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine akuten Risiken.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {risks.slice(0, 3).map((r) => (
            <li key={r.key} className="flex items-start gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-red-500" />
              {r.href ? (
                <Link href={r.href} className="hover:text-primary hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span>{r.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
