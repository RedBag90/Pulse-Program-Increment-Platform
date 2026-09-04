import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadPeriodDetail } from "@/modules/budgeting/server/views/period-detail";
import { loadDistributionOverview } from "@/modules/budgeting/server/views/distribution-overview";
import { Sheets } from "@/modules/budgeting/features/components/period/ballot-sheets";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { Link } from "@/i18n/navigation";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Druckbare Verteilbögen **dieser** Kachel — ein Bogen je Gruppe, für die
 * Verteilung auf Papier. Verlinkt aus dem Reiter „Verteilung".
 *
 * Vorgänger war `/budgeting/rounds/sheet`, das die Runde des tenant-weiten
 * „aktiven Zyklus" zeigte und aus der Oberfläche gar nicht mehr erreichbar war.
 */
export default async function SheetPage({ params }: Props) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [detail, overview] = await Promise.all([
    loadPeriodDetail(db, principal, id),
    loadDistributionOverview(db, principal, id),
  ]);
  if (!detail || !overview) notFound();

  return (
    <Page>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Participatory Budgeting"
          title="Verteilbögen"
          subtitle="Ein Bogen je Gruppe — zum Ausdrucken für die Verteilung auf Papier."
          actions={
            <Link
              href={`/budgeting/periods/${id}?tab=verteilung`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Zur Verteilung
            </Link>
          }
        />
      </div>
      <Sheets
        model={{
          cycleLabel: halfYearLabel(detail.round.cycleKey),
          poolTotal: detail.round.poolTotal,
          distributable: overview.distributable,
          groups: overview.groups.map((g) => ({ id: g.id, name: g.name })),
          candidates: overview.candidates.map((c) => ({
            id: c.id,
            title: c.title,
            ask: c.ask,
            kind: c.kind,
            valueStreamName: c.valueStreamName,
            solutionName: c.solutionName,
          })),
        }}
      />
    </Page>
  );
}
