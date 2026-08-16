import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart-lazy";
import type { PiOverviewSummary as Summary } from "@/modules/drumbeat/server/views/pi-detail";

interface Props {
  summary: Summary;
  piId: string;
  artId: string;
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="h-full space-y-1 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </Card>
  );
}

/** KPI tiles + feature-status chart for the PI detail page. */
export function PiOverviewSummary({ summary, piId, artId }: Props) {
  const { openIssues, featureStatus } = summary;
  void piId; // piId bleibt fuer kuenftige Tiles in der Signatur
  void artId; // artId bleibt fuer kuenftige Tiles in der Signatur

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Tile label="Offene Issues">
          <p className="text-2xl font-semibold">
            {openIssues}
            <span className="text-base font-normal text-muted-foreground"> offen</span>
          </p>
        </Tile>
      </div>

      <Card className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Feature-Status
        </p>
        {featureStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Features in diesem PI.</p>
        ) : (
          <StatusDistributionChart data={featureStatus} label="Features" />
        )}
      </Card>
    </div>
  );
}
