import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import type { ActivityItem } from "@/components/detail/initiative-activity-sidebar";
import { FeatureOverviewTab } from "@/modules/drumbeat/features/umsetzung/components/feature-overview-tab";
import {
  FeatureDependenciesTab,
  type DependencyEdge,
} from "@/modules/drumbeat/features/umsetzung/components/feature-dependencies-tab";
import { FeatureAcceptanceTab } from "@/modules/drumbeat/features/umsetzung/components/feature-acceptance-tab";
import { FeatureHistoryTab } from "@/modules/drumbeat/features/umsetzung/components/feature-history-tab";
import type { FeatureDetailModel } from "@/server/views/feature-detail";

const FEATURE_DETAIL_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "dependencies", label: "Dependencies" },
  { key: "acceptance", label: "Acceptance" },
  { key: "history", label: "History" },
];

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
  canTransition: boolean;
  canLinkDependency: boolean;
  outgoing: DependencyEdge[];
  incoming: DependencyEdge[];
  candidates: { id: string; title: string }[];
  historyEvents: ActivityItem[];
  userLabels: Record<string, string>;
  /** Aktiver Tab aus dem URL-Query, von der Page durchgereicht. */
  activeTab?: string;
  /** Wenn gesetzt, sind Tabs in-place (kein Page-Navigate). Slide-Over
   *  uebergibt seinen lokalen Tab-State + Setter. Voll-Route laesst es
   *  undefined und behaelt das URL-basierte Tab-Routing. */
  onTabChange?: (key: string) => void;
  /** Embed-Modus (z. B. im Slide-Over): kein „Zurueck zum Hub"-Link
   *  rendern, weil das Sheet seinen eigenen Schliessen-Knopf hat. */
  embed?: boolean;
}

/**
 * Feature-Detail-Shell. Routet Overview/Dependencies/Acceptance/History
 * Tabs auf die jeweiligen Inhalts-Komponenten.
 */
export function FeatureDetailShell({
  model,
  canEdit,
  canTransition,
  canLinkDependency,
  outgoing,
  incoming,
  candidates,
  historyEvents,
  userLabels,
  activeTab,
  onTabChange,
  embed,
}: Props) {
  const active = resolveTab(FEATURE_DETAIL_TABS, activeTab);

  return (
    <EntityDetailShell
      {...(!embed ? { backHref: "/umsetzung", backLabel: "Zurueck zum Hub" } : {})}
      title={model.title}
      tabs={FEATURE_DETAIL_TABS}
      activeTab={active}
      basePath={`/umsetzung/feature/${model.id}`}
      {...(onTabChange ? { onTabChange } : {})}
    >
      {active === "overview" && (
        <FeatureOverviewTab model={model} canEdit={canEdit} canTransition={canTransition} />
      )}
      {active === "dependencies" && (
        <FeatureDependenciesTab
          featureId={model.id}
          artId={model.art?.id ?? null}
          outgoing={outgoing}
          incoming={incoming}
          candidates={candidates}
          canEdit={canLinkDependency}
        />
      )}
      {active === "acceptance" && (
        <FeatureAcceptanceTab
          featureId={model.id}
          artId={model.art?.id ?? null}
          initialCriteria={model.acceptanceCriteria}
          canEdit={canEdit}
        />
      )}
      {active === "history" && <FeatureHistoryTab events={historyEvents} userLabels={userLabels} />}
    </EntityDetailShell>
  );
}
