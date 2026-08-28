import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import type { ActivityItem } from "@/components/detail/initiative-activity-sidebar";
import { FeatureOverviewTab } from "@/modules/drumbeat/features/cockpit/components/feature-overview-tab";
import {
  FeatureDependenciesTab,
  type DependencyEdge,
} from "@/modules/drumbeat/features/cockpit/components/feature-dependencies-tab";
import { FeatureAcceptanceTab } from "@/modules/drumbeat/features/cockpit/components/feature-acceptance-tab";
import { FeatureHistoryTab } from "@/modules/drumbeat/features/cockpit/components/feature-history-tab";
import { StatusBadge } from "@/modules/drumbeat/features/lib/status-badges";
import { FeatureStatusSelect } from "@/modules/work/features/feature/components/feature-status-select";
import { FEATURE_STATUSES, type FeatureStatus } from "@/modules/drumbeat/domain/status";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import type { ReactNode } from "react";
import type { FeatureDetailModel } from "@/modules/drumbeat/server/views/feature-detail";

const FEATURE_DETAIL_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Überblick" },
  { key: "dependencies", label: "Abhängigkeiten" },
  { key: "acceptance", label: "Abnahme" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
  canTransition: boolean;
  canAssignOwner: boolean;
  approvers: ReadonlyArray<{ userId: string; roles: string[] }>;
  canLinkDependency: boolean;
  outgoing: DependencyEdge[];
  incoming: DependencyEdge[];
  candidates: { id: string; title: string }[];
  historyEvents: ActivityItem[];
  userLabels: Record<string, string>;
  /** Ein-Hop-Blocker fuer den Fruehester-Start-Header im Deps-Tab. */
  blockerWindows?: { blockerId: string; blockerTitle: string; blockerEndDate: Date | null }[];
  blockerSummary?: { earliest: Date | null; unscheduledBlockers: string[] };
  /** Aktiver Tab aus dem URL-Query, von der Page durchgereicht. */
  activeTab?: string;
  /** Wenn gesetzt, sind Tabs in-place (kein Page-Navigate). Slide-Over
   *  uebergibt seinen lokalen Tab-State + Setter. Voll-Route laesst es
   *  undefined und behaelt das URL-basierte Tab-Routing. */
  onTabChange?: (key: string) => void;
  /** Embed-Modus (z. B. im Slide-Over): kein Zurueck-Link rendern,
   *  weil das Sheet seinen eigenen Schliessen-Knopf hat. */
  embed?: boolean;
  /** Zurueck-Link. Default (Nicht-Embed): Hub. Die ART-Vollroute
   *  uebergibt stattdessen `/art/<id>/features`. */
  backHref?: string;
  backLabel?: string;
  /** Basis fuer die `?tab=`-Links. Default: `/umsetzung/feature/<id>`.
   *  Die Standalone-Vollroute uebergibt `/feature/<id>`. */
  basePath?: string;
  /** Header-Aktionen (z. B. Loeschen), nur auf Vollrouten sinnvoll. */
  headerActions?: ReactNode;
}

/**
 * Feature-Detail-Shell. Routet Overview/Dependencies/Acceptance/History
 * Tabs auf die jeweiligen Inhalts-Komponenten.
 */
export function FeatureDetailShell({
  model,
  canEdit,
  canTransition,
  canAssignOwner,
  approvers,
  canLinkDependency,
  outgoing,
  incoming,
  candidates,
  historyEvents,
  userLabels,
  blockerWindows,
  blockerSummary,
  activeTab,
  onTabChange,
  embed,
  backHref,
  backLabel,
  basePath,
  headerActions,
}: Props) {
  const active = resolveTab(FEATURE_DETAIL_TABS, activeTab);
  // Nicht-Embed: entweder die vom Caller uebergebene Rueck-Navigation
  // (z. B. ART) oder der Hub als Default. Embed (Slide-Over) hat keine.
  const back = embed
    ? {}
    : {
        backHref: backHref ?? "/umsetzung",
        backLabel: backLabel ?? "Zurück zum Hub",
      };

  // Status-Badge links vom Titel — Registry-Badge fuer Delivery-Status,
  // sonst (QS-States wie draft/in_review) ein generisches Label-Pill.
  const badge = (FEATURE_STATUSES as readonly string[]).includes(model.status) ? (
    <StatusBadge status={model.status as FeatureStatus} />
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
      {STATUS_LABELS[model.status] ?? model.status}
    </span>
  );

  // Unterzeile „Epic · ART · PI" — Kontext direkt unter dem Titel (Wireframe).
  const metaBits = [
    model.parent ? `Epic: ${model.parent.title}` : null,
    model.art ? `ART ${model.art.name}` : (model.valueStream?.name ?? null),
    model.pi ? model.pi.name : "Backlog",
  ].filter((x): x is string => Boolean(x));
  const subHeader =
    metaBits.length > 0 ? (
      <p className="text-sm text-muted-foreground">{metaBits.join(" · ")}</p>
    ) : undefined;

  // „Status ändern" im Header (Wireframe) — der EINE kanonische Status-Wechsel.
  // Governance-Grund-Gate (Blockiert/Verworfen) sitzt im Control selbst.
  const statusControl =
    canTransition && model.allowedTransitions.length > 0 ? (
      <FeatureStatusSelect
        featureId={model.id}
        status={model.status}
        label={model.title}
        size="sm"
        disabled={!canEdit}
      />
    ) : null;
  const combinedActions =
    statusControl || headerActions ? (
      <div className="flex flex-wrap items-center gap-2">
        {statusControl}
        {headerActions}
      </div>
    ) : undefined;

  return (
    <EntityDetailShell
      {...back}
      title={model.title}
      badge={badge}
      tabs={FEATURE_DETAIL_TABS}
      activeTab={active}
      basePath={basePath ?? `/umsetzung/feature/${model.id}`}
      {...(onTabChange ? { onTabChange } : {})}
      {...(combinedActions ? { headerActions: combinedActions } : {})}
      {...(subHeader ? { subHeader } : {})}
    >
      {active === "overview" && (
        <FeatureOverviewTab
          model={model}
          canEdit={canEdit}
          canAssignOwner={canAssignOwner}
          approvers={approvers}
          userLabels={userLabels}
        />
      )}
      {active === "dependencies" && (
        <FeatureDependenciesTab
          featureId={model.id}
          artId={model.art?.id ?? null}
          outgoing={outgoing}
          incoming={incoming}
          candidates={candidates}
          canEdit={canLinkDependency}
          {...(blockerWindows ? { blockerWindows } : {})}
          {...(blockerSummary ? { blockerSummary } : {})}
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
