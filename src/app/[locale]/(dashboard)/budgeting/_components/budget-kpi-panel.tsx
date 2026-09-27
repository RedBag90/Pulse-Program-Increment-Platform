import { useTranslations } from "next-intl";
import type { createPrismaClient } from "@/server/db/prisma";
import type { requirePrincipal } from "@/server/auth/principal";
import { previousCycles } from "@/modules/budgeting/domain/cycle";
import { RATE_WINDOW } from "@/modules/budgeting/domain/art-throughput";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { loadBudgetKpis, rateSuspicion } from "@/modules/budgeting/server/views/budget-kpis";
import { loadBudgetStichtag } from "@/modules/budgeting/server/services/budget-stichtag";
import {
  CoverageTable,
  DeliveryCard,
  KpiTiles,
  RateCheckBanner,
  type DeliveryRow,
} from "@/modules/budgeting/features/components/art-budget/budget-kpi-overview";
import { loadPiVelocity } from "@/modules/drumbeat/server/views/pi-velocity-view";
import { PiVelocityRows } from "@/modules/drumbeat/features/cockpit/components/pi-velocity-table";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { hasCapability } from "@/server/auth/authorize";

/**
 * **Die Budget-KPIs eines Wertstroms** — eine Karte je Kennzahl, nicht je ART
 * (`docs/concepts/budget-kpi-tab.md`).
 *
 * Oben zwei gleichrangige Kacheln: Deckung (gewähltes Halbjahr) und Lieferung
 * (geltende Budget-Kachel). Darunter der Hinweis „Satz prüfen", falls beide
 * gegenläufig weit danebenliegen, dann die Karten Deckung, Lieferung und
 * Velocity — jede stellt die ARTs nebeneinander.
 *
 * Hier, im App-Baum, weil er Budgeting und Drumbeat zusammensetzt — das darf
 * nur die Composition Root (ADR-0013). Den Job-Size-Verlauf allein für den
 * Portfolio Sync liefert `budget-burn-panel.tsx`.
 */
export async function BudgetKpiPanel({
  db,
  principal,
  arts,
  cycleKey,
  showTotals,
  basePath,
  burnArtId,
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
  /** Ohne Wertstrom-Recht entfallen die Σ-Zeilen — wie in „Nachsehen" (REQ-3). */
  showTotals: boolean;
  /** Die Seite, auf der der Reiter steht — für die Auswahl im Verlauf. */
  basePath: string;
  /** `?kpiArt=` — der ART, dessen Verlauf das Diagramm zeigt; `null` = Σ. */
  burnArtId: string | null;
}) {
  const t = useTranslations();
  if (arts.length === 0) {
    return (
      <SectionCard title={t("budgeting.kpi.deckungTitel", { halbjahr: halfYearLabel(cycleKey) })}>
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
   * abgeschlossenen PIs des Halbjahrs der geltenden Kachel (Budget-Stichtag).
   * Sie kommt aus Drumbeat; ohne Drumbeat gibt es keine Karte.
   */
  const stichtag = await loadBudgetStichtag(db, principal.tenantId as never);
  const velocityWindow = {
    closedKeys: previousCycles(cycleKey, RATE_WINDOW),
    runningKey: stichtag.focusKey,
  };
  const [kpis, velocity] = await Promise.all([
    loadBudgetKpis(db, principal.tenantId as never, arts, { cycleKey, stichtag }),
    principal.enabledModules.includes("drumbeat")
      ? loadPiVelocity(db, principal.tenantId, arts, velocityWindow)
      : Promise.resolve(null),
  ]);

  // Wer das ART-Budget verteilen darf, darf auch seinen Satz schätzen — mit
  // dem Wertstrom, sonst wäre dessen Scope vakuant wahr.
  const darfSchaetzen = (artId: string) => {
    const art = arts.find((x) => x.id === artId);
    return (
      art?.valueStreamId != null &&
      hasCapability(principal, "art_budget.distribute", {
        tenantId: principal.tenantId,
        artId,
        valueStreamId: art.valueStreamId,
      })
    );
  };

  const suspicions = rateSuspicion(kpis.arts);
  const href = (artId: string | null) =>
    `${basePath}?tab=kpi&cycle=${cycleKey}${artId ? `&kpiArt=${artId}` : ""}`;

  const deliveryRows: DeliveryRow[] = [
    ...kpis.arts.map((a) => ({
      artId: a.artId,
      name: a.name,
      burn: a.coverage.burn,
      href: href(a.artId),
    })),
    ...(showTotals
      ? [
          {
            artId: null,
            name: t("budgeting.kpi.summeWertstrom"),
            burn: kpis.stream.burn,
            href: href(null),
          },
        ]
      : []),
  ];
  const selected =
    deliveryRows.find((r) => r.artId === burnArtId) ??
    deliveryRows.find((r) => r.artId == null) ??
    deliveryRows[0]!;

  return (
    <div className="space-y-4">
      <KpiTiles
        stream={kpis.stream}
        cycleKey={cycleKey}
        artCount={arts.length}
        isTotal={showTotals}
      />
      <RateCheckBanner suspicions={suspicions} />
      <CoverageTable
        rows={kpis.arts.map((a) => ({
          artId: a.artId,
          name: a.name,
          coverage: a.coverage,
          estimate: darfSchaetzen(a.artId) ? { artId: a.artId } : undefined,
        }))}
        stream={showTotals ? kpis.stream : null}
        cycleKey={cycleKey}
        suspicions={suspicions}
      />
      <DeliveryCard rows={deliveryRows} selected={selected} />
      {velocity && (
        <PiVelocityRows
          arts={velocity.arts}
          stream={showTotals ? velocity.stream : null}
          window={velocityWindow}
        />
      )}
      <p className="px-1 text-meta text-muted-foreground">
        {t("budgeting.page.betriebZaehltInKeiner")}
      </p>
    </div>
  );
}
