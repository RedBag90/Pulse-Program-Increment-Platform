import type { ZieleModel } from "@/server/views/ziele-view";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { ZieleSubTabs } from "./ziele-sub-tabs";
import { GoalHealthStrip } from "./goal-health-strip";
import { StrategySankeyView } from "./strategy-sankey-view";
import { StrategyTableView } from "./strategy-table-view";
import { StrategyNetworkView } from "./strategy-network-view";
import { StrategyLayoutToggle, type StrategyLayout } from "./strategy-layout-toggle";
import { GoalScopeFilterBar } from "./goal-scope-filter-bar";
import { ZieleEditDrawer } from "./ziele-edit-drawer";
import { OkrBoardView } from "./okr-board-view";
import { MoneySheetView } from "./money-sheet-view";

/**
 * Geteilte Shell fuer das **Ziele-Modul** (Wert-Anzeige, read-only,
 * `mode="ziele"`) und das **Strategie-Pflege-Modul** (volle Edit-
 * Affordances, `mode="strategy"`). Beide laufen ueber denselben
 * Loader (`loadStrategyTree` + `loadKpiInventory`); der Unterschied steckt im `canEdit`-
 * Flag (vom Page-Loader gesetzt) und in den Sub-Tabs:
 *
 *  - `mode="ziele"`   → Tabs Strategie · OKRs · Money (Pflege ist
 *                       in der Refactor-Phase nach Controlling gewandert)
 *  - `mode="strategy"`→ Tabs Strategie · OKRs (Pflege-Surface fuer
 *                       Vision/Theme/Objective/KR + KPI-Coverage)
 *
 * Money/Sankey/Tree bleiben dieselben Komponenten; sie respektieren
 * `permissions.canEditStrategy` fuer Edit-Affordances. Die Hrefs in
 * den Komponenten zeigen alle auf `/strategy?entity=…` — von der
 * Ziele-Seite navigiert ein Klick auf eine Card also in die Pflege.
 */
type ShellMode = "ziele" | "strategy";

interface Props {
  model: ZieleModel;
  layout: StrategyLayout;
  mode?: ShellMode;
  /** Owner-Id → Anzeigename (für die Owner-Avatare in der Tabelle). */
  userLabels?: Record<string, string>;
}

export function ZieleShell({ model, layout, mode = "ziele", userLabels = {} }: Props) {
  const { tab, themes, tenantTrio, permissions, modules } = model;
  const isStrategy = mode === "strategy";

  return (
    <Page>
      <PageHeader
        title={isStrategy ? "Strategie" : "Ziele"}
        subtitle={
          isStrategy
            ? "Themes (OKR-Statements) + Key Results pflegen. Wert-Anzeige unter Ziele."
            : "Wert-Anzeige Theme → Key Result, mit €-Rollup. Pflege unter Strategie."
        }
        actions={<ZieleSubTabs active={tab} mode={mode} />}
      />

      <div className="space-y-1.5">
        <GoalHealthStrip themes={themes} tenantTrio={tenantTrio} showMoney={modules.portfolio} />
        <p className="text-xs text-muted-foreground">{themes.length} Themes (OKRs) im Scope</p>
      </div>

      {tab === "strategie" && (
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
          {layout === "sankey" && <StrategySankeyView themes={themes} />}
          {layout === "netzplan" && <StrategyNetworkView themes={themes} />}
        </PageSection>
      )}
      {tab === "okrs" && <OkrBoardView themes={themes} canEdit={permissions.canEditStrategy} />}
      {tab === "money" && !isStrategy && (
        <MoneySheetView themes={themes} hasPortfolio={modules.portfolio} />
      )}

      {/* Detail-Drawer in beiden Modi: read-only auf /ziele, editierbar auf
          /strategy (canEdit spiegelt das Permission-Gate). */}
      <ZieleEditDrawer model={model} canEdit={permissions.canEditStrategy} />
    </Page>
  );
}
