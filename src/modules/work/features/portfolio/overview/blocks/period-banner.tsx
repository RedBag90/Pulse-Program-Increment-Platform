import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

/**
 * Top-of-page time context — how many PIs are live, when the nearest one ends,
 * and how many Value Streams and in-flight Epics are on the table. Sets the
 * "you are here" frame for the rest of the page.
 */
export function PeriodBanner({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const inFlight =
    data.epicsByGate.L2.length + data.epicsByGate.L3.length + data.epicsByGate.L4.length;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-muted/30 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-foreground">
        <CalendarClock className="size-4 text-muted-foreground" />
        <span className="font-medium">
          {data.activePis.length === 1
            ? t("work.overview.activePiCountOne", { count: data.activePis.length })
            : t("work.overview.activePiCountOther", { count: data.activePis.length })}
        </span>
      </span>
      {data.nearestPiEnd && (
        <span className="text-muted-foreground">
          {t("work.overview.daysUntilPiEnd", {
            days: data.nearestPiEnd.daysRemaining,
            name: data.nearestPiEnd.name,
          })}
        </span>
      )}
      <span className="text-muted-foreground">
        {data.valueStreamCount === 1
          ? t("work.overview.valueStreamCountOne", { count: data.valueStreamCount })
          : t("work.overview.valueStreamCountOther", { count: data.valueStreamCount })}
      </span>
      <span className="text-muted-foreground">
        {t("work.overview.epicsInFlowCount", { count: inFlight })}
      </span>
    </div>
  );
}
