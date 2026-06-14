import type { ZieleModel } from "@/server/views/ziele-view";
import { ZieleSubTabs } from "./ziele-sub-tabs";
import { StrategyTreeView } from "./strategy-tree-view";

/**
 * Ziele-Modul-Shell (Konzept §1). Vier Sub-Tabs (Strategie · OKRs ·
 * Money · Pflege); Default `Strategie`. Phase-1 liefert nur Strategie
 * als read-only Tree-Sicht; die anderen drei Tabs sind Placeholder
 * fuer Folge-Phasen (P2 Sankey-Toggle, P3 OKR-Board, P4 Money-Sheet,
 * P5 Pflege).
 */
interface Props {
  model: ZieleModel;
}

export function ZieleShell({ model }: Props) {
  const { tab, visions, themes, tenantTrio } = model;

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Ziele</h1>
          <p className="text-sm text-muted-foreground">
            Strategie-Kaskade Vision → Theme → OKR → KPI, mit €-Rollup.
          </p>
        </div>
        <ZieleSubTabs active={tab} />
      </header>

      <div className="flex items-center justify-between rounded-md border bg-card px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {themes.length} Themes · {visions.length} Vision(en) im Scope
        </p>
        <TenantRollup
          planned={tenantTrio.planned}
          realized={tenantTrio.realized}
          runRate={tenantTrio.runRate}
        />
      </div>

      {tab === "strategie" && <StrategyTreeView visions={visions} themes={themes} />}
      {tab === "okrs" && <Placeholder name="OKRs (Quartal-Board)" />}
      {tab === "money" && <Placeholder name="Money (Strategic Investment Sheet)" />}
      {tab === "pflege" && <Placeholder name="Pflege (KPI-Bibliothek + valuePerUnit)" />}
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

function Placeholder({ name }: { name: string }) {
  return (
    <div className="grid h-[420px] place-items-center rounded-lg border border-dashed bg-muted/10">
      <div className="text-center">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">Skelett — kommt mit der naechsten Phase.</p>
      </div>
    </div>
  );
}
