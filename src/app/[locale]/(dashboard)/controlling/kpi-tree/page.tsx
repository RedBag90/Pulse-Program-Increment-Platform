import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { getKpiTree, type GoalNode } from "@/server/services/controlling";
import { KpiTree } from "@/features/controlling/components/kpi-tree";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat, StatStrip } from "@/components/ui/stat";
import { MarginRail, MarginNote } from "@/components/layout/margin-rail";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number) => eur.format(Math.round(v));

export default async function KpiTreePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tree = await getKpiTree(db, principal.tenantId);

  // Coarse "may set any valuation in this tenant" (admins / portfolio_manager /
  // transformation_lead pass; value_stream_owner and the VS finance approver
  // are enforced authoritatively at the service seam).
  const canEdit = authorize("kpi.value.manage", { tenantId: principal.tenantId }, principal).allow;

  const allKpis = [
    ...tree.goals.flatMap((g) => g.strategicKpis),
    ...tree.goals.flatMap((g) => g.epics.flatMap((e) => e.kpis)),
    ...tree.unboundStrategicKpis,
  ];
  const valuedKpis = allKpis.filter((k) => k.valuePerUnit != null).length;
  const totalContribution = allKpis
    .map((k) => k.contribution)
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);

  const unvaluedKpis = allKpis.length - valuedKpis;
  const epicsWithoutKpis = tree.goals.flatMap((g) =>
    g.epics.filter((e) => e.kpis.length === 0).map((e) => ({ goal: g.title, epic: e.title })),
  );

  return (
    <main className="p-6 md:p-8">
      {/* Context bar */}
      <header className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-normal tracking-tight">KPI-Wertbeitrag</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vom Ziel über das Epic bis zur KPI — und was eine KPI-Bewegung monetär wert ist.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Content */}
        <div className="min-w-0 flex-1 space-y-8">
          {/* Headline strip */}
          <StatStrip>
            <Stat label="Ziele" value={tree.goals.length} />
            <Stat label="KPIs" value={allKpis.length} />
            <Stat
              label="Bewertet"
              value={valuedKpis}
              delta={{
                tone: unvaluedKpis === 0 ? "up" : "flat",
                text: `${unvaluedKpis} offen`,
              }}
            />
            <Stat
              label="Σ Beitrag"
              value={fmtEur(totalContribution)}
              {...(totalContribution > 0
                ? { valueClassName: "text-emerald-600 dark:text-emerald-400" }
                : totalContribution < 0
                  ? { valueClassName: "text-destructive" }
                  : {})}
            />
          </StatStrip>

          {/* Tree */}
          <section className="space-y-3">
            <SectionLabel>Ziel-Baum</SectionLabel>
            <KpiTree tree={tree} canEdit={canEdit} />
          </section>
        </div>

        {/* Margin rail — derived from existing data only. */}
        <MarginRail>
          <SectionLabel>Randnotizen</SectionLabel>
          {!canEdit && (
            <MarginNote label="Nur Lesen">
              Werte können nur von Portfolio-Manager, Transformation-Lead, dem Finance-Approver des
              Wertstroms oder Admins gesetzt werden.
            </MarginNote>
          )}
          {unvaluedKpis > 0 && (
            <MarginNote label={`Ohne €-Wert · ${unvaluedKpis}`} tone="amber">
              {unvaluedKpis} KPI{unvaluedKpis !== 1 ? "s" : ""} haben noch keine monetäre Bewertung.
            </MarginNote>
          )}
          {epicsWithoutKpis.length > 0 && (
            <MarginNote label="Epics ohne KPI" tone="muted">
              <ul className="space-y-0.5">
                {epicsWithoutKpis.slice(0, 6).map((p, i) => (
                  <li key={`${p.goal}-${p.epic}-${i}`} className="truncate">
                    {p.epic}
                  </li>
                ))}
              </ul>
            </MarginNote>
          )}
          {tree.goals.length === 0 ? (
            <MarginNote label="Hinweis">
              Noch keine Ziele angelegt — siehe Transformation → Ziele.
            </MarginNote>
          ) : (
            <BlockedNote goals={tree.goals} />
          )}
        </MarginRail>
      </div>
    </main>
  );
}

function BlockedNote({ goals }: { goals: GoalNode[] }) {
  const blocked = goals.flatMap((g) => g.epics.filter((e) => e.status === "blocked"));
  if (blocked.length === 0) return null;
  return (
    <MarginNote label={`Blockiert · ${blocked.length}`} tone="destructive">
      {blocked.length} verknüpfte Epic{blocked.length !== 1 ? "s" : ""} blockiert.
    </MarginNote>
  );
}
