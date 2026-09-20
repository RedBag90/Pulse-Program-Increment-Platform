import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  loadPortfolioOverview,
  type PortfolioFilter,
} from "@/modules/work/server/views/portfolio-overview";
import {
  getBudgetingBoard,
  getValueStreamBudgets,
} from "@/modules/budgeting/server/services/budgeting";
import {
  cycleRunCosts,
  artEpicCycleAllocations,
} from "@/modules/budgeting/server/services/rtb-item-service";
import { getEpicCycleAllocations } from "@/modules/budgeting/server/services/epic-allocation";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { bandForScore, riskExposure, type RiskLevel } from "@/modules/core/kernel/domain/exposure";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listSavedPortfolioFilters } from "@/modules/work/server/services/saved-portfolio-filter";
import { getTenantPractices } from "@/server/services/target-model";
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
    /** Epic-Klasse (`portfolio` | `art`) — nur bei aktiver Practice `artEpics`. */
    cls?: string;
    /** Marker "f=0" = Nutzer hat explizit zurückgesetzt → kein Auto-Standard. */
    f?: string;
  }>;
}

const splitCsv = (v: string | undefined): string[] =>
  typeof v === "string" && v ? v.split(",").filter(Boolean) : [];

// Die Schwellen standen hier als dritte Abschrift, weil `ExposureBand` im
// `risks`-Modul lag. Seit die Skala im Kernel steht (wie ROAM), liest sie jeder
// von dort — inklusive dieser Stelle.

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

  const [savedFilters, practices] = await Promise.all([
    listSavedPortfolioFilters(db, principal),
    getTenantPractices(db, principal.tenantId),
  ]);

  // Auto-Standard: keine Filter-Parameter in der URL UND kein „leer"-Marker →
  // den als Standard markierten Filter des Nutzers anwenden (Redirect, damit die
  // URL Single Source of Truth bleibt und teilbar ist).
  const anyFilterParam = Boolean(sp.vs || sp.gate || sp.status || sp.owner || sp.cls);
  const explicitlyCleared = sp.f === "0";
  if (!anyFilterParam && !explicitlyCleared) {
    const def = savedFilters.find((x) => x.isDefault);
    const c = def?.criteria;
    if (c && (c.vs.length || c.gate.length || c.status.length || c.owner.length || c.cls.length)) {
      const qs = new URLSearchParams();
      if (sp.view) qs.set("view", sp.view);
      if (c.vs.length) qs.set("vs", c.vs.join(","));
      if (c.gate.length) qs.set("gate", c.gate.join(","));
      if (c.status.length) qs.set("status", c.status.join(","));
      if (c.owner.length) qs.set("owner", c.owner.join(","));
      if (c.cls.length) qs.set("cls", c.cls.join(","));
      redirect(`/portfolio?${qs.toString()}`);
    }
  }

  const filter: PortfolioFilter = {
    valueStreamIds: splitCsv(sp.vs),
    stageGates: splitCsv(sp.gate),
    statuses: splitCsv(sp.status),
    ownerIds: splitCsv(sp.owner),
    // Ohne die Practice gibt es keine ART-Epics — dann ignoriert die Seite den
    // Parameter, statt eine leere Unterscheidung zu treffen.
    epicClasses: practices.artEpics ? splitCsv(sp.cls) : [],
  };

  // Filter-Optionen für die Leiste (Server-geladen → Bar ist rein kontrolliert).
  const [valueStreamRows, ownerLabels] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const valueStreams = valueStreamRows.map((v) => ({ id: v.id, name: v.name }));
  const owners = Object.entries(ownerLabels).map(([id, label]) => ({ id, label }));

  // Composition-Root reicht die Adapter für Budgeting und Risks in das
  // Work-View — Work importiert diese oberen Layer nicht direkt (ADR-0013).
  // Wertstrom-/Owner-Filter greifen zusätzlich in Risks/Budgeting. Risiken
  // kommen aus dem vereinten `Issue`-Register (db.issue), inline geformt.
  // Budgeting-Adapter mit seinem ECHTEN zweiten Adapter: ohne Entitlement liefert
  // der Port leere Daten, statt den oberen Layer zu laden — genau die
  // Degradation, die ADR-0013 fuer Cross-Modul-Komposite verlangt.
  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const data = await loadPortfolioOverview(
    db,
    principal.tenantId,
    async () => {
      if (!budgetingEnabled) {
        return {
          board: { periods: [], pool: {} },
          vsBudgets: { valueStreams: [] },
          cycleAllocations: {},
          // Ohne Budgeting-Modul gibt es keine Kacheln — und damit auch keinen
          // geltenden Budget-Rahmen.
          budgetCycleKey: null,
        };
      }
      const [board, vsBudgets, cycle] = await Promise.all([
        getBudgetingBoard(db, principal.tenantId),
        getValueStreamBudgets(db, principal.tenantId),
        getEpicCycleAllocations(db, principal.tenantId, new Date()),
      ]);
      // Wertstrom-Filter: nur die gewählten VS-Zeilen zeigen (Pool bleibt).
      const filteredVs = filter.valueStreamIds.length
        ? {
            valueStreams: vsBudgets.valueStreams.filter((v) =>
              filter.valueStreamIds.includes(v.valueStreamId),
            ),
          }
        : vsBudgets;
      // Zyklus-Allokationen werden im Work-Modell nur über die (bereits
      // gefilterten) Karten aggregiert — kein zusätzlicher VS-Filter nötig.
      return {
        board,
        vsBudgets: filteredVs,
        cycleAllocations: cycle.byEpic,
        budgetCycleKey: cycle.cycleKey,
      };
    },
    async () => {
      const issues = await db.issue.findMany({
        where: { tenantId: principal.tenantId, deletedAt: null, reviewStatus: "documented" },
        include: {
          initiative: { select: { id: true, title: true, level: true, parentId: true } },
        },
      });
      // Wertstrom-Filter für Issues: Menge der Epic-IDs in den gewählten VS.
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
      // Das „Epic" eines Issues: die verknüpfte Initiative selbst, wenn Epic
      // (level 0), sonst deren Parent (Feature → Epic). Titel nur bei direkt
      // verknüpftem Epic bekannt (der Parent-Titel liegt nicht im Include).
      const epicIdOf = (init: { id: string; level: number; parentId: string | null } | null) =>
        init ? (init.level === 0 ? init.id : init.parentId) : null;
      // **`resolved` gehört dazu.** Hier stand `.filter((r) => r.roamStatus
      // !== "resolved")`, solange die Übersicht *eine* Liste „aktiver" Risiken
      // zeigte. Seit sie ein ROAM-Board ist, hat jede Disposition ihre eigene
      // Kachel — und eine davon heißt „Resolved". Sie wegzufiltern hieße, eine
      // leere Kachel zu zeigen, wo Arbeit steht.
      return issues
        .filter(
          (r) =>
            !filter.ownerIds.length || (r.ownerId != null && filter.ownerIds.includes(r.ownerId)),
        )
        .filter(
          (r) =>
            !epicIdSet ||
            (() => {
              const eid = epicIdOf(r.initiative);
              return eid != null && epicIdSet.has(eid);
            })(),
        )
        .filter((r) => r.probability != null && r.impact != null)
        .map((r) => {
          const score = riskExposure(r.probability as RiskLevel, r.impact as RiskLevel).score;
          const epic =
            r.initiative && r.initiative.level === 0
              ? { id: r.initiative.id, title: r.initiative.title }
              : null;
          return {
            id: r.id,
            riskNumber: r.issueNumber,
            title: r.title,
            band: bandForScore(score),
            score,
            roamStatus: r.roamStatus as RoamStatus,
            epic,
          };
        });
    },
    // Betriebskosten für den Horizont-Trichter, auf der Periode des angewandten
    // Zyklus — getrennt nach Solution-Zurechnung und wertstromübergreifend.
    // Ohne das Budgeting-Modul gibt es keine Run-the-Business-Positionen; dann
    // zeigt der Trichter nur die Investition, und das ist die ganze Wahrheit.
    async () =>
      budgetingEnabled ? cycleRunCosts(db, principal.tenantId) : { bySolution: {}, unassigned: [] },
    // Der ART-Rahmen: der zweite Geldweg. Ohne ihn zeigte der Trichter für
    // ART-Epics null, obwohl ihnen zugeteilt wurde.
    async (cycleKey) =>
      budgetingEnabled ? artEpicCycleAllocations(db, principal.tenantId, cycleKey) : {},
    filter,
    // Ohne das Modul gibt es kein Geld zu messen: der Horizont-Trichter misst
    // dann die laufenden Epics statt lauter leerer Umrisse zu zeigen.
    budgetingEnabled,
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
          showClassFacet={practices.artEpics}
        />
      </div>

      {view === "mission" && <OverviewMissionControl data={data} />}
      {view === "hero" && <OverviewHero data={data} />}
      {view === "executive" && <OverviewExecutive data={data} />}
    </Page>
  );
}
