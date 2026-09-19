import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { loadValueStreamBudgetAccess } from "@/modules/budgeting/server/services/value-stream-budget-access";
import { resolveCycle } from "@/modules/budgeting/domain/cycle";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { loadRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import { loadArtGridModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { loadArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { artDetailIsEmpty } from "@/modules/budgeting/domain/art-budget-model";
import { getTenantPractices } from "@/server/services/target-model";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { getTenantBudgetSettings } from "@/modules/budgeting/server/services/tenant-budget-settings";
import { loadValueStreamCourse } from "@/modules/budgeting/server/views/value-stream-course";
import { loadFundingPhases } from "@/modules/budgeting/server/views/art-funding";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { RtbAwardsSection } from "@/modules/budgeting/features/components/rtb/rtb-awards-section";
import { ArtBudgetBreakdown } from "@/modules/budgeting/features/components/art-budget/art-budget-breakdown";
import { ArtBudgetTab } from "@/modules/budgeting/features/components/art-budget/art-budget-tab";
import { ArtPotRows } from "@/modules/budgeting/features/components/art-budget/art-pot-rows";
import { loadArtEpicBudgets } from "@/modules/budgeting/server/services/art-epic-budget";
import { readSolutions } from "@/modules/budgeting/server/services/budget-reads";
import { AllocationCourseChart } from "@/modules/budgeting/features/components/art-budget/allocation-course-chart";
import { ArtFundingRail } from "@/modules/budgeting/features/components/art-funding-rail";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";
import { SectionCard } from "@/components/ui/section-card";

/**
 * Das Budget **eines** Wertstroms — und die Fläche, auf der ein ART-Epic-Budget
 * entsteht.
 *
 * Zwei Reiter: **Budget** ist das Abgeleitete zum Lesen, **Run the Business**
 * trägt die Positionen und die Aufteilung des Zuspruchs. Beide Hälften der
 * Kette liegen damit nebeneinander; vorher erzeugte sie `components/rtb/` und
 * verteilte sie `components/art-budget/` — zwei Ordner auf zwei Seiten.
 */

const TABS = [
  { key: "budget", label: "Budget" },
  { key: "betrieb", label: "Run the Business" },
] as const;

export default async function BudgetingValueStreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string; art?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { id } = await params;
  const { tab, cycle, art } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const vs = await db.valueStream.findFirst({
    where: { id, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true, name: true, financeApproverId: true },
  });
  if (!vs) notFound();

  /**
   * **Bis hierhin prüfte diese Seite gar nichts** — kein Modul, keine
   * Capability, keinen Scope. Tragbar, solange sie nur Wertstrom-Summen zeigte;
   * mit den ART-Budgets darin stünde geschütztes Geld hinter einer offenen Tür
   * (Spec `art-budget-consolidation.md`, REQ-1).
   *
   * `notFound()` statt einer Fehlerseite: ob es diesen Wertstrom gibt, ist
   * selbst schon eine Auskunft.
   */
  const arts = await db.art.findMany({
    where: { valueStreamId: vs.id, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const access = await loadValueStreamBudgetAccess(db, principal, vs, arts);
  if (access.deniedReason !== null) notFound();

  /**
   * **Welche Zeile ist offen** — und darf sie es sein.
   *
   * `?art=` kommt aus der Adresszeile, also aus fremder Hand. Ein ART eines
   * anderen Wertstroms oder eines, dessen Zahlen der Betrachter nicht sehen
   * darf, wird hier zu „keine Zeile offen" — nicht zu einem Fehler: die
   * Einsprünge aus Kette und Inbox sollen auch dann auf einer brauchbaren Seite
   * landen, wenn sich das Recht inzwischen geändert hat.
   */
  const expandedArtId = art != null && access.visibleArtIds.has(art) ? art : null;

  const canManage =
    vs.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });

  const { cycleKey, options: cycles } = resolveCycle(cycle, new Date());
  const active = resolveTab(TABS, tab);
  const basePath = `/budgeting/value-streams/${vs.id}`;

  return (
    <EntityDetailShell
      backHref="/budgeting/value-streams"
      backLabel="Wertströme"
      title={vs.name}
      badge="Wertstrom"
      tabs={TABS}
      activeTab={active}
      basePath={basePath}
      // `art` reist mit: sonst fiele die aufgeklappte Zeile beim Reiterwechsel zu.
      tabQuery={
        expandedArtId != null ? { cycle: cycleKey, art: expandedArtId } : { cycle: cycleKey }
      }
      headerActions={
        <nav className="flex items-center gap-1" aria-label="Halbjahr">
          {cycles.map((c) => (
            <Link
              key={c.key}
              href={`${basePath}?tab=${active}&cycle=${c.key}${
                expandedArtId != null ? `&art=${expandedArtId}` : ""
              }`}
              aria-current={c.key === cycleKey ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-sm ${
                c.key === cycleKey
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      }
      subHeader={
        // Eigene Insel: der Leitfaden braucht sechs Abfragen, die niemand sonst
        // auf dieser Seite braucht. Vorher stand hier ein nacktes `await` vor
        // dem `return` und hielt den Reiter auf, bis die Leiste stand.
        <Suspense fallback={<RailSkeleton />}>
          <FundingRail
            db={db}
            tenantId={principal.tenantId}
            vsId={vs.id}
            cycleKey={cycleKey}
            focusArtId={expandedArtId}
          />
        </Suspense>
      }
    >
      {active === "budget" ? (
        <BudgetTab
          db={db}
          principal={principal}
          vs={vs}
          cycleKey={cycleKey}
          basePath={basePath}
          expandedArtId={expandedArtId}
          access={access}
        />
      ) : (
        <OperationsTab
          db={db}
          principal={principal}
          vs={vs}
          cycleKey={cycleKey}
          basePath={basePath}
          expandedArtId={expandedArtId}
          access={access}
          canManage={canManage}
        />
      )}
    </EntityDetailShell>
  );
}

/** Der Leitfaden als eigene Insel — er blockiert die Reiter nicht mehr. */
async function FundingRail({
  db,
  tenantId,
  vsId,
  cycleKey,
  focusArtId,
}: {
  db: ReturnType<typeof createPrismaClient>;
  tenantId: string;
  vsId: string;
  cycleKey: string;
  /** Die aufgeklappte Zeile, falls eine offen ist. */
  focusArtId: string | null;
}) {
  const phases = await loadFundingPhases(
    db,
    tenantId as never,
    vsId,
    cycleKey,
    focusArtId ?? undefined,
  );
  /**
   * **Die Fläche wechselt die Rolle mit der aufgeklappten Zeile.** `surface`
   * entscheidet, ob ein Schritt „dran · Sie" oder „wartet auf: ART" sagt. Ohne
   * offene Zeile steht man als Wertstrom davor; mit einer offenen sieht man die
   * Kette **dieses** ARTs, und dann ist sein Schritt der eigene.
   */
  return <ArtFundingRail phases={phases} surface={focusArtId != null ? "art" : "value_stream"} />;
}

/** Platzhalter in der Höhe der Leiste, damit der Kopf nicht springt. */
function RailSkeleton() {
  // Dieselbe Fläche wie die echte Leiste (`rounded-lg bg-card shadow-card`) —
  // vorher war der Platzhalter ein Rahmen und die Leiste eine Karte, der Stil
  // sprang also beim Nachladen.
  return <div className="h-[58px] animate-pulse rounded-lg bg-card shadow-card" />;
}

/**
 * Der Reiter „Budget" — **eine** Tabelle, deren ART-Zeilen aufklappen.
 *
 * Hier stand zusätzlich `ValueStreamBudgetPlan`: eine eigene Tabelle mit dem
 * Budgetplan je Halbjahr — dieselben Zahlen aus derselben Quelle, die die
 * ART-Matrix als ihre erste Zeile ohnehin schon trägt
 * (`getArtBudgetBreakdown` liest `vsBudget.budget.byPeriod`). Zwei Tabellen mit
 * derselben Kopfzeile untereinander; die zweite ist entfallen.
 */
async function BudgetTab({
  db,
  principal,
  vs,
  cycleKey,
  basePath,
  expandedArtId,
  access,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; name: string; financeApproverId: string | null };
  cycleKey: string;
  basePath: string;
  expandedArtId: string | null;
  access: Awaited<ReturnType<typeof loadValueStreamBudgetAccess>>;
}) {
  const [model, course] = await Promise.all([
    loadArtGridModel(db, principal.tenantId as never, vs.id as never),
    loadValueStreamCourse(db, principal.tenantId as never, vs.id, { cycleKey }),
  ]);

  return (
    <div className="space-y-6">
      {/*
        **Die Matrix führt.** Sie ist das, wofür man kommt; der Verlauf ist
        Zusammenhang. Bis 2026-09-19 stand er oben und schob die Zahlen unter
        die Falz.
      */}
      <ArtBudgetBreakdown
        model={model}
        basePath={basePath}
        tab="budget"
        cycleKey={cycleKey}
        expandedArtId={expandedArtId}
        visibleArtIds={access.visibleArtIds}
        showTotals={access.showTotals}
      />

      {/*
        Der Falter steht **unter** der Tabelle, nicht darin. Als
        `<tr><td colSpan={9}>` konnte er keine eigene Fläche tragen — eine ganze
        Seite in einer leicht getönten Tabellenzeile. Die Spalten hat er ohnehin
        nie benutzt.

        Eigene Insel: er kostet rund ein Dutzend Abfragen; ohne sie stünde die
        Tabelle erst, wenn auch der Kasten steht.
      */}
      {expandedArtId != null && (
        <Suspense fallback={<PanelSkeleton />}>
          <ArtDetailPanel
            db={db}
            principal={principal}
            vs={vs}
            artId={expandedArtId}
            artName={model.rows.find((r) => r.artId === expandedArtId)?.name ?? "ART"}
            cycleKey={cycleKey}
            basePath={basePath}
            tab="budget"
            view="overview"
          />
        </Suspense>
      )}

      {/* Der Verlauf ist eine Wertstrom-Summe — ohne das Wertstrom-Recht entfällt er (REQ-3). */}
      {access.showTotals && course.course && (
        <SectionCard
          title={`Verlauf · ${halfYearLabel(course.cycleKey)}`}
          description="Alle Zuteilungen dieses Wertstroms, auf die Monate des Halbjahres verteilt."
        >
          <AllocationCourseChart course={course.course} todayIndex={course.todayIndex} />
        </SectionCard>
      )}
    </div>
  );
}

/** Platzhalter in ungefährer Höhe des Kastens, damit nichts springt. */
function PanelSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-card shadow-card" />;
}

/**
 * Was bisher die ART-Seite war — jetzt der Inhalt einer aufgeklappten Zeile.
 *
 * Es ist **dieselbe** Komponente: `ArtBudgetTab` teilt sich schon immer nach
 * `view` in „alles zum Lesen" und „die Arbeit", und das ist genau der Schnitt
 * der beiden Reiter dieser Seite. Zusammenlegen heißt hier also nicht
 * nachbauen, sondern nur noch anders aufhängen.
 */
async function ArtDetailPanel({
  db,
  principal,
  vs,
  artId,
  artName,
  cycleKey,
  basePath,
  tab,
  view,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; financeApproverId: string | null };
  artId: string;
  artName: string;
  cycleKey: string;
  basePath: string;
  tab: string;
  view: "overview" | "distribute";
}) {
  const [practices, guardrailRows, tenantRow] = await Promise.all([
    getTenantPractices(db, principal.tenantId),
    listValueStreamGuardrailTargets(db, principal.tenantId),
    getTenantBudgetSettings(db, principal.tenantId),
  ]);
  const threshold = resolveGuardrailTargets(
    guardrailRows,
    tenantRow.guardrailTargets ?? null,
    vs.id,
  ).targets.approval.portfolioThreshold;

  const isValueStreamFinance = vs.financeApproverId === principal.id;
  const hasRtbCapability = hasCapability(principal, "rtb_item.manage", {
    tenantId: principal.tenantId,
    valueStreamId: vs.id,
  });
  const hasArtDistributeCapability = hasCapability(principal, "art_budget.distribute", {
    tenantId: principal.tenantId,
    artId,
  });

  const detail = await loadArtBudgetDetail(
    db,
    principal.tenantId as never,
    { id: artId, valueStreamId: vs.id },
    {
      cycleKey,
      artEpics: practices.artEpics,
      threshold,
      viewer: {
        userId: principal.id,
        isValueStreamFinance,
        hasRtbCapability,
        hasArtDistributeCapability,
      },
    },
  );

  const canDistribute =
    isValueStreamFinance ||
    hasRtbCapability ||
    hasArtDistributeCapability ||
    (detail.pot?.rows.some((r) => r.canDistribute) ?? false);

  // Der leere Kasten sagt, was fehlt — und das ist in den beiden Reitern nicht
  // dasselbe: im Lesen fehlt die Zuteilung, im Arbeiten der Rahmen.
  if (artDetailIsEmpty(detail)) {
    return (
      <SectionCard title={`${artName} · ${halfYearLabel(cycleKey)}`}>
        <p className="text-sm text-muted-foreground">
          {view === "distribute"
            ? `Für ${halfYearLabel(cycleKey)} ist diesem ART kein Rahmen zugesprochen — es gibt nichts zu verteilen. Ein Rahmen entsteht aus einer Betriebsposition der Art „ART-Rahmen“ und dem Zuspruch der Kachel.`
            : `Für ${halfYearLabel(cycleKey)} ist diesem ART nichts zugeteilt, und es sind keine Features eingeplant. Zuteilungen entstehen beim Festschreiben einer Budgeting-Kachel.`}
        </p>
      </SectionCard>
    );
  }

  return (
    /*
      **Die Zeile spricht über alle Halbjahre, der Kasten über eines.** Das ist
      keine Unstimmigkeit, sondern die Rechnung: Deckung, Zustandsstaffel und
      Rahmen gibt es nur je Halbjahr. Deshalb steht das Halbjahr im Titel.
    */
    <SectionCard
      title={`${artName} · ${view === "distribute" ? "Verteilen" : "Detail"} ${halfYearLabel(cycleKey)}`}
      action={
        <Link
          href={`${basePath}?tab=${tab}&cycle=${cycleKey}`}
          className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Schließen
        </Link>
      }
    >
      <ArtBudgetTab
        detail={detail}
        // In den Reiter „Betrieb", **an dieselbe Zeile**: der Sprung soll nicht
        // die aufgeklappte Stelle verlieren, an der man gerade steht.
        distributeHref={`/budgeting/value-streams/${vs.id}?tab=betrieb&cycle=${detail.cycleKey}&art=${artId}`}
        canDistribute={canDistribute}
        view={view}
      />
    </SectionCard>
  );
}

/**
 * Der Reiter „Betrieb" — die Arbeit, von oben nach unten in der Reihenfolge, in
 * der sie anfällt: die Positionen anlegen, den Zuspruch der Kachel aufteilen,
 * und dann je ART seinen Rahmen verteilen.
 *
 * Der letzte Schritt war bis hierhin eine eigene Seite je ART. Er steht jetzt
 * als aufklappbare Zeile darunter — dieselbe Geste wie im Reiter „Budget", und
 * dasselbe `?art=`.
 */
async function OperationsTab({
  db,
  principal,
  vs,
  cycleKey,
  basePath,
  expandedArtId,
  access,
  canManage,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; name: string; financeApproverId: string | null };
  cycleKey: string;
  basePath: string;
  expandedArtId: string | null;
  access: Awaited<ReturnType<typeof loadValueStreamBudgetAccess>>;
  canManage: boolean;
}) {
  const tenantId = principal.tenantId;
  const [items, solutions, arts, awards] = await Promise.all([
    listRtbItems(db, tenantId as never, { valueStreamId: vs.id }),
    // Über den geteilten Lader: der Reiter „Budget" liest dieselben Solutions,
    // um Betriebspositionen auf ihre ARTs aufzulösen (REQ-9).
    readSolutions(db, tenantId as never).then((all) =>
      all.filter((s) => s.valueStreamId === vs.id),
    ),
    db.art.findMany({
      // Ein gelöschtes ART stand bis hierhin im Auswahlfeld der
      // Betriebspositionen (REQ-11).
      where: { tenantId, valueStreamId: vs.id, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    loadRtbAwards(db, tenantId as never, vs.id, cycleKey),
  ]);

  const budgets = await loadArtEpicBudgets(
    db,
    tenantId as never,
    arts.map((a) => a.id),
    cycleKey,
  );

  return (
    <div className="space-y-6">
      <RtbSection
        valueStreamId={vs.id}
        items={items}
        canManage={canManage}
        solutions={solutions}
        arts={arts}
      />
      <RtbAwardsSection valueStreamId={vs.id} view={awards} canManage={canManage} />
      <ArtPotRows
        arts={arts}
        budgets={budgets}
        basePath={basePath}
        cycleKey={cycleKey}
        expandedArtId={expandedArtId}
        visibleArtIds={access.visibleArtIds}
      />

      {/* Wie im Reiter „Budget": das Detail steht unter seiner Tabelle, nicht darin. */}
      {expandedArtId != null && (
        <Suspense fallback={<PanelSkeleton />}>
          <ArtDetailPanel
            db={db}
            principal={principal}
            vs={vs}
            artId={expandedArtId}
            artName={arts.find((a) => a.id === expandedArtId)?.name ?? "ART"}
            cycleKey={cycleKey}
            basePath={basePath}
            tab="betrieb"
            view="distribute"
          />
        </Suspense>
      )}
    </div>
  );
}
