import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { loadValueStreamBudgetAccess } from "@/modules/budgeting/server/services/value-stream-budget-access";
import { currentCycle, previousCycles, resolveCycle } from "@/modules/budgeting/domain/cycle";
import { RATE_WINDOW } from "@/modules/budgeting/domain/art-throughput";
import { loadPiVelocity } from "@/modules/drumbeat/server/views/pi-velocity-view";
import { PiVelocityTable } from "@/modules/drumbeat/features/cockpit/components/pi-velocity-table";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { loadRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import { loadArtGridModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { loadArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { loadArtBusinessCase } from "@/modules/budgeting/server/views/art-business-case";
import { loadValueStreamRoundResult } from "@/modules/budgeting/server/views/value-stream-round-result";
import { loadBudgetKpis } from "@/modules/budgeting/server/views/budget-kpis";
import { artDetailIsEmpty } from "@/modules/budgeting/domain/art-budget-model";
import { getTenantPractices } from "@/server/services/target-model";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { getTenantBudgetSettings } from "@/modules/budgeting/server/services/tenant-budget-settings";
import { loadFundingPhases } from "@/modules/budgeting/server/views/art-funding";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { RtbAwardsSection } from "@/modules/budgeting/features/components/rtb/rtb-awards-section";
import { ArtBudgetBreakdown } from "@/modules/budgeting/features/components/art-budget/art-budget-breakdown";
import { ArtBudgetTab } from "@/modules/budgeting/features/components/art-budget/art-budget-tab";
import { ArtBusinessCase } from "@/modules/budgeting/features/components/art-budget/art-business-case";
import { RoundResult } from "@/modules/budgeting/features/components/art-budget/round-result";
import {
  ArtCoverageCard,
  StreamCoverageCard,
} from "@/modules/budgeting/features/components/art-budget/coverage-card";
import { loadArtEpicBudgets } from "@/modules/budgeting/server/services/art-epic-budget";
import { readSolutions } from "@/modules/budgeting/server/services/budget-reads";
import { ArtFundingRail } from "@/modules/budgeting/features/components/art-funding-rail";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Das Budget **eines** Wertstroms — und die Fläche, auf der ein ART-Epic-Budget
 * entsteht.
 *
 * **Geschnitten nach Prozessschritt und Eigentümer** — nicht nach Geldsorte
 * (`art-budget-process-layout.md`). Vier Reiter gehören dem Wertstrom
 * (Einrichten · Dieses Halbjahr · Nachsehen · Budget-KPIs), je einer jedem
 * sichtbaren ART. Die Schiene bildet damit ab, wer handelt.
 *
 * Vorher waren es zwei: **Budget** zum Lesen, **Run the Business** zum
 * Arbeiten. Das war der Schnitt nach *Modus* — und er legte Navigationskacheln
 * neben Eingabekacheln, zeitlose Stammdaten unter einen Halbjahr-Umschalter und
 * drei Zeitbezüge auf eine Fläche. Wer etwas suchte, musste jede Kachel lesen,
 * um zu erkennen, ob sie etwas von ihm will.
 */

/** Der ART-Reiter trägt seine Id im Schlüssel. */
const ART_TAB = (artId: string) => `art:${artId}`;
const artIdOfTab = (key: string) => (key.startsWith("art:") ? key.slice(4) : null);

/**
 * Die Reiter — **nach Eigentümer, nicht nach Geldsorte**.
 *
 * Vier gehören dem Wertstrom, je einer jedem sichtbaren ART. Die Schiene bildet
 * damit die Handelnden des Prozesses ab: wer den Rahmen anlegt und den Zuspruch
 * aufteilt, ist der Wertstrom; wer ihn auf Epics verteilt, ist das ART. Genau
 * dort wechselt auch die Finanzierungskette ihren Handelnden.
 *
 * Die Reihenfolge ist die des Prozesses — „Einrichten" zuerst. Der **Landeplatz**
 * ist ein anderer (`LANDEPLATZ`): wer die Adresse ohne `?tab=` öffnet, kommt, um
 * zu sehen.
 */
const LANDEPLATZ = "nachsehen";

function buildTabs(
  arts: readonly { id: string; name: string }[],
  offenJeArt: ReadonlyMap<string, number>,
): DetailTab[] {
  return [
    { key: "einrichten", label: "Einrichten", group: "Wertstrom" },
    { key: "halbjahr", label: "Dieses Halbjahr", group: "Wertstrom" },
    { key: LANDEPLATZ, label: "Nachsehen", group: "Wertstrom" },
    { key: "kpi", label: "Budget-KPIs", group: "Wertstrom" },
    ...arts.map((a) => {
      const offen = offenJeArt.get(a.id) ?? 0;
      return {
        key: ART_TAB(a.id),
        label: a.name,
        group: "ARTs",
        // Die einzige Zahl in der Navigation — und nur, wenn sie etwas sagt.
        ...(offen > 0 ? { badge: formatCompactEUR(offen) } : {}),
      };
    }),
  ];
}

export default async function BudgetingValueStreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string; art?: string }>;
}) {
  const t = await getTranslations();
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
    // `timelineId` für die PI-Velocity der Budget-KPIs: die PIs eines ARTs
    // kommen aus seiner Taktung.
    select: { id: true, name: true, timelineId: true },
    orderBy: { name: "asc" },
  });
  const access = await loadValueStreamBudgetAccess(db, principal, vs, arts);
  if (access.deniedReason !== null) notFound();

  /** Nur ARTs, deren Zahlen der Betrachter sehen darf, bekommen einen Reiter. */
  const sichtbareArts = arts.filter((a) => access.visibleArtIds.has(a.id));

  const canManage =
    vs.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });

  const { cycleKey, options: cycles } = resolveCycle(cycle, new Date());
  const basePath = `/budgeting/value-streams/${vs.id}`;

  /**
   * Der offene Rahmen je ART — die Zahl neben dem Reiternamen.
   *
   * Sie steht in der **Navigation**, also wird sie hier geladen und nicht im
   * Reiterinhalt: man soll ohne Klick sehen, wo etwas liegt. Über die geteilten
   * Lader (`budget-reads.ts`) kostet das eine Abfrage.
   */
  const rahmen = await loadArtEpicBudgets(
    db,
    principal.tenantId as never,
    sichtbareArts.map((a) => a.id),
    cycleKey,
  );
  const tabs = buildTabs(sichtbareArts, new Map([...rahmen].map(([id, b]) => [id, b.remaining])));

  /**
   * **Alte Adressen halten.** `?art=` war bis 2026-09-19 der aufgeklappte ART;
   * jetzt ist er ein Reiter. Kette, Inbox und Lesezeichen zeigen noch darauf —
   * ein Verweis auf ein sichtbares ART gewinnt deshalb gegen `?tab=`.
   */
  const ausAltemArt =
    art != null && sichtbareArts.some((a) => a.id === art) ? ART_TAB(art) : undefined;
  const active = resolveTab(tabs, ausAltemArt ?? tab, LANDEPLATZ);
  const offenerArt = artIdOfTab(active);
  const offenerArtName = sichtbareArts.find((a) => a.id === offenerArt)?.name ?? "";

  /**
   * **„Einrichten" trägt keinen Halbjahr-Umschalter.** Was dort steht, gilt über
   * alle Halbjahre; ein Umschalter behauptete einen Zeitbezug, den es nicht gibt
   * — und beim Umschalten änderte sich nichts, während alles andere spränge.
   */
  const zeigtHalbjahr = active !== "einrichten";

  return (
    <EntityDetailShell
      backHref="/budgeting/value-streams"
      backLabel="Wertströme"
      title={vs.name}
      badge="Wertstrom"
      tabs={tabs}
      activeTab={active}
      basePath={basePath}
      // Das Halbjahr reist mit — auch nach „Einrichten", wo es niemand sieht:
      // wer von dort zurückkommt, soll dasselbe Halbjahr vorfinden.
      tabQuery={{ cycle: cycleKey }}
      headerActions={
        zeigtHalbjahr ? (
          <nav className="flex items-center gap-1" aria-label={t("budgeting.page.halbjahr")}>
            {cycles.map((c) => (
              <Link
                key={c.key}
                href={`${basePath}?tab=${active}&cycle=${c.key}`}
                scroll={false}
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
        ) : undefined
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
            focusArtId={offenerArt}
          />
        </Suspense>
      }
    >
      {offenerArt != null ? (
        <Suspense fallback={<PanelSkeleton />}>
          <ArtTab
            db={db}
            principal={principal}
            vs={vs}
            artId={offenerArt}
            artName={offenerArtName}
            cycleKey={cycleKey}
            basePath={basePath}
          />
        </Suspense>
      ) : active === "einrichten" ? (
        <SetupTab db={db} principal={principal} vs={vs} canManage={canManage} />
      ) : active === "halbjahr" ? (
        <CycleTab
          db={db}
          principal={principal}
          vs={vs}
          cycleKey={cycleKey}
          arts={sichtbareArts}
          basePath={basePath}
          canManage={canManage}
        />
      ) : active === "kpi" ? (
        <KpiTab
          db={db}
          principal={principal}
          arts={sichtbareArts}
          cycleKey={cycleKey}
          vsName={vs.name}
          showTotals={access.showTotals}
        />
      ) : (
        <ReviewTab
          db={db}
          principal={principal}
          vs={vs}
          cycleKey={cycleKey}
          basePath={basePath}
          access={access}
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
  /** Der ART, dessen Reiter offen ist — sonst `null`. */
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
   * **Die Leiste wechselt die Rolle mit dem Reiter.** `surface` entscheidet, ob
   * ein Schritt „dran · Sie" oder „wartet auf: ART" sagt. Auf einem
   * Wertstrom-Reiter steht man als Wertstrom davor; auf einem ART-Reiter sieht
   * man die Kette **dieses** ARTs, und dann ist sein Schritt der eigene.
   *
   * Der Schritt der Leiste ist dabei **nicht** der Schritt des Reiters: sie
   * sagt, wo der Prozess steht, der Reiter, wo man steht.
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
 * Der Reiter **„Nachsehen"** — kein Schreibweg, kein Prozessschritt.
 *
 * Er beantwortet die eine Frage des Wertstrom-Owners aus dem Leitfaden:
 * *„Reicht das Geld, das ich habe, für das, was ansteht?"* — über alle
 * Halbjahre, nicht nur das gewählte.
 *
 * Hier stand zusätzlich `ValueStreamBudgetPlan`: eine eigene Tabelle mit dem
 * Budgetplan je Halbjahr — dieselben Zahlen aus derselben Quelle, die die
 * ART-Matrix als ihre erste Zeile ohnehin schon trägt. Zwei Tabellen mit
 * derselben Kopfzeile untereinander; die zweite ist entfallen.
 */
async function ReviewTab({
  db,
  principal,
  vs,
  cycleKey,
  basePath,
  access,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; name: string; financeApproverId: string | null };
  cycleKey: string;
  basePath: string;
  access: Awaited<ReturnType<typeof loadValueStreamBudgetAccess>>;
}) {
  // Das Halbjahr reicht bis in die Matrix: ihre Betriebsspalte zeigt einen
  // Betrag, keine Reihe, und „zugesprochen" gibt es nur je Halbjahr (REQ-8).
  const model = await loadArtGridModel(db, principal.tenantId as never, vs.id as never, cycleKey);

  return (
    <div className="space-y-6">
      {/*
        **Die Matrix ist der Reiter.** Neben ihr stand bis 2026-09-19 der
        Verlauf des Wertstroms; er ist entfallen, und damit steht hier genau
        eine Karte. Das ist kein Mangel: sie ist das, wofür man kommt.
      */}
      <ArtBudgetBreakdown
        model={model}
        artHref={(artId, cycle) => `${basePath}?tab=${ART_TAB(artId)}&cycle=${cycle}`}
        cycleKey={cycleKey}
        visibleArtIds={access.visibleArtIds}
        showTotals={access.showTotals}
      />
    </div>
  );
}

/** Platzhalter in ungefährer Höhe des Kastens, damit nichts springt. */
function PanelSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-card shadow-card" />;
}

/**
 * Der Reiter **eines ARTs** — was bisher die ART-Seite war, dann ein Falter, und
 * jetzt wieder eine Fläche mit eigener Adresse.
 *
 * Er beantwortet zwei Fragen: *woher kommt das Geld dieses Zuges* und *was mache
 * ich mit dem Teil, über den ich entscheide*. Deshalb `view="all"` — der Schnitt
 * nach „lesen" und „arbeiten" war der Schnitt **zweier Reiter**; hier gehört
 * beides demselben Handelnden.
 */
async function ArtTab({
  db,
  principal,
  vs,
  artId,
  artName,
  cycleKey,
  basePath,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; financeApproverId: string | null };
  artId: string;
  artName: string;
  cycleKey: string;
  basePath: string;
}) {
  const t = await getTranslations();
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
    // Beide Achsen, wie im Service-Seam: RTE `art`-scoped, Wertstrom-Owner
    // `value_stream`-scoped. Sonst zeigte die Flaeche einen Knopf, den das
    // Speichern ablehnt.
    valueStreamId: vs.id,
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

  /**
   * **Nach `detail`, nicht daneben.** `buildArtBudgetDetail` darf auf ein
   * anderes Halbjahr zurückfallen, wenn das gewählte auf seiner Achse fehlt —
   * parallel geladen sprächen die beiden Karten dann über verschiedene
   * Halbjahre. Teuer ist die zweite Runde nicht: der Lader liest über die
   * geteilten Lader, die `detail` ohnehin schon gefüllt hat.
   */
  const origin = await loadArtBusinessCase(
    db,
    principal.tenantId as never,
    { id: artId, valueStreamId: vs.id },
    detail.cycleKey,
  );

  const canDistribute =
    isValueStreamFinance ||
    hasRtbCapability ||
    hasArtDistributeCapability ||
    (detail.pot?.rows.some((r) => r.canDistribute) ?? false);

  if (artDetailIsEmpty(detail)) {
    return (
      <SectionCard title={`${artName} · ${halfYearLabel(cycleKey)}`}>
        <p className="text-sm text-muted-foreground">
          {t("budgeting.page.artTabNichtsZugeteilt", { halfYear: halfYearLabel(cycleKey) })}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {/*
        **Nachschlagewerk vor Handlung** (REQ-4). Woher das Geld kommt, ist die
        Begründung dessen, was darunter zu tun ist — und die einzige Fläche, die
        das Betriebsgeld dieses ARTs auf **allen drei** Wegen zeigt.
      */}
      <ArtBusinessCase origin={origin} artName={artName} />

      {/*
        **Keine Karte um die Karten.** Hier stand eine `SectionCard`, in der
        sechs weitere steckten — ein Rahmen um einen Rahmen, der die Gliederung
        eher verwischte als sie zu stützen. Der ART und sein Halbjahr stehen im
        Titel des Business Case; wo man ist, sagt ausserdem die Reiterschiene.
      */}
      <ArtBudgetTab
        detail={detail}
        // Man ist schon da: der Reiter dieses ARTs **ist** die Verteilfläche.
        distributeHref={`${basePath}?tab=${ART_TAB(artId)}&cycle=${detail.cycleKey}`}
        kpiHref={`${basePath}?tab=kpi&cycle=${detail.cycleKey}`}
        canDistribute={canDistribute}
      />
    </div>
  );
}

/**
 * Der Reiter **„Einrichten"** — Schritt 1 der Kette, und das Einzige auf dieser
 * Seite, das **zeitlos** ist.
 *
 * Genau deshalb steht er allein: die Betriebspositionen ändern sich beim
 * Halbjahrwechsel nicht, alles andere schon. Unter einem Halbjahr-Umschalter
 * behaupteten sie einen Zeitbezug, den sie nicht haben — und der Reiter trägt
 * deshalb keinen.
 */
async function SetupTab({
  db,
  principal,
  vs,
  canManage,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string; name: string };
  canManage: boolean;
}) {
  const tenantId = principal.tenantId;
  const [items, solutions, arts] = await Promise.all([
    listRtbItems(db, tenantId as never, { valueStreamId: vs.id }),
    // Über den geteilten Lader: der ART-Reiter liest dieselben Solutions, um
    // Betriebspositionen auf ihre ARTs aufzulösen.
    readSolutions(db, tenantId as never).then((all) =>
      all.filter((x) => x.valueStreamId === vs.id),
    ),
    db.art.findMany({
      // Ein gelöschtes ART stand bis hierhin im Auswahlfeld der
      // Betriebspositionen (REQ-11 der Konsolidierungs-Spec).
      where: { tenantId, valueStreamId: vs.id, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <RtbSection
      valueStreamId={vs.id}
      items={items}
      canManage={canManage}
      solutions={solutions}
      arts={arts}
    />
  );
}

/**
 * Der Reiter **„Dieses Halbjahr"** — Schritt 4a der Kette.
 *
 * Der Wertstrom teilt den Zuspruch der Kachel auf seine Positionen auf. Das
 * **Verteilen** an die Epics steht nicht mehr hier: es ist ART-Sache und hat je
 * ART einen eigenen Reiter. Genau dort wechselt die Kette ihren Handelnden.
 */
async function CycleTab({
  db,
  principal,
  vs,
  cycleKey,
  arts,
  basePath,
  canManage,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  vs: { id: string };
  cycleKey: string;
  arts: readonly { id: string; name: string }[];
  basePath: string;
  canManage: boolean;
}) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const [ergebnis, awards] = await Promise.all([
    loadValueStreamRoundResult(db, principal.tenantId as never, vs.id, cycleKey),
    loadRtbAwards(db, principal.tenantId as never, vs.id, cycleKey),
  ]);

  return (
    <div className="space-y-6">
      {/*
        **Nachschlagewerk vor Handlung** (REQ-4): man teilt auf, was die Kachel
        zugesprochen hat — also steht über der Aufteilung, was sie zugesprochen
        hat.
      */}
      <RoundResult result={ergebnis} />
      <RtbAwardsSection
        valueStreamId={vs.id}
        view={awards}
        canManage={canManage}
        setupHref={`${basePath}?tab=einrichten&cycle=${cycleKey}`}
      />
      {/*
        **Jede Arbeitsfläche nennt ihren Nachfolger.** Die Leiste erklärt den
        Prozess; dieser Satz übergibt konkret — an die Reiter, in denen der
        nächste Schritt wirklich passiert.
      */}
      {arts.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {t.rich("budgeting.page.artRahmenWeiterIn", {
            arts: () =>
              // Die Aufzählung („A, B und C“) setzt Intl.ListFormat je Sprache.
              new Intl.ListFormat(locale, { type: "conjunction" })
                .formatToParts(arts.map((a) => a.id))
                .map((part, i) => {
                  if (part.type === "literal") return <span key={i}>{part.value}</span>;
                  const a = arts.find((x) => x.id === part.value)!;
                  return (
                    <Link
                      key={a.id}
                      href={`${basePath}?tab=${ART_TAB(a.id)}&cycle=${cycleKey}`}
                      scroll={false}
                      className="text-primary hover:underline"
                    >
                      {a.name}
                    </Link>
                  );
                }),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Der Reiter **„Budget-KPIs"** — kein Prozessschritt, sondern der Ort, an dem
 * die Herleitung wohnt.
 *
 * Dieselbe Karte für den Wertstrom und für jedes sichtbare ART, untereinander.
 * Es gibt ihn, damit die Arbeitsreiter die Rechnung **nicht** mitschleppen:
 * dort steht das Ergebnis in einer Zeile, hier steht, wie es zustande kommt.
 */
async function KpiTab({
  db,
  principal,
  arts,
  cycleKey,
  vsName,
  showTotals,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  arts: readonly { id: string; name: string; timelineId: string | null }[];
  cycleKey: string;
  vsName: string;
  /** Ohne Wertstrom-Recht entfällt die Summenzeile — wie in „Nachsehen" (REQ-3). */
  showTotals: boolean;
}) {
  const t = useTranslations();
  if (arts.length === 0) {
    return (
      <SectionCard title={`Wofür · eingeplant · ${halfYearLabel(cycleKey)}`}>
        <EmptyState
          title={t("budgeting.page.nochKeinArt")}
          body={t("budgeting.page.dieRechnungLastGegen")}
        />
      </SectionCard>
    );
  }

  /**
   * **PI-Velocity: dasselbe Fenster wie der €-Satz** — die Halbjahre vor dem
   * gewählten (`RATE_WINDOW`), gezählt nach dem Ende der PIs — plus die schon
   * abgeschlossenen PIs des laufenden Halbjahrs. Sie kommt aus
   * Drumbeat; Budgeting darf es nicht importieren (ADR-0013), deshalb wird sie
   * hier geladen und als Slot in die Karten gereicht. Ohne Drumbeat gibt es
   * keine PIs und keinen Slot.
   */
  const velocityWindow = {
    closedKeys: previousCycles(cycleKey, RATE_WINDOW),
    runningKey: currentCycle(new Date()),
  };
  const [kpis, velocity] = await Promise.all([
    loadBudgetKpis(db, principal.tenantId as never, arts, cycleKey),
    principal.enabledModules.includes("drumbeat")
      ? loadPiVelocity(db, principal.tenantId, arts, velocityWindow)
      : Promise.resolve(null),
  ]);
  const velocityOf = new Map(velocity?.arts.map((v) => [v.artId, v]) ?? []);

  return (
    <div className="space-y-6">
      {showTotals && (
        <StreamCoverageCard
          name={`${vsName} · gesamt`}
          stream={kpis.stream}
          extra={
            velocity && (
              <PiVelocityTable
                rows={velocity.stream.rows}
                summary={velocity.stream.ratio}
                kind="stream"
                window={velocityWindow}
              />
            )
          }
        />
      )}
      {kpis.arts.map((a) => {
        const v = velocityOf.get(a.artId);
        return (
          <ArtCoverageCard
            key={a.artId}
            name={a.name}
            coverage={a.coverage}
            extra={
              v && (
                <PiVelocityTable
                  rows={v.rows}
                  summary={v.mean}
                  kind="art"
                  window={velocityWindow}
                />
              )
            }
          />
        );
      })}
      <p className="px-1 text-meta text-muted-foreground">
        {t("budgeting.page.betriebZaehltInKeiner")}
      </p>
    </div>
  );
}
