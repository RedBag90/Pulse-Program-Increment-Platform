import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { loadSolutionsList } from "@/modules/work/server/views/solutions-list";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { rtbAnnualAmount } from "@/modules/budgeting/domain/rtb-interval";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { ConceptCallout } from "@/modules/work/features/portfolio/components/solutions/concept-callout";
import { SolutionsCreateControl } from "@/modules/work/features/portfolio/components/solutions/solutions-create-control";
import { Page, PageHeader } from "@/components/layout";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Solutions-Verwaltung: langlebige Produkte/Systeme je Value Stream, klassifiziert
 * nach Investitionshorizont. Grow (Σ aktive Primär-Epics) + Run (Σ zugerechnete
 * Betriebskosten p. a.) je Zeile; Klick öffnet die Detailseite.
 *
 * Kompositions-Wurzel über zwei Modulen (ADR-0013): Grow aus **Work**, Run aus
 * **Budgeting**. Ohne dessen Entitlement entfällt die Run-Spalte ganz.
 */
export default async function SolutionsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const canManage = hasCapability(principal, "solution.create", { tenantId: principal.tenantId });
  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const [rows, rtbItems] = await Promise.all([
    loadSolutionsList(db, principal.tenantId),
    budgetingEnabled ? listRtbItems(db, principal.tenantId) : Promise.resolve(null),
  ]);

  // Run je Solution: Σ Jahres-Äquivalent der aktiven Positionen, die ihr
  // zugerechnet sind. Wertstrom-übergreifende Positionen (`solutionId === null`)
  // zählen bewusst in keine Zeile.
  const runBySolution = new Map<string, number>();
  for (const it of rtbItems ?? []) {
    if (!it.active || it.solutionId == null) continue;
    const annual = rtbAnnualAmount(it.plannedAmount, it.interval);
    runBySolution.set(it.solutionId, (runBySolution.get(it.solutionId) ?? 0) + annual);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Portfolio"
        title="Solutions"
        subtitle="Langlebige Produkte/Systeme je Value Stream, klassifiziert nach Investitionshorizont."
        actions={
          canManage ? (
            <Suspense fallback={null}>
              <SolutionsCreateControl />
            </Suspense>
          ) : undefined
        }
      />

      <div className="mb-5">
        <ConceptCallout storageKey="solution-vs-epic" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm font-medium">Noch keine Solutions.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {canManage
              ? "Erste Schritte: 1. Solution anlegen · 2. Horizont setzen · 3. Epics zuordnen. Danach erscheinen die Horizont-Swimlanes im Portfolio-Kanban."
              : "Ein Admin/Portfolio-Manager legt Solutions an."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Value Stream</th>
                <th className="px-4 py-2.5 font-semibold">ART</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Epics</th>
                <th className="px-4 py-2.5 text-right font-semibold">Grow</th>
                {budgetingEnabled && (
                  <th className="px-4 py-2.5 text-right font-semibold">Run p.a.</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/portfolio/solutions/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.valueStreamName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {s.artName ?? <span className="italic">— kein ART —</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <HorizonBadge horizon={s.horizon} investmentMode={s.investmentMode} withHelp />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.epicCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {s.grow > 0 ? formatCompactEUR(s.grow) : "—"}
                  </td>
                  {budgetingEnabled && (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {(runBySolution.get(s.id) ?? 0) > 0
                        ? formatCompactEUR(runBySolution.get(s.id)!)
                        : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
