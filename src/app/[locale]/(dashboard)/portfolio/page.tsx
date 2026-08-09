import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadPortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { redirect } from "next/navigation";
import { ViewSwitcher } from "@/modules/work/features/portfolio/overview/view-switcher";
import { resolveOverviewView } from "@/modules/work/features/portfolio/overview/view-switcher-config";
import { OverviewMissionControl } from "@/modules/work/features/portfolio/overview/overview-mission-control";
import { OverviewHero } from "@/modules/work/features/portfolio/overview/overview-hero";
import { OverviewExecutive } from "@/modules/work/features/portfolio/overview/overview-executive";
import { Page, PageHeader } from "@/components/layout";

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
  const data = await loadPortfolioOverview(db, principal.tenantId);

  return (
    <Page>
      <PageHeader
        title="Portfolio-Übersicht"
        subtitle="Strategischer Bezug, Funding und Flow auf einen Blick."
        actions={<ViewSwitcher current={view} />}
      />

      {view === "mission" && <OverviewMissionControl data={data} />}
      {view === "hero" && <OverviewHero data={data} />}
      {view === "executive" && <OverviewExecutive data={data} />}
    </Page>
  );
}
