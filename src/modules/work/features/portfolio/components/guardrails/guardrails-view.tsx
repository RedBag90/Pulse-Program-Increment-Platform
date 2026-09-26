"use client";

import type { Translate } from "@/i18n/translate";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Page, PageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";
import {
  HORIZON_KEYS,
  STATIONS,
  horizonOfStation,
  type Station,
} from "@/modules/work/domain/portfolio-guardrails";
import { HORIZON_HEX } from "@/modules/core/org/features/solution/components/horizon-tokens";
import type { PortfolioGuardrailsModel } from "@/modules/work/server/views/portfolio-guardrails-view";
import type { ValueStreamCapacityPlan } from "@/modules/work/server/views/value-stream-capacity-mix";
import type { GuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { GuardrailTargetsForm } from "@/modules/work/features/portfolio/components/guardrail-targets-form";
import { GuardrailTargetsReadOnly } from "@/modules/work/features/portfolio/components/guardrail-targets-readonly";
import { SectionLabel } from "@/components/ui/section-label";
import { GuardrailMixCard, type MixBucketSpec, type MixView } from "./guardrail-mix-card";
import { CapacityPlanCard } from "./capacity-plan-card";
import { BoEngagementCard } from "./bo-engagement-card";
import { EpicTower } from "./epic-tower";

const VIEW_OPTIONS: ReadonlyArray<ToggleGroupOption<MixView>> = [
  { id: "count", label: "Anzahl" },
  { id: "amount", label: "€ Kosten" },
];

/**
 * Fuenf Kuebel: H1 zerfaellt in Investing und Extracting. Beide behalten den
 * H1-Ton — es ist ein Horizont mit zwei Phasen, nicht zwei Horizonte.
 */
const STATION_KEYS: Record<Station, string> = {
  h3: HORIZON_KEYS.h3,
  h2: HORIZON_KEYS.h2,
  "h1.1": "org.solutionStep.investing",
  "h1.2": "org.solutionStep.extracting",
  h0: HORIZON_KEYS.h0,
};

/**
 * Die Kübel entstehen erst im Rendern, nicht beim Laden des Moduls: ihre
 * Beschriftung hängt an der Sprache, und die kennt nur die Komponente.
 */
const horizonBuckets = (t: Translate): ReadonlyArray<MixBucketSpec<Station>> =>
  STATIONS.map((st) => ({
    id: st,
    label: t(STATION_KEYS[st]),
    color: HORIZON_HEX[horizonOfStation(st)],
  }));

/**
 * Guardrails-Flaeche. Client-Shell, weil die Umschaltung Anzahl ↔ € der einzige
 * Zustand der Seite ist und fuer beide Mix-Karten gemeinsam gilt. Das Model
 * kommt fertig gerechnet vom Server — hier wird nichts nachgeladen.
 */
export function GuardrailsView({
  model,
  capacityPlan,
  epicCount,
  canManageTargets,
  targets,
}: {
  model: PortfolioGuardrailsModel;
  /** Guardrail 2 — die Summe der Wertströme, in Job-Size-Punkten. */
  capacityPlan: ValueStreamCapacityPlan;
  epicCount: number;
  canManageTargets: boolean;
  /** Der Soll-Mix — gepflegt am Ende dieser Seite, nicht mehr im Budgeting. */
  targets: GuardrailTargets;
}) {
  const t = useTranslations();
  const [view, setView] = useState<MixView>("count");
  const { horizon, engagement } = model;

  return (
    <Page>
      <PageHeader
        title={t("work.guardrails.portfolioGuardrails")}
        subtitle={`Ist-Mix gegen den vom LPM gesetzten Soll-Mix. ${epicCount} Epics im Portfolio.`}
        actions={
          <ToggleGroup
            value={view}
            options={VIEW_OPTIONS}
            onChange={setView}
            ariaLabel={t("work.guardrails.sicht")}
            className="bg-card text-meta"
          />
        }
      />

      {epicCount === 0 ? (
        <EmptyState
          title={t("work.guardrails.nochKeineEpicsIm")}
          body={t("work.guardrails.dieGuardrailsMessenDen")}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <GuardrailMixCard
              title={t("work.guardrails.investmentByHorizon")}
              subtitle={t("work.guardrails.guardrail")}
              view={view}
              buckets={horizonBuckets(t)}
              rows={horizon.rows}
              status={horizon.status}
              unclassifiedCount={horizon.unclassifiedCount}
              unclassifiedAmount={horizon.unclassifiedAmount}
              unclassifiedNoun={t("work.guardrails.horizontImSatz")}
              totalCount={horizon.totalCount}
              coverageThin={model.horizonCoverageThin}
            />
            <CapacityPlanCard plan={capacityPlan} />
            {engagement && <BoEngagementCard model={engagement} />}
          </div>

          <EpicTower epicsByStage={horizon.epicsByStage} epicsByHorizon={horizon.epicsByHorizon} />
        </>
      )}

      {/* Der Soll-Mix steht am Ende der Seite, die ihn misst. Vorher lag er im
          Budgeting-Modul — fachlich ein Fremdkörper und zwei Klicks entfernt
          von jeder Abweichung, die er erklären soll. */}
      <section className="space-y-3 border-t pt-6">
        <SectionLabel>{t("work.guardrails.sollMixTargets")}</SectionLabel>
        {canManageTargets ? (
          <GuardrailTargetsForm targets={targets} />
        ) : (
          <GuardrailTargetsReadOnly targets={targets} />
        )}
      </section>
    </Page>
  );
}
