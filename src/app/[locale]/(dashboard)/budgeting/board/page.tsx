import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { loadBudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";
import { BudgetingBoard } from "@/modules/budgeting/features/components/board/budgeting-board-lazy";
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
 * `/budgeting/board`. Die alten `/portfolio/budgeting`- und
 * `/controlling/budgeting`-URLs redirecten hierhin.
 */
export default async function BudgetingPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("budget.manage", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/budgeting");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadBudgetingBoardModel(db, principal.tenantId);

  return (
    <Page>
      <PageHeader
        title="Participatory Budgeting"
        subtitle="Budget je Halbjahr auf vorgemerkte Epics verteilen — priorisieren, terminieren, Wertstrom-Verteilung"
        actions={
          <Link
            href="/budgeting"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Controlling
          </Link>
        }
      />

      <BudgetingBoard model={model} canManage />
    </Page>
  );
}
