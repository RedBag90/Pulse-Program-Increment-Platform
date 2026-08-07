import type { ZieleModel } from "@/server/views/ziele-view";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { ZieleSubTabs } from "./ziele-sub-tabs";
import { GoalHealthStrip } from "./goal-health-strip";
import { StrategyTableView } from "./strategy-table-view";
import { StrategyNetworkViewLazy } from "./strategy-network-view-lazy";
import { StrategyRoadmapView } from "./strategy-roadmap-view";
import { StrategyAlignmentView } from "./strategy-alignment-view";
import { StrategyLayoutToggle, type StrategyLayout } from "./strategy-layout-toggle";
import { GoalScopeFilterBar } from "./goal-scope-filter-bar";
import { ZieleEditDrawer } from "./ziele-edit-drawer";
import { MoneySheetView } from "./money-sheet-view";

/**
 * Ziele-Shell — die **eine** Surface für Übersicht **und** Pflege (die frühere
 * Trennung /ziele read-only vs. /strategy edit ist zusammengelegt). Läuft über
 * `loadStrategyTree` + `loadKpiInventory`; ob Edit-Affordances sichtbar sind,
 * steuert `permissions.canEditStrategy` (aus der Capability `target.manage`,
 * von der Page gesetzt) — nicht mehr die Route.
 *
 * Sub-Tabs: Strategie · Money. Layout im Strategie-Tab: Tabelle / Netzplan.
 * Deeplinks der Komponenten zeigen auf `/ziele?entity=…`.
 */
interface Props {
  model: ZieleModel;
  layout: StrategyLayout;
  /** Owner-Id → Anzeigename (für die Owner-Avatare in der Tabelle). */
  userLabels?: Record<string, string>;
}

export function ZieleShell({ model, layout, userLabels = {} }: Props) {
  const { tab, themes, tenantTrio, permissions, modules } = model;
  // Money existiert nur mit Portfolio-Modul — Deep-Link `?tab=money` ohne
  // Portfolio fällt still auf „Strategie" zurück (keine leere Fläche).
  const effectiveTab = tab === "money" && !modules.portfolio ? "strategie" : tab;

  return (
    <Page>
      <PageHeader
        title="Ziele"
        subtitle="Ziele und Unterziele — Übersicht und Pflege in einer Ansicht."
        actions={<ZieleSubTabs active={effectiveTab} showMoney={modules.portfolio} />}
      />

      <div className="space-y-2">
        <GoalHealthStrip themes={themes} tenantTrio={tenantTrio} showMoney={modules.portfolio} />
        <p className="px-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{themes.length}</span> Ziele im Scope
        </p>
      </div>

      {effectiveTab === "strategie" && (
        <PageSection>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GoalScopeFilterBar showValueStreams={modules.portfolio} showArts={modules.program} />
            <StrategyLayoutToggle active={layout} />
          </div>
          {layout === "tabelle" && (
            <StrategyTableView
              themes={themes}
              canEdit={permissions.canEditStrategy}
              userLabels={userLabels}
            />
          )}
          {layout === "netzplan" && (
            <StrategyNetworkViewLazy themes={themes} userLabels={userLabels} />
          )}
          {layout === "roadmap" && <StrategyRoadmapView themes={themes} />}
          {layout === "alignment" && (
            <StrategyAlignmentView themes={themes} userLabels={userLabels} />
          )}
        </PageSection>
      )}
      {effectiveTab === "money" && (
        <MoneySheetView themes={themes} hasPortfolio={modules.portfolio} />
      )}

      {/* Detail-Drawer: read-only oder editierbar je nach `canEdit` (Capability). */}
      <ZieleEditDrawer model={model} canEdit={permissions.canEditStrategy} />
    </Page>
  );
}
