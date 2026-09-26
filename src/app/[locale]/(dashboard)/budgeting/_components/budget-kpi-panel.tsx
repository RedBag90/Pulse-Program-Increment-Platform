import { useTranslations } from "next-intl";
import type { createPrismaClient } from "@/server/db/prisma";
import type { requirePrincipal } from "@/server/auth/principal";
import { currentCycle, previousCycles } from "@/modules/budgeting/domain/cycle";
import { RATE_WINDOW } from "@/modules/budgeting/domain/art-throughput";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { loadBudgetKpis } from "@/modules/budgeting/server/views/budget-kpis";
import { loadRunningPeriod } from "@/modules/budgeting/server/services/running-period";
import {
  ArtCoverageCard,
  StreamCoverageCard,
} from "@/modules/budgeting/features/components/art-budget/coverage-card";
import { loadPiVelocity } from "@/modules/drumbeat/server/views/pi-velocity-view";
import { PiVelocityTable } from "@/modules/drumbeat/features/cockpit/components/pi-velocity-table";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { hasCapability } from "@/server/auth/authorize";

/**
 * **Die Budget-KPIs eines Wertstroms** — die Herleitung von Last gegen
 * Deckung, der Job-Size-Verlauf der laufenden Kachel und die PI-Velocity, je
 * Wertstrom und je ART.
 *
 * Lag bis September 2026 als `KpiTab` in der Wertstrom-Budgetseite. Hier,
 * im App-Baum, weil er Budgeting und Drumbeat zusammensetzt — das darf nur die
 * Composition Root (ADR-0013). Den Job-Size-Verlauf allein für den Portfolio
 * Sync liefert `budget-burn-panel.tsx`.
 */
export async function BudgetKpiPanel({
  db,
  principal,
  arts,
  cycleKey,
  vsName,
  showTotals,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  /** Nur die ARTs, die der Betrachter sehen darf. */
  arts: readonly {
    id: string;
    name: string;
    timelineId: string | null;
    /** Für das Recht, den Satz zu schätzen (`art_budget.distribute`). */
    valueStreamId?: string;
  }[];
  cycleKey: string;
  vsName: string;
  /** Ohne Wertstrom-Recht entfällt die Summenzeile — wie in „Nachsehen" (REQ-3). */
  showTotals: boolean;
}) {
  const t = useTranslations();
  if (arts.length === 0) {
    return (
      <SectionCard title={`Wofür · eingeplant · ${halfYearLabel(cycleKey)}`}>
        <EmptyState
          title={t("budgeting.page.nochKeinArt")}
          body={t("budgeting.page.dieRechnungLastGegen")}
        />
      </SectionCard>
    );
  }

  /**
   * **PI-Velocity: dasselbe Fenster wie der €-Satz** — die Halbjahre vor dem
   * gewählten (`RATE_WINDOW`), gezählt nach dem Ende der PIs — plus die schon
   * abgeschlossenen PIs des laufenden Halbjahrs. Sie kommt aus Drumbeat;
   * Budgeting darf es nicht importieren (ADR-0013), deshalb wird sie hier
   * geladen und als Slot in die Karten gereicht. Ohne Drumbeat gibt es keine
   * PIs und keinen Slot.
   */
  const velocityWindow = {
    closedKeys: previousCycles(cycleKey, RATE_WINDOW),
    runningKey: currentCycle(new Date()),
  };
  /**
   * **Der Job-Size-Verlauf folgt der laufenden Budget-Kachel**, nicht dem
   * Halbjahr des Umschalters: Budget wird je Kachel zugeteilt, und eine
   * Kachel hat eigene Daten. Die übrigen Zahlen der Karten rechnen weiter nach
   * dem Halbjahr.
   */
  const heute = new Date();
  const burnWindow = await loadRunningPeriod(db, principal.tenantId as never, heute);
  const [kpis, velocity] = await Promise.all([
    loadBudgetKpis(db, principal.tenantId as never, arts, cycleKey, heute, burnWindow),
    principal.enabledModules.includes("drumbeat")
      ? loadPiVelocity(db, principal.tenantId, arts, velocityWindow)
      : Promise.resolve(null),
  ]);
  const velocityOf = new Map(velocity?.arts.map((v) => [v.artId, v]) ?? []);

  return (
    <div className="space-y-6">
      {showTotals && (
        <StreamCoverageCard
          name={`${vsName} · gesamt`}
          stream={kpis.stream}
          extra={
            velocity && (
              <PiVelocityTable
                rows={velocity.stream.rows}
                summary={velocity.stream.ratio}
                kind="stream"
                window={velocityWindow}
              />
            )
          }
        />
      )}
      {kpis.arts.map((a) => {
        const v = velocityOf.get(a.artId);
        const art = arts.find((x) => x.id === a.artId);
        // Wer das ART-Budget verteilen darf, darf auch seinen Satz schätzen —
        // mit dem Wertstrom, sonst wäre dessen Scope vakuant wahr.
        const darfSchaetzen =
          art?.valueStreamId != null &&
          hasCapability(principal, "art_budget.distribute", {
            tenantId: principal.tenantId,
            artId: a.artId,
            valueStreamId: art.valueStreamId,
          });
        return (
          <ArtCoverageCard
            key={a.artId}
            name={a.name}
            coverage={a.coverage}
            estimate={darfSchaetzen ? { artId: a.artId } : undefined}
            extra={
              v && (
                <PiVelocityTable
                  rows={v.rows}
                  summary={v.mean}
                  kind="art"
                  window={velocityWindow}
                />
              )
            }
          />
        );
      })}
      <p className="px-1 text-meta text-muted-foreground">
        {t("budgeting.page.betriebZaehltInKeiner")}
      </p>
    </div>
  );
}
