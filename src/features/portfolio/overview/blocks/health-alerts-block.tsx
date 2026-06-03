import { Link } from "@/i18n/navigation";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { PortfolioOverview } from "@/server/services/portfolio-overview";

/**
 * Three flat counts of things that need attention — blocked epics, stale
 * epics, open impediments. Each links into the editor where the user resolves
 * them.
 */
export function HealthAlertsBlock({ data }: { data: PortfolioOverview }) {
  const empty =
    data.blockedEpics.length === 0 && data.staleEpics.length === 0 && data.impedimentsOpen === 0;

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Health Alerts</SectionLabel>

      {empty ? (
        <p className="text-sm text-muted-foreground">Keine offenen Hinweise.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {data.blockedEpics.length > 0 && (
            <li className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-500" />
              <Link
                href="/portfolio/epics?status=blocked"
                className="hover:text-primary hover:underline"
              >
                {data.blockedEpics.length} Epic{data.blockedEpics.length === 1 ? "" : "s"} blockiert
              </Link>
            </li>
          )}
          {data.staleEpics.length > 0 && (
            <li className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <Link href="/portfolio/epics" className="hover:text-primary hover:underline">
                {data.staleEpics.length} Epic{data.staleEpics.length === 1 ? "" : "s"} &gt; 30 Tage
                still
              </Link>
            </li>
          )}
          {data.impedimentsOpen > 0 && (
            <li className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>
                {data.impedimentsOpen} offene Impediment{data.impedimentsOpen === 1 ? "" : "s"}
              </span>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
