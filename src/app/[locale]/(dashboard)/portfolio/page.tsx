import { getTranslations } from "next-intl/server";
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
import { getValueStreamChangeBudgets } from "@/modules/budgeting/server/services/value-stream-change-budget";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { bandForScore, riskExposure, type RiskLevel } from "@/modules/core/kernel/domain/exposure";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listSavedPortfolioFilters } from "@/modules/work/server/services/saved-portfolio-filter";
import { getTenantPractices } from "@/server/services/target-model";
import { redirect } from "next/navigation";
import { ViewSwitcher } from "@/modules/work/features/portfolio/overview/view-switcher";
import {
  availableOverviewViews,
  resolveOverviewView,
} from "@/modules/work/features/portfolio/overview/view-switcher-config";
import { PortfolioFilterBar } from "@/modules/work/features/portfolio/overview/portfolio-filter-bar";
import { OverviewMissionControl } from "@/modules/work/features/portfolio/overview/overview-mission-control";
import { loadViewPreferences } from "@/modules/core/kernel/server/view-preference";
import {
  CONTRIBUTION_VIEW_KEY,
  parseContributionView,
} from "@/modules/work/domain/contribution-view-preference";
import { OverviewReview } from "@/modules/work/features/portfolio/overview/overview-review";
import { OverviewSync } from "@/modules/work/features/portfolio/overview/overview-sync";
import { OverviewBudgeting } from "@/modules/work/features/portfolio/overview/overview-budgeting";
import { Page, PageHeader } from "@/components/layout";
import { loadValueStreamBudgetAccess } from "@/modules/budgeting/server/services/value-stream-budget-access";
import { resolveCycle } from "@/modules/budgeting/domain/cycle";
import { BudgetBurnPanel } from "@/app/[locale]/(dashboard)/budgeting/_components/budget-burn-panel";
import {
  resolveKpiSelection,
  type KpiValueStreamOption,
} from "@/modules/work/domain/budget-kpi-selection";
import type { SyncBurn } from "@/modules/work/features/portfolio/overview/overview-sync";

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
    /** Portfolio Sync: der Wertstrom der Budget-KPIs. */
    kpiVs?: string;
    /** Portfolio Sync: das ART darin; fehlt = „Wertstrom gesamt". */
    kpiArt?: string;
  }>;
}

const splitCsv = (v: string | undefined): string[] =>
  typeof v === "string" && v ? v.split(",").filter(Boolean) : [];

// Die Schwellen standen hier als dritte Abschrift, weil `ExposureBand` im
// `risks`-Modul lag. Seit die Skala im Kernel steht (wie ROAM), liest sie jeder
// von dort — inklusive dieser Stelle.

/**
 * Portfolio Übersicht — „Gesamt" und je eine Ansicht für die drei
 * Portfolio-Termine (Strategic Review, Portfolio Sync, Budgeting) hinter einem
 * `?view=`-Umschalter. A Filterleiste (Wertstrom · Stage Gate ·
 * Status · Owner) verengt die gesamte Übersicht; gespeicherte Filter (pro
 * Nutzer) sind anwendbar, einer als Standard automatisch beim Öffnen.
 */
export default async function PortfolioPage({ searchParams }: Props) {
  const t = await getTranslations();
  const sp = await searchParams;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");
  // Die Budgeting-Ansicht gibt es nur mit dem Modul; ohne fällt `?view=budgeting`
  // auf „Gesamt" zurück.
  const views = availableOverviewViews(principal.enabledModules.includes("budgeting"));
  const view = resolveOverviewView(sp.view, views);

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [savedFilters, practices, viewPreferences] = await Promise.all([
    listSavedPortfolioFilters(db, principal),
    getTenantPractices(db, principal.tenantId),
    // Die gemerkten Kachel-Ansichten des Nutzers — ein Lesezugriff fuer alle
    // Schluessel, in derselben Welle wie der Rest.
    loadViewPreferences(db, principal, [CONTRIBUTION_VIEW_KEY]),
  ]);
  // Geparst, nicht durchgereicht: der gespeicherte Wert ueberlebt
  // Code-Aenderungen, und eine umbenannte Achse wuerde die Kachel sonst mit
  // leerer Spaltenueberschrift rendern.
  const contributionView = parseContributionView(viewPreferences.get(CONTRIBUTION_VIEW_KEY));

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
  // Dieselbe Degradation für Risks — der Kommentar oben nennt beide, gebaut war
  // bis September 2026 nur die eine Hälfte. Ohne das Modul blieben fünf leere
  // ROAM-Kacheln stehen und behaupteten, der Mandant habe **keine** Risiken;
  // in Wahrheit führt er sie gar nicht.
  const risksEnabled = principal.enabledModules.includes("risks");

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
      // Veränderungsgeld je Wertstrom in der geltenden Kachel — Portfolio-Epics
      // und ART-Rahmen (vergeben an Epics, an eigene Arbeit, noch offen). Der
      // Funding-Snapshot zeigt es; ohne geltende Kachel gibt es keins.
      const change = cycle.cycleKey
        ? await getValueStreamChangeBudgets(db, principal.tenantId, cycle.cycleKey)
        : [];
      const changeBudgets = filter.valueStreamIds.length
        ? change.filter((c) => filter.valueStreamIds.includes(c.valueStreamId))
        : change;
      // Zyklus-Allokationen werden im Work-Modell nur über die (bereits
      // gefilterten) Karten aggregiert — kein zusätzlicher VS-Filter nötig.
      return {
        board,
        vsBudgets: filteredVs,
        cycleAllocations: cycle.byEpic,
        budgetCycleKey: cycle.cycleKey,
        changeBudgets,
      };
    },
    async () => {
      // Ohne das Modul wird gar nicht erst gelesen. Das ist nicht nur Kosmetik:
      // die Abfrage holt jede Spalte jedes dokumentierten Issues, zwei
      // Text-Felder eingeschlossen, und sitzt in derselben Welle wie die
      // Epic-Liste — sie bestimmt die Latenz der Seite mit.
      if (!risksEnabled) return [];
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
    risksEnabled,
  );

  /**
   * **Der Job-Size-Verlauf im Portfolio Sync** — ein Wertstrom, darin „gesamt"
   * oder ein ART, neben dem Funding-Snapshot. Dieselben Rechte wie auf der Wertstrom-Budgetseite
   * (`loadValueStreamBudgetAccess`): in der Auswahl steht nur, was der
   * Betrachter sehen darf. Nur im Sync und nur mit dem Budgeting-Modul
   * geladen; die übrigen Ansichten zahlen nichts dafür.
   */
  let burn: SyncBurn | undefined;
  if (view === "sync" && budgetingEnabled) {
    const streams = filter.valueStreamIds.length
      ? valueStreamRows.filter((v) => filter.valueStreamIds.includes(v.id))
      : valueStreamRows;
    const alleArts = await db.art.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        valueStreamId: { in: streams.map((v) => v.id) },
      },
      select: { id: true, name: true, timelineId: true, valueStreamId: true },
      orderBy: { name: "asc" },
    });
    const zugriff = await Promise.all(
      streams.map(async (v) => {
        const arts = alleArts.filter((a) => a.valueStreamId === v.id);
        const access = await loadValueStreamBudgetAccess(
          db,
          principal,
          { id: v.id, financeApproverId: v.financeApproverId ?? null },
          arts,
        );
        return { v, arts: arts.filter((a) => access.visibleArtIds.has(a.id)), access };
      }),
    );
    const options: KpiValueStreamOption[] = zugriff
      .filter((z) => z.access.deniedReason === null)
      .map((z) => ({
        id: z.v.id,
        name: z.v.name,
        arts: z.arts.map((a) => ({ id: a.id, name: a.name })),
        showTotals: z.access.showTotals,
      }));
    const wahl = resolveKpiSelection(options, sp.kpiVs, sp.kpiArt);
    const gewaehlt = wahl ? zugriff.find((z) => z.v.id === wahl.valueStream.id) : undefined;
    burn = {
      options,
      selectedVs: wahl?.valueStream.id ?? null,
      selectedArt: wahl?.artId ?? null,
      chart:
        wahl && gewaehlt ? (
          <BudgetBurnPanel
            db={db}
            principal={principal}
            arts={gewaehlt.arts}
            // Wie die Vorgabe des KPI-Reiters: das laufende Kalender-Halbjahr.
            cycleKey={resolveCycle(undefined, new Date()).cycleKey}
            artId={wahl.artId}
          />
        ) : null,
    };
  }

  return (
    <Page>
      <PageHeader
        title={t("work.overview.portfolioUebersicht")}
        subtitle={t("work.overview.strategischerBezugFundingUnd")}
        actions={<ViewSwitcher current={view} available={views} />}
      />

      <div className="mb-4">
        <PortfolioFilterBar
          valueStreams={valueStreams}
          owners={owners}
          savedFilters={savedFilters}
          showClassFacet={practices.artEpics}
        />
      </div>

      {view === "mission" && (
        <OverviewMissionControl data={data} contributionView={contributionView} />
      )}
      {view === "review" && <OverviewReview data={data} contributionView={contributionView} />}
      {view === "sync" && <OverviewSync data={data} burn={burn} />}
      {view === "budgeting" && <OverviewBudgeting data={data} />}
    </Page>
  );
}
