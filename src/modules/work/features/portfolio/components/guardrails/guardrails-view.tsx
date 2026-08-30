"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { Page, PageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";
import { HORIZONS, HORIZON_LABEL } from "@/modules/work/domain/portfolio-guardrails";
import { HORIZON_HEX } from "@/modules/work/features/portfolio/components/horizon-badge";
import type {
  CapacityBucket,
  PortfolioGuardrailsModel,
} from "@/modules/work/server/views/portfolio-guardrails-view";
import { GuardrailMixCard, type MixBucketSpec, type MixView } from "./guardrail-mix-card";
import { BoEngagementCard } from "./bo-engagement-card";
import { EpicTower } from "./epic-tower";

const VIEW_OPTIONS: ReadonlyArray<ToggleGroupOption<MixView>> = [
  { id: "count", label: "Anzahl" },
  { id: "amount", label: "€ Kosten" },
];

const HORIZON_BUCKETS = HORIZONS.map((h) => ({
  id: h,
  label: HORIZON_LABEL[h],
  color: HORIZON_HEX[h],
}));

/**
 * Die Capacity-Achse traegt bewusst keinen Eigen-Ton: „Business vs Enabler" ist
 * keine Kategorie mit Farbcode, die Wertung steckt in der Ampel.
 */
const CAPACITY_BUCKETS: ReadonlyArray<MixBucketSpec<CapacityBucket>> = [
  { id: "business", label: "Business", color: "var(--foreground)" },
  { id: "enabler", label: "Enabler", color: "var(--muted-foreground)" },
];

/**
 * Guardrails-Flaeche. Client-Shell, weil die Umschaltung Anzahl ↔ € der einzige
 * Zustand der Seite ist und fuer beide Mix-Karten gemeinsam gilt. Das Model
 * kommt fertig gerechnet vom Server — hier wird nichts nachgeladen.
 */
export function GuardrailsView({
  model,
  epicCount,
  canManageTargets,
}: {
  model: PortfolioGuardrailsModel;
  epicCount: number;
  canManageTargets: boolean;
}) {
  const [view, setView] = useState<MixView>("count");
  const { horizon, capacity, engagement } = model;

  return (
    <Page>
      <PageHeader
        title="Portfolio-Guardrails"
        subtitle={`Ist-Mix gegen den vom LPM gesetzten Soll-Mix. ${epicCount} Epics im Portfolio.`}
        actions={
          <>
            <ToggleGroup
              value={view}
              options={VIEW_OPTIONS}
              onChange={setView}
              ariaLabel="Sicht"
              className="bg-card text-[11px]"
            />
            {canManageTargets && (
              <Link
                href="/budgeting"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Targets pflegen
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </>
        }
      />

      {epicCount === 0 ? (
        <EmptyState
          title="Noch keine Epics im Portfolio"
          body="Die Guardrails messen den Mix der Epics — sobald das erste angelegt ist, rechnet die Fläche."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <GuardrailMixCard
              title="Investment by Horizon"
              subtitle="Guardrail 1"
              view={view}
              buckets={HORIZON_BUCKETS}
              rows={horizon.rows}
              status={horizon.status}
              unclassifiedCount={horizon.unclassifiedCount}
              unclassifiedAmount={horizon.unclassifiedAmount}
              unclassifiedNoun="Horizont"
              totalCount={horizon.totalCount}
              coverageThin={model.horizonCoverageThin}
            />
            <GuardrailMixCard
              title="Capacity Allocation"
              subtitle="Guardrail 2"
              view={view}
              buckets={CAPACITY_BUCKETS}
              rows={capacity.rows}
              status={capacity.status}
              unclassifiedCount={capacity.unclassifiedCount}
              unclassifiedAmount={capacity.unclassifiedAmount}
              unclassifiedNoun="Typ"
              totalCount={capacity.totalCount}
              coverageThin={model.capacityCoverageThin}
            />
            {engagement && <BoEngagementCard model={engagement} />}
          </div>

          <EpicTower epicsByStage={horizon.epicsByStage} epicsByHorizon={horizon.epicsByHorizon} />
        </>
      )}
    </Page>
  );
}
