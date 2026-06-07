import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { FeatureOverviewTab } from "@/features/umsetzung/components/feature-overview-tab";
import type { FeatureDetailModel } from "@/server/views/feature-detail";

const FEATURE_DETAIL_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  // Tabs aus Roadmap-P1.B — heute Platzhalter.
  { key: "dependencies", label: "Dependencies" },
  { key: "acceptance", label: "Acceptance" },
  { key: "history", label: "History" },
];

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
  canTransition: boolean;
  /** Aktiver Tab aus dem URL-Query, von der Page durchgereicht. */
  activeTab?: string;
}

/**
 * Feature-Detail-Shell. Wrappt das generische `EntityDetailShell` und
 * routet den Overview-Tab auf `FeatureOverviewTab`. Andere Tabs
 * sind Platzhalter mit Roadmap-Verweis.
 */
export function FeatureDetailShell({ model, canEdit, canTransition, activeTab }: Props) {
  const active = resolveTab(FEATURE_DETAIL_TABS, activeTab);

  return (
    <EntityDetailShell
      backHref="/umsetzung"
      backLabel="Zurueck zum Hub"
      title={model.title}
      tabs={FEATURE_DETAIL_TABS}
      activeTab={active}
      basePath={`/umsetzung/feature/${model.id}`}
    >
      {active === "overview" && (
        <FeatureOverviewTab model={model} canEdit={canEdit} canTransition={canTransition} />
      )}
      {active === "dependencies" && (
        <PlaceholderTab
          title="Dependencies"
          hint="In Roadmap-P1.B: ein- und ausgehende Dependencies des Features mit Inline-Add/Remove."
        />
      )}
      {active === "acceptance" && (
        <PlaceholderTab
          title="Acceptance"
          hint="In Roadmap-P1.B: Acceptance-Criteria-Editor mit Checkbox-State und History."
        />
      )}
      {active === "history" && (
        <PlaceholderTab
          title="History"
          hint="In Roadmap-P1.B: Audit-Log gefiltert auf dieses Feature."
        />
      )}
    </EntityDetailShell>
  );
}

function PlaceholderTab({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </section>
  );
}
