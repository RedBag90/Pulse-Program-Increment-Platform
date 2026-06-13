import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import {
  getPortfolioEconomics,
  getPortfolioGuardrailsInputs,
} from "@/server/services/portfolio-dashboard";
import { PortfolioDashboard } from "@/features/portfolio/components/dashboard/portfolio-dashboard";
import { PortfolioGuardrailsSection } from "@/features/portfolio/components/dashboard/portfolio-guardrails-section";
import { computePortfolioGuardrails } from "@/server/views/portfolio-guardrails-view";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * Portfolio Dashboard — portfolio-wide economics over time: cost, earned
 * business value, ROI, cash-flow and break-even, stacked per Epic. A pure
 * aggregation/visualisation layer over each Epic's business-case inputs.
 */
export default async function PortfolioDashboardPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [data, guardrailsInputs] = await Promise.all([
    getPortfolioEconomics(db, principal.tenantId),
    getPortfolioGuardrailsInputs(db, principal.tenantId),
  ]);

  const canEdit = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;

  // Targets-Pflege fuer die Guardrails lebt unter Setup & Controlling
  // (`/controlling`). Hier wird nur der Ist-vs-Soll-Mix gerendert.
  const guardrailsModel = computePortfolioGuardrails({
    epics: guardrailsInputs.epics,
    targets: guardrailsInputs.targets,
  });

  return (
    <main className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio-Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Wirtschaftlichkeit über Zeit — Kosten, Business Value, ROI und Break-even je Epic
          </p>
        </div>
        <Link
          href="/portfolio"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Portfolio
        </Link>
      </div>

      <PortfolioGuardrailsSection model={guardrailsModel} />

      {data.epics.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Noch keine Epics mit Business-Case-Daten. Hinterlege Kosten und Nutzen im Business Case
          eines Epics, damit das Dashboard rechnet.
        </div>
      ) : (
        <PortfolioDashboard data={data} canEdit={canEdit} />
      )}
    </main>
  );
}
