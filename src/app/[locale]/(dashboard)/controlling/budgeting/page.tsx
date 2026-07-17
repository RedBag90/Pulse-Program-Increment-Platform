import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { getBudgetingBoard } from "@/server/services/budgeting";
import { BudgetingBoard } from "@/features/budgeting/components/budgeting-board-lazy";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/layout";

/**
 * Participatory Budgeting — distribute the budget pool across the Epics staged
 * for the next budget meeting (with an approved hypothesis or business case),
 * prioritise and schedule them, and see the per-value-stream roll-up.
 *
 * Modul-Verantwortlichkeit: Budgeting ist eine zentral-strukturierte
 * Controlling-Aufgabe (User-Prinzip „alles ausser Epic-Bedarf + KPI-
 * Definition lebt im Controlling"); deshalb sitzt die Route unter
 * `/controlling/budgeting`. Die alte `/portfolio/budgeting`-URL
 * redirected hierhin.
 */
export default async function BudgetingPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("budget.manage", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/controlling");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const data = await getBudgetingBoard(db, principal.tenantId);

  return (
    <Page>
      <PageHeader
        title="Participatory Budgeting"
        subtitle="Budget je Halbjahr auf vorgemerkte Epics verteilen — priorisieren, terminieren, Wertstrom-Verteilung"
        actions={
          <Link
            href="/controlling"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Controlling
          </Link>
        }
      />

      <BudgetingBoard data={data} canManage />
    </Page>
  );
}
