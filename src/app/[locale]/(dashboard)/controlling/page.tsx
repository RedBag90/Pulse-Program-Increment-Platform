import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { halfYearKey, halfYearLabel } from "@/domain/calendar";
import {
  getLatestBudgetPlanRevision,
  listBudgetPlanRevisions,
} from "@/server/services/budget-plan-revision";
import { getKpiTree } from "@/server/services/controlling";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { CaptureRevisionButton } from "@/features/controlling/components/capture-revision-button";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat, StatStrip } from "@/components/ui/stat";
import { fmtEur } from "@/components/format/eur";
import { userLabel } from "@/components/detail/initiative-labels";
import { Link } from "@/i18n/navigation";

/**
 * Controlling-Übersicht — die Landing-Seite für budgetdisziplin und
 * KPI-Wertbeitrag. Surfacet die aktuelle Budget-Plan-Revision (oder eine
 * Empty-State-CTA, wenn noch keine existiert), eine Liste vergangener
 * Revisionen und die KPI-Tree-Headlines.
 */
export default async function ControllingOverviewPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [latest, history, kpiTree, userLabels] = await Promise.all([
    getLatestBudgetPlanRevision(db, principal.tenantId),
    listBudgetPlanRevisions(db, principal.tenantId),
    getKpiTree(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const canCapture = authorize(
    "budget_plan.revision.capture",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  const cycleKey = halfYearKey(new Date());
  const cycleLabel = halfYearLabel(cycleKey);

  // KPI-Tree-Headlines — derived inline (cheaper than calling the page helper).
  const allKpis = [
    ...kpiTree.goals.flatMap((g) => g.strategicKpis),
    ...kpiTree.goals.flatMap((g) => g.epics.flatMap((e) => e.kpis)),
    ...kpiTree.unboundStrategicKpis,
  ];
  const valuedKpis = allKpis.filter((k) => k.valuePerUnit != null).length;
  const totalContribution = allKpis
    .map((k) => k.contribution)
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);

  const latestIsCurrentCycle = latest?.cycleKey === cycleKey;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Controlling-Übersicht</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Budget-Disziplin und Wertbeitrag in einer Sicht.
        </p>
      </div>

      <StatStrip>
        <Stat
          label="Aktiver Zyklus"
          value={<span className="text-xl">{cycleLabel}</span>}
          delta={
            latest
              ? {
                  tone: latestIsCurrentCycle ? "up" : "flat",
                  text: latestIsCurrentCycle
                    ? "Aktuelle Revision verfügbar"
                    : `Letzte Revision: ${latest.cycleLabel}`,
                }
              : { tone: "down", text: "Noch keine Revision" }
          }
        />
        <Stat
          label="Σ Zyklus-Budget"
          value={<span className="text-xl">{latest ? fmtEur(latest.cycleBudgetSum) : "—"}</span>}
          {...(latest && {
            delta: { tone: "flat" as const, text: `${latest.epicCount} Epics priorisiert` },
          })}
        />
        <Stat
          label="Σ Folgebudgets"
          value={<span className="text-xl">{latest ? fmtEur(latest.followBudgetSum) : "—"}</span>}
        />
        <Stat
          label="Σ KPI-Beitrag"
          value={<span className="text-xl">{fmtEur(totalContribution)}</span>}
          delta={{ tone: "flat", text: `${valuedKpis} / ${allKpis.length} KPIs bewertet` }}
        />
      </StatStrip>

      {/* Aktuelle Revision */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Aktuelle Revision</SectionLabel>
          {canCapture && (
            <CaptureRevisionButton
              cycleLabel={cycleLabel}
              variant={latest ? "compact" : "primary"}
            />
          )}
        </div>
        {latest ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm">
                <span className="font-medium">{latest.cycleLabel}</span> · erfasst am{" "}
                {latest.capturedAt.toLocaleDateString("de-DE")} von{" "}
                {userLabel(latest.capturedBy, userLabels)}
              </p>
              <Link
                href={`/controlling/budget-plan/${latest.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Volle Revision öffnen →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Top-Epics (Σ-Budget)</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.epics.slice(0, 5).map((e, i) => (
                    <li key={e.epicId} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="text-muted-foreground">{i + 1}.</span> {e.title}
                      </span>
                      <span className="shrink-0 tabular-nums">{fmtEur(e.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Wertströme</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.valueStreams.slice(0, 5).map((vs) => (
                    <li key={vs.valueStreamId} className="flex justify-between gap-2">
                      <span className="truncate">{vs.name}</span>
                      <span className="shrink-0 tabular-nums">{fmtEur(vs.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Halbjahres-Pool</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.periods.map((p) => (
                    <li key={p.key} className="flex justify-between gap-2">
                      <span>{p.label}</span>
                      <span className="shrink-0 tabular-nums">
                        {fmtEur(latest.snapshot.budgetPoolByPeriod[p.key] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Budget-Plan-Revision erfasst. Friere den aktuellen Stand der teilnehmenden
              Budgetierung ein, um eine reproduzierbare Sicht je Halbjahr zu erhalten.
            </p>
            {canCapture && (
              <div className="mt-4 flex justify-center">
                <CaptureRevisionButton cycleLabel={cycleLabel} variant="primary" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* KPI-Wertbeitrag */}
      <section className="space-y-3">
        <SectionLabel>KPI-Wertbeitrag</SectionLabel>
        <div className="flex items-baseline justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="text-sm">
              <span className="font-medium">{fmtEur(totalContribution)}</span> Σ Beitrag über{" "}
              {valuedKpis} bewertete KPIs
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {allKpis.length - valuedKpis} KPIs ohne Bewertung, {kpiTree.goals.length} aktive Ziele
            </p>
          </div>
          <Link
            href="/controlling/kpi-tree"
            className="text-sm font-medium text-primary hover:underline"
          >
            KPI-Tree öffnen →
          </Link>
        </div>
      </section>

      {/* Vergangene Revisionen */}
      {history.length > 1 && (
        <section className="space-y-3">
          <SectionLabel>Vergangene Revisionen</SectionLabel>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Zyklus</th>
                  <th className="px-3 py-2">Erfasst am</th>
                  <th className="px-3 py-2">Erfasst von</th>
                  <th className="px-3 py-2 text-right">Epics</th>
                  <th className="px-3 py-2 text-right">Σ Zyklus-Budget</th>
                  <th className="px-3 py-2 text-right">Σ Folgebudgets</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/controlling/budget-plan/${h.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {h.cycleLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {h.capturedAt.toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {userLabel(h.capturedBy, userLabels)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.epicCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtEur(h.cycleBudgetSum)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmtEur(h.followBudgetSum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
