/* eslint-disable no-console */
/**
 * „Large Test Corp" — realistisches, **budget-getriebenes 10-Jahres-Programm**:
 * eine Firma in der Restrukturierung mit Cost-Optimization-Fokus über 3
 * Workstreams (Verwaltung & Overhead · Logistik · Produktion).
 *
 * Engpass ist das **Budget: nur €2 Mio./Kalenderjahr** (≈ €1 Mio./Halbjahres-Zyklus).
 * Wir stehen im **1. Halbjahr von Jahr 5** (die laufende Kachel `${YEAR}-H1`). Der
 * Reifegrad + die Zeitleiste jedes Epics folgen der Budget-Verfügbarkeit:
 *   L5 Done / L4 Implementing (in der Vergangenheit bezahlt) · L3 jetzt bezahlt ·
 *   L2 fertig definiert, aber OHNE Budget (wartet, nach hinten geschoben) · L1/L0 früh.
 * Nur bezahlte Epics (L3–L5) tragen eine `BudgetAllocation` (Σ ≤ ~€1 Mio./Zyklus).
 *
 * Zusätzlich: Issues je Epic (L2–L5, vom Owner beim LBC aufgenommen), Features im
 * Umsetzungsmodul (L4/L5), Ziele = Top-Ziel + je Wertstrom aufgebrochen, Solutions
 * je Wertstrom mit zugeordneten Epics, 10-Jahres-Budget-Entwurf (alle 20 Zyklen).
 *
 * Eigener Tenant, uid-Namespace `uid("large:…")`, nur Demo-Logins (@pulse.dev,
 * `Test1234!`), Reset-then-insert (`wipeDomainData`).
 *
 * Run: `pnpm db:seed:large`  (lädt `.env.local` selbst; braucht DIRECT_URL + Supabase Service-Role)
 */

import type { Prisma } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { buildBudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";
import { prisma, upsertAuthUser, assignRole, wipeDomainData, uid } from "./seed-helpers.js";
import { computeBusinessCaseTotals, parseBusinessCase } from "@/modules/work/domain/business-case";
import {
  seedArtEpicAllocations,
  seedBudgetPeriod,
  seedRunTheBusiness,
  seedValueStreamGuardrails,
  type ArtAllocationSpec,
  type GroupSpec,
} from "./seed-budgeting.js";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import {
  assertGateHistory,
  buildGateHistory,
  gateRuleRows,
  straightPath,
  stepsUpTo,
  type GateApprovalRow,
  type GateMove,
  type GateTransitionRow,
} from "./seed-gate-history.js";
import type { GateStep } from "@/modules/work/domain/stage-gate";

// ── Zeit-Anker (Szenario steht in Jahr 5, 1. Halbjahr) ───────────────────────
const DAY = 86_400_000;
const YEAR = new Date().getFullYear();
// „Jetzt" ist bewusst der 1. März von Jahr 5 (= H1), unabhängig von der realen Uhr.
const now = new Date(YEAR, 2, 1);
/**
 * Die echte Uhr. `now` oben ist die *simulierte* Gegenwart des
 * Zehnjahres-Programms (1. März) — für die Historie richtig, für alles, was
 * „gerade offen" sein soll, falsch: die App misst Wartezeiten und
 * Überfälligkeit gegen die echte Zeit. Offene Anträge und frische
 * Entscheidungen hängen deshalb hier.
 */
const realNow = new Date();
const addDays = (base: Date, d: number): Date => new Date(base.getTime() + d * DAY);
const beforeNow = (d: Date, margin = 3): Date =>
  new Date(Math.min(d.getTime(), now.getTime() - margin * DAY));
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function halfYearCycles(
  fromYear: number,
  fromHalf: 1 | 2,
  toYear: number,
  toHalf: 1 | 2,
): string[] {
  const out: string[] = [];
  let y = fromYear;
  let h: 1 | 2 = fromHalf;
  while (y < toYear || (y === toYear && h <= toHalf)) {
    out.push(`${y}-H${h}`);
    if (h === 1) h = 2;
    else {
      h = 1;
      y += 1;
    }
  }
  return out;
}
function cycleStart(key: string): Date {
  const [ys, hs] = key.split("-");
  return new Date(Number(ys), hs === "H1" ? 0 : 6, 6);
}
const cycleEnd = (key: string): Date => addDays(cycleStart(key), 178);

// 10-Jahres-Fenster: Jahr 1 = YEAR-4 … Jahr 10 = YEAR+5. Jahr 5 = YEAR (jetzt).
const ALL_CYCLES = halfYearCycles(YEAR - 4, 1, YEAR + 5, 2); // 20 Zyklen
const CURRENT_CYCLE = `${YEAR}-H1`;
const CURRENT_IDX = ALL_CYCLES.indexOf(CURRENT_CYCLE);
const MAX_IDX = ALL_CYCLES.length - 1;
const PROGRAM_TARGET_YEAR = `${YEAR + 5}`; // Programmende Jahr 10

// €1 Mio. je Halbjahres-Zyklus (= €2 Mio./Kalenderjahr).
const CYCLE_POOL = 1_000_000;

const TENANT_NAME = "Large Test Corp";
const EPIC_COUNT = 200;

// Reifegrad → Ziel-Zyklus-Band (relativ zum aktuellen Zyklus). Budget/Zeit folgen daraus.
const BANDS: Record<string, [number, number]> = {
  L5: [CURRENT_IDX - 8, CURRENT_IDX - 4], // Jahr 1–3: bezahlt & fertig
  L4: [CURRENT_IDX - 3, CURRENT_IDX - 1], // jüngst bezahlt, in Umsetzung
  L3: [CURRENT_IDX, CURRENT_IDX], // jetzt bezahlt (Budget alloziert)
  L2: [CURRENT_IDX + 1, CURRENT_IDX + 3], // fertig definiert, wartet auf Budget
  L1: [CURRENT_IDX + 4, CURRENT_IDX + 7], // Hypothese
  L0: [CURRENT_IDX + 8, CURRENT_IDX + 11], // Idee/Funnel (nach hinten geschoben)
};

async function ensureLargeTenant(): Promise<string> {
  const existing = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (existing) {
    console.log(`  ↳ ${TENANT_NAME} existiert`);
    return existing.id;
  }
  const t = await prisma.tenant.create({
    data: { id: uid("large:tenant"), name: TENANT_NAME, region: "eu", kind: "organization" },
  });
  console.log(`  ✓ ${TENANT_NAME} angelegt`);
  return t.id;
}

async function main() {
  console.log("\n🌱  LARGE-Seed startet (budget-getriebenes 10-Jahres-Programm, Jahr 5 H1)\n");

  // ── Phase 1: Auth-User ─────────────────────────────────────────────────────
  console.log("── Auth-User");
  const U = {
    admin: await upsertAuthUser("admin@pulse.dev", "Admin1234!"),
    portfolio: await upsertAuthUser("portfolio@pulse.dev", "Test1234!"),
    vmo: await upsertAuthUser("vmo@pulse.dev", "Test1234!"),
    rte: await upsertAuthUser("rte@pulse.dev", "Test1234!"),
    owner: await upsertAuthUser("owner@pulse.dev", "Test1234!"),
    viewer: await upsertAuthUser("viewer@pulse.dev", "Test1234!"),
    vso: await upsertAuthUser("vso@pulse.dev", "Test1234!"),
    fo: await upsertAuthUser("fo@pulse.dev", "Test1234!"),
  };
  const ADMIN = U.admin;

  // ── Phase 1: Tenant + Ökonomie ────────────────────────────────────────────
  console.log("\n── Tenant");
  const tenantId = await ensureLargeTenant();
  await wipeDomainData(tenantId);

  // 10-Jahres-Budget-Entwurf: ~€1 Mio. je Zyklus über alle 20 Zyklen (Controller,
  // Jahr 1). Nur noch eine lokale Vorgabe für die Kachel-Töpfe unten — einen
  // Tenant-weiten Topf gibt es nicht mehr.
  const budgetPoolByPeriod: Record<string, number> = {};
  ALL_CYCLES.forEach((c) => {
    budgetPoolByPeriod[c] = CYCLE_POOL;
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      enabledModules: [],
      costNeutralTarget: 500_000,
      dashboardHorizonEnd: cycleEnd(ALL_CYCLES[MAX_IDX]!),
      budgetWindowSize: 4,
      defaultHypothesisEffort: 30_000,
      costPerJobSizePoint: 1_500,
      guardrailTargets: {
        horizon: { h3: 10, h2: 25, h1: 55, h0: 10 },
        capacity: { business: 65, enabler: 35 },
      },
    },
  });

  // ── Phase 2: RBAC ─────────────────────────────────────────────────────────
  console.log("\n── Rollen + Capabilities");
  const vsIds = [uid("large:vs:0"), uid("large:vs:1"), uid("large:vs:2")];
  const artIds = Array.from({ length: 6 }, (_, i) => uid(`large:art:${i}`));

  await assignRole(U.admin, tenantId, "platform_admin");
  await assignRole(U.admin, tenantId, "tenant_admin");
  await assignRole(U.portfolio, tenantId, "portfolio_manager");
  await assignRole(U.vmo, tenantId, "portfolio_manager");
  await assignRole(U.rte, tenantId, "rte");
  await assignRole(U.owner, tenantId, "epic_owner");
  await assignRole(U.owner, tenantId, "feature_owner");
  await assignRole(U.viewer, tenantId, "viewer");
  await assignRole(U.vso, tenantId, "value_stream_owner", { valueStreamIds: [vsIds[0]!] });
  await assignRole(U.fo, tenantId, "feature_owner");

  const capsList = enumerateDefaultCapabilities();
  await prisma.roleCapability.createMany({
    data: capsList.map((c) => ({
      tenantId,
      role: c.role,
      action: c.action,
      scope: c.scope,
      createdBy: ADMIN,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ ${capsList.length} Default-Capabilities gespiegelt`);

  // ── Phase 3: Struktur (3 Workstreams) ─────────────────────────────────────
  console.log("\n── Struktur (3 Workstreams, 6 ARTs, Timeline, PIs)");
  const timelineId = uid("large:timeline");
  await prisma.timeline.create({
    data: { id: timelineId, tenantId, name: "Restrukturierungs-Kadenz" },
  });
  await prisma.piStandard.create({
    data: {
      id: uid("large:pistd"),
      tenantId,
      name: "Standard 10-Wochen",
      anchorMonth: 1,
      anchorDay: 6,
      cadenceWeeks: 10,
      piCount: 8,
      createdBy: ADMIN,
    },
  });

  const vsNames = ["Verwaltung & Overhead", "Logistik", "Produktion"];
  const vsDesc = [
    "SG&A/Overhead senken: Prozessautomatisierung, Shared Services, IT-/Einkaufs-Konsolidierung.",
    "Logistikkosten senken: Fracht, Netzwerk, Bestände, Verpackung und Retouren.",
    "Herstellkosten senken: OEE, Ausschuss, Energie, Rüstzeiten und Materialkosten.",
  ];
  await prisma.valueStream.createMany({
    data: vsNames.map((name, i) => ({
      id: vsIds[i]!,
      tenantId,
      name,
      description: vsDesc[i]!,
      budgetAmount: [500_000, 800_000, 1_200_000][i]!,
      budgetCurrency: "EUR",
      financeApproverId: U.fo,
      vmoId: U.vmo,
    })),
  });

  const artNames = [
    "Shared Services & Automation",
    "Procurement & IT",
    "Transport & Network",
    "Warehouse & Inventory",
    "Plant Efficiency (OEE)",
    "Materials & Energy",
  ];
  await prisma.art.createMany({
    data: artNames.map((name, i) => ({
      id: artIds[i]!,
      tenantId,
      valueStreamId: vsIds[Math.floor(i / 2)]!,
      name,
      description: `${name} — Agile Release Train`,
      rteId: U.rte,
      timelineId,
    })),
  });

  // 12 PIs im aktiven Umsetzungsfenster (um „jetzt" = Jahr 5 H1).
  const piBase = addDays(now, -21);
  const piIds: Record<string, string> = {};
  const piSpecs = Array.from({ length: 12 }, (_, k) => {
    const key = `pi${k + 1}`;
    piIds[key] = uid(`large:pi:${key}`);
    const start = addDays(piBase, (k - 8) * 70);
    const status = k < 8 ? "completed" : k === 8 ? "active" : "planned";
    return { key, name: `PI ${k + 1}`, start, status };
  });
  await prisma.programIncrement.createMany({
    data: piSpecs.map((p, i) => ({
      id: piIds[p.key]!,
      tenantId,
      timelineId,
      name: p.name,
      startDate: p.start,
      endDate: addDays(p.start, 69),
      status: p.status,
      capacityJobSize: 120 + i * 4,
      capacityAmount: 220_000 + i * 8_000,
      ...(p.status === "completed"
        ? { systemDemoAt: addDays(p.start, 68), inspectAdaptAt: addDays(p.start, 69) }
        : {}),
    })),
  });
  const activePi = piIds["pi9"]!;
  const prevPi = piIds["pi8"]!;
  const planPi = piIds["pi10"]!;
  const oldPi = piIds["pi2"]!;

  // ── Phase 4: Solutions (je Wertstrom, mit Horizont) + Gate-Regeln ─────────
  const solId = (vs: number, h: string) => uid(`large:sol:${vs}:${h}`);
  const solNameSuffix: Record<string, string> = { h1: "Betrieb", h2: "Programm", h3: "Pilot" };
  const solutionRows: Prisma.SolutionCreateManyInput[] = [];
  for (let vs = 0; vs < vsIds.length; vs++) {
    for (const h of ["h1", "h2", "h3"] as const) {
      solutionRows.push({
        id: solId(vs, h),
        tenantId,
        valueStreamId: vsIds[vs]!,
        artId: h === "h1" ? artIds[vs * 2]! : null,
        name: `${vsNames[vs]} ${solNameSuffix[h]}`,
        horizon: h,
        investmentMode: h === "h1" ? "extracting" : null,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  }
  await prisma.solution.createMany({ data: solutionRows });

  // Abnehmer je Reifegrad-Wechsel. Die `toGate`-Werte sind **GateSteps**, keine
  // Haupt-Gates: der Lookup vergleicht gegen `L3.1`/`L3.2`/`L4.2`, eine Zeile
  // `"L3"` traefe nie und fiele still auf den Code-Default zurueck.
  await prisma.stageGateApproverRule.createMany({
    data: gateRuleRows(null).map((r) => ({
      tenantId,
      valueStreamId: null,
      toGate: r.toGate,
      required: r.required,
      quorum: r.quorum,
      approverUserIds: r.approverUserIds,
      approverRoles: r.approverRoles,
      updatedBy: ADMIN,
    })),
  });

  // ── Phase 5: 200 Epics — Reifegrad + Zeit + Budget aus der Verfügbarkeit ──
  console.log("\n── Delivery (200 Epics + KPIs + Features)");

  // Funnel eines Jahr-5-Programms: viel Fertiges/Backlog, wenig gerade Bezahltes.
  const gateFunnel: [string, number][] = [
    ["L0", 32],
    ["L1", 38],
    ["L2", 42],
    ["L3", 10],
    ["L4", 28],
    ["L5", 50],
  ];
  const gates: string[] = [];
  for (const [g, n] of gateFunnel) for (let i = 0; i < n; i++) gates.push(g);

  const gateStatus: Record<string, string> = {
    L0: "draft",
    L1: "draft",
    L2: "approved",
    L3: "approved",
    L4: "in_progress",
    L5: "completed",
  };
  const savingsFraction: Record<string, number> = {
    L5: 0.95,
    L4: 0.6,
    L3: 0.35,
    L2: 0.1,
    L1: 0.04,
    L0: 0.02,
  };

  const LEVERS: string[][] = [
    [
      "Prozessautomatisierung (RPA)",
      "Shared Service Center",
      "Lizenz- & IT-Konsolidierung",
      "Indirekten Einkauf bündeln",
      "Flächen- & Standort-Reduktion",
      "Reise- & Spesen-Governance",
      "Rechnungsworkflow digitalisieren",
      "Reporting-Automatisierung",
      "Vertragsmanagement zentralisieren",
      "Cloud-Kosten-Optimierung (FinOps)",
      "Org-Straffung Verwaltung",
      "Dokumenten-/Archiv-Digitalisierung",
    ],
    [
      "Frachtkosten-Ausschreibung",
      "Transportnetz-Optimierung",
      "Lager-Konsolidierung",
      "Bestandsreduktion (Sicherheitsbestände)",
      "Verpackungsoptimierung",
      "Retouren- & Schwund-Reduktion",
      "Ladungsträger-Pooling",
      "Transport-Management-System (TMS)",
      "Routenoptimierung",
      "Cross-Docking",
      "Anlieferkonzepte (JIT/JIS)",
      "Zoll- & Trade-Kosten senken",
    ],
    [
      "OEE-Steigerung",
      "Ausschuss-/Scrap-Reduktion",
      "Energiekosten-Senkung",
      "Rüstzeit-Reduktion (SMED)",
      "Predictive Maintenance",
      "Materialkosten-Verhandlung",
      "Layout-/Linien-Optimierung",
      "Yield-Verbesserung",
      "Instandhaltungskosten senken",
      "Automatisierung / Cobots",
      "Werksverbund-Konsolidierung",
      "Lean-/Kaizen-Programm",
    ],
  ];
  const VARIANT = [
    "Werk Nord",
    "Werk Süd",
    "Zentrale",
    "Region West",
    "Region Ost",
    "Phase 1",
    "Phase 2",
    "Standort A",
    "Standort B",
    "Konzern",
  ];
  const EPIC_TYPES = ["epic", "epic", "enabler", "epic", "enabler", "epic", "epic", "enabler"];
  const HORIZONS = ["h2", "h1", "h3"];
  const VS_WEIGHTS = [2, 2, 2, 1, 1, 0]; // Produktion (2) größter Block, dann Logistik (1), Verwaltung (0)
  const SAVINGS_BASE = [100_000, 180_000, 300_000];
  const owners = [U.owner, U.portfolio, U.vso, U.vmo, U.rte, U.fo];

  // ── Der Weg jedes Epics ───────────────────────────────────────────────
  //
  // Der Reifegrad entsteht aus Anträgen und Abnahmen, nicht aus gesetzten
  // Spalten (docs/concepts/epic-lifecycle-walkthrough.md). `buildGateHistory`
  // leitet Spalten, Anträge und Abnahmen aus dem beschriebenen Weg ab — mit
  // derselben Domänenlogik, die die App benutzt.

  /**
   * Ziel-Schritt aus dem Haupt-Gate. L3 und L4 tragen je zwei Stufen; wir
   * verteilen sie, damit beide Zustände im Mandanten vorkommen: L3.1 wartet auf
   * die Investitionsentscheidung, L3.2 hat sie hinter sich; L4.1 baut noch,
   * L4.2 ist bestätigt fertig.
   */
  const targetStepFor = (gate: string, i: number): GateStep => {
    if (gate === "L3") return i % 2 === 0 ? "L3.1" : "L3.2";
    if (gate === "L4") return i % 3 === 0 ? "L4.2" : "L4";
    return gate as GateStep;
  };

  const gateRules = gateRuleRows(null);
  const gateTransitionRows: GateTransitionRow[] = [];
  const gateApprovalRows: GateApprovalRow[] = [];

  const epicIds = Array.from({ length: EPIC_COUNT }, (_, i) => uid(`large:epic:${i}`));
  const epicVs: number[] = [];
  const epicTitles: string[] = [];
  const epicOwner: (string | null)[] = [];
  const epicCycleIdx: number[] = [];
  /** L4.1-Datum je Epic (nur Gate ≥ L4) — Anker der KPI-Erfassung. */
  const epicImplStart: (Date | null)[] = [];
  /** L4.2-Datum je Epic — dort friert die Menge, dort endet die Messreihe. */
  const epicImplDone: (Date | null)[] = [];
  const gateSeen: Record<string, number> = {};
  const epicRows: Prisma.InitiativeCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    const vs = VS_WEIGHTS[i % VS_WEIGHTS.length]!;
    epicVs[i] = vs;
    const lever = LEVERS[vs]![Math.floor(i / 3) % LEVERS[vs]!.length]!;
    const variant = VARIANT[(i * 7) % VARIANT.length]!;
    const title = `${lever} — ${variant}`;
    epicTitles[i] = title;
    const epicType = EPIC_TYPES[i % EPIC_TYPES.length]!;
    const horizon = HORIZONS[i % HORIZONS.length]!;
    const status = gateStatus[gate]!;

    // Ziel-Zyklus aus dem Reifegrad-Band (verteilt Epics über 10 Jahre; Budget folgt).
    const [b0, b1] = BANDS[gate]!;
    const k = gateSeen[gate] ?? 0;
    gateSeen[gate] = k + 1;
    const idx = clamp(b0 + (k % (b1 - b0 + 1)), 0, MAX_IDX);
    epicCycleIdx[i] = idx;
    const eraStart = cycleStart(ALL_CYCLES[idx]!);
    const plannedStart = addDays(eraStart, 15 + (i % 60));
    const plannedEnd = addDays(plannedStart, 150 + (i % 4) * 40);

    const owned = gate !== "L0" || i % 3 !== 0;
    const ownerId = owned ? owners[i % owners.length]! : null;
    epicOwner[i] = ownerId;
    const definedNoBudget = gate === "L2"; // fertig definiert, wartet auf Budget
    const gteL2 = ["L2", "L3", "L4", "L5"].includes(gate);

    // Ohne Owner gibt es niemanden, der beantragt — solche Epics bleiben im
    // Funnel liegen, ganz gleich, welches Gate der Funnel ihnen zuweist.
    const target = owned ? targetStepFor(gate, i) : "L0";
    const benefitHypothesis =
      gate !== "L0"
        ? {
            measuresHypothesis: `„${title}" senkt die Kosten in ${vsNames[vs]} nachhaltig.`,
            changeFromBaseline: "Dauerhaft geringere Kosten gegenüber dem heutigen Kostenniveau.",
            businessOutcomes: ["Geringere Kosten", "Höhere Effizienz", "Schlankere Prozesse"],
            leadingIndicators: ["Kosten je Einheit", "Prozesskosten", "Durchlaufzeit"],
            risks: ["Umsetzungsaufwand", "Change-/Mitbestimmungsthemen"],
          }
        : null;
    const businessCase = gteL2
      ? {
          costSlices: [
            { period: ALL_CYCLES[idx]!, amount: 30_000 + (i % 20) * 2_000 },
            {
              period: ALL_CYCLES[Math.min(idx + 1, MAX_IDX)]!,
              amount: 20_000 + (i % 20) * 1_500,
            },
          ],
          assumptions:
            "Investition zur Realisierung nachhaltiger Einsparungen (Amortisation < 2 Jahre).",
        }
      : null;

    // Das Datumsgerüst: der **letzte** Schritt bekommt seinen natürlichen Anker
    // im Planfenster, die früheren staffeln sich davor. `beforeNow` je Schritt
    // reichte nicht — Epics, deren Planfenster in der Zukunft liegt (L0–L2
    // stehen in den Bändern +1…+11 Halbjahre), bekamen sonst mehrere Schritte
    // auf denselben Tag geklemmt, und die Kette war nicht mehr chronologisch.
    // Der Mindestabstand von 45 Tagen lässt außerdem Platz für die
    // Sonderfälle, die sich unten dahinterhängen.
    const anchorFor = (step: GateStep): Date => {
      if (step === "L5") return addDays(plannedEnd, 10);
      if (step === "L4.2") return plannedEnd;
      if (step === "L4") return plannedStart;
      if (step === "L3.2") return addDays(plannedStart, -10);
      if (step === "L3.1") return addDays(plannedStart, -20);
      if (step === "L2") return addDays(plannedStart, -35);
      return addDays(plannedStart, -55);
    };
    // Jeder Schritt bekommt seinen *eigenen* Anker, nicht einen gleichmässigen
    // Abstand: zwischen L4 und L4.2 liegt das ganze Umsetzungsfenster, und die
    // KPI-Messreihe braucht diese Zeit, um überhaupt etwas zu zeigen. Danach
    // zwei Korrekturen: die Kette muss streng steigen (mindestens eine Woche
    // Abstand), und sie muss vollständig in der Vergangenheit liegen — dafür
    // wird sie als Ganzes zurückgeschoben, damit die Abstände erhalten bleiben.
    const walked = stepsUpTo(target);
    const raw = walked.map((step) => anchorFor(step).getTime());
    for (let n = 1; n < raw.length; n++) {
      raw[n] = Math.max(raw[n]!, raw[n - 1]! + 7 * DAY);
    }
    const latest = raw[raw.length - 1] ?? now.getTime();
    const overflow = Math.max(0, latest - (now.getTime() - (45 + (i % 20)) * DAY));
    const stepDayFor = (step: GateStep): Date =>
      new Date((raw[walked.indexOf(step)] ?? now.getTime()) - overflow);

    // Die unbequemen Zustände über den Mandanten streuen — sonst zeigen 200
    // Epics ausschließlich den glatten Pfad.
    // Alle Sonderfälle liegen im Fenster der letzten 44 Tage — also hinter dem
    // glatten Pfad und vor heute.
    const extras: GateMove[] = [];
    if (target === "L2" && i % 5 === 0) {
      // Offener Business-Case-Antrag. Jeder dritte davon liegt lange genug, um
      // in Guardrail 4 als überfällig zu zählen.
      const overdue = i % 15 === 0;
      extras.push({
        kind: "open",
        to: "L3.1",
        requestedAt: addDays(realNow, overdue ? -30 - (i % 7) : -6 - (i % 4)),
        decidedRoles: ["epic.party.mgmt", "epic.party.finance"],
        decidedAt: addDays(realNow, overdue ? -24 : -3),
      });
    } else if (target === "L2" && i % 7 === 3) {
      extras.push({
        kind: "rejected",
        to: "L3.1",
        requestedAt: addDays(realNow, -38),
        decidedAt: addDays(realNow, -34),
        reason: "Die Einsparung ist nicht belegt — bitte mit Ist-Zahlen erneut vorlegen.",
      });
    } else if (target === "L2" && i % 11 === 5) {
      extras.push({
        kind: "withdrawn",
        to: "L3.1",
        requestedAt: addDays(realNow, -42),
        decidedAt: addDays(realNow, -40),
      });
      // L3.1 liegt in diesem Mandanten nur auf GERADEN Indizes (`targetStepFor`),
      // deshalb müssen beide folgenden Zweige gerade Reste treffen — mit 1 und 3
      // wären sie tot.
    } else if (target === "L3.1" && i % 4 === 0) {
      // Einmal zurückgestuft und erneut abgenommen — das Epic zeigt den Diff.
      extras.push(
        {
          kind: "revert",
          to: "L2",
          at: addDays(realNow, -40),
          reason: "Nutzenrechnung hält der Prüfung nicht stand.",
        },
        {
          kind: "advance",
          to: "L3.1",
          requestedAt: addDays(realNow, -30),
          decidedAt: addDays(realNow, -24),
        },
      );
    } else if (target === "L3.1" && i % 4 === 2) {
      // Budget ist da, die Investitionsentscheidung läuft.
      extras.push({ kind: "open", to: "L3.2", requestedAt: addDays(realNow, -5 - (i % 6)) });
    }

    const history = buildGateHistory({
      tenantId,
      epicId: epicIds[i]!,
      makeId: (sfx) => uid(`large:gate:${i}:${sfx}`),
      requestedBy: ownerId ?? U.owner,
      createdBy: ADMIN,
      ownerId,
      valueStreamId: vsIds[vs]!,
      valueStreamVmoId: U.vmo,
      valueStreamFinanceApproverId: U.fo,
      rules: gateRules,
      // MGMT und IRT-Owner haben keine Wertstrom-Spalte; jeder dritte Antrag
      // geht ohne Business Owner raus, damit Guardrail 4 keine triviale
      // 100-%-Abdeckung zeigt.
      parties: {
        mgmt: U.portfolio,
        businessOwner: i % 3 === 2 ? null : U.vso,
        irtOwner: U.rte,
      },
      benefitHypothesis,
      businessCase,
      timeline: {
        estimates: {
          implementation_started: plannedStart.toISOString().slice(0, 10),
          implementation: plannedEnd.toISOString().slice(0, 10),
        },
        actuals: {},
      },
      childFeatureStats: { total: 2, started: 2, completed: 2 },
      budgetAllocationSum: ["L3", "L4", "L5"].includes(gate) ? 120_000 : 0,
      moves: [...straightPath(target, stepDayFor), ...extras],
    });
    assertGateHistory(history, `#${i} ${title}`);
    gateTransitionRows.push(...history.transitions);
    gateApprovalRows.push(...history.approvals);

    // Umsetzungsstart (L4.1): derselbe Wert für Spalte und KPI-Messbeginn.
    const implStartedAt = history.stamps.implementationStartedAt ?? null;
    epicImplStart[i] = implStartedAt;
    epicImplDone[i] = history.stamps.implementationCompletedAt ?? null;

    epicRows.push({
      id: epicIds[i]!,
      tenantId,
      level: 0,
      path: epicIds[i]!,
      title,
      description: `Restrukturierungs-Initiative zur Kostensenkung im Workstream ${vsNames[vs]}.`,
      ownerId,
      assigneeIds: i % 2 === 0 && owned ? [U.owner] : [],
      valueStreamId: vsIds[vs]!,
      artId: artIds[vs * 2 + (i % 2)]!,
      // Alle Reifegrad-Spalten stammen aus der Faltung — `stageGate`, die
      // Freigabe-Stempel, die Baselines und das Timeline-Ist-Datum.
      ...history.stamps,
      status,
      epicType,
      primarySolutionId: solId(vs, horizon),
      // Wie im Demo-Mandanten: der Merker aus der Faltung wird ueberschrieben,
      // weil das Steering ihn im Betrieb abhakt. Uebrig bleiben die offenen.
      needsSteeringAttention: i % 13 === 0,
      // L2-Kandidaten stehen auf dem Ballot (warten auf Budget); Bezahlte nicht mehr.
      stagedForBudgeting: definedNoBudget,
      // „I need help" nur dort, wo es weh tut: definiert, aber noch nicht in
      // der Umsetzung.
      ...(owned && gteL2 && !["L4", "L5"].includes(gate) && i % 15 === 0
        ? { helpRequestedAt: addDays(now, -3 - (i % 5)), helpRequestedBy: ownerId ?? U.owner }
        : {}),
      costToMvp: gteL2 ? 40_000 + (i % 30) * 2_000 : null,
      plannedStartAt: plannedStart,
      plannedEndAt: plannedEnd,
      // L0 = Funnel-Eintritt, abgeleitet aus `createdAt`. Muss VOR dem
      // fruehesten Antrag liegen (L1 bei -55), sonst stuende die Anlage der
      // Zeile hinter den Gates, die sie beschreibt — der Reifegrad-Tab zeigte
      // dann ein L0-Datum hinter L5.
      createdAt: beforeNow(addDays(plannedStart, -90), 12),
      ...(gate === "L5" ? { completedAt: history.stamps.impactRecognizedAt ?? plannedEnd } : {}),
      ...(benefitHypothesis ? { benefitHypothesis } : {}),
      ...(businessCase ? { businessCase } : {}),
      createdBy: ADMIN,
      updatedBy: ADMIN,
    });
  }
  await createManyChunked(epicRows, (data) => prisma.initiative.createMany({ data }));

  await prisma.epicSolution.createMany({
    data: epicIds.map((epicId, i) => ({
      tenantId,
      epicId,
      solutionId: solId(epicVs[i]!, HORIZONS[i % HORIZONS.length]!),
      createdBy: ADMIN,
    })),
  });

  // Szenario-Invariante: JEDES Epic hängt an einer Solution (primär + Join-Satz).
  const epicsWithoutSolution = await prisma.initiative.count({
    where: { tenantId, level: 0, primarySolutionId: null },
  });
  const solutionLinks = await prisma.epicSolution.count({ where: { tenantId } });
  if (epicsWithoutSolution > 0 || solutionLinks < EPIC_COUNT) {
    throw new Error(
      `Seed-Invariante verletzt: ${epicsWithoutSolution} Epics ohne primarySolutionId, ` +
        `${solutionLinks}/${EPIC_COUNT} EpicSolution-Verknüpfungen.`,
    );
  }

  // KPIs: Primär = Kosteneinsparung (€/Jahr, nach Reifegrad realisiert); Sekundär = operativ.
  const OPS = [
    { name: "SG&A-Quote", unit: "%", base: 14, tgt: 9 },
    { name: "Frachtkosten je Sendung", unit: "€", base: 42, tgt: 30 },
    { name: "Ausschussquote", unit: "%", base: 6, tgt: 2 },
  ];
  const epicSavingsKpi: { id: string; target: number }[] = [];
  const kpiRows: Prisma.KpiCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    const vs = epicVs[i]!;
    const savingsTarget = SAVINGS_BASE[vs]! + (i % 40) * 12_000;
    const savId = uid(`large:kpi:${i}:save`);
    // Erfassung beginnt erst mit der Umsetzung (L4.1): die Baseline wird am
    // Umsetzungsstart gemessen (erster Punkt = baseline @ L4.1-Datum). Epics
    // vor L4 tragen noch KEINE Messwerte — baseline/target bleiben Planannahme.
    const implStart = epicImplStart[i] ?? null;
    kpiRows.push({
      id: savId,
      tenantId,
      initiativeId: epicIds[i]!,
      name: "Kosteneinsparung",
      unit: "€",
      baseline: 0,
      target: savingsTarget,
      measurements: implStart
        ? simulateSeries(0, savingsTarget, {
            from: implStart,
            fraction: savingsFraction[gate]!,
            seed: i * 5,
            ...(epicImplDone[i] ? { until: epicImplDone[i]! } : {}),
          })
        : [],
      valuePerUnit: 1,
      benefitKind: "recurring",
      recurringInterval: "yearly",
      calculationNote: "Nachhaltige jährliche Kosteneinsparung aus dieser Initiative.",
      createdBy: ADMIN,
      updatedBy: ADMIN,
    });
    epicSavingsKpi[i] = { id: savId, target: savingsTarget };

    if (i % 2 === 0) {
      const ops = OPS[vs]!;
      kpiRows.push({
        id: uid(`large:kpi:${i}:ops`),
        tenantId,
        initiativeId: epicIds[i]!,
        name: ops.name,
        unit: ops.unit,
        baseline: ops.base,
        target: ops.tgt,
        measurements: implStart
          ? simulateSeries(ops.base, ops.tgt, {
              from: implStart,
              fraction: 0.55,
              seed: i * 9 + 1,
              ...(epicImplDone[i] ? { until: epicImplDone[i]! } : {}),
            })
          : [],
        valuePerUnit: 1_000,
        benefitKind: "one_time",
        recurringInterval: "monthly",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  }
  await createManyChunked(kpiRows, (data) => prisma.kpi.createMany({ data }));

  // Features im Umsetzungsmodul — nur für laufende/fertige Epics (L4/L5).
  const FEATURE_PARTS = [
    "Analyse & Baseline",
    "Prozessdesign",
    "System-/Tool-Anbindung",
    "Pilot",
    "Rollout",
    "Nachhaltigkeit & Controlling",
  ];
  const featureRows: Prisma.InitiativeCreateManyInput[] = [];
  let gf = 0;
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    if (gate !== "L4" && gate !== "L5") continue;
    const done = gate === "L5";
    const count = 2 + (i % 3);
    const eStart = cycleStart(ALL_CYCLES[epicCycleIdx[i]!]!);
    for (let f = 0; f < count; f++) {
      const fid = uid(`large:feat:${i}:${f}`);
      const bv = 3 + ((i + f) % 8);
      const tc = 2 + ((i * 2 + f) % 7);
      const rr = 1 + ((i + f * 2) % 6);
      const js = 2 + ((i + f) % 9);
      const wsjf = Number((((bv + tc + rr) / js) as number).toFixed(2));
      const status = done
        ? "completed"
        : (["in_progress", "blocked", "in_progress", "completed"] as const)[gf % 4]!;
      const artId = artIds[gf % artIds.length]!;
      const piId = done
        ? gf % 2 === 0
          ? oldPi
          : prevPi
        : status === "completed"
          ? prevPi
          : gf % 5 === 0
            ? planPi
            : activePi;
      const fStart = addDays(eStart, 20 + f * 20);
      featureRows.push({
        id: fid,
        tenantId,
        level: 1,
        parentId: epicIds[i]!,
        path: `${epicIds[i]!}/${fid}`,
        title: `${epicTitles[i]!} — ${FEATURE_PARTS[f % FEATURE_PARTS.length]}`,
        description: `Baustein „${FEATURE_PARTS[f % FEATURE_PARTS.length]}".`,
        ownerId: gf % 2 === 0 ? U.owner : U.fo,
        assigneeIds: [U.owner],
        artId,
        piId,
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: wsjf,
        featureType: EPIC_TYPES[i % EPIC_TYPES.length] === "enabler" ? "enabler" : "feature",
        stageGate: "L3",
        status,
        completedAt: status === "completed" ? beforeNow(addDays(fStart, 60), 2) : null,
        plannedStartAt: fStart,
        plannedEndAt: addDays(fStart, 60),
        acceptanceCriteria: [
          "Einsparung nachgewiesen und im Controlling verankert",
          "Prozess dokumentiert und übergeben",
        ],
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
      gf++;
    }
  }
  await createManyChunked(featureRows, (data) => prisma.initiative.createMany({ data }));
  console.log(
    `  ✓ ${epicIds.length} Epics + ${featureRows.length} Features + ${kpiRows.length} KPIs`,
  );

  // ── Phase 6: Issues (vom Epic-Owner beim LBC aufgenommen; Epics L2–L5) ─────
  console.log("\n── Issues");
  const LEVELS = ["very_low", "low", "medium", "high", "very_high"];
  const CAT = ["technical", "business", "schedule", "external"];
  const ROAM = ["open", "owned", "mitigated", "accepted", "resolved"];
  const ISSUE_TOPICS = [
    "Umsetzungsaufwand höher als geschätzt",
    "Abhängigkeit von Altsystem",
    "Change-/Mitbestimmung offen",
    "Datenqualität unklar",
    "Lieferanten-/Vertragsrisiko",
    "Ressourcen-Engpass im Team",
    "Regulatorische Freigabe ausstehend",
    "Einsparung schwer nachweisbar",
  ];
  const issueRows: Prisma.IssueCreateManyInput[] = [];
  const mitigationRows: Prisma.IssueMitigationCreateManyInput[] = [];
  const assessmentRows: Prisma.IssueAssessmentCreateManyInput[] = [];
  let issueNo = 0;
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    if (!["L2", "L3", "L4", "L5"].includes(gate)) continue;
    const nIssues = 1 + (i % 3 === 0 ? 1 : 0); // 1–2 Issues je definiertem Epic
    const raisedBy = epicOwner[i] ?? U.rte;
    for (let n = 0; n < nIssues; n++) {
      issueNo += 1;
      const issueId = uid(`large:issue:${i}:${n}`);
      const roam = ROAM[(i + n) % ROAM.length]!;
      issueRows.push({
        id: issueId,
        tenantId,
        issueNumber: issueNo,
        title: `${ISSUE_TOPICS[(i + n) % ISSUE_TOPICS.length]!} — ${epicTitles[i]!}`,
        description: `Im LBC-Workshop aufgenommenes Issue zu „${epicTitles[i]!}".`,
        probability: LEVELS[(i + n) % LEVELS.length]!,
        impact: LEVELS[(i * 2 + n) % LEVELS.length]!,
        category: CAT[(i + n) % CAT.length]!,
        reviewStatus: "documented",
        roamStatus: roam,
        ...(roam !== "open"
          ? { roamRationale: "ROAM-Entscheidung im Risk-Review festgehalten." }
          : {}),
        ownerId: epicOwner[i] ?? U.rte,
        raisedBy,
        targetResolutionDate: addDays(now, 30 + (i % 6) * 15),
        initiativeId: epicIds[i]!,
        ...(i % 5 === 0 ? { artId: artIds[epicVs[i]! * 2 + (i % 2)]! } : {}),
      });
      if (i % 4 === 0) {
        mitigationRows.push({
          id: uid(`large:imit:${i}:${n}`),
          tenantId,
          issueId,
          description: "Gegenmaßnahme definiert und dem Owner zugewiesen.",
          createdBy: raisedBy,
        });
      }
      if (i % 6 === 0) {
        assessmentRows.push({
          id: uid(`large:iass:${i}:${n}`),
          tenantId,
          issueId,
          probability: LEVELS[(i + n + 1) % LEVELS.length]!,
          impact: LEVELS[(i + n) % LEVELS.length]!,
          note: "Neubewertung nach Gegenmaßnahmen.",
          createdBy: raisedBy,
        });
      }
    }
  }
  await createManyChunked(issueRows, (data) => prisma.issue.createMany({ data }));
  if (mitigationRows.length) await prisma.issueMitigation.createMany({ data: mitigationRows });
  if (assessmentRows.length) await prisma.issueAssessment.createMany({ data: assessmentRows });
  await prisma.issueSettings.create({
    data: { id: uid("large:issuesettings"), tenantId, prefix: "R-", lastNumber: issueNo },
  });
  console.log(`  ✓ ${issueRows.length} Issues an Epics (L2–L5)`);

  // ── Phase 7: Budget (nur bezahlte Epics L3–L5, Σ ≤ ~€1 Mio./Zyklus) ───────
  console.log("\n── Budget (Allocations + Historie + Kacheln)");
  const fundedIdx = Array.from({ length: EPIC_COUNT }, (_, i) => i).filter((i) =>
    ["L3", "L4", "L5"].includes(gates[i]!),
  );
  const l2Idx = Array.from({ length: EPIC_COUNT }, (_, i) => i).filter((i) => gates[i] === "L2");
  // Allocation je bezahltem Epic in SEINEM Förderzyklus (Vergangenheit/jetzt).
  await createManyChunked(
    fundedIdx.map((i, k) => {
      const cyc = ALL_CYCLES[epicCycleIdx[i]!]!;
      const cost = 80_000 + (i % 6) * 8_000; // ~80–120k → ~€1 Mio./Zyklus bei ~10 Epics
      return {
        id: uid(`large:balloc:${i}`),
        tenantId,
        epicId: epicIds[i]!,
        priority: k,
        hypothesisBudget: null,
        allocations: { [cyc]: cost },
        createdBy: ADMIN,
        updatedBy: ADMIN,
      };
    }),
    (data) => prisma.budgetAllocation.createMany({ data }),
  );
  // Snapshot-Historie je vergangenem Zyklus (der früheste ≈ Controller-Entwurf Jahr 1).
  for (let c = 0; c <= CURRENT_IDX; c++) {
    const cycleKey = ALL_CYCLES[c]!;
    const capturedAt = beforeNow(addDays(cycleStart(cycleKey), 20), 1);
    const cycleFunded = fundedIdx.filter((i) => epicCycleIdx[i] === c).slice(0, 10);
    await prisma.budgetPlanRevision.create({
      data: {
        id: uid(`large:bprev:${cycleKey}`),
        tenantId,
        cycleKey,
        capturedAt,
        capturedBy: ADMIN,
        payload: buildSnapshotPayload({
          cycleKey,
          capturedAt,
          pool: budgetPoolByPeriod[cycleKey] ?? CYCLE_POOL,
          epics: (cycleFunded.length ? cycleFunded : fundedIdx.slice(0, 8)).map((i, k) => ({
            epicId: epicIds[i]!,
            title: epicTitles[i]!,
            valueStreamId: vsIds[epicVs[i]!]!,
            valueStreamName: vsNames[epicVs[i]!]!,
            priority: k,
            alloc: 80_000 + k * 6_000,
          })),
          arts: artIds.map((id, i) => ({ id, name: artNames[i]!, amount: 130_000 + i * 12_000 })),
        }),
      },
    });
  }

  // PB-Kacheln: closed (Vergangenheit) · running = Jahr 5 H1 · draft (Zukunft).
  const parts = [U.portfolio, U.vmo, U.rte, U.owner, U.vso, U.fo, U.viewer];
  const rtb = await seedRunTheBusiness(
    tenantId,
    ADMIN,
    // Zwei wertstrom-übergreifende Positionen (ohne Solution) plus der Betrieb
    // des H1-Kerns — beide Ausprägungen kommen im Mandanten vor.
    vsIds.map((vsId, k) => ({
      valueStreamId: vsId,
      items: [
        {
          name: "Programm-Office & Controlling",
          plannedAmount: 40_000 + k * 8_000,
          interval: "half_yearly",
        },
        { name: "Externe Beratung", plannedAmount: 60_000 + k * 10_000, interval: "yearly" },
        {
          name: "Betrieb & Support",
          plannedAmount: 200_000 + k * 40_000,
          interval: "yearly",
          solutionId: solId(k, "h1"),
        },
        // Je ART ein Veränderungsrahmen — beide ARTs des Wertstroms, damit die
        // Flächen unter Last mit Daten laufen und nicht nur mit Sonderfällen.
        {
          name: `Veränderungsrahmen ${artNames[k * 2]}`,
          plannedAmount: 180_000 + k * 30_000,
          interval: "half_yearly",
          artId: artIds[k * 2]!,
          kind: "art_change",
        },
        {
          name: `Veränderungsrahmen ${artNames[k * 2 + 1]}`,
          plannedAmount: 140_000 + k * 20_000,
          interval: "half_yearly",
          artId: artIds[k * 2 + 1]!,
          kind: "art_change",
        },
      ],
    })),
  );
  const rtbCands = rtb.map((r) => ({
    rtbItemId: r.id,
    title: r.name,
    ask: rtbCycleAmount(r.plannedAmount, r.interval),
    valueStreamId: r.valueStreamId,
  }));
  // Kandidaten der laufenden/geplanten Runden = die L2-Epics (definiert, warten auf Budget).
  const backlogCands = l2Idx.slice(0, 22).map((i) => ({
    epicId: epicIds[i]!,
    title: epicTitles[i]!,
    ask: 60_000 + (i % 12) * 6_000,
    valueStreamId: vsIds[epicVs[i]!]!,
    artId: artIds[epicVs[i]! * 2 + (i % 2)]!,
  }));
  // Kandidaten der geschlossenen Runden = damals bezahlte Epics.
  const fundedCands = fundedIdx.slice(0, 20).map((i) => ({
    epicId: epicIds[i]!,
    title: epicTitles[i]!,
    ask: 80_000 + (i % 6) * 8_000,
    valueStreamId: vsIds[epicVs[i]!]!,
    artId: artIds[epicVs[i]! * 2 + (i % 2)]!,
  }));
  const buildGroups = (
    submitted: boolean[],
    amountsBy: ((gi: number) => Record<string, number>) | null,
  ): GroupSpec[] => [
    {
      name: "Verwaltung & Overhead",
      spokespersonUserId: U.portfolio,
      submitted: submitted[0]!,
      memberUserIds: [U.portfolio, U.owner, U.rte],
      amounts: amountsBy ? amountsBy(0) : {},
    },
    {
      name: "Logistik",
      spokespersonUserId: U.vso,
      submitted: submitted[1]!,
      memberUserIds: [U.vso, U.fo, U.viewer],
      amounts: amountsBy ? amountsBy(1) : {},
    },
    {
      name: "Produktion",
      spokespersonUserId: U.vmo,
      submitted: submitted[2]!,
      memberUserIds: [U.vmo, U.owner, U.fo],
      amounts: amountsBy ? amountsBy(2) : {},
    },
  ];
  const amountsFor = (cands: { epicId: string; ask: number }[]) => (gi: number) => {
    const out: Record<string, number> = {};
    cands.forEach((c, j) => {
      if (j % 3 !== gi % 3) out[c.epicId] = c.ask;
    });
    rtbCands.forEach((c, j) => {
      if (j % 3 !== gi % 3) out[c.rtbItemId] = c.ask;
    });
    return out;
  };
  const finalsFor = (
    cands: { epicId?: string; rtbItemId?: string; ask: number }[],
    pool: number,
  ) => {
    let acc = 0;
    const m = new Map<string, number>();
    for (const c of cands) {
      const ref = c.epicId ?? c.rtbItemId!;
      const fund = acc + c.ask <= pool;
      m.set(ref, fund ? c.ask : 0);
      if (fund) acc += c.ask;
    }
    return m;
  };

  // 3 geschlossene Runden (vergangene Zyklen).
  const closedCycles = [CURRENT_IDX - 4, CURRENT_IDX - 3, CURRENT_IDX - 1].filter((x) => x >= 0);
  for (let n = 0; n < closedCycles.length; n++) {
    const cycleKey = ALL_CYCLES[closedCycles[n]!]!;
    const pool = budgetPoolByPeriod[cycleKey]!;
    // Der Betrieb wird zuerst bezahlt, dann konkurriert das Wachstum um den
    // Rest. Andersherum erschöpften die 20 Epic-Anträge (~2 Mio €) den Topf
    // von 1 Mio €, bevor die erste Run-the-Business-Position an der Reihe
    // wäre — jede Position stünde in jeder Kachel mit 0 € da, und kein ART
    // hätte je einen finanzierten Veränderungsrahmen.
    const finals = finalsFor([...rtbCands, ...fundedCands], pool);
    const acc = [...finals.values()].reduce((a, b) => a + b, 0);
    await seedBudgetPeriod(tenantId, ADMIN, {
      key: `large-closed-${n}`,
      cycleKey,
      status: "closed",
      poolTotal: pool,
      startDate: cycleStart(cycleKey),
      endDate: cycleEnd(cycleKey),
      submissionDeadline: addDays(cycleStart(cycleKey), 40),
      reserveAmount: pool - acc,
      participantUserIds: parts,
      epicCandidates: fundedCands.map((c) => ({ ...c, finalAmount: finals.get(c.epicId) ?? 0 })),
      rtbCandidates: rtbCands.map((c) => ({ ...c, finalAmount: finals.get(c.rtbItemId) ?? 0 })),
      groups: buildGroups([true, true, true], amountsFor(fundedCands)),
    });
  }
  // Betriebs- und Rahmenrunde des laufenden Halbjahres — abgeschlossen, während
  // die Wachstumsrunde desselben Zyklus noch läuft. Das ist die Reihenfolge der
  // Praxis: der Betrieb steht fest, bevor um neue Vorhaben gerungen wird.
  //
  // Sie ist zugleich die Voraussetzung dafür, dass ein ART **jetzt** verteilen
  // kann: der Veränderungsrahmen eines Halbjahres ist die Summe der finalen
  // `art_change`-Beträge aus den Kacheln genau dieses Zyklus. Ohne eine
  // geschlossene Kachel im laufenden Halbjahr wäre jeder Topf 0 €, obwohl das
  // Verteilfenster offen steht.
  const rtbPool = rtbCands.reduce((sum, c) => sum + c.ask, 0);
  await seedBudgetPeriod(tenantId, ADMIN, {
    key: "large-rtb-current",
    cycleKey: CURRENT_CYCLE,
    status: "closed",
    poolTotal: rtbPool,
    startDate: addDays(cycleStart(CURRENT_CYCLE), -60),
    endDate: cycleStart(CURRENT_CYCLE),
    submissionDeadline: addDays(cycleStart(CURRENT_CYCLE), -40),
    reserveAmount: 0,
    participantUserIds: parts,
    epicCandidates: [],
    rtbCandidates: rtbCands.map((c) => ({ ...c, finalAmount: c.ask })),
    groups: buildGroups([true, true, true], amountsFor([])),
  });

  // Laufende Runde = Jahr 5 H1 — die L2-Epics konkurrieren um die €1 Mio.
  await seedBudgetPeriod(tenantId, ADMIN, {
    key: "large-running",
    cycleKey: CURRENT_CYCLE,
    status: "running",
    poolTotal: budgetPoolByPeriod[CURRENT_CYCLE]!,
    startDate: cycleStart(CURRENT_CYCLE),
    endDate: cycleEnd(CURRENT_CYCLE),
    submissionDeadline: addDays(now, 40),
    participantUserIds: parts,
    epicCandidates: backlogCands,
    rtbCandidates: rtbCands,
    groups: buildGroups([true, false, false], amountsFor(backlogCands)),
  });
  // 2 Entwurfsrunden (nahe Zukunft) — ebenfalls die wartenden L2-Epics.
  for (let n = 1; n <= 2; n++) {
    const cycleKey = ALL_CYCLES[Math.min(CURRENT_IDX + n, MAX_IDX)]!;
    await seedBudgetPeriod(tenantId, ADMIN, {
      key: `large-draft-${n}`,
      cycleKey,
      status: "draft",
      poolTotal: budgetPoolByPeriod[cycleKey]!,
      startDate: cycleStart(cycleKey),
      endDate: cycleEnd(cycleKey),
      submissionDeadline: addDays(cycleStart(cycleKey), 40),
      participantUserIds: parts,
      epicCandidates: backlogCands,
      rtbCandidates: rtbCands,
      groups: buildGroups([false, false, false], null),
    });
  }

  // ── Phase 8: Ziele — Top-Ziel + je Wertstrom aufgebrochen ─────────────────
  console.log("\n── Ziele (Top-Ziel + Wertstrom-Breakdown)");
  const themeAdmin = uid("large:theme:admin");
  const themeLog = uid("large:theme:log");
  const themeProd = uid("large:theme:prod");
  await prisma.strategicTheme.createMany({
    data: [
      {
        id: themeAdmin,
        tenantId,
        title: "Verwaltung & Overhead",
        narrative: "SG&A/Overhead senken: Automatisierung, Shared Services, IT & Einkauf.",
        kind: "business",
        color: "#6366f1",
        budgetPlanned: 500_000,
        ownerId: U.portfolio,
        sortOrder: 0,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeLog,
        tenantId,
        title: "Logistik",
        narrative: "Fracht, Netzwerk, Bestände und Verpackung kostenoptimieren.",
        kind: "business",
        color: "#f59e0b",
        budgetPlanned: 800_000,
        ownerId: U.vso,
        sortOrder: 1,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeProd,
        tenantId,
        title: "Produktion",
        narrative: "OEE, Ausschuss, Energie und Materialkosten senken.",
        kind: "enabler",
        color: "#10b981",
        budgetPlanned: 1_200_000,
        ownerId: U.vmo,
        sortOrder: 2,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });
  const vsTheme = [themeAdmin, themeLog, themeProd];

  const roots: Prisma.ObjectiveCreateManyInput[] = [];
  const children: Prisma.ObjectiveCreateManyInput[] = [];
  const objBase = (
    id: string,
    themeId: string,
    title: string,
    extra: Partial<Prisma.ObjectiveCreateManyInput>,
  ): Prisma.ObjectiveCreateManyInput => ({
    id,
    tenantId,
    themeId,
    title,
    path: id,
    createdBy: ADMIN,
    updatedBy: ADMIN,
    ...extra,
  });

  // Top-Ziel (Unternehmensführung) → je Wertstrom aufgebrochen (kpi_tree, aus Epics).
  // Ziel-getriebener Prozess: das Ziel steht zuerst, Epics füllen es — ALLE
  // Epics (auch L0/L1) zählen in die Pipeline; das Ziel liegt mit 15 % Stretch
  // darüber, damit der Benefit-Wasserfall eine sichtbare Deckungslücke behält.
  const GOAL_STRETCH = 1.15;
  const gVs = [uid("large:goal:vs0"), uid("large:goal:vs1"), uid("large:goal:vs2")];
  const vsTarget = [0, 0, 0];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const k = epicSavingsKpi[i];
    if (!k) continue;
    vsTarget[epicVs[i]!]! += k.target;
  }
  for (let v = 0; v < vsTarget.length; v++) vsTarget[v] = Math.round(vsTarget[v]! * GOAL_STRETCH);
  const gCost = uid("large:goal:cost-total");
  roots.push(
    objBase(gCost, themeProd, "Gesamt-Kostenreduktion (€ p.a.)", {
      progressMode: "kpi_tree",
      metricType: "currency",
      metricUnit: "€",
      currencyCode: "EUR",
      baseline: 0,
      target: vsTarget[0]! + vsTarget[1]! + vsTarget[2]!,
      status: "on_track",
      period: PROGRAM_TARGET_YEAR,
      ownerId: U.portfolio,
    }),
  );
  const vsNodeTitles = [
    "Verwaltung: Overhead senken (€ p.a.)",
    "Logistik: Logistikkosten senken (€ p.a.)",
    "Produktion: Herstellkosten senken (€ p.a.)",
  ];
  children.push(
    ...gVs.map((id, vs) =>
      objBase(id, vsTheme[vs]!, vsNodeTitles[vs]!, {
        parentObjectiveId: gCost,
        level: 1,
        progressMode: "kpi_tree",
        metricType: "currency",
        metricUnit: "€",
        currencyCode: "EUR",
        baseline: 0,
        target: vsTarget[vs]!,
        parentUnitPerChildUnit: 1,
        status: vs === 2 ? "at_risk" : "on_track",
        ownerId: U.vmo,
      }),
    ),
  );

  // Bewusst KEINE weiteren Ziele: Der Ziele-Baum besteht ausschließlich aus dem
  // Top-Ziel „Gesamt-Kostenreduktion" und den drei Wertstrom-Kindern (kpi_tree
  // aus den Epic-Einsparungs-KPIs) — keine operativen KRs, keine geschlossenen
  // Meilensteine, keine Check-in-Historie.
  await prisma.objective.createMany({ data: roots });
  await prisma.objective.createMany({ data: children });

  // Epics dem Baum zuordnen: die Einsparungs-KPI JEDES Epics (alle Gates,
  // auch L0/L1 — ziel-getriebener Prozess) → Wertstrom-Ziel.
  const goalLinkRows: Prisma.GoalEpicLinkCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const k = epicSavingsKpi[i];
    if (!k) continue;
    goalLinkRows.push({
      id: uid(`large:gel:${i}`),
      tenantId,
      objectiveId: gVs[epicVs[i]!]!,
      epicId: epicIds[i]!,
      kpiId: k.id,
      conversionFactor: 1,
      impactKind: "recurring",
      recurringInterval: "yearly",
      createdBy: ADMIN,
    });
  }
  await prisma.goalEpicLink.createMany({ data: goalLinkRows });

  // Szenario-Invariante: JEDES Epic hat genau einen Goal-Link.
  const goalLinkCount = await prisma.goalEpicLink.count({ where: { tenantId } });
  if (goalLinkCount !== EPIC_COUNT) {
    throw new Error(`Seed-Invariante verletzt: ${goalLinkCount}/${EPIC_COUNT} Goal-Epic-Links.`);
  }

  // ── Phase 9: Aktivität (Freigaben) + TOM ──────────────────────────────────
  console.log("\n── Freigaben + TOM");
  // Die Reifegrad-Historie aller Epics: eine Antragszeile je gegangenem Schritt
  // plus die Abnahmen, gesammelt in Phase 5. Gebuendelt geschrieben — bei 200
  // Epics sind das einige hundert Zeilen, und Einzel-Inserts wuerden den Seed
  // spuerbar bremsen. Reihenfolge: Antraege vor Abnahmen (Fremdschluessel).
  await createManyChunked(gateTransitionRows, (data) =>
    prisma.stageGateTransition.createMany({ data }),
  );
  await createManyChunked(gateApprovalRows, (data) =>
    prisma.stageGateApproval.createMany({ data }),
  );
  console.log(
    `  ✓ ${gateTransitionRows.length} Reifegrad-Anträge, ${gateApprovalRows.length} Abnahmen`,
  );
  // Invariante: jedes Epic, das L0 verlassen hat, traegt die Antragshistorie,
  // die es dorthin gebracht hat. Genau das war vorher nicht der Fall.
  {
    const moved = epicRows.filter((e) => e.stageGate !== "L0");
    const withHistory = new Set(
      gateTransitionRows.filter((t) => t.status === "approved").map((t) => t.initiativeId),
    );
    const missing = moved.filter((e) => !withHistory.has(e.id as string));
    if (missing.length > 0) {
      throw new Error(
        `Seed-Invariante verletzt: ${missing.length} Epic(s) jenseits von L0 ohne abgenommenen Reifegrad-Wechsel.`,
      );
    }
  }

  await prisma.targetOperatingModel.create({
    data: {
      id: uid("large:tom"),
      tenantId,
      status: "active",
      template: "portfolio_safe",
      targetValueStreams: 3,
      targetArtsTotal: 6,
      targetTeamsTotal: 18,
      targetPiCadenceWeeks: 10,
      targetDate: cycleStart(ALL_CYCLES[MAX_IDX]!),
      // Guardrail 3 an — der Lastdatensatz soll die neuen Flächen mit Masse
      // durchlaufen, nicht mit Sonderfällen.
      artEpics: true,
      createdBy: ADMIN,
      updatedBy: ADMIN,
    },
  });

  // ── Guardrail 3: Rahmen-Verteilung und Ziele je Wertstrom ─────────────────
  //
  // Erzeugt, nicht von Hand gesetzt: der Lastdatensatz braucht Masse in den
  // neuen Tabellen. Klassifiziert wird über den freigegebenen Business Case —
  // deshalb kommen nur Epics infrage, die L3.1 erreicht haben.
  const artEpicRows = await prisma.initiative.findMany({
    where: {
      tenantId,
      level: 0,
      deletedAt: null,
      artId: { not: null },
      businessCaseApprovedAt: { not: null },
    },
    select: { id: true, artId: true, businessCase: true },
  });

  const LIMIT = 100_000;
  const allocSpecs: ArtAllocationSpec[] = [];

  // Die Verteilliste des ARTs zeigt nur **vorgemerkte** Epics. Bei der Anlage
  // war `stagedForBudgeting` an L2 geknüpft (definiert, wartet auf Budget) —
  // ein ART-Epic braucht aber einen freigegebenen Business Case und steht damit
  // frühestens auf L3.1. Die beiden Mengen überschneiden sich nie, die Liste
  // bliebe zwangsläufig leer. Die Vormerkung meldet hier keine Portfolio-Runde
  // an, sondern die Verteilung durch den Wertstrom.
  const artEpicIds = artEpicRows
    .filter((e) => {
      const cost = computeBusinessCaseTotals(
        parseBusinessCase(e.businessCase).current,
      ).implementationCost;
      return cost > 0 && cost <= LIMIT;
    })
    .map((e) => e.id);
  await prisma.initiative.updateMany({
    where: { tenantId, id: { in: artEpicIds } },
    data: { stagedForBudgeting: true },
  });

  // Der Rahmen je ART ist der Deckel — in der Anwendung prüft ihn der
  // Schreibpfad in derselben Transaktion. Ein Seed, der daran vorbeischreibt,
  // erzeugt Töpfe, die dauerhaft überzogen dastehen: einen Zustand, den das
  // System gar nicht zulässt. Deshalb wird er hier mitgerechnet.
  const frameByArt = new Map<string, number>();
  for (const it of rtb) {
    if (it.kind !== "art_change" || it.artId == null) continue;
    frameByArt.set(
      it.artId,
      (frameByArt.get(it.artId) ?? 0) + rtbCycleAmount(it.plannedAmount, it.interval),
    );
  }
  const usedByArt = new Map<string, number>();

  for (const [n, e] of artEpicRows.entries()) {
    const cost = computeBusinessCaseTotals(
      parseBusinessCase(e.businessCase).current,
    ).implementationCost;
    if (cost > LIMIT || cost === 0 || e.artId == null) continue;
    // Nur etwa zwei Drittel bekommen überhaupt Geld — der Rest bleibt sichtbar
    // ungedeckt, sonst zeigt die Fläche überall denselben Normalfall.
    if (n % 3 === 2) continue;

    const amount = Math.round(cost);
    const used = usedByArt.get(e.artId) ?? 0;
    if (used + amount > (frameByArt.get(e.artId) ?? 0)) continue; // passt nicht mehr

    usedByArt.set(e.artId, used + amount);
    allocSpecs.push({
      artId: e.artId,
      epicId: e.id,
      cycleKey: CURRENT_CYCLE,
      amount,
      ask: amount,
    });
  }
  await seedArtEpicAllocations(tenantId, ADMIN, allocSpecs);
  console.log(`  ✓ ${allocSpecs.length} ART-Zuteilungen (${CURRENT_CYCLE})`);

  await seedValueStreamGuardrails(
    tenantId,
    ADMIN,
    vsIds.map((vsId, k) => ({
      valueStreamId: vsId,
      targets: {
        capacity: { business: 70 + k * 5, enabler: 30 - k * 5 },
        approval: { portfolioThreshold: 100_000 + k * 25_000 },
      },
    })),
  );
  console.log(`  ✓ Guardrail-Ziele für ${vsIds.length} Wertströme`);

  console.log("\n✅ Large-Seed fertig (budget-getriebenes 10-Jahres-Programm, Jahr 5 H1).\n");
}

// ── Kleine Helfer ───────────────────────────────────────────────────────────

async function createManyChunked<T>(
  rows: T[],
  run: (data: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size));
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function simulateSeries(
  baseline: number,
  target: number,
  opts: {
    monthsBack?: number;
    fraction: number;
    seed: number;
    endExact?: number;
    /**
     * Anker der Erfassung (Umsetzungsstart L4.1): Punkte im 30-Tage-Raster ab
     * `from` bis maximal `now`; der erste Punkt ist die Baseline-Erfassung am
     * Ankerdatum. Ohne `from`: Bestandsverhalten (rückwärts von `now`,
     * `monthsBack` Punkte).
     */
    from?: Date;
    /**
     * Ende der Rampe statt `now`. Für Epics mit abgenommener Umsetzung ist das
     * das L4.2-Datum: dort friert die gelieferte Menge ein, also muss die Reihe
     * bis dahin ihren Endwert erreicht haben. Ohne diesen Anker rampte sie bis
     * heute weiter, und das Einfrieren träfe sie mitten im Anstieg — ein
     * fertiges Epic sähe dann aus, als habe es kaum etwas geliefert.
     */
    until?: Date;
  },
): { date: string; value: number }[] {
  const end = opts.until ?? now;
  const months = opts.from
    ? Math.max(0, Math.floor((end.getTime() - opts.from.getTime()) / (30 * DAY)))
    : (opts.monthsBack ?? 9);
  const dir = target >= baseline ? 1 : -1;
  const span = Math.abs(target - baseline);
  const finalDelta = span * opts.fraction;
  const decimals = span < 20 ? 1 : 0;
  const round = (v: number): number => Number(v.toFixed(decimals));
  // Frisch gestartet (< 1 Monat Umsetzung): nur die Baseline-Erfassung selbst.
  if (opts.from && months === 0) return [{ date: isoDate(opts.from), value: round(baseline) }];
  const dateAt = (i: number): Date =>
    opts.from ? addDays(opts.from, 30 * i) : addDays(end, -30 * (months - i));
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i <= months; i++) {
    const t = months === 0 ? 1 : i / months;
    const eased = t * t * (3 - 2 * t);
    const jitter = i === 0 || i === months ? 0 : Math.sin(opts.seed + i * 1.7) * finalDelta * 0.06;
    const magnitude = Math.min(finalDelta, Math.max(0, eased * finalDelta + jitter));
    const value =
      i === months && opts.endExact != null ? opts.endExact : baseline + dir * magnitude;
    out.push({ date: isoDate(dateAt(i)), value: round(value) });
  }
  return out;
}

function buildSnapshotPayload(input: {
  cycleKey: string;
  capturedAt: Date;
  pool: number;
  epics: {
    epicId: string;
    title: string;
    valueStreamId: string;
    valueStreamName: string;
    priority: number;
    alloc: number;
  }[];
  arts: { id: string; name: string; amount: number }[];
}): Prisma.InputJsonValue {
  const snapshot = buildBudgetPlanSnapshot({
    cycleKey: input.cycleKey,
    capturedAt: input.capturedAt,
    pool: { [input.cycleKey]: input.pool },
    epics: input.epics.map((e) => ({
      id: e.epicId,
      title: e.title,
      valueStreamId: e.valueStreamId,
      valueStream: e.valueStreamName,
      isHypothesisOnly: false,
      costSlices: [e.alloc],
      hypothesisBudget: 0,
      startKey: input.cycleKey,
      allocations: { [input.cycleKey]: e.alloc },
      priority: e.priority,
    })),
    artRows: input.arts.map((a) => ({
      artId: a.id,
      name: a.name,
      budgetByPeriod: { [input.cycleKey]: a.amount },
    })),
    features: [],
  });
  return { version: 1, snapshot } as unknown as Prisma.InputJsonValue;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
