/* eslint-disable no-console */
/**
 * Pulse Simulations-Seed — Mandant „Test Demo", Szenario **Firmen-Offsite**.
 *
 * Absichtlich klein: ein Wertstrom, ein ART, ein Kopf-Ziel, drei Epics, neun
 * Features. Wer die Plattform kennenlernen will, soll sich nicht erst in einer
 * erfundenen Digitalbank zurechtfinden müssen — dafür gibt es `seed-demo.ts`
 * („Pulse Demo Corp", Dichte statt Klarheit). Hier ist der Gegenentwurf: ein
 * Vorhaben, das jeder sofort versteht.
 *
 * **Stand: kurz vor dem PI-Planning.** Die Epics sind ausgearbeitet, freigegeben
 * und finanziert (L3), die Features sind angelegt und geschätzt — aber **keines
 * ist einem PI zugeordnet** und nichts ist gestartet. Genau dieser Schritt ist
 * das, was man in der Simulation selbst geht.
 *
 * Die drei Vorhaben gehören zu **einer neuen Außentagung** und liegen daher alle
 * im Horizont **H3** (explorativ; frühere Offsites gab es schon) — über eine
 * gemeinsame Primär-Solution. Für die Portfolio-Charts ist nur die **Struktur**
 * hinterlegt (H3-Solution, €-Wertbeitrags-Ziel, aktiver Budget-Zyklus); die
 * Ist-/Umsetzungs-Daten der Horizont-Budget-, Wasserfall- und Forecast-Ansichten
 * entstehen, sobald man in der Simulation Epics startet und Impact erfasst.
 *
 * Zwei Dinge, die das Szenario formen:
 * - **Es gibt kein Team-Modell mehr** (Teardown `fd8164a`); die Plattform endet
 *   bei Wertstrom + ART. Das „Planungsteam" sind deshalb sechs Rollenzuweisungen
 *   mit ART-Scope — die Menschen gibt es, ein Objekt dafür nicht.
 * - **Practices lassen sich nur hier setzen**: einen Operating-Model-Konfigurator
 *   gibt es im UI nicht, ohne aktiven Datensatz laufen alle Practices auf „an".
 *
 * Reset-then-insert wie beim Demo-Seed: `wipeDomainData` zuerst, danach `create`
 * mit deterministischen Ids (`uid`). Ein zweiter Lauf erzeugt denselben Stand.
 * Datumswerte sind relativ zu heute, damit der Datensatz nicht veraltet.
 *
 * Run: `pnpm db:seed:offsite`  (lädt `.env.local` selbst; braucht DIRECT_URL
 * und SUPABASE_SERVICE_ROLE_KEY)
 */

import type { Prisma } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { buildBudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";
import {
  prisma,
  requireTenantByName,
  upsertAuthUser,
  assignRole,
  wipeDomainData,
  uid,
} from "./seed-helpers.js";
import { seedRunTheBusiness, seedBudgetPeriod, type GroupSpec } from "./seed-budgeting.js";

const TENANT_NAME = "Test Demo";

// ── Zeit ────────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const now = new Date();
const addDays = (base: Date, d: number): Date => new Date(base.getTime() + d * DAY);

/** Der kommende Montag — Startpunkt von PI 1. */
function nextMonday(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  return addDays(d, (8 - d.getDay()) % 7 || 7);
}

/** Halbjahres-Schlüssel für Budget-Perioden, z. B. „2026-H2". */
const halfKey = (d: Date): string => `${d.getFullYear()}-H${d.getMonth() < 6 ? 1 : 2}`;

const PI_START = nextMonday(now);
const PI_WEEKS = 8;
/** Das Offsite liegt am Ende von PI 3 — sechs Monate ab heute. */
const OFFSITE_AT = addDays(PI_START, 3 * PI_WEEKS * 7 - 1);

const PERIOD_NOW = halfKey(now);
const PERIOD_END = halfKey(OFFSITE_AT);

// ── Szenario-Konstanten ─────────────────────────────────────────────────────
const PARTICIPANTS = 40;
const AGENDA_BLOCKS = 8;
const BUDGET_HOTEL = 30_000;
const BUDGET_TRAVEL = 20_000;
const BUDGET_PROGRAM = 10_000;
const BUDGET_TOTAL = BUDGET_HOTEL + BUDGET_TRAVEL + BUDGET_PROGRAM;

/**
 * Die drei Vorhaben. Titel wörtlich wie vorgegeben (englisch), Inhalte deutsch.
 * `slug` trägt sowohl die deterministischen Ids als auch die Zuordnung
 * Epic Owner ↔ Feature Owner.
 */
const EPICS = [
  {
    slug: "transport",
    title: "Transport and Travel",
    description:
      "Anreise und Rückreise für alle Teilnehmenden organisieren — Bahn, Bus und Fahrgemeinschaften.",
    budget: BUDGET_TRAVEL,
    kpi: { name: "Teilnehmer mit gebuchter Anreise", unit: "Teilnehmer", target: PARTICIPANTS },
    goal: {
      title: "Anreise für alle organisiert",
      unit: "Teilnehmer",
      target: PARTICIPANTS,
      current: 0,
      status: "on_track",
      checkin: "Angebote von zwei Busunternehmen liegen vor, Buchung startet nach dem PI-Planning.",
    },
    features: [
      {
        title: "Anreiseoptionen erheben",
        criteria: ["Alle Anreisewege je Standort erfasst", "Kostenrahmen je Option bekannt"],
        wsjf: { bv: 8, tc: 5, rr: 3, js: 3 },
      },
      {
        title: "Bustransfer beauftragen",
        criteria: ["Anbieter ausgewählt", "Transfer für Hin- und Rückfahrt gebucht"],
        wsjf: { bv: 8, tc: 8, rr: 5, js: 5 },
      },
      {
        title: "Reisekostenregel kommunizieren",
        criteria: ["Regel abgestimmt", "An alle Teilnehmenden versendet"],
        wsjf: { bv: 3, tc: 3, rr: 2, js: 2 },
      },
    ],
  },
  {
    slug: "agenda",
    title: "Offsite-Agenda and content",
    description:
      "Programm, Formate und Inhalte für zwei Tage — von der Eröffnung bis zur Retrospektive.",
    budget: BUDGET_PROGRAM,
    kpi: { name: "Abgestimmte Programmblöcke", unit: "Blöcke", target: AGENDA_BLOCKS },
    goal: {
      title: "Agenda steht",
      unit: "Programmblöcke",
      target: AGENDA_BLOCKS,
      current: 2,
      status: "on_track",
      checkin: "Eröffnung und Abschluss stehen, die sechs Arbeitsblöcke dazwischen sind offen.",
    },
    features: [
      {
        title: "Agenda-Entwurf abstimmen",
        criteria: ["Entwurf mit der Geschäftsführung abgestimmt", "Zeitraster steht"],
        wsjf: { bv: 13, tc: 8, rr: 3, js: 5 },
      },
      {
        title: "Workshop-Formate festlegen",
        criteria: ["Je Block ein Format gewählt", "Materialbedarf bekannt"],
        wsjf: { bv: 8, tc: 5, rr: 5, js: 5 },
      },
      {
        title: "Referenten anfragen",
        criteria: ["Zwei externe Impulse angefragt", "Zusagen schriftlich"],
        wsjf: { bv: 5, tc: 8, rr: 2, js: 3 },
      },
    ],
  },
  {
    slug: "hotel",
    title: "Hotel and Location",
    description: "Tagungsort, Zimmerkontingent und Verpflegung für zwei Tage sichern.",
    budget: BUDGET_HOTEL,
    kpi: { name: "Reservierte Zimmer", unit: "Zimmer", target: PARTICIPANTS },
    goal: {
      title: "Location gebucht",
      unit: "Zimmer",
      target: PARTICIPANTS,
      current: 0,
      status: "at_risk",
      checkin:
        "Zwei Wunsch-Locations sind im Zeitraum bereits ausgebucht — die dritte hält eine Option bis Monatsende.",
    },
    features: [
      {
        title: "Locations vergleichen",
        criteria: ["Drei Angebote eingeholt", "Bewertung nach Kosten, Lage, Räumen"],
        wsjf: { bv: 13, tc: 13, rr: 8, js: 5 },
      },
      {
        title: "Zimmerkontingent reservieren",
        criteria: [`${PARTICIPANTS} Zimmer verbindlich reserviert`, "Stornofristen dokumentiert"],
        wsjf: { bv: 13, tc: 13, rr: 8, js: 3 },
      },
      {
        title: "Verpflegung abstimmen",
        criteria: ["Menüauswahl steht", "Unverträglichkeiten abgefragt"],
        wsjf: { bv: 5, tc: 3, rr: 2, js: 3 },
      },
    ],
  },
] as const;

type EpicDef = (typeof EPICS)[number];

/** €-Wert je 1 KPI-Einheit dieses Epics (Budgetanteil je Einheit). Einzige
 *  Quelle für KPI-`valuePerUnit` und den €-Ziel-`conversionFactor`. */
const valuePerUnit = (e: EpicDef): number => Math.round(e.budget / e.kpi.target);

async function main() {
  console.log("\n🌱  Offsite-Simulation für „Test Demo“\n");
  console.log(
    `   Offsite am ${OFFSITE_AT.toLocaleDateString("de-DE")} · ${PARTICIPANTS} Teilnehmer · ${BUDGET_TOTAL.toLocaleString("de-DE")} €\n`,
  );

  // ── Konten ────────────────────────────────────────────────────────────────
  // Pulse zeigt E-Mails statt Klarnamen (`listTenantUserLabels` liest Supabase
  // Auth) — die sprechenden Adressen sind also zugleich die Anzeigenamen.
  console.log("── Auth-User");
  const admin = await upsertAuthUser("admin@pulse.dev", "Admin1234!");
  const portfolio = await upsertAuthUser("portfolio@pulse.dev", "Test1234!");
  const rte = await upsertAuthUser("rte@pulse.dev", "Test1234!");
  const vso = await upsertAuthUser("vso@pulse.dev", "Test1234!");

  const epicOwners: Record<string, string> = {};
  const featureOwners: Record<string, string> = {};
  for (const e of EPICS) {
    epicOwners[e.slug] = await upsertAuthUser(`eo-${e.slug}@pulse.dev`, "Test1234!");
    featureOwners[e.slug] = await upsertAuthUser(`fo-${e.slug}@pulse.dev`, "Test1234!");
  }

  // ── Mandant ───────────────────────────────────────────────────────────────
  console.log("\n── Mandant");
  const tenantId = await requireTenantByName(TENANT_NAME);
  await wipeDomainData(tenantId);

  // `kind`/`enabledModules` hart setzen: wäre „Test Demo" als `personal`
  // angelegt, wäre nur `core` freigeschaltet — Portfolio, Umsetzung und Budget
  // blieben unsichtbar, und die Ursache läge weit weg vom Symptom.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      kind: "organization",
      status: "active",
      enabledModules: [...MODULE_KEYS],
      dashboardHorizonEnd: addDays(OFFSITE_AT, 30),
      budgetPoolByPeriod: { [PERIOD_NOW]: BUDGET_TOTAL * 0.7, [PERIOD_END]: BUDGET_TOTAL * 0.5 },
      // Der laufende Budget-Zyklus (aktives Halbjahr). Explizit gesetzt, damit die
      // Horizont-Budget-Zeilen des Portfolio-Kanbans einen klaren Bezug haben.
      activeBudgetCycle: PERIOD_NOW,
      // PB-Default-Aufwand: Kosten-Richtwert im Ballot für nur-Hypothese-Epics.
      defaultHypothesisEffort: 60_000,
      // Ein Job-Size-Punkt Planungsaufwand ≈ ein Personentag.
      costPerJobSizePoint: 600,
      // Kleiner, sichtbarer Richtwert, damit die Benefit-Velocity-Ziel-Linie rendert.
      costNeutralTarget: 5_000,
      guardrailTargets: { horizon: { H1: 1, H2: 0, H3: 0 }, enablerRatio: 0 },
    },
  });

  // ── Rollen ────────────────────────────────────────────────────────────────
  console.log("\n── Rollen");
  const vsId = uid("offsite:vs");
  const artId = uid("offsite:art");

  // Jeder Tenant braucht einen Plattform-Admin (globaler Operator-Grant).
  await assignRole(admin, tenantId, "platform_admin");
  await assignRole(admin, tenantId, "tenant_admin");
  await assignRole(portfolio, tenantId, "portfolio_manager");
  await assignRole(rte, tenantId, "rte", { artIds: [artId] });
  await assignRole(vso, tenantId, "value_stream_owner", { valueStreamIds: [vsId] });
  for (const e of EPICS) {
    await assignRole(epicOwners[e.slug]!, tenantId, "epic_owner", { artIds: [artId] });
    await assignRole(featureOwners[e.slug]!, tenantId, "feature_owner", { artIds: [artId] });
  }
  console.log(`  ✓ ${4 + EPICS.length * 2} Zuweisungen (davon 6 im Planungsteam)`);

  // `wipeDomainData` leert `roleCapability` mit — Defaults neu spiegeln.
  const caps = enumerateDefaultCapabilities();
  await prisma.roleCapability.createMany({
    data: caps.map((c) => ({
      tenantId,
      role: c.role,
      action: c.action,
      scope: c.scope,
      createdBy: admin,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ ${caps.length} Default-Capabilities gespiegelt`);

  // ── Struktur + Kadenz ─────────────────────────────────────────────────────
  console.log("\n── Struktur");
  await prisma.valueStream.create({
    data: {
      id: vsId,
      tenantId,
      name: "Firmen-Offsite",
      description: "Alles, was zum jährlichen Offsite des Unternehmens gehört.",
      budgetAmount: BUDGET_TOTAL,
      budgetCurrency: "EUR",
      financeApproverId: admin,
      vmoId: portfolio,
    },
  });

  const timelineId = uid("offsite:timeline");
  await prisma.timeline.create({
    data: { id: timelineId, tenantId, name: "Offsite-Kadenz" },
  });

  await prisma.art.create({
    data: {
      id: artId,
      tenantId,
      valueStreamId: vsId,
      name: "Offsite-Planung",
      description: "Das Planungsteam: drei Epic Owner, drei Feature Owner.",
      rteId: rte,
      timelineId,
      piCadenceWeeks: PI_WEEKS,
    },
  });

  // Drei PIs à 8 Wochen. Alle `planned` — das PI-Planning steht ja noch aus;
  // ein „active" PI ohne zugeordnete Features wäre ein Widerspruch.
  const piIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = uid(`offsite:pi:${i + 1}`);
    piIds.push(id);
    const start = addDays(PI_START, i * PI_WEEKS * 7);
    await prisma.programIncrement.create({
      data: {
        id,
        tenantId,
        timelineId,
        name: `PI ${i + 1}`,
        startDate: start,
        endDate: addDays(start, PI_WEEKS * 7 - 1),
        status: "planned",
        capacityJobSize: 30,
        capacityAmount: BUDGET_TOTAL / 3,
      },
    });
  }

  // Der PI-Standard wird nicht angewendet (er erzeugt ein ganzes Kalenderjahr,
  // hier sind genau drei Fenster gewollt) — er steht als Kadenz-Definition da,
  // damit die Timelines-Seite nicht leer wirkt.
  await prisma.piStandard.create({
    data: {
      id: uid("offsite:pistd"),
      tenantId,
      name: `Standard ${PI_WEEKS} Wochen`,
      anchorMonth: PI_START.getMonth() + 1,
      anchorDay: PI_START.getDate(),
      cadenceWeeks: PI_WEEKS,
      piCount: 3,
      createdBy: admin,
    },
  });
  console.log(`  ✓ Wertstrom, ART, Timeline, 3 PIs ab ${PI_START.toLocaleDateString("de-DE")}`);

  // ── Ziele ─────────────────────────────────────────────────────────────────
  console.log("\n── Ziele");
  const themeId = uid("offsite:theme");
  await prisma.strategicTheme.create({
    data: {
      id: themeId,
      tenantId,
      title: "Zusammenarbeit stärken",
      narrative: "Einmal im Jahr arbeitet das ganze Unternehmen zwei Tage am selben Ort.",
      kind: "business",
      color: "#6366f1",
      budgetPlanned: BUDGET_TOTAL,
      ownerId: portfolio,
      sortOrder: 0,
      createdBy: admin,
      updatedBy: admin,
    },
  });

  // Kopf-Ziel: die eigene Metrik (0 von 1 Offsite) ist die Aussage, der
  // Fortschritt entsteht per Rollup aus den drei Unterzielen — bei Kindern
  // gewinnt der Rollup ohnehin über die eigene Metrik.
  const headGoalId = uid("offsite:goal:head");
  await prisma.objective.create({
    data: {
      id: headGoalId,
      tenantId,
      themeId,
      title: "One Offsite performed",
      narrative: `Ein zweitägiges Offsite mit ${PARTICIPANTS} Teilnehmenden, durchgeführt bis zum ${OFFSITE_AT.toLocaleDateString("de-DE")}.`,
      path: headGoalId,
      level: 0,
      nodeKind: "objective",
      progressMode: "rollup",
      metricName: "Durchgeführte Offsites",
      metricUnit: "Offsites",
      metricType: "number",
      baseline: 0,
      target: 1,
      current: 0,
      status: "on_track",
      periodStart: now,
      periodEnd: OFFSITE_AT,
      dueDate: OFFSITE_AT,
      ownerId: portfolio,
      createdBy: admin,
      updatedBy: admin,
    },
  });

  for (const [i, e] of EPICS.entries()) {
    const id = uid(`offsite:goal:${e.slug}`);
    await prisma.objective.create({
      data: {
        id,
        tenantId,
        themeId,
        parentObjectiveId: headGoalId,
        title: e.goal.title,
        path: `${headGoalId}/${id}`,
        level: 1,
        nodeKind: "key_result",
        progressMode: "manual",
        metricName: e.goal.title,
        metricUnit: e.goal.unit,
        metricType: "number",
        baseline: 0,
        target: e.goal.target,
        current: e.goal.current,
        // Gleichgewichtet: kein Teil des Offsites ist verzichtbar. Bewusst
        // **kein** `parentUnitPerChildUnit` — „Zimmer je Offsite" wäre eine
        // Einheiten-Kaskade, die nichts aussagt; hier zählt der Prozent-Rollup.
        rollupWeight: 1,
        includeInParentRollup: true,
        status: e.goal.status,
        periodStart: now,
        periodEnd: OFFSITE_AT,
        dueDate: OFFSITE_AT,
        ownerId: epicOwners[e.slug]!,
        sortOrder: i,
        createdBy: admin,
        updatedBy: admin,
      },
    });
    await prisma.goalCheckin.create({
      data: {
        id: uid(`offsite:checkin:${e.slug}`),
        tenantId,
        objectiveId: id,
        status: e.goal.status,
        value: e.goal.current,
        progress: Number((e.goal.current / e.goal.target).toFixed(2)),
        note: e.goal.checkin,
        createdAt: addDays(now, -2),
        createdBy: epicOwners[e.slug]!,
      },
    });
  }
  console.log("  ✓ Kopf-Ziel + 3 Unterziele mit Check-ins");

  // €-Wertbeitrags-Ziel (Wurzel, Währung): das messbare €-Ziel, auf das die Epics
  // über ihre KPIs einzahlen (conversionFactor = €/Einheit). Treibt den Benefit-
  // Wasserfall im Portfolio-Dashboard (Wert je Reifegrad-Status vs. Zielwert). Der
  // Zielwert liegt bewusst über der Summe der geplanten Beiträge → sichtbare Lücke.
  const valueGoalId = uid("offsite:goal:wertbeitrag");
  const plannedContribSum = EPICS.reduce((s, e) => s + e.kpi.target * valuePerUnit(e), 0);
  await prisma.objective.create({
    data: {
      id: valueGoalId,
      tenantId,
      themeId,
      title: "Offsite-Wertbeitrag",
      narrative:
        "Geplanter €-Wertbeitrag der Außentagungs-Vorhaben — Summe der KPI-Nutzen gegen das gesetzte Zielbudget.",
      path: valueGoalId,
      level: 0,
      nodeKind: "objective",
      progressMode: "manual",
      metricName: "Wertbeitrag",
      metricUnit: "€",
      metricType: "currency",
      currencyCode: "EUR",
      baseline: 0,
      target: Math.round(plannedContribSum * 1.3),
      current: 0,
      status: "on_track",
      periodStart: now,
      periodEnd: OFFSITE_AT,
      dueDate: OFFSITE_AT,
      ownerId: portfolio,
      createdBy: admin,
      updatedBy: admin,
    },
  });

  // ── Portfolio: Epics ──────────────────────────────────────────────────────
  console.log("\n── Portfolio");
  const epicIds: Record<string, string> = {};
  for (const e of EPICS) epicIds[e.slug] = uid(`offsite:epic:${e.slug}`);

  // Eine Solution im Horizont H3: es wird eine *neue* Außentagung geplant
  // (explorativ/R&D) — frühere gab es schon. Der Horizont eines Epics kommt aus
  // seiner Primär-Solution; hier ist das für alle dieselbe H3-Solution, damit die
  // Horizont-Swimlane des Portfolio-Kanbans die drei Vorhaben in der H3-Zeile zeigt.
  const solutionId = uid("offsite:sol:aussentagung");
  await prisma.solution.create({
    data: {
      id: solutionId,
      tenantId,
      valueStreamId: vsId,
      artId,
      name: "Außentagung (Format)",
      horizon: "h3",
      investmentMode: null,
      runBaselineAmount: null,
      createdBy: admin,
      updatedBy: admin,
    },
  });

  const epicRows: Prisma.InitiativeCreateManyInput[] = EPICS.map((e) => ({
    id: epicIds[e.slug]!,
    tenantId,
    level: 0,
    path: epicIds[e.slug]!,
    title: e.title,
    description: e.description,
    ownerId: epicOwners[e.slug]!,
    assigneeIds: [featureOwners[e.slug]!],
    valueStreamId: vsId,
    // ART-Zuordnung des Epics (der eine ART des Wertstroms). Der Kosten-Richtwert
    // im Ballot wird aus dem freigegebenen Lean Business Case abgeleitet (Σ
    // costSlices), die Budget-Info ebenfalls — kein manuelles Einreichungsfeld mehr.
    artId,
    // L3 = Budget alloziert. Der nächste Schritt ist das PI-Planning, danach L4.
    stageGate: "L3",
    status: "approved",
    approvalPhase: "approved",
    approvalRevision: 1,
    epicType: "epic",
    // Horizont kommt aus der Primär-Solution (H3, neue Außentagung).
    primarySolutionId: solutionId,
    investmentHorizon: "h3",
    stagedForBudgeting: true,
    needsSteeringAttention: false,
    plannedStartAt: PI_START,
    plannedEndAt: OFFSITE_AT,
    // Reifegrad-Plan: das Umsetzungsfenster L4.1→L4.2 IST das geplante
    // Zeitfenster; plannedStartAt/EndAt werden jetzt genau daraus abgeleitet.
    timeline: {
      estimates: {
        implementation_started: PI_START.toISOString().slice(0, 10),
        implementation: OFFSITE_AT.toISOString().slice(0, 10),
      },
      actuals: {},
    },
    selectedForDetailingAt: addDays(now, -40),
    hypothesisApprovedAt: addDays(now, -28),
    selectedForAnalyzingAt: addDays(now, -26),
    businessCaseApprovedAt: addDays(now, -12),
    benefitHypothesis: versioned(admin, benefitHypothesisFor(e)),
    businessCase: versioned(admin, businessCaseFor(e)),
    createdBy: admin,
    updatedBy: admin,
  }));
  await prisma.initiative.createMany({ data: epicRows });

  // Voller Epic↔Solution-Zuordnungssatz (Primär steht am Epic). Alle drei zeigen
  // auf die eine H3-Solution.
  await prisma.epicSolution.createMany({
    data: EPICS.map((e) => ({
      tenantId,
      epicId: epicIds[e.slug]!,
      solutionId,
      createdBy: admin,
    })),
  });

  // Je Epic eine KPI — sie ist zugleich der Träger des Ziel-Beitrags.
  const kpiIds: Record<string, string> = {};
  for (const e of EPICS) kpiIds[e.slug] = uid(`offsite:kpi:${e.slug}`);
  await prisma.kpi.createMany({
    data: EPICS.map((e) => ({
      id: kpiIds[e.slug]!,
      tenantId,
      initiativeId: epicIds[e.slug]!,
      name: e.kpi.name,
      unit: e.kpi.unit,
      baseline: 0,
      target: e.kpi.target,
      measurements: [{ date: addDays(now, -2).toISOString(), value: e.goal.current }],
      valuePerUnit: valuePerUnit(e),
      benefitKind: "one_time",
      recurringInterval: "yearly",
      calculationNote: `Anteil am Offsite-Budget je ${e.kpi.unit.replace(/n$/, "")}.`,
      createdBy: admin,
      updatedBy: admin,
    })),
  });

  // Ziel-Beitrag: jedes Epic zahlt über seine KPI auf das €-Wertbeitrags-Ziel ein.
  // `conversionFactor = €/Einheit` (Budgetanteil je KPI-Einheit) rechnet die KPI-
  // Bewegung in die €-Ziel-Einheit um. Ein Link je KPI (`@@unique([kpiId])`); die
  // manuellen Zahlen-Unterziele bleiben ohne KPI-Link (sie sind `progressMode:
  // manual` und tragen ihren Fortschritt selbst).
  await prisma.goalEpicLink.createMany({
    data: EPICS.map((e) => ({
      id: uid(`offsite:gel:${e.slug}`),
      tenantId,
      objectiveId: valueGoalId,
      epicId: epicIds[e.slug]!,
      kpiId: kpiIds[e.slug]!,
      conversionFactor: valuePerUnit(e),
      impactKind: "one_time",
      recurringInterval: "yearly",
      createdBy: admin,
    })),
  });

  await prisma.themeEpicLink.createMany({
    data: EPICS.map((e) => ({
      id: uid(`offsite:tel:${e.slug}`),
      tenantId,
      themeId,
      epicId: epicIds[e.slug]!,
      createdBy: admin,
    })),
  });

  // Freigaben: alle fünf Parteien plus die beiden Abschnitte — sonst passt
  // `approvalPhase: "approved"` nicht zu dem, was der Freigaben-Tab zeigt.
  const PARTIES = ["mgmt", "business_owner", "finance", "irt_owner", "lace_vmo"] as const;
  const partyApprover: Record<(typeof PARTIES)[number], string> = {
    mgmt: portfolio,
    business_owner: vso,
    finance: admin,
    irt_owner: rte,
    lace_vmo: portfolio,
  };
  const approvalRows: Prisma.EpicApprovalCreateManyInput[] = [];
  for (const e of EPICS) {
    for (const party of PARTIES) {
      approvalRows.push({
        id: uid(`offsite:appr:${e.slug}:${party}`),
        tenantId,
        initiativeId: epicIds[e.slug]!,
        kind: "party",
        party,
        approverUserId: partyApprover[party],
        status: "approved",
        decidedAt: addDays(now, -12),
        comment: "Freigegeben.",
        createdBy: admin,
      });
    }
    for (const section of ["breakdown", "kpis"] as const) {
      approvalRows.push({
        id: uid(`offsite:appr:${e.slug}:${section}`),
        tenantId,
        initiativeId: epicIds[e.slug]!,
        kind: "section",
        section,
        approverUserId: epicOwners[e.slug]!,
        status: "approved",
        decidedAt: addDays(now, -10),
        createdBy: admin,
      });
    }
  }
  await prisma.epicApproval.createMany({ data: approvalRows });
  console.log(`  ✓ 3 Epics auf L3, ${approvalRows.length} Freigaben, 3 KPIs, 3 Ziel-Beiträge`);

  // ── Reifegrad-Freigaben (ADR-0018) ────────────────────────────────────────
  // Wer nimmt welchen Reifegrad-Wechsel ab. Zwei Ebenen:
  //   • Tenant-Default (valueStreamId: null) L1–L5 — die Baseline, damit jedes
  //     Gate überhaupt beantragbar ist (= DEFAULT_GATE_POLICIES).
  //   • Wertstrom-Override auf „Firmen-Offsite" — zeigt die neue per-Wertstrom-
  //     Konfig: L3 mit zusätzlicher benannter Person, L4 mit Quorum „any".
  // Die Platzhalter (`value_stream.vmo`/`.finance_approver`) lösen auf die oben
  // gesetzten `vmoId: portfolio` / `financeApproverId: admin` auf.
  await prisma.stageGateApproverRule.createMany({
    data: [
      // Tenant-Default L1–L5
      ...(
        [
          ["L1", ["value_stream.vmo"]],
          ["L2", ["value_stream.vmo"]],
          ["L3", ["value_stream.vmo", "value_stream.finance_approver"]],
          ["L4", ["value_stream.vmo"]],
          ["L5", ["value_stream.finance_approver"]],
        ] as const
      ).map(([toGate, approverRoles]) => ({
        tenantId,
        valueStreamId: null,
        toGate,
        required: true,
        quorum: "all",
        approverUserIds: [] as string[],
        approverRoles: [...approverRoles],
        updatedBy: admin,
      })),
      // Wertstrom-Override „Firmen-Offsite": L3 zusätzlich mit dem VS-Owner als
      // benanntem Abnehmer (einstimmig), L4 nur VMO, aber „eine Zustimmung genügt".
      {
        tenantId,
        valueStreamId: vsId,
        toGate: "L3",
        required: true,
        quorum: "all",
        approverUserIds: [vso],
        approverRoles: ["value_stream.vmo", "value_stream.finance_approver"],
        updatedBy: admin,
      },
      {
        tenantId,
        valueStreamId: vsId,
        toGate: "L4",
        required: true,
        quorum: "any",
        approverUserIds: [admin],
        approverRoles: ["value_stream.vmo"],
        updatedBy: admin,
      },
    ],
  });

  // Ein offener L3→L4-Antrag, damit „Meine Freigaben" und die Gate-Karte sofort
  // etwas zeigen. Quorum „any" ist aus der VS-L4-Regel EINGEFROREN; die zwei
  // Abnahme-Zeilen spiegeln deren Auflösung (VMO-Platzhalter + benannte Person).
  await prisma.stageGateTransition.create({
    data: {
      tenantId,
      initiativeId: epicIds["transport"]!,
      fromGate: "L3",
      toGate: "L4",
      kind: "forward",
      status: "pending",
      quorum: "any",
      requestedBy: epicOwners["transport"]!,
      reason: "Transport ist geplant — Umsetzung kann starten.",
      approvals: {
        create: [
          {
            tenantId,
            approverUserId: portfolio,
            role: "value_stream.vmo",
            source: "value_stream",
            createdBy: epicOwners["transport"]!,
          },
          {
            tenantId,
            approverUserId: admin,
            role: null,
            source: "manual",
            createdBy: epicOwners["transport"]!,
          },
        ],
      },
    },
  });
  console.log("  ✓ 7 Gate-Regeln (5 Tenant-Default + 2 Wertstrom) + 1 offener L3→L4-Antrag");

  // ── Features ──────────────────────────────────────────────────────────────
  // `piId: null` ist der Kern des Szenarios: angelegt und geschätzt, aber noch
  // nicht eingeplant. Das PI-Planning ist der nächste Schritt.
  console.log("\n── Features");
  const featureIds: Record<string, string> = {};
  const featureRows: Prisma.InitiativeCreateManyInput[] = [];
  const graphRows: Prisma.InitiativeGraphPositionCreateManyInput[] = [];

  for (const e of EPICS) {
    e.features.forEach((f, i) => {
      const key = `${e.slug}:${i}`;
      const id = uid(`offsite:feat:${key}`);
      featureIds[key] = id;
      const { bv, tc, rr, js } = f.wsjf;
      featureRows.push({
        id,
        tenantId,
        level: 1,
        parentId: epicIds[e.slug]!,
        path: `${epicIds[e.slug]!}/${id}`,
        title: f.title,
        description: `Baustein für „${e.title}".`,
        ownerId: featureOwners[e.slug]!,
        assigneeIds: [],
        artId,
        piId: null,
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: Number(((bv + tc + rr) / js).toFixed(2)),
        featureType: "feature",
        stageGate: "L3",
        // Startzustand der Liefer-FSM — nichts läuft, nichts ist fertig.
        status: "approved",
        acceptanceCriteria: [...f.criteria],
        createdBy: admin,
        updatedBy: admin,
      });
      graphRows.push({
        id: uid(`offsite:pos:${key}`),
        tenantId,
        epicId: epicIds[e.slug]!,
        initiativeId: id,
        x: 160 + i * 240,
        y: 120 + (i % 2) * 140,
        updatedBy: admin,
      });
    });
  }
  await prisma.initiative.createMany({ data: featureRows });
  await prisma.initiativeGraphPosition.createMany({ data: graphRows });
  console.log(`  ✓ ${featureRows.length} Features, keines einem PI zugeordnet`);

  // Eine Abhängigkeit, die man sofort versteht: wie groß der Raum ist,
  // entscheidet darüber, welche Workshop-Formate überhaupt gehen.
  await prisma.dependency.create({
    data: {
      id: uid("offsite:dep:agenda-hotel"),
      tenantId,
      fromId: featureIds["agenda:0"]!,
      toId: featureIds["hotel:1"]!,
      type: "depends_on",
      createdBy: rte,
    },
  });

  // ── Risiko ────────────────────────────────────────────────────────────────
  console.log("\n── Risiko");
  const issueId = uid("offsite:issue:location");
  await prisma.issue.create({
    data: {
      id: issueId,
      tenantId,
      issueNumber: 1,
      title: "Wunsch-Location im Zeitraum ausgebucht",
      description:
        "Zwei der drei in Frage kommenden Häuser sind im Zielzeitraum belegt. Fällt auch das dritte weg, verschiebt sich der Termin oder das Format ändert sich.",
      probability: "high",
      impact: "high",
      category: "external",
      reviewStatus: "documented",
      roamStatus: "mitigated",
      roamRationale: "Option auf Haus 3 gehalten, parallel wird ein Ausweichtermin geprüft.",
      ownerId: epicOwners["hotel"]!,
      raisedBy: rte,
      targetResolutionDate: addDays(now, 21),
      initiativeId: epicIds["hotel"]!,
      artId,
    },
  });
  await prisma.issueMitigation.create({
    data: {
      id: uid("offsite:mit:location"),
      tenantId,
      issueId,
      description: "Option auf das dritte Haus bis Monatsende verlängern und anzahlen.",
      createdBy: epicOwners["hotel"]!,
    },
  });
  await prisma.issueAssessment.create({
    data: {
      id: uid("offsite:ass:location"),
      tenantId,
      issueId,
      probability: "very_high",
      impact: "high",
      note: "Erst-Einschätzung: zum Aufnahmezeitpunkt waren noch beide Wunschhäuser offen.",
      createdBy: rte,
    },
  });
  await prisma.issueSettings.create({
    data: { id: uid("offsite:issuesettings"), tenantId, prefix: "R-", lastNumber: 1 },
  });
  console.log("  ✓ 1 Risiko mit Maßnahme und Neubewertung");

  // ── Budget ────────────────────────────────────────────────────────────────
  console.log("\n── Budget");
  await prisma.budgetAllocation.createMany({
    data: EPICS.map((e, i) => ({
      id: uid(`offsite:balloc:${e.slug}`),
      tenantId,
      epicId: epicIds[e.slug]!,
      priority: i,
      // Zwei Drittel im laufenden Halbjahr, ein Drittel im Halbjahr des Offsites.
      allocations: {
        [PERIOD_NOW]: Math.round(e.budget * 0.66),
        [PERIOD_END]: Math.round(e.budget * 0.34),
      },
      createdBy: admin,
      updatedBy: admin,
    })),
  });
  await prisma.artBudget.create({
    data: {
      id: uid("offsite:abudget"),
      tenantId,
      artId,
      byPeriod: {
        [PERIOD_NOW]: Math.round(BUDGET_TOTAL * 0.66),
        [PERIOD_END]: Math.round(BUDGET_TOTAL * 0.34),
      },
      createdBy: admin,
      updatedBy: admin,
    },
  });
  await prisma.budgetPlanRevision.create({
    data: {
      id: uid(`offsite:bprev:${PERIOD_NOW}`),
      tenantId,
      cycleKey: PERIOD_NOW,
      capturedAt: addDays(now, -12),
      capturedBy: admin,
      // Payload über den ECHTEN Domain-Builder statt inline — so bleibt der Seed
      // an denselben Snapshot-Vertrag gebunden wie ein produktiver Capture.
      payload: {
        version: 1,
        snapshot: buildBudgetPlanSnapshot({
          cycleKey: PERIOD_NOW,
          capturedAt: addDays(now, -12),
          pool: { [PERIOD_NOW]: BUDGET_TOTAL },
          epics: EPICS.map((e, i) => ({
            id: epicIds[e.slug]!,
            title: e.title,
            valueStreamId: vsId,
            valueStream: "Firmen-Offsite",
            isHypothesisOnly: false,
            costSlices: [e.budget],
            hypothesisBudget: 0,
            startKey: PERIOD_NOW,
            allocations: { [PERIOD_NOW]: e.budget },
            priority: i,
          })),
          artRows: [
            { artId, name: "Offsite-Planung", budgetByPeriod: { [PERIOD_NOW]: BUDGET_TOTAL } },
          ],
          features: [],
        }),
      } as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`  ✓ ${BUDGET_TOTAL.toLocaleString("de-DE")} € auf 3 Epics verteilt`);

  // ── Budgeting-Kachel (Kachel-Modell, laufend) ─────────────────────────────
  console.log("\n── Budgeting-Kachel (Periode)");
  const owners = EPICS.map((e) => epicOwners[e.slug]!);
  const fowners = EPICS.map((e) => featureOwners[e.slug]!);
  const KPOOL = Math.round(BUDGET_TOTAL * 0.7);

  const rtb = await seedRunTheBusiness(tenantId, admin, [
    {
      valueStreamId: vsId,
      items: [
        { name: "Betrieb & Support", plannedAmount: 80_000 },
        { name: "Lizenzen & Tooling", plannedAmount: 40_000 },
      ],
    },
  ]);
  const rtbCands = rtb.map((r) => ({
    rtbItemId: r.id,
    title: r.name,
    ask: r.plannedAmount,
    valueStreamId: r.valueStreamId,
  }));
  const epicCands = EPICS.map((e, ei) => ({
    epicId: epicIds[e.slug]!,
    title: e.title,
    ask: 180_000 + ei * 40_000,
    valueStreamId: vsId,
    artId,
  }));

  const allRefs = [
    ...epicCands.map((c) => ({ ref: c.epicId, ask: c.ask })),
    ...rtbCands.map((c) => ({ ref: c.rtbItemId, ask: c.ask })),
  ];
  const groupAmounts = (gi: number): Record<string, number> => {
    const out: Record<string, number> = {};
    allRefs.forEach((c, j) => {
      if (j % 2 !== gi % 2) out[c.ref] = c.ask;
    });
    return out;
  };
  const groups: GroupSpec[] = [
    {
      name: "Gruppe A",
      spokespersonUserId: owners[0]!,
      submitted: true,
      memberUserIds: [owners[0]!, fowners[0]!, portfolio],
      amounts: groupAmounts(0),
    },
    {
      name: "Gruppe B",
      spokespersonUserId: owners[1]!,
      submitted: false, // offen → My-Tasks-Hinweis für die Mitglieder
      memberUserIds: [owners[1]!, fowners[1]!, vso],
      amounts: groupAmounts(1),
    },
  ];

  await seedBudgetPeriod(tenantId, admin, {
    key: "offsite-running",
    cycleKey: PERIOD_NOW,
    status: "running",
    poolTotal: KPOOL,
    startDate: addDays(now, -20),
    endDate: addDays(now, 160),
    submissionDeadline: addDays(now, 25),
    participantUserIds: [portfolio, rte, vso, ...owners, ...fowners],
    epicCandidates: epicCands,
    rtbCandidates: rtbCands,
    groups,
  });

  // ── Operating Model + Setup-Fortschritt ───────────────────────────────────
  console.log("\n── Einrichtung");
  await prisma.targetOperatingModel.create({
    data: {
      id: uid("offsite:tom"),
      tenantId,
      status: "active",
      template: "portfolio_safe",
      targetValueStreams: 1,
      targetArtsTotal: 1,
      targetPiCadenceWeeks: PI_WEEKS,
      targetDate: OFFSITE_AT,
      createdBy: admin,
      updatedBy: admin,
    },
  });

  // M8 („First PI startet") bleibt offen — das ist der nächste Schritt in der
  // Simulation. `m2-3` („Teams unter ARTs") ist seit dem Team-Rückbau gar nicht
  // mehr erfüllbar und bleibt es deshalb auch.
  const DONE_CHECKS = [
    "m1-1",
    "m1-2",
    "m1-3",
    "m2-1",
    "m2-2",
    "m3-1",
    "m3-2",
    "m3-3",
    "m4-1",
    "m4-2",
    "m4-3",
    "m6-1",
    "m6-2",
    "m6-3",
    "m7-1",
    "m7-2",
    "m7-3",
  ];
  await prisma.setupProgress.createMany({
    data: DONE_CHECKS.map((checkId, i) => ({
      id: uid(`offsite:setup:${checkId}`),
      tenantId,
      checkId,
      updatedBy: admin,
      updatedAt: addDays(now, -30 + i),
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ Operating Model aktiv, ${DONE_CHECKS.length} Setup-Schritte abgehakt`);

  console.log("\n✅ Fertig. Anmelden als admin@pulse.dev, Mandant „Test Demo“.");
  console.log("   Planungsteam: eo-{transport,agenda,hotel}@pulse.dev · fo-{…}@pulse.dev");
  console.log("   Nächster Schritt in der Simulation: PI-Planning (Features in PI 1 ziehen).\n");
}

// ── Inhalts-Bausteine ───────────────────────────────────────────────────────

/**
 * Versionierter Umschlag, wie ihn `parseBenefitHypothesis`/`parseBusinessCase`
 * erwarten. Der Parser nimmt zwar auch die alte Flachform, aber die versionierte
 * ist die richtige — nur sie trägt eine Historie.
 */
function versioned<T>(userId: string, content: T): Prisma.InputJsonValue {
  return { current: content, history: [] } as Prisma.InputJsonValue & { current: T };
}

function benefitHypothesisFor(e: EpicDef): Record<string, unknown> {
  return {
    measuresHypothesis: `${e.kpi.name} (Ziel: ${e.kpi.target} ${e.kpi.unit})`,
    changeFromBaseline: `Heute gibt es dafür weder Angebot noch Zusage — am Ende steht ${e.goal.title.toLowerCase()}.`,
    businessOutcomes: [
      "Das Offsite findet wie geplant statt",
      "Keine kurzfristigen Absagen wegen offener Organisation",
    ],
    leadingIndicators: [e.kpi.name, "Offene Rückmeldungen der Teilnehmenden"],
    risks: ["Zeitfenster kollidiert mit dem Quartalsabschluss"],
  };
}

function businessCaseFor(e: EpicDef): Record<string, unknown> {
  return {
    keyStakeholders: "Geschäftsführung, People & Culture, Assistenz",
    initiativeDescription: e.description,
    businessOutcomeHypothesis: `${e.goal.title} — messbar an „${e.kpi.name}".`,
    leadingIndicators: e.kpi.name,
    inScope: e.features.map((f) => f.title).join(", "),
    outOfScope: "Alles, was nach dem Offsite passiert (Nachbereitung, Foto-Doku)",
    // Ein Halbjahres-Slice: das Vorhaben ist in unter sechs Monaten durch.
    costSlices: [{ amount: e.budget }],
    oneTimeBenefit: 0,
    recurringBenefit: 0,
    customersAffected: `${PARTICIPANTS} Mitarbeitende`,
    analysisSummary: `Budgetrahmen ${e.budget.toLocaleString("de-DE")} € — Teil der ${BUDGET_TOTAL.toLocaleString("de-DE")} € für das Gesamt-Offsite.`,
    approvals: [
      { party: "mgmt", approved: true },
      { party: "business_owner", approved: true },
      { party: "finance", approved: true },
    ],
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
