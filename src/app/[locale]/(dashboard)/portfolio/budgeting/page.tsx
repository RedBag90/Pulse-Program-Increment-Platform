import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { getBudgetingBoard } from "@/server/services/budgeting";
import { BudgetingBoard } from "@/features/budgeting/components/budgeting-board";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * Participatory Budgeting — distribute the budget pool across the Epics staged
 * for the next budget meeting (with an approved hypothesis or business case),
 * prioritise and schedule them, and see the per-value-stream roll-up.
 */
export default async function BudgetingPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("budget.manage", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/portfolio");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const data = await getBudgetingBoard(db, principal.tenantId);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Participatory Budgeting</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Budget je Halbjahr auf vorgemerkte Epics verteilen — priorisieren, terminieren,
            Wertstrom-Verteilung
          </p>
        </div>
        <Link
          href="/portfolio"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Portfolio
        </Link>
      </div>

      <BudgetingBoard data={data} canManage />
    </main>
  );
}
