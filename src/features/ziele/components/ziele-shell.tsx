import type { ZieleModel } from "@/server/views/ziele-view";
import { ZieleSubTabs } from "./ziele-sub-tabs";
import { StrategySankeyView } from "./strategy-sankey-view";
import { StrategyTableView } from "./strategy-table-view";
import { StrategyNetworkView } from "./strategy-network-view";
import { StrategyLayoutToggle, type StrategyLayout } from "./strategy-layout-toggle";
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
}

export function ZieleShell({ model, layout, mode = "ziele" }: Props) {
  const { tab, themes, tenantTrio, permissions } = model;
  const isStrategy = mode === "strategy";

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {isStrategy ? "Strategie" : "Ziele"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStrategy
              ? "Themes (OKR-Statements) + Key Results pflegen. Wert-Anzeige unter Ziele."
              : "Wert-Anzeige Theme → Key Result, mit €-Rollup. Pflege unter Strategie."}
          </p>
        </div>
        <ZieleSubTabs active={tab} mode={mode} />
      </header>

      <div className="flex items-center justify-between rounded-md border bg-card px-4 py-2">
        <p className="text-xs text-muted-foreground">{themes.length} Themes (OKRs) im Scope</p>
        <TenantRollup
          planned={tenantTrio.planned}
          realized={tenantTrio.realized}
          runRate={tenantTrio.runRate}
        />
      </div>

      {tab === "strategie" && (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <StrategyLayoutToggle active={layout} />
          </div>
          {layout === "tabelle" && (
            <StrategyTableView themes={themes} canEdit={permissions.canEditStrategy} />
          )}
          {layout === "sankey" && <StrategySankeyView themes={themes} />}
          {layout === "netzplan" && <StrategyNetworkView themes={themes} />}
        </div>
      )}
      {tab === "okrs" && <OkrBoardView themes={themes} canEdit={permissions.canEditStrategy} />}
      {tab === "money" && !isStrategy && <MoneySheetView themes={themes} />}

      {isStrategy && <ZieleEditDrawer model={model} canEdit={permissions.canEditStrategy} />}
    </div>
  );
}

function TenantRollup({
  planned,
  realized,
  runRate,
}: {
  planned: number;
  realized: number;
  runRate: number;
}) {
  const fmt = (n: number) => `€${Math.round(n).toLocaleString("de-DE")}`;
  return (
    <div className="flex items-baseline gap-4 text-xs">
      <span>
        <span className="text-muted-foreground">Planned</span>{" "}
        <span className="font-medium tabular-nums">{fmt(planned)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Realized</span>{" "}
        <span className="font-medium tabular-nums">{fmt(realized)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Run-Rate</span>{" "}
        <span className="font-medium tabular-nums">{fmt(runRate)}</span>
      </span>
    </div>
  );
}
