import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  loadPortfolioOverview,
  type PortfolioFilter,
} from "@/modules/work/server/views/portfolio-overview";
import { listImpedimentsForArts } from "@/modules/drumbeat/server/services/impediment";
import {
  getBudgetingBoard,
  getValueStreamBudgets,
} from "@/modules/budgeting/server/services/budgeting";
import { listRisks } from "@/modules/risks/server/services/risk";
import { riskPositions, type RiskLevel } from "@/modules/risks/domain/risk-matrix";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listSavedPortfolioFilters } from "@/modules/work/server/services/saved-portfolio-filter";
import { redirect } from "next/navigation";
import { ViewSwitcher } from "@/modules/work/features/portfolio/overview/view-switcher";
import { resolveOverviewView } from "@/modules/work/features/portfolio/overview/view-switcher-config";
import { PortfolioFilterBar } from "@/modules/work/features/portfolio/overview/portfolio-filter-bar";
import { OverviewMissionControl } from "@/modules/work/features/portfolio/overview/overview-mission-control";
import { OverviewHero } from "@/modules/work/features/portfolio/overview/overview-hero";
import { OverviewExecutive } from "@/modules/work/features/portfolio/overview/overview-executive";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  searchParams: Promise<{
    view?: string;
    vs?: string;
    gate?: string;
    status?: string;
    owner?: string;
    /** Marker "f=0" = Nutzer hat explizit zurückgesetzt → kein Auto-Standard. */
    f?: string;
  }>;
}

const splitCsv = (v: string | undefined): string[] =>
  typeof v === "string" && v ? v.split(",").filter(Boolean) : [];

/**
 * Portfolio Übersicht — three parallel variants behind a `?view=` switcher so
 * the user can compare and decide. A Filterleiste (Wertstrom · Stage Gate ·
 * Status · Owner) verengt die gesamte Übersicht; gespeicherte Filter (pro
 * Nutzer) sind anwendbar, einer als Standard automatisch beim Öffnen.
 */
export default async function PortfolioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = resolveOverviewView(sp.view);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const savedFilters = await listSavedPortfolioFilters(db, principal);

  // Auto-Standard: keine Filter-Parameter in der URL UND kein „leer"-Marker →
  // den als Standard markierten Filter des Nutzers anwenden (Redirect, damit die
  // URL Single Source of Truth bleibt und teilbar ist).
  const anyFilterParam = Boolean(sp.vs || sp.gate || sp.status || sp.owner);
  const explicitlyCleared = sp.f === "0";
  if (!anyFilterParam && !explicitlyCleared) {
    const def = savedFilters.find((x) => x.isDefault);
    const c = def?.criteria;
    if (c && (c.vs.length || c.gate.length || c.status.length || c.owner.length)) {
      const qs = new URLSearchParams();
      if (sp.view) qs.set("view", sp.view);
      if (c.vs.length) qs.set("vs", c.vs.join(","));
      if (c.gate.length) qs.set("gate", c.gate.join(","));
      if (c.status.length) qs.set("status", c.status.join(","));
      if (c.owner.length) qs.set("owner", c.owner.join(","));
      redirect(`/portfolio?${qs.toString()}`);
    }
  }

  const filter: PortfolioFilter = {
    valueStreamIds: splitCsv(sp.vs),
    stageGates: splitCsv(sp.gate),
    statuses: splitCsv(sp.status),
    ownerIds: splitCsv(sp.owner),
  };

  // Filter-Optionen für die Leiste (Server-geladen → Bar ist rein kontrolliert).
  const [valueStreamRows, ownerLabels] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const valueStreams = valueStreamRows.map((v) => ({ id: v.id, name: v.name }));
  const owners = Object.entries(ownerLabels).map(([id, label]) => ({ id, label }));

  // Composition-Root reicht die Adapter für Drumbeat (Impediment), Budgeting und
  // Risks in das Work-View — Work importiert diese oberen Layer nicht direkt
  // (ADR-0013). Wertstrom-/Owner-Filter greifen zusätzlich in Risks/Budgeting.
  const data = await loadPortfolioOverview(
    db,
    principal.tenantId,
    async (artIds) =>
      (await listImpedimentsForArts(db, principal.tenantId, artIds, { status: "open" })).length,
    async () => {
      const [board, vsBudgets] = await Promise.all([
        getBudgetingBoard(db, principal.tenantId),
        getValueStreamBudgets(db, principal.tenantId),
      ]);
      // Wertstrom-Filter: nur die gewählten VS-Zeilen zeigen (Pool bleibt).
      const filteredVs = filter.valueStreamIds.length
        ? {
            valueStreams: vsBudgets.valueStreams.filter((v) =>
              filter.valueStreamIds.includes(v.valueStreamId),
            ),
          }
        : vsBudgets;
      return { board, vsBudgets: filteredVs };
    },
    async () => {
      const { items } = await listRisks(db, principal, { page: 1, pageSize: 500 });
      // Wertstrom-Filter für Risiken: Menge der Epic-IDs in den gewählten VS.
      let vsEpicIds: Set<string> | null = null;
      if (filter.valueStreamIds.length) {
        const eps = await db.initiative.findMany({
          where: {
            tenantId: principal.tenantId,
            level: InitiativeLevel.EPIC,
            deletedAt: null,
            valueStreamId: { in: filter.valueStreamIds },
          },
          select: { id: true },
        });
        vsEpicIds = new Set(eps.map((e) => e.id));
      }
      const epicIdSet = vsEpicIds;
      return items
        .filter((r) => r.reviewStatus === "documented" && r.roamStatus !== "resolved")
        .filter(
          (r) => !filter.ownerIds.length || (r.ownerId != null && filter.ownerIds.includes(r.ownerId)),
        )
        .filter((r) => !epicIdSet || r.epicLinks.some((l) => epicIdSet.has(l.epicId)))
        .map((r) => {
          const current = riskPositions(
            { probability: r.probability, impact: r.impact },
            r.assessments.map((a) => ({
              probability: a.probability as RiskLevel,
              impact: a.impact as RiskLevel,
            })),
          ).current;
          const epic = r.epicLinks[0]?.epic ?? null;
          return {
            id: r.id,
            riskNumber: r.riskNumber,
            title: r.title,
            band: current?.band ?? null,
            score: current?.score ?? null,
            roamStatus: r.roamStatus as RoamStatus,
            epic: epic ? { id: epic.id, title: epic.title } : null,
          };
        });
    },
    filter,
  );

  return (
    <Page>
      <PageHeader
        title="Portfolio-Übersicht"
        subtitle="Strategischer Bezug, Funding und Flow auf einen Blick."
        actions={<ViewSwitcher current={view} />}
      />

      <div className="mb-4">
        <PortfolioFilterBar
          valueStreams={valueStreams}
          owners={owners}
          savedFilters={savedFilters}
        />
      </div>

      {view === "mission" && <OverviewMissionControl data={data} />}
      {view === "hero" && <OverviewHero data={data} />}
      {view === "executive" && <OverviewExecutive data={data} />}
    </Page>
  );
}
