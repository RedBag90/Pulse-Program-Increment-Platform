import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
import type { PiOverviewSummary as Summary } from "@/domain/pi-overview";

interface Props {
  summary: Summary;
  piId: string;
  artId: string;
}

function Tile({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  const card = (
    <Card className={`h-full space-y-1 p-4 ${href ? "transition-colors hover:bg-muted/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

/** KPI tiles + feature-status chart for the PI detail page. */
export function PiOverviewSummary({ summary, piId, artId }: Props) {
  const { velocity, capacity, objectives, impediments, featureStatus } = summary;
  const velocityPct =
    velocity.plannedPoints > 0
      ? Math.min(100, Math.round((velocity.completedPoints / velocity.plannedPoints) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Velocity">
          <p className="text-2xl font-semibold">
            {velocity.completedPoints}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {velocity.plannedPoints} Pkt
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${velocityPct}%` }} />
          </div>
        </Tile>

        <Tile label="Kapazität">
          <p className="text-2xl font-semibold">
            {capacity.plannedCapacity}
            <span className="text-base font-normal text-muted-foreground"> Pkt</span>
          </p>
          <p className="text-xs text-muted-foreground">
            geplant über {capacity.sprintCount} Sprint{capacity.sprintCount !== 1 ? "s" : ""}
          </p>
        </Tile>

        <Tile label="Objectives" href={`/pi/${piId}/objectives`}>
          <p className="text-2xl font-semibold">
            {objectives.committed}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {objectives.total} committed
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Ø Confidence {objectives.avgConfidence ?? "—"}
          </p>
        </Tile>

        <Tile label="Impediments" href={`/art/${artId}/impediments`}>
          <p className="text-2xl font-semibold">
            {impediments.open}
            <span className="text-base font-normal text-muted-foreground"> offen</span>
          </p>
          <p className="text-xs text-muted-foreground">{impediments.escalated} eskaliert</p>
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
