import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPortfolioOverview } from "@/server/services/portfolio-overview";
import { redirect } from "next/navigation";
import { ViewSwitcher, resolveOverviewView } from "@/features/portfolio/overview/view-switcher";
import { OverviewMissionControl } from "@/features/portfolio/overview/overview-mission-control";
import { OverviewHero } from "@/features/portfolio/overview/overview-hero";
import { OverviewExecutive } from "@/features/portfolio/overview/overview-executive";

interface Props {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Portfolio Übersicht — three parallel variants behind a `?view=` switcher so
 * the user can compare and decide. All three consume the same overview DTO;
 * any single variant can be promoted to the default by changing
 * `resolveOverviewView`'s fallback.
 */
export default async function PortfolioPage({ searchParams }: Props) {
  const { view: rawView } = await searchParams;
  const view = resolveOverviewView(rawView);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const data = await getPortfolioOverview(db, principal.tenantId);

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Portfolio-Übersicht
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Strategischer Bezug, Funding und Flow auf einen Blick.
          </p>
        </div>
        <ViewSwitcher current={view} />
      </header>

      {view === "mission" && <OverviewMissionControl data={data} />}
      {view === "hero" && <OverviewHero data={data} />}
      {view === "executive" && <OverviewExecutive data={data} />}
    </main>
  );
}
