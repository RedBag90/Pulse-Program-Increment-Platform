/* eslint-disable no-console */
/**
 * Pulse Demo-Seed — großer, dichter, story-getriebener Datensatz für den Demo-
 * Tenant „Pulse Demo Corp" (eine europäische Digitalbank mitten in der SAFe-
 * Transformation). Macht JEDE Funktion durchklickbar: Portfolio, Programm,
 * Controlling, Reporting, Roadmap, Ziele (alle 4 Fortschrittsquellen), Issues
 * (5×5-Matrix + ROAM + Baum), Admin/my-approvals/my-tasks.
 *
 * Wischt die Domain-Daten von „Pulse Demo Corp" und baut alles frisch auf.
 * Ids sind deterministisch (`uid(key)`), Datumswerte relativ zu heute
 * (`addDays(now, n)`), Streuung deterministisch (`Math.sin`). Reset-then-insert:
 * `wipeDomainData(tenantId)` läuft zuerst, ein Rerun reproduziert dieselben Rows.
 *
 * Run: `pnpm db:seed:demo`  (lädt `.env.local` selbst; braucht DIRECT_URL)
 */

import type { Prisma } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { buildBudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";
import {
  prisma,
  ensureTenant,
  upsertAuthUser,
  assignRole,
  wipeDomainData,
  uid,
} from "./seed-helpers.js";

// ── Zeit-Helfer (relativ zu heute) ──────────────────────────────────────────
const DAY = 86_400_000;
const now = new Date();
const YEAR = now.getFullYear();
const addDays = (base: Date, d: number): Date => new Date(base.getTime() + d * DAY);
const H1 = `${YEAR}-H1`;
const H2 = `${YEAR}-H2`;
const PREV_H2 = `${YEAR - 1}-H2`; // ältere, abgelöste Budget-Revision (Historie)

async function main() {
  console.log("\n🌱  Pulse DEMO-Seed startet (dichter Story-Datensatz)\n");

  // ── Phase 1: Auth-User ────────────────────────────────────────────────────
  console.log("── Auth-User");
  const U = {
    admin: await upsertAuthUser("admin@pulse.dev", "Admin1234!"),
    portfolio: await upsertAuthUser("portfolio@pulse.dev", "Test1234!"),
    vmo: await upsertAuthUser("vmo@pulse.dev", "Test1234!"),
    rte: await upsertAuthUser("rte@pulse.dev", "Test1234!"),
    owner: await upsertAuthUser("owner@pulse.dev", "Test1234!"),
    viewer: await upsertAuthUser("viewer@pulse.dev", "Test1234!"),
    transformation: await upsertAuthUser("transformation@pulse.dev", "Test1234!"),
    vso: await upsertAuthUser("vso@pulse.dev", "Test1234!"),
    fo: await upsertAuthUser("fo@pulse.dev", "Test1234!"),
  };
  const ADMIN = U.admin;

  // ── Phase 1: Tenant + Ökonomie ────────────────────────────────────────────
  console.log("\n── Tenant");
  const tenantId = await ensureTenant();
  await wipeDomainData(tenantId);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      enabledModules: [], // Org ⇒ alle Module
      costNeutralTarget: 250_000,
      dashboardHorizonEnd: addDays(now, 540),
      budgetPoolByPeriod: { [H1]: 2_000_000, [H2]: 2_400_000 },
      costPerJobSizePoint: 1_800,
      guardrailTargets: { horizon: { H1: 0.5, H2: 0.3, H3: 0.2 }, enablerRatio: 0.2 },
    },
  });

  // ── Phase 2: RBAC-Scopes + RoleCapability ─────────────────────────────────
  console.log("\n── Rollen + Capabilities");
  const vsIds = [uid("vs:digital-banking"), uid("vs:payments"), uid("vs:cx")];
  const artIds = [
    uid("art:accounts-onboarding"),
    uid("art:lending-credit"),
    uid("art:realtime-payments"),
    uid("art:cards-wallets"),
    uid("art:web-mobile"),
    uid("art:service-contact"),
  ];

  await assignRole(U.admin, tenantId, "tenant_admin");
  await assignRole(U.portfolio, tenantId, "portfolio_manager");
  await assignRole(U.vmo, tenantId, "portfolio_manager");
  await assignRole(U.transformation, tenantId, "portfolio_manager");
  await assignRole(U.rte, tenantId, "rte", { artIds: [artIds[0]!, artIds[1]!] });
  await assignRole(U.owner, tenantId, "epic_owner");
  await assignRole(U.owner, tenantId, "feature_owner");
  await assignRole(U.viewer, tenantId, "viewer");
  await assignRole(U.vso, tenantId, "value_stream_owner", { valueStreamIds: [vsIds[0]!] });
  await assignRole(U.fo, tenantId, "feature_owner");

  const caps = enumerateDefaultCapabilities();
  await prisma.roleCapability.createMany({
    data: caps.map((c) => ({
      tenantId,
      role: c.role,
      action: c.action,
      scope: c.scope,
      createdBy: ADMIN,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ ${caps.length} Default-Capabilities gespiegelt`);

  // ── Phase 3: Struktur-Spine (VS → ART, Timeline, PIs) ─────────────────────
  console.log("\n── Struktur (Value Streams, ARTs, Timeline, PIs)");
  const timelineId = uid("timeline:konzern");
  await prisma.timeline.create({
    data: { id: timelineId, tenantId, name: "Konzern-Kadenz" },
  });
  await prisma.piStandard.create({
    data: {
      id: uid("pistd:std"),
      tenantId,
      name: "Standard 10-Wochen",
      anchorMonth: 1,
      anchorDay: 6,
      cadenceWeeks: 10,
      piCount: 6,
      createdBy: ADMIN,
    },
  });

  const vsNames = ["Digital Banking", "Payments Platform", "Customer Experience"];
  const vsDesc = [
    "Konten, Onboarding und Kreditprodukte — der digitale Kern der Bank.",
    "Echtzeit-Zahlungen, Karten und Wallet-Erlebnisse über alle Rails.",
    "Web-, Mobile- und Service-Erlebnis über alle Kundenkontaktpunkte.",
  ];
  await prisma.valueStream.createMany({
    data: vsNames.map((name, i) => ({
      id: vsIds[i]!,
      tenantId,
      name,
      description: vsDesc[i]!,
      budgetAmount: [3_000_000, 2_400_000, 1_600_000][i]!,
      budgetCurrency: "EUR",
      financeApproverId: U.fo,
      vmoId: U.vmo,
    })),
  });

  // 6 ARTs, 2 pro Value Stream.
  const artNames = [
    "Accounts & Onboarding", // vs0
    "Lending & Credit", // vs0
    "Real-time Payments", // vs1
    "Cards & Wallets", // vs1
    "Web & Mobile", // vs2
    "Service & Contact Center", // vs2
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

  // 6 PIs auf der Timeline (2 completed, 1 active, 3 planned). timelineId ist
  // kanonisch; artId bleibt leer (Timeline-Modell — geteilte PI-Grid über ARTs).
  const piBase = addDays(now, -21); // aktives PI läuft seit 3 Wochen
  const piSpecs = [
    { key: "pi1", name: "PI 1", start: addDays(piBase, -140), status: "completed" },
    { key: "pi2", name: "PI 2", start: addDays(piBase, -70), status: "completed" },
    { key: "pi3", name: "PI 3", start: piBase, status: "active" },
    { key: "pi4", name: "PI 4", start: addDays(piBase, 70), status: "planned" },
    { key: "pi5", name: "PI 5", start: addDays(piBase, 140), status: "planned" },
    { key: "pi6", name: "PI 6", start: addDays(piBase, 210), status: "planned" },
  ];
  const piIds: Record<string, string> = {};
  for (const p of piSpecs) piIds[p.key] = uid(`pi:${p.key}`);
  await prisma.programIncrement.createMany({
    data: piSpecs.map((p, i) => ({
      id: piIds[p.key]!,
      tenantId,
      timelineId,
      name: p.name,
      startDate: p.start,
      endDate: addDays(p.start, 69),
      status: p.status,
      capacityJobSize: 110 + i * 5,
      capacityAmount: 880_000 + i * 20_000,
      ...(p.status === "completed"
        ? { systemDemoAt: addDays(p.start, 68), inspectAdaptAt: addDays(p.start, 69) }
        : {}),
    })),
  });
  const activePi = piIds["pi3"]!;
  const prevPi = piIds["pi2"]!;

  // ── Phase 4: Delivery (Epics + Features) ──────────────────────────────────
  console.log("\n── Delivery (Epics + Features)");

  // Explizite Epic-Definitionen — echte Bank-Vorhaben, kein „Epic 1/2/…".
  // Epic 0 ist das TAT-KPI-Tree-Showcase (Digital-Onboarding-Durchlaufzeit).
  type EpicDef = {
    title: string;
    desc: string;
    vs: number; // 0..2
    epicType: string; // epic | enabler | solution
    horizon: string; // H1 | H2 | H3
    gate: string; // L0..L5
    steering: boolean;
    approvalPhase?: string;
  };
  const EPIC_DEFS: EpicDef[] = [
    {
      title: "Instant Onboarding & KYC",
      desc: "Volldigitale Kontoeröffnung mit sofortiger Identifikation — Durchlaufzeit von Tagen auf Minuten.",
      vs: 0,
      epicType: "epic",
      horizon: "H2",
      gate: "L4",
      steering: false,
    },
    {
      title: "Open-Banking & PSD2 APIs",
      desc: "PSD2-konforme Account-Information- und Payment-Initiation-Schnittstellen für Drittanbieter.",
      vs: 0,
      epicType: "enabler",
      horizon: "H2",
      gate: "L3",
      steering: false,
    },
    {
      title: "AI Fraud Detection",
      desc: "Echtzeit-Betrugserkennung auf Transaktionsströmen mit ML-Scoring und Fallmanagement.",
      vs: 1,
      epicType: "epic",
      horizon: "H3",
      gate: "L2",
      steering: true,
      approvalPhase: "business_case",
    },
    {
      title: "Mobile App Relaunch",
      desc: "Neubau der Mobile-App mit neuer Navigation, Performance und Barrierefreiheit.",
      vs: 2,
      epicType: "epic",
      horizon: "H1",
      gate: "L4",
      steering: false,
    },
    {
      title: "Instant SEPA",
      desc: "SEPA-Instant-Credit-Transfer rund um die Uhr mit Sub-10-Sekunden-Gutschrift.",
      vs: 1,
      epicType: "epic",
      horizon: "H1",
      gate: "L5",
      steering: false,
    },
    {
      title: "Card Tokenization",
      desc: "Tokenisierung von Kartendaten für Apple/Google Pay und sichere Händler-Zahlungen.",
      vs: 1,
      epicType: "epic",
      horizon: "H2",
      gate: "L3",
      steering: false,
    },
    {
      title: "Self-Service Contact Center",
      desc: "KI-gestützte Self-Service-Flows und Agenten-Assist zur Senkung der Kontaktquote.",
      vs: 2,
      epicType: "epic",
      horizon: "H2",
      gate: "L2",
      steering: false,
      approvalPhase: "hypothesis_review",
    },
    {
      title: "Cloud Migration",
      desc: "Migration der Kernplattformen in die Cloud — Architectural Runway für Skalierung.",
      vs: 0,
      epicType: "enabler",
      horizon: "H1",
      gate: "L4",
      steering: true,
    },
    {
      title: "Data Platform",
      desc: "Zentrale Daten- und Streaming-Plattform als Grundlage für Analytics und ML.",
      vs: 0,
      epicType: "enabler",
      horizon: "H2",
      gate: "L3",
      steering: false,
    },
    {
      title: "Core Banking Modernization",
      desc: "Ablösung des Legacy-Kernbankensystems — großer Cross-ART-Solution-Brocken.",
      vs: 0,
      epicType: "solution",
      horizon: "H2",
      gate: "L2",
      steering: true,
      approvalPhase: "stakeholder_review",
    },
    {
      title: "SME Lending",
      desc: "Automatisierte Kreditentscheidung und -vergabe für kleine und mittlere Unternehmen.",
      vs: 0,
      epicType: "epic",
      horizon: "H2",
      gate: "L1",
      steering: false,
      approvalPhase: "hypothesis_review",
    },
    {
      title: "Loyalty & Rewards",
      desc: "Punkte-, Cashback- und Partner-Rewards-Programm für aktivere Kundenbindung.",
      vs: 2,
      epicType: "epic",
      horizon: "H3",
      gate: "L1",
      steering: false,
    },
    {
      title: "Biometric Auth",
      desc: "Biometrische Anmeldung (Face/Fingerprint) und Passkey-Support — Sicherheits-Enabler.",
      vs: 2,
      epicType: "enabler",
      horizon: "H2",
      gate: "L3",
      steering: false,
    },
    {
      title: "Regulatory Reporting",
      desc: "Automatisiertes aufsichtsrechtliches Meldewesen (DORA, BaFin) mit Prüf-Trails.",
      vs: 0,
      epicType: "epic",
      horizon: "H1",
      gate: "L4",
      steering: false,
    },
    {
      title: "PFM Insights",
      desc: "Personal-Finance-Management: Kategorisierung, Budgets und Spar-Insights.",
      vs: 2,
      epicType: "epic",
      horizon: "H3",
      gate: "L1",
      steering: false,
    },
    {
      title: "Green Banking",
      desc: "CO₂-Fußabdruck je Transaktion und nachhaltige Anlageprodukte.",
      vs: 2,
      epicType: "epic",
      horizon: "H3",
      gate: "L0",
      steering: false,
    },
    {
      title: "Developer Platform",
      desc: "Interne Developer-Experience-Plattform (CI/CD, Templates, Self-Service) — Enabler.",
      vs: 1,
      epicType: "enabler",
      horizon: "H3",
      gate: "L2",
      steering: true,
    },
    {
      title: "Wealth Management Cockpit",
      desc: "Beratungs- und Portfolio-Cockpit für vermögende Privatkunden.",
      vs: 2,
      epicType: "epic",
      horizon: "H3",
      gate: "L0",
      steering: false,
    },
    {
      title: "Omnichannel Notifications",
      desc: "Einheitliche Benachrichtigungen über Push, E-Mail und In-App mit Präferenzcenter.",
      vs: 2,
      epicType: "epic",
      horizon: "H1",
      gate: "L5",
      steering: false,
    },
    {
      title: "Payments Observability",
      desc: "Ende-zu-Ende-Monitoring und Tracing der Zahlungsstrecken — Betriebs-Enabler.",
      vs: 1,
      epicType: "enabler",
      horizon: "H1",
      gate: "L4",
      steering: false,
    },
  ];

  // Epic-Status aus dem Stage Gate ableiten (gültige InitiativeStatus-Werte).
  const gateStatus: Record<string, string> = {
    L0: "draft",
    L1: "draft",
    L2: "approved",
    L3: "approved",
    L4: "in_progress",
    L5: "completed",
  };

  const epicIds = EPIC_DEFS.map((_, i) => uid(`epic:${i}`));
  const epicRows: Prisma.InitiativeCreateManyInput[] = EPIC_DEFS.map((def, i) => {
    const start = addDays(now, -160 + i * 12);
    const status = gateStatus[def.gate]!;
    return {
      id: epicIds[i]!,
      tenantId,
      level: 0,
      path: epicIds[i]!,
      title: def.title,
      description: def.desc,
      ownerId: i % 4 === 3 ? null : i % 3 === 0 ? U.owner : i % 3 === 1 ? U.portfolio : U.vso,
      assigneeIds: i % 2 === 0 ? [U.owner] : [],
      valueStreamId: vsIds[def.vs]!,
      stageGate: def.gate,
      status,
      epicType: def.epicType,
      investmentHorizon: def.horizon,
      needsSteeringAttention: def.steering,
      stagedForBudgeting: def.gate === "L2" || def.gate === "L3",
      plannedStartAt: start,
      plannedEndAt: addDays(start, 150),
      // Reifegrad-Plan: Umsetzungsfenster L4.1→L4.2 = das geplante Zeitfenster
      // (plannedStartAt/EndAt werden jetzt daraus abgeleitet — deckungsgleich).
      timeline: {
        estimates: {
          implementation_started: start.toISOString().slice(0, 10),
          implementation: addDays(start, 150).toISOString().slice(0, 10),
        },
        actuals: {},
      },
      ...(status === "completed" ? { completedAt: addDays(now, -18 + i) } : {}),
      benefitHypothesis: {
        measuresHypothesis: `Mit „${def.title}" verbessern wir das messbare Ergebnis für ${vsNames[def.vs]}.`,
        changeFromBaseline: "Signifikante Verbesserung gegenüber dem heutigen Startpunkt.",
        businessOutcomes: ["Höhere Effizienz", "Bessere Kundenerfahrung", "Geringeres Risiko"],
        leadingIndicators: ["Adoption-Rate", "Durchlaufzeit", "Fehlerquote"],
        risks: ["Abhängigkeit von Legacy-Systemen", "Regulatorische Freigaben"],
      },
      ...(def.gate === "L2" || def.gate === "L3" || def.gate === "L4" || def.gate === "L5"
        ? {
            businessCase: {
              costSlices: [
                { period: H1, amount: 120_000 + i * 6_000 },
                { period: H2, amount: 90_000 + i * 4_000 },
              ],
              assumptions: "Kalkulation auf Basis der aktuellen Team-Kapazität und Lauf-Kosten.",
            },
          }
        : {}),
      ...(def.approvalPhase ? { approvalPhase: def.approvalPhase } : {}),
      createdBy: ADMIN,
      updatedBy: ADMIN,
    };
  });
  await prisma.initiative.createMany({ data: epicRows });

  // Abnehmer je Reifegrad-Wechsel (ADR-0018). Ohne diese Regeln ist ein Wechsel
  // nicht beantragbar — ein frischer Demo-Tenant wäre sonst am ersten Gate
  // blockiert. Die Platzhalter lösen auf die Wertstrom-Governance-Spalten auf
  // (`vmoId` / `financeApproverId`), die oben schon gesetzt sind.
  await prisma.stageGateApproverRule.createMany({
    data: (
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
      approverUserIds: [],
      approverRoles: [...approverRoles],
      updatedBy: U.admin,
    })),
  });

  // Ein offener Antrag, damit die Gate-Karte und „Meine Freigaben" im Demo-
  // Tenant ohne Vorarbeit etwas zeigen: das erste L3-Epic will nach L4.
  const pendingGateEpicId = epicIds[EPIC_DEFS.findIndex((d) => d.gate === "L3")];
  if (pendingGateEpicId) {
    await prisma.stageGateTransition.create({
      data: {
        tenantId,
        initiativeId: pendingGateEpicId,
        fromGate: "L3",
        toGate: "L4",
        kind: "forward",
        status: "pending",
        quorum: "all",
        requestedBy: U.owner,
        reason: "Team steht bereit, Umsetzung kann starten.",
        approvals: {
          create: [
            {
              tenantId,
              approverUserId: U.vmo,
              role: "value_stream.vmo",
              source: "value_stream",
              createdBy: U.owner,
            },
          ],
        },
      },
    });
  }

  // Features (~44): 3 für Epics an Index %5==0, sonst 2. artId rotiert über ALLE
  // 6 ARTs (globaler Zähler), piId über aktives/vorheriges/geplantes PI.
  const FEATURE_STATUS = ["in_progress", "approved", "blocked", "completed"];
  const FEATURE_TYPES = ["feature", "enabler"];
  // kurze, sprechende Feature-Bausteine je Epic-Kontext.
  const FEATURE_PARTS = [
    "MVP-Strecke",
    "API-Anbindung",
    "Frontend-Flows",
    "Datenmigration",
    "Monitoring & Alerting",
    "Rollout & Enablement",
  ];
  const featureRows: Prisma.InitiativeCreateManyInput[] = [];
  const featureIdsByEpic: Record<number, string[]> = {};
  let gf = 0; // globaler Feature-Index für gleichmäßige ART-Verteilung
  epicIds.forEach((epicId, ei) => {
    const count = ei % 5 === 0 ? 3 : 2;
    featureIdsByEpic[ei] = [];
    for (let f = 0; f < count; f++) {
      const fid = uid(`feat:${ei}:${f}`);
      featureIdsByEpic[ei]!.push(fid);
      const bv = 3 + ((ei + f) % 8);
      const tc = 2 + ((ei * 2 + f) % 7);
      const rr = 1 + ((ei + f * 2) % 6);
      const js = 2 + ((ei + f) % 9);
      const wsjf = Number((((bv + tc + rr) / js) as number).toFixed(2));
      const status = FEATURE_STATUS[gf % FEATURE_STATUS.length]!;
      const artId = artIds[gf % artIds.length]!; // ALLE 6 ARTs füllen
      const piId =
        status === "completed"
          ? gf % 3 === 0
            ? piIds["pi1"]!
            : prevPi
          : gf % 7 === 0
            ? piIds["pi4"]!
            : activePi;
      const start = addDays(now, -40 + f * 15);
      featureRows.push({
        id: fid,
        tenantId,
        level: 1,
        parentId: epicId,
        path: `${epicId}/${fid}`,
        title: `${EPIC_DEFS[ei]!.title} — ${FEATURE_PARTS[f % FEATURE_PARTS.length]}`,
        description: `Feature-Baustein „${FEATURE_PARTS[f % FEATURE_PARTS.length]}" für ${EPIC_DEFS[ei]!.title}.`,
        ownerId: gf % 2 === 0 ? U.owner : U.fo,
        assigneeIds: [U.owner, U.fo].slice(0, (gf % 2) + 1),
        artId,
        piId,
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: wsjf,
        featureType:
          EPIC_DEFS[ei]!.epicType === "enabler"
            ? "enabler"
            : FEATURE_TYPES[gf % FEATURE_TYPES.length]!,
        stageGate: "L3",
        status,
        completedAt: status === "completed" ? addDays(now, -12 + (gf % 6)) : null,
        plannedStartAt: start,
        plannedEndAt: addDays(start, 45),
        acceptanceCriteria: [
          "Akzeptanzkriterium A erfüllt und getestet",
          "Akzeptanzkriterium B erfüllt und abgenommen",
        ],
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
      gf++;
    }
  });
  await prisma.initiative.createMany({ data: featureRows });
  console.log(`  ✓ ${epicIds.length} Epics + ${featureRows.length} Features`);

  // Netzplan-Positionen für JEDES Epic (deterministisches Grid) — nicht nur Epic 0.
  const graphPositions: Prisma.InitiativeGraphPositionCreateManyInput[] = [];
  epicIds.forEach((epicId, ei) => {
    (featureIdsByEpic[ei] ?? []).forEach((fid, k) => {
      graphPositions.push({
        id: uid(`pos:${fid}`),
        tenantId,
        epicId,
        initiativeId: fid,
        x: 160 + k * 240,
        y: 120 + (k % 2) * 140,
        updatedBy: ADMIN,
      });
    });
  });
  await prisma.initiativeGraphPosition.createMany({ data: graphPositions });

  // ── Phase 5: KPIs (Zeitreihen) + Budgets ──────────────────────────────────
  console.log("\n── KPIs + Budgets");
  const kpiOnboardingId = uid("kpi:onboarding-tat");
  const kpiRows: Prisma.KpiCreateManyInput[] = [];
  // Primär-KPI je Epic (treibt die Ziel-Bindung) — Index = Epic-Index.
  const epicPrimaryKpi: { id: string; valuePerUnit: number; baseline: number; target: number }[] =
    [];

  // Epic 0: TAT-Showcase (kpi_tree) — Verlauf 0→100, letzter Wert exakt 50.
  kpiRows.push({
    id: kpiOnboardingId,
    tenantId,
    initiativeId: epicIds[0]!,
    name: "Digitalisierte Onboarding-Strecken",
    unit: "Strecken",
    baseline: 0,
    target: 100,
    measurements: simulateSeries(0, 100, { monthsBack: 9, fraction: 0.5, seed: 1, endExact: 50 }),
    valuePerUnit: 8_000,
    benefitKind: "recurring",
    recurringInterval: "yearly",
    calculationNote: "Jede digitalisierte Onboarding-Strecke senkt die Durchlaufzeit um 0,5 Tage.",
    createdBy: ADMIN,
    updatedBy: ADMIN,
  });
  epicPrimaryKpi[0] = { id: kpiOnboardingId, valuePerUnit: 8_000, baseline: 0, target: 100 };

  // Weitere KPIs je Epic (1–2), jeweils mit simulierter Monats-Zeitreihe.
  const KPI_NAMES = ["Durchlaufzeit", "NPS", "Automatisierungsgrad", "Fehlerquote", "Adoption"];
  const KPI_UNITS = ["Tage", "Punkte", "%", "ppm", "%"];
  epicIds.forEach((epicId, ei) => {
    const k = 1 + (ei % 2);
    for (let j = 0; j < k; j++) {
      if (ei === 0 && j === 0) continue; // TAT-KPI bereits gesetzt
      const base = 100 + ei * 10;
      const tgt = base + 50 + j * 20;
      const valuePerUnit = 1_500 + ei * 100;
      const fraction = 0.35 + ((ei * 3 + j) % 5) * 0.1; // 0.35 … 0.75
      const nameIdx = (ei + j) % KPI_NAMES.length;
      const kpiId = uid(`kpi:${ei}:${j}`);
      kpiRows.push({
        id: kpiId,
        tenantId,
        initiativeId: epicId,
        name: KPI_NAMES[nameIdx]!,
        unit: KPI_UNITS[nameIdx]!,
        baseline: base,
        target: tgt,
        measurements: simulateSeries(base, tgt, { monthsBack: 9, fraction, seed: ei * 7 + j }),
        valuePerUnit,
        benefitKind: j % 2 === 0 ? "recurring" : "one_time",
        recurringInterval: j % 2 === 0 ? "yearly" : "monthly",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
      if (j === 0) epicPrimaryKpi[ei] = { id: kpiId, valuePerUnit, baseline: base, target: tgt };
    }
  });
  await prisma.kpi.createMany({ data: kpiRows });

  // BudgetAllocation je Epic
  await prisma.budgetAllocation.createMany({
    data: epicIds.map((epicId, i) => ({
      id: uid(`balloc:${i}`),
      tenantId,
      epicId,
      priority: i,
      hypothesisBudget: i % 4 === 0 ? 50_000 : null,
      allocations: { [H1]: 80_000 + i * 6_000, [H2]: 60_000 + i * 4_000 },
      createdBy: ADMIN,
      updatedBy: ADMIN,
    })),
  });
  // ArtBudget je ART
  await prisma.artBudget.createMany({
    data: artIds.map((artId, i) => ({
      id: uid(`abudget:${i}`),
      tenantId,
      artId,
      byPeriod: { [H1]: 400_000 + i * 30_000, [H2]: 380_000 + i * 25_000 },
      createdBy: ADMIN,
      updatedBy: ADMIN,
    })),
  });
  // BudgetPlanRevision ×2: aktuelle H1 + ältere, abgelöste Revision (Historie).
  await prisma.budgetPlanRevision.create({
    data: {
      id: uid(`bprev:${PREV_H2}`),
      tenantId,
      cycleKey: PREV_H2,
      capturedAt: addDays(now, -120),
      capturedBy: ADMIN,
      payload: buildSnapshotPayload({
        cycleKey: PREV_H2,
        capturedAt: addDays(now, -120),
        epics: epicIds.slice(0, 6).map((epicId, i) => ({
          epicId,
          title: EPIC_DEFS[i]!.title,
          valueStreamId: vsIds[EPIC_DEFS[i]!.vs]!,
          valueStreamName: vsNames[EPIC_DEFS[i]!.vs]!,
          priority: i,
          alloc: 60_000 + i * 5_000,
        })),
        arts: artIds.map((id, i) => ({ id, name: artNames[i]!, amount: 340_000 + i * 25_000 })),
      }),
    },
  });
  await prisma.budgetPlanRevision.create({
    data: {
      id: uid(`bprev:${H1}`),
      tenantId,
      cycleKey: H1,
      capturedAt: addDays(now, -20),
      capturedBy: ADMIN,
      payload: buildSnapshotPayload({
        cycleKey: H1,
        capturedAt: addDays(now, -20),
        epics: epicIds.slice(0, 8).map((epicId, i) => ({
          epicId,
          title: EPIC_DEFS[i]!.title,
          valueStreamId: vsIds[EPIC_DEFS[i]!.vs]!,
          valueStreamName: vsNames[EPIC_DEFS[i]!.vs]!,
          priority: i,
          alloc: 80_000 + i * 6_000,
        })),
        arts: artIds.map((id, i) => ({ id, name: artNames[i]!, amount: 400_000 + i * 30_000 })),
      }),
    },
  });

  // ── Phase 6: Dependencies, Issues, System-Demos ───────────────────────────
  console.log("\n── Programm-Inhalt (Deps, Issues, Demos)");

  // Cross-ART Feature-Dependencies (Typen rotieren, unique from/to/type).
  const allFeatureIds = featureRows.map((f) => f.id as string);
  const featureArtById = new Map(featureRows.map((f) => [f.id as string, f.artId as string]));
  const DEP_TYPES = ["blocks", "depends_on", "relates_to"];
  const depRows: Prisma.DependencyCreateManyInput[] = [];
  for (let i = 0; i < 26 && i < allFeatureIds.length; i++) {
    const fromId = allFeatureIds[i]!;
    const toId = allFeatureIds[(i * 3 + 5) % allFeatureIds.length]!;
    if (fromId === toId) continue;
    // Cross-ART bevorzugen: nur verknüpfen, wenn die ARTs sich unterscheiden.
    if (featureArtById.get(fromId) === featureArtById.get(toId)) continue;
    depRows.push({
      id: uid(`dep:${i}`),
      tenantId,
      fromId,
      toId,
      type: DEP_TYPES[i % DEP_TYPES.length]!,
      createdBy: ADMIN,
    });
  }
  await prisma.dependency.createMany({ data: depRows, skipDuplicates: true });
  console.log(`  ✓ ${depRows.length} Cross-ART Dependencies`);

  // Issues — voll gestaffelt: 4 Head-Issues mit Kindern (2–3 Ebenen tief),
  // volle 5×5-Matrix, alle 5 ROAM-Buckets, Kategorien gestreut, viele an
  // Features/Epics verlinkt (initiativeId) + teils artId/piId.
  const LEVELS = ["very_low", "low", "medium", "high", "very_high"];
  const CAT = ["technical", "business", "schedule", "external"];
  const ROAM = ["open", "resolved", "owned", "accepted", "mitigated"];
  type IssueDef = { key: string; title: string; parent?: string };
  const issueDefs: IssueDef[] = [
    { key: "reg", title: "Regulatorische Bereitschaft" }, // 0 head
    { key: "reg-dora", title: "DORA-Compliance noch offen", parent: "reg" }, // 1
    { key: "reg-sca", title: "PSD2-SCA Nachweise fehlen", parent: "reg" }, // 2
    { key: "reg-mw", title: "Meldewesen-Fristen sehr eng", parent: "reg" }, // 3
    { key: "reg-mw-data", title: "Testdaten für Meldung fehlen", parent: "reg-mw" }, // 4 grandchild
    { key: "reg-mw-bafin", title: "BaFin-Rückfragen unbeantwortet", parent: "reg-mw" }, // 5 grandchild
    { key: "debt", title: "Technische Schulden Core" }, // 6 head
    { key: "debt-batch", title: "Core-Banking Batch-Fenster zu kurz", parent: "debt" }, // 7
    { key: "debt-cobol", title: "Legacy-COBOL-Know-how konzentriert", parent: "debt" }, // 8
    { key: "debt-mig", title: "Datenmigration Kernbank riskant", parent: "debt" }, // 9
    { key: "debt-mig-map", title: "Feldmapping unklar", parent: "debt-mig" }, // 10 grandchild
    { key: "supp", title: "Lieferanten-Risiken" }, // 11 head
    { key: "supp-kyc", title: "KYC-Anbieter reißt SLA", parent: "supp" }, // 12
    { key: "supp-cloud", title: "Cloud-Provider Lock-in", parent: "supp" }, // 13
    { key: "supp-card", title: "Kartenprozessor-Zertifizierung offen", parent: "supp" }, // 14
    { key: "supp-card-pci", title: "PCI-DSS-Audit noch offen", parent: "supp-card" }, // 15 grandchild
    { key: "sec", title: "Sicherheit & Fraud" }, // 16 head
    { key: "sec-fp", title: "Fraud-Modell zu viele False Positives", parent: "sec" }, // 17
    { key: "sec-bio", title: "Biometrie-Spoofing möglich", parent: "sec" }, // 18
    { key: "sec-ddos", title: "API-Rate-Limits gegen DDoS fehlen", parent: "sec" }, // 19
    { key: "sec-fp-bias", title: "Trainingsdaten-Bias im Fraud-Modell", parent: "sec-fp" }, // 20 grandchild
    { key: "cap", title: "PI-Planning Kapazitätsengpass" }, // 21 standalone
    { key: "dep-core", title: "Abhängigkeit vom Zahlungskern" }, // 22
    { key: "conv", title: "Onboarding-Konversion zu niedrig" }, // 23
    { key: "store", title: "App-Store-Freigabe verzögert" }, // 24
    { key: "pfm-dq", title: "Datenqualität PFM unzureichend" }, // 25
    { key: "fx", title: "Wechselkurs-Volatilität" }, // 26
    { key: "churn", title: "Personalfluktuation im RTE-Kreis" }, // 27
  ];
  const issueIdByKey: Record<string, string> = {};
  issueDefs.forEach((d, i) => (issueIdByKey[d.key] = uid(`issue:${i}`)));
  const issueOwners = [U.rte, U.owner, U.portfolio, U.vmo, U.fo];
  const issueRows: Prisma.IssueCreateManyInput[] = issueDefs.map((d, i) => {
    // Volle 5×5-Matrix: i=0..24 deckt alle Kombinationen ab.
    const probability = LEVELS[Math.floor(i / 5) % 5]!;
    const impact = LEVELS[i % 5]!;
    const roamStatus = ROAM[i % ROAM.length]!;
    const category = CAT[i % CAT.length]!;
    // Viele Issues an Epics/Features hängen; einige mit ART/PI-Kontext.
    const linkToFeature = i % 3 === 1;
    const initiativeId = linkToFeature
      ? allFeatureIds[(i * 5) % allFeatureIds.length]!
      : i % 3 === 0
        ? epicIds[i % epicIds.length]!
        : undefined;
    return {
      id: issueIdByKey[d.key]!,
      tenantId,
      issueNumber: i + 1,
      title: d.title,
      description: `Details und Kontext zu: ${d.title}.`,
      probability,
      impact,
      category,
      reviewStatus: "documented",
      roamStatus,
      ...(roamStatus !== "open"
        ? { roamRationale: "ROAM-Entscheidung im letzten Risk-Review festgehalten." }
        : {}),
      ownerId: issueOwners[i % issueOwners.length]!,
      raisedBy: U.rte,
      targetResolutionDate: addDays(now, 20 + (i % 5) * 10),
      ...(d.parent ? { parentId: issueIdByKey[d.parent]! } : {}),
      ...(initiativeId ? { initiativeId } : {}),
      ...(i % 4 === 0 ? { artId: artIds[i % artIds.length]! } : {}),
      ...(i % 6 === 0 ? { piId: activePi } : {}),
    };
  });
  await prisma.issue.createMany({ data: issueRows });

  // IssueMitigation (1–3 auf mehreren Issues).
  const mitigationRows: Prisma.IssueMitigationCreateManyInput[] = [];
  issueDefs.forEach((d, i) => {
    if (i % 3 !== 0) return;
    const n = 1 + (Math.floor(i / 3) % 3); // 1–3 Maßnahmen (variiert deterministisch)
    for (let m = 0; m < n; m++) {
      mitigationRows.push({
        id: uid(`imit:${i}:${m}`),
        tenantId,
        issueId: issueIdByKey[d.key]!,
        description: `Maßnahme ${m + 1}: Gegensteuern bei „${d.title}".`,
        createdBy: issueOwners[i % issueOwners.length]!,
      });
    }
  });
  await prisma.issueMitigation.createMany({ data: mitigationRows });

  // IssueAssessment: Neubewertungs-Trail auf einigen Issues (verschiebt Exposure).
  const assessmentRows: Prisma.IssueAssessmentCreateManyInput[] = [];
  issueDefs.forEach((d, i) => {
    if (i % 5 !== 0) return;
    // Erst-Bewertung + spätere Re-Assessment mit verschobenem Prob/Impact.
    assessmentRows.push(
      {
        id: uid(`iass:${i}:0`),
        tenantId,
        issueId: issueIdByKey[d.key]!,
        probability: LEVELS[Math.floor(i / 5) % 5]!,
        impact: LEVELS[i % 5]!,
        note: "Erst-Einschätzung beim Aufnehmen.",
        createdBy: U.rte,
      },
      {
        id: uid(`iass:${i}:1`),
        tenantId,
        issueId: issueIdByKey[d.key]!,
        probability: LEVELS[(Math.floor(i / 5) + 1) % 5]!,
        impact: LEVELS[(i + 1) % 5]!,
        note: "Neubewertung nach Gegenmaßnahmen — Exposure verschoben.",
        createdBy: U.owner,
      },
    );
  });
  await prisma.issueAssessment.createMany({ data: assessmentRows });

  // IssueSettings: Prefix + lastNumber = max issueNumber.
  await prisma.issueSettings.create({
    data: {
      id: uid("issuesettings:1"),
      tenantId,
      prefix: "R-",
      lastNumber: issueDefs.length,
    },
  });
  console.log(
    `  ✓ ${issueRows.length} Issues, ${mitigationRows.length} Mitigations, ${assessmentRows.length} Assessments`,
  );

  // System-Demos je abgeschlossenem PI (pi1, pi2) + Items über MEHRERE Epics.
  const demoEpicSets: Record<string, number[]> = {
    pi1: [3, 4, 7, 13, 18],
    pi2: [0, 5, 8, 16, 19],
  };
  for (const demoKey of ["pi1", "pi2"] as const) {
    const piId = piIds[demoKey]!;
    const featureSet = demoEpicSets[demoKey]!.flatMap((ei) =>
      (featureIdsByEpic[ei] ?? []).slice(0, 1).map((fid) => ({ ei, fid })),
    );
    await prisma.systemDemo.create({
      data: {
        id: uid(`demo:${demoKey}`),
        tenantId,
        piId,
        scheduledAt: addDays(now, demoKey === "pi2" ? -12 : -82),
        notes: "System-Demo-Agenda: End-to-End-Durchstiche der abgeschlossenen Features.",
        createdBy: ADMIN,
        items: {
          create: featureSet.map(({ ei, fid }, k) => ({
            id: uid(`demoitem:${demoKey}:${k}`),
            tenantId,
            featureId: fid,
            title: `Demo: ${EPIC_DEFS[ei]!.title}`,
            ownerId: U.owner,
            presented: true,
            position: k,
            createdBy: ADMIN,
          })),
        },
      },
    });
  }

  // ── Phase 7: Ziele — alle 4 Fortschrittsquellen ───────────────────────────
  console.log("\n── Ziele (manual · rollup · auto_kpi · kpi_tree)");
  const themeBiz = uid("theme:wachstum");
  const themeEnabler = uid("theme:exzellenz");
  const themeTrust = uid("theme:kundenvertrauen");
  await prisma.strategicTheme.createMany({
    data: [
      {
        id: themeBiz,
        tenantId,
        title: "Wachstum",
        narrative: "Neukundengewinnung und Cross-Sell über digitale Kanäle beschleunigen.",
        kind: "business",
        color: "#6366f1",
        budgetPlanned: 6_000_000,
        ownerId: U.portfolio,
        sortOrder: 0,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeEnabler,
        tenantId,
        title: "Technische Exzellenz",
        narrative: "Architektur-Runway, Cloud und Developer-Experience als Fundament.",
        kind: "enabler",
        color: "#0ea5e9",
        budgetPlanned: 2_500_000,
        ownerId: U.vmo,
        sortOrder: 1,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeTrust,
        tenantId,
        title: "Kundenvertrauen",
        narrative: "Sicherheit, Regulatorik und Servicequalität als Vertrauensanker.",
        kind: "business",
        color: "#10b981",
        budgetPlanned: 1_800_000,
        ownerId: U.portfolio,
        sortOrder: 2,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });

  // ThemeEpicLink: jedes Epic an ein Theme (Enabler→Exzellenz, Solution→Wachstum,
  // Business-Epics alternierend Wachstum/Kundenvertrauen).
  await prisma.themeEpicLink.createMany({
    data: epicIds.map((epicId, i) => {
      const t = EPIC_DEFS[i]!;
      const themeId =
        t.epicType === "enabler"
          ? themeEnabler
          : t.epicType === "solution"
            ? themeBiz
            : i % 2 === 0
              ? themeBiz
              : themeTrust;
      return { id: uid(`tel:${i}`), tenantId, themeId, epicId, createdBy: ADMIN };
    }),
  });

  // Custom Fields (×3)
  const cfSelect = uid("cf:prio");
  const cfNumber = uid("cf:konfidenz");
  await prisma.goalCustomFieldDef.createMany({
    data: [
      {
        id: uid("cf:notiz"),
        tenantId,
        name: "Notiz",
        type: "text",
        sortOrder: 0,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: cfNumber,
        tenantId,
        name: "Konfidenz",
        type: "number",
        sortOrder: 1,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: cfSelect,
        tenantId,
        name: "Priorität",
        type: "select",
        options: ["Hoch", "Mittel", "Niedrig"],
        sortOrder: 2,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });

  // Objective-Bausteine
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

  // (a) manual-Blatt (mit dichter Check-in-Historie)
  const gManual = uid("goal:manual-nps");
  roots.push(
    objBase(gManual, themeTrust, "NPS auf 60", {
      progressMode: "manual",
      metricType: "number",
      metricUnit: "Punkte",
      baseline: 40,
      target: 60,
      current: 52,
      status: "on_track",
      period: H1,
      ownerId: U.portfolio,
    }),
  );

  // weitere manual-Ziele (benannt) mit Check-ins
  const gCIR = uid("goal:cir");
  roots.push(
    objBase(gCIR, themeBiz, "Cost-Income-Ratio senken", {
      progressMode: "manual",
      metricType: "number",
      metricUnit: "%",
      baseline: 68,
      target: 58,
      current: 63,
      status: "at_risk",
      period: `${YEAR}`,
      ownerId: U.vmo,
    }),
  );
  const gDigital = uid("goal:digital-adoption");
  roots.push(
    objBase(gDigital, themeBiz, "Digital-Adoption 80 %", {
      progressMode: "manual",
      metricType: "number",
      metricUnit: "%",
      baseline: 55,
      target: 80,
      current: 68,
      status: "on_track",
      period: `${YEAR}`,
      ownerId: U.portfolio,
    }),
  );

  // (b) rollup-Ast mit 2 manual-Kindern
  const gRollup = uid("goal:rollup-kundenzufriedenheit");
  roots.push(
    objBase(gRollup, themeTrust, "Kundenzufriedenheit erhöhen", {
      progressMode: "rollup",
      status: "at_risk",
      period: `${YEAR}`,
      ownerId: U.portfolio,
    }),
  );
  const gRollupK1 = uid("goal:rollup-k1");
  const gRollupK2 = uid("goal:rollup-k2");
  children.push(
    objBase(gRollupK1, themeTrust, "Beschwerdequote senken", {
      parentObjectiveId: gRollup,
      level: 1,
      progressMode: "manual",
      metricType: "number",
      metricUnit: "%",
      baseline: 8,
      target: 3,
      current: 5,
      status: "on_track",
      rollupWeight: 2,
    }),
    objBase(gRollupK2, themeTrust, "Erstlösungsquote steigern", {
      parentObjectiveId: gRollup,
      level: 1,
      progressMode: "manual",
      metricType: "number",
      metricUnit: "%",
      baseline: 60,
      target: 85,
      current: 70,
      status: "at_risk",
      rollupWeight: 1,
    }),
  );

  // (c) Portfolio-Outcome-Baum (kpi_tree): jedes Epic (außer 0) realisiert genau
  //     eines dieser VS-Ziele über seine Primär-KPI. gVS0 = auto_kpi (Demo),
  //     gVS1/2 = kpi_tree; alle drei €-Blätter unter gPortfolio (kpi_tree).
  const gPortfolio = uid("goal:portfolio-value");
  const gVs = [uid("goal:vs0-value"), uid("goal:vs1-value"), uid("goal:vs2-value")];
  const vsTarget = [0, 0, 0];
  epicIds.forEach((_, ei) => {
    if (ei === 0) return; // TAT zählt separat
    const k = epicPrimaryKpi[ei];
    if (!k) return;
    vsTarget[EPIC_DEFS[ei]!.vs]! += Math.abs(k.target - k.baseline) * k.valuePerUnit;
  });
  const portfolioTarget = vsTarget[0]! + vsTarget[1]! + vsTarget[2]!;
  roots.push(
    objBase(gPortfolio, themeBiz, "Portfolio-Wertbeitrag", {
      progressMode: "kpi_tree",
      metricType: "currency",
      metricUnit: "€",
      currencyCode: "EUR",
      baseline: 0,
      target: portfolioTarget,
      status: "on_track",
      period: `${YEAR}`,
      ownerId: U.portfolio,
    }),
  );
  children.push(
    ...gVs.map((id, vs) =>
      objBase(id, themeBiz, `Wertbeitrag ${vsNames[vs]}`, {
        parentObjectiveId: gPortfolio,
        level: 1,
        progressMode: vs === 0 ? "auto_kpi" : "kpi_tree",
        metricType: "currency",
        metricUnit: "€",
        currencyCode: "EUR",
        baseline: 0,
        target: vsTarget[vs]!,
        parentUnitPerChildUnit: 1, // € → € (1:1)
        status: vs === 1 ? "at_risk" : "on_track",
        ownerId: U.vmo,
      }),
    ),
  );

  // (d) kpi_tree — das TAT-Beispiel (€-Parent → Days-Kind → KPI Onboarding)
  const gTatParent = uid("goal:tat-parent");
  const gTatChild = uid("goal:tat-child");
  roots.push(
    objBase(gTatParent, themeBiz, "Onboarding-TAT Wertbeitrag", {
      progressMode: "kpi_tree",
      metricType: "currency",
      metricUnit: "€",
      currencyCode: "EUR",
      baseline: 0,
      target: 10_000_000,
      status: "on_track",
      period: `${YEAR}`,
      ownerId: U.portfolio,
    }),
  );
  children.push(
    objBase(gTatChild, themeBiz, "TAT durch Digital-Onboarding senken", {
      parentObjectiveId: gTatParent,
      level: 1,
      progressMode: "kpi_tree",
      metricType: "number",
      metricUnit: "Days",
      baseline: 122,
      target: 60,
      parentUnitPerChildUnit: 16_000, // 1 Day = 16.000 €
      status: "on_track",
      ownerId: U.owner,
    }),
  );

  // (e) geschlossene Ziele (Status-Abdeckung achieved/partial/missed/dropped)
  const CLOSED = [
    ["achieved", "Zahlungsausfälle halbiert"],
    ["partial", "Onboarding-Zeit reduziert"],
    ["missed", "App-Store-Rating 4.8"],
    ["dropped", "Filial-Kiosk-Pilot"],
  ] as const;
  const closedIds: string[] = [];
  const closedThemes = [themeTrust, themeBiz, themeTrust, themeEnabler];
  CLOSED.forEach(([status, title], i) => {
    const id = uid(`goal:closed:${i}`);
    closedIds.push(id);
    roots.push(
      objBase(id, closedThemes[i]!, title, {
        progressMode: "manual",
        metricType: "number",
        metricUnit: "%",
        baseline: 0,
        target: 100,
        current: status === "achieved" ? 100 : status === "partial" ? 60 : 30,
        status,
        closedAt: addDays(now, -20 + i),
        closingNote: "Quartals-Retrospektive abgeschlossen — Lessons Learned dokumentiert.",
        period: H1,
      }),
    );
  });

  await prisma.objective.createMany({ data: roots });
  await prisma.objective.createMany({ data: children });

  // GoalEpicLink: JEDES Epic realisiert genau EIN Ziel über seine Primär-KPI.
  // Epic 0 → TAT-Kind (Faktor 0,5); Epics 1–19 → VS-Outcome-Ziel des eigenen VS
  // (conversionFactor = valuePerUnit ⇒ Beitrag = kpiΔ × €/Einheit).
  const goalLinkRows: Prisma.GoalEpicLinkCreateManyInput[] = epicIds.map((epicId, ei) => {
    if (ei === 0) {
      return {
        id: uid("gel:0"),
        tenantId,
        objectiveId: gTatChild,
        epicId,
        kpiId: kpiOnboardingId,
        conversionFactor: 0.5,
        impactKind: "recurring",
        recurringInterval: "yearly",
        createdBy: ADMIN,
      };
    }
    const k = epicPrimaryKpi[ei]!;
    return {
      id: uid(`gel:${ei}`),
      tenantId,
      objectiveId: gVs[EPIC_DEFS[ei]!.vs]!,
      epicId,
      kpiId: k.id,
      conversionFactor: k.valuePerUnit,
      impactKind: "recurring",
      recurringInterval: "yearly",
      createdBy: ADMIN,
    };
  });
  await prisma.goalEpicLink.createMany({ data: goalLinkRows });

  // Dichte Check-in-Historie für MEHRERE Ziele.
  const checkinRows: Prisma.GoalCheckinCreateManyInput[] = [];
  const checkinPlan: { obj: string; series: number[]; statuses: string[] }[] = [
    {
      obj: gManual,
      series: [42, 44, 47, 49, 52],
      statuses: ["on_track", "on_track", "at_risk", "on_track", "on_track"],
    },
    {
      obj: gCIR,
      series: [68, 66, 65, 64, 63],
      statuses: ["at_risk", "at_risk", "on_track", "at_risk", "at_risk"],
    },
    {
      obj: gDigital,
      series: [55, 59, 62, 65, 68],
      statuses: ["on_track", "on_track", "on_track", "on_track", "on_track"],
    },
    {
      obj: gRollupK2,
      series: [60, 63, 66, 68, 70],
      statuses: ["at_risk", "at_risk", "on_track", "at_risk", "at_risk"],
    },
  ];
  checkinPlan.forEach((p, pi) => {
    const span = 4;
    p.series.forEach((value, i) => {
      checkinRows.push({
        id: uid(`ci:${pi}:${i}`),
        tenantId,
        objectiveId: p.obj,
        status: p.statuses[i]!,
        value,
        progress: Number((i / (p.series.length - 1)).toFixed(2)),
        ...(i % 2 === 0 ? { note: `Fortschritts-Update #${i + 1}` } : {}),
        createdAt: addDays(now, -span * 15 * (p.series.length - 1 - i) - 3),
        createdBy: U.portfolio,
      });
    });
  });
  await prisma.goalCheckin.createMany({ data: checkinRows });

  // Kommentare (Aktivitäts-Feed)
  await prisma.goalComment.createMany({
    data: [
      {
        id: uid("gc:1"),
        tenantId,
        objectiveId: gTatParent,
        body: "Sieht gut aus für das Quartalsende — TAT-Kurve zieht an.",
        createdAt: addDays(now, -4),
        createdBy: U.owner,
      },
      {
        id: uid("gc:2"),
        tenantId,
        objectiveId: gRollup,
        body: "Erstlösungsquote braucht Unterstützung vom Contact-Center-ART.",
        createdAt: addDays(now, -2),
        createdBy: U.portfolio,
      },
      {
        id: uid("gc:3"),
        tenantId,
        objectiveId: gCIR,
        body: "Kostenseite hängt an der Cloud-Migration — abhängig von Enabler-Epic.",
        createdAt: addDays(now, -1),
        createdBy: U.vmo,
      },
    ],
  });

  // Related Work (Feature/PI-Referenzen)
  await prisma.goalRelatedWork.createMany({
    data: [
      {
        id: uid("grw:1"),
        tenantId,
        objectiveId: gTatChild,
        kind: "feature",
        refId: featureIdsByEpic[0]![0]!,
        createdBy: ADMIN,
      },
      {
        id: uid("grw:2"),
        tenantId,
        objectiveId: gVs[1]!,
        kind: "pi",
        refId: activePi,
        createdBy: ADMIN,
      },
      {
        id: uid("grw:3"),
        tenantId,
        objectiveId: gDigital,
        kind: "feature",
        refId: featureIdsByEpic[3]![0]!,
        createdBy: ADMIN,
      },
    ],
  });

  // VS-/ART-Verantwortungs-Links
  await prisma.goalValueStreamLink.createMany({
    data: [
      {
        id: uid("gvsl:1"),
        tenantId,
        objectiveId: gTatParent,
        valueStreamId: vsIds[0]!,
        createdBy: ADMIN,
      },
      {
        id: uid("gvsl:2"),
        tenantId,
        objectiveId: gVs[1]!,
        valueStreamId: vsIds[1]!,
        createdBy: ADMIN,
      },
      {
        id: uid("gvsl:3"),
        tenantId,
        objectiveId: gRollup,
        valueStreamId: vsIds[2]!,
        createdBy: ADMIN,
      },
    ],
  });
  await prisma.goalArtLink.createMany({
    data: [
      { id: uid("gal:1"), tenantId, objectiveId: gTatChild, artId: artIds[0]!, createdBy: ADMIN },
      { id: uid("gal:2"), tenantId, objectiveId: gRollupK2, artId: artIds[5]!, createdBy: ADMIN },
    ],
  });

  // Custom-Field-Werte für die MEISTEN Ziele.
  const prioObjectives = [
    gManual,
    gCIR,
    gDigital,
    gRollup,
    gRollupK1,
    gRollupK2,
    gPortfolio,
    gVs[0]!,
    gVs[1]!,
    gVs[2]!,
    gTatParent,
    gTatChild,
    ...closedIds,
  ];
  const prioValues = ["Hoch", "Mittel", "Niedrig"];
  const cfvRows: Prisma.GoalCustomFieldValueCreateManyInput[] = [];
  prioObjectives.forEach((objId, i) => {
    cfvRows.push({
      id: uid(`cfv:prio:${i}`),
      tenantId,
      defId: cfSelect,
      objectiveId: objId,
      value: prioValues[i % prioValues.length]!,
      createdBy: ADMIN,
      updatedBy: ADMIN,
    });
    if (i % 3 === 0) {
      cfvRows.push({
        id: uid(`cfv:konf:${i}`),
        tenantId,
        defId: cfNumber,
        objectiveId: objId,
        value: String(60 + (i % 4) * 10),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  });
  await prisma.goalCustomFieldValue.createMany({ data: cfvRows });

  // ── Phase 8: Approvals, Audit, Anfragen, Setup, Transformation ────────────
  console.log("\n── Workflow + Admin-Inbox");
  // EpicApprovals über VIELE Epics; Parteien auf die richtigen Seed-User mappen,
  // damit /my-approvals für portfolio/vmo/finance/owner/rte füllt.
  const partyApprover: Record<string, string> = {
    mgmt: U.portfolio,
    business_owner: U.owner,
    finance: U.fo,
    irt_owner: U.rte,
    lace_vmo: U.vmo,
  };
  const PARTIES = ["mgmt", "business_owner", "finance", "irt_owner", "lace_vmo"];
  const approvalRows: Prisma.EpicApprovalCreateManyInput[] = [];
  epicIds.slice(0, 12).forEach((epicId, i) => {
    const party = PARTIES[i % PARTIES.length]!;
    // Mehrheit pending (Inbox füllt), einige entschieden.
    const status = i % 4 === 3 ? "approved" : i % 4 === 2 ? "rejected" : "pending";
    approvalRows.push({
      id: uid(`appr:party:${i}`),
      tenantId,
      initiativeId: epicId,
      kind: "party",
      party,
      approverUserId: partyApprover[party]!,
      status,
      ...(status !== "pending"
        ? {
            decidedAt: addDays(now, -2 - (i % 3)),
            comment: status === "approved" ? "Freigegeben." : "Bitte Business Case nachschärfen.",
          }
        : {}),
      createdBy: ADMIN,
    });
    // Zusätzlich Section-Reviews auf einigen Epics (breakdown/kpis).
    if (i % 2 === 0) {
      approvalRows.push({
        id: uid(`appr:section:${i}`),
        tenantId,
        initiativeId: epicId,
        kind: "section",
        section: i % 4 === 0 ? "breakdown" : "kpis",
        approverUserId: U.owner,
        status: i % 3 === 0 ? "pending" : "approved",
        ...(i % 3 !== 0 ? { decidedAt: addDays(now, -1) } : {}),
        createdBy: ADMIN,
      });
    }
  });
  await prisma.epicApproval.createMany({ data: approvalRows });

  // Tenant-Invite + Join-Requests (admin/anfragen)
  await prisma.tenantInvite.create({
    data: {
      id: uid("invite:1"),
      tenantId,
      linkToken: uid("token:link"),
      joinCode: "PULSE-DEMO",
      autoAccept: false,
      active: true,
      createdBy: ADMIN,
    },
  });
  await prisma.tenantJoinRequest.createMany({
    data: [
      {
        id: uid("jr:1"),
        tenantId,
        email: "neuer.kollege@example.com",
        via: "link",
        status: "pending",
        createdAt: addDays(now, -1),
      },
      {
        id: uid("jr:2"),
        tenantId,
        email: "gast@example.com",
        via: "code",
        status: "pending",
        createdAt: addDays(now, -3),
      },
    ],
  });

  // Audit-Log (~48 Events, rotierend, echte Actor-/Resource-Ids).
  const AUDIT_ACTIONS = [
    ["initiative.create", "initiative"],
    ["initiative.update", "initiative"],
    ["epic.approve", "initiative"],
    ["goal.checkin", "objective"],
    ["goal.update", "objective"],
    ["budget.allocate", "budget_allocation"],
    ["issue.raise", "issue"],
    ["issue.roam", "issue"],
    ["pi.plan", "program_increment"],
    ["kpi.update", "kpi"],
  ] as const;
  const actors = [U.admin, U.portfolio, U.owner, U.rte, U.vmo, U.fo];
  const auditTargets = [
    ...epicIds,
    gTatParent,
    gManual,
    gCIR,
    activePi,
    issueIdByKey["reg"]!,
    issueIdByKey["sec"]!,
  ];
  await prisma.auditEvent.createMany({
    data: Array.from({ length: 48 }, (_, i) => {
      const [action, resourceType] = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]!;
      return {
        id: uid(`audit:${i}`),
        tenantId,
        occurredAt: addDays(now, -i),
        actorId: actors[i % actors.length]!,
        action,
        resourceType,
        resourceId: auditTargets[i % auditTargets.length]!,
        changes: { note: `Geseedetes Audit-Event #${i}`, field: resourceType },
      };
    }),
  });

  // Setup-Progress (ALLE Checks erledigt).
  const SETUP_CHECKS = [
    "m1-1",
    "m1-2",
    "m1-3",
    "m2-1",
    "m2-2",
    "m2-3",
    "m3-1",
    "m3-2",
    "m3-3",
    "m4-1",
    "m4-2",
    "m4-3",
    "m5-legacy-1",
    "m5-legacy-2",
    "m5-legacy-3",
    "m6-1",
    "m6-2",
    "m6-3",
    "m7-1",
    "m7-2",
    "m7-3",
    "m8-1",
    "m8-2",
    "m8-3",
  ];
  await prisma.setupProgress.createMany({
    data: SETUP_CHECKS.map((checkId, i) => ({
      id: uid(`setup:${checkId}`),
      tenantId,
      checkId,
      updatedBy: ADMIN,
      updatedAt: addDays(now, -30 + i),
    })),
    skipDuplicates: true,
  });

  // Target Operating Model + Transformation-Actions
  await prisma.targetOperatingModel.create({
    data: {
      id: uid("tom:1"),
      tenantId,
      status: "active",
      template: "portfolio_safe",
      targetValueStreams: 3,
      targetArtsTotal: 6,
      targetTeamsTotal: 18,
      targetPiCadenceWeeks: 10,
      createdBy: ADMIN,
      updatedBy: ADMIN,
    },
  });
  await prisma.transformationAction.createMany({
    data: [
      {
        id: uid("ta:1"),
        tenantId,
        title: "PI-Planning-Kadenz konzernweit vereinheitlichen",
        status: "in_progress",
        ownerId: U.transformation,
        dueDate: addDays(now, 30),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("ta:2"),
        tenantId,
        title: "WSJF-Schulung für alle Feature Owner",
        status: "open",
        ownerId: U.rte,
        dueDate: addDays(now, 60),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("ta:3"),
        tenantId,
        title: "Value-Stream-Mapping Workshop",
        status: "done",
        ownerId: U.portfolio,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("ta:4"),
        tenantId,
        title: "Lean-Budget-Guardrails etablieren",
        status: "in_progress",
        ownerId: U.vmo,
        dueDate: addDays(now, 45),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("ta:5"),
        tenantId,
        title: "Cloud-Migrations-Runway priorisieren",
        status: "open",
        ownerId: U.transformation,
        dueDate: addDays(now, 90),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });

  // SavedPortfolioFilter ×2 (benannte Views, user-scoped → admin).
  await prisma.savedPortfolioFilter.createMany({
    data: [
      {
        id: uid("spf:1"),
        tenantId,
        userId: U.admin,
        name: "Steuerungs-Kandidaten",
        criteria: { status: ["approved"], gate: ["L2", "L3"], vs: [vsIds[0]!], owner: [] },
        isDefault: true,
      },
      {
        id: uid("spf:2"),
        tenantId,
        userId: U.admin,
        name: "In Umsetzung (L4)",
        criteria: { status: ["in_progress"], gate: ["L4"], vs: [], owner: [U.owner] },
        isDefault: false,
      },
    ],
  });

  console.log("\n✅ Demo-Seed fertig.\n");
}

// ── Kleine Helfer ───────────────────────────────────────────────────────────
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Simuliert eine KPI-Messreihe als Monatspunkte von `monthsBack` Monaten in der
 * Vergangenheit bis heute: monoton von `baseline` Richtung Ist
 * (`baseline + fraction·(target−baseline)`), richtungs-bewusst, mit kleiner
 * **deterministischer** Streuung (kein Random). `endExact` fixiert den letzten Wert.
 */
function simulateSeries(
  baseline: number,
  target: number,
  opts: { monthsBack?: number; fraction: number; seed: number; endExact?: number },
): { date: string; value: number }[] {
  const months = opts.monthsBack ?? 9;
  const dir = target >= baseline ? 1 : -1;
  const span = Math.abs(target - baseline);
  const finalDelta = span * opts.fraction; // erreichter Fortschritt (Betrag)
  const decimals = span < 20 ? 1 : 0;
  const round = (v: number): number => Number(v.toFixed(decimals));
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i <= months; i++) {
    const t = months === 0 ? 1 : i / months; // 0..1
    // leichte S-Kurve für Realismus + deterministische Streuung
    const eased = t * t * (3 - 2 * t);
    // Kein Jitter am ersten/letzten Punkt (exakter Start = Baseline, klares Ende).
    const jitter = i === 0 || i === months ? 0 : Math.sin(opts.seed + i * 1.7) * finalDelta * 0.06;
    const magnitude = Math.min(finalDelta, Math.max(0, eased * finalDelta + jitter));
    const value =
      i === months && opts.endExact != null ? opts.endExact : baseline + dir * magnitude;
    out.push({ date: isoDate(addDays(now, -30 * (months - i))), value: round(value) });
  }
  return out;
}

/**
 * Baut ein Revisions-Payload über den ECHTEN Domain-Builder statt von Hand.
 * Vorher stand hier eine handgeschriebene Kopie der Snapshot-Form — ohne
 * `cycleBudgetSum`/`followBudgetSum`/`loadBacklog` und mit einem abweichenden
 * `cycleLabel`. Sie konnte von `BudgetPlanSnapshot` wegdriften, ohne dass etwas
 * auffiel; jetzt ist der Seed an denselben Vertrag gebunden wie der Capture.
 */
function buildSnapshotPayload(input: {
  cycleKey: string;
  capturedAt: Date;
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
    pool: { [input.cycleKey]: 2_000_000 },
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
