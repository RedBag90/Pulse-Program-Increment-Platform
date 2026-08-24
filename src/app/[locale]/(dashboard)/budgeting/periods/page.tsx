import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { loadPeriodsGallery } from "@/modules/budgeting/server/views/periods-gallery";
import { PeriodTileCard } from "@/modules/budgeting/features/components/period/period-tile";
import { CreatePeriodDialog } from "@/modules/budgeting/features/components/period/create-period-dialog";
import { SectionLabel } from "@/components/ui/section-label";
import { Page, PageHeader } from "@/components/layout";

/**
 * Budgeting-Zeiträume als Kachel-Gallery. Je Kachel ein Zeitraum; in der Kachel
 * lebt der Participatory-Budgeting-Prozess. Kommende + laufende Kacheln stehen im
 * Fokus, abgeschlossene wandern ausgegraut nach unten.
 */
export default async function BudgetingPeriodsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const canManage = hasCapability(principal, "budget.round.manage", { tenantId: principal.tenantId });
  const model = await loadPeriodsGallery(db, principal.tenantId, canManage);

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Budgeting-Zeiträume"
        subtitle="Je Kachel ein Zeitraum — Beteiligte, Gruppen, Verteilung und Finalisierung leben darin."
        actions={model.canManage ? <CreatePeriodDialog /> : undefined}
      />

      {model.focus.length === 0 && model.past.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Budgeting-Zeiträume.{" "}
            {model.canManage ? "Lege die erste Kachel an." : "Ein Admin/Finance legt sie an."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {model.focus.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Im Fokus</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {model.focus.map((t) => (
                  <PeriodTileCard key={t.id} tile={t} />
                ))}
              </div>
            </section>
          )}

          {model.past.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Abgeschlossen</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {model.past.map((t) => (
                  <PeriodTileCard key={t.id} tile={t} muted />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
