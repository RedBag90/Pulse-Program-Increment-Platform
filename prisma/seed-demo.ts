/* eslint-disable no-console */
/**
 * Pulse Demo-Seed — großer, deterministischer Datensatz, der JEDE Funktion
 * durchklickbar macht (Portfolio, Programm, Controlling, Reporting, Roadmap,
 * Ziele inkl. aller 4 Fortschrittsquellen, Admin, my-approvals/my-tasks).
 *
 * Wischt die Domain-Daten von „Pulse Demo Corp" und baut alles frisch auf.
 * Ids sind deterministisch (`uid(key)`), Datumswerte relativ zu heute.
 *
 * Run: `pnpm db:seed:demo`  (lädt `.env.local` selbst; braucht DIRECT_URL)
 */

import type { Prisma } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
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

async function main() {
  console.log("\n🌱  Pulse DEMO-Seed startet (großer Datensatz)\n");

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
  // Struktur-IDs vorab (für Scopes referenzierbar)
  const vsIds = [uid("vs:digital-banking"), uid("vs:payments"), uid("vs:cx")];
  const artIds = [
    uid("art:onlinebanking"),
    uid("art:mobile"),
    uid("art:cards"),
    uid("art:sepa"),
    uid("art:web-cx"),
    uid("art:contact-center"),
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

  // ── Phase 3: Struktur-Spine ───────────────────────────────────────────────
  console.log("\n── Struktur (VS → ART → Team, Timeline, PIs)");
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
      piCount: 4,
      createdBy: ADMIN,
    },
  });

  const vsNames = ["Digital Banking", "Payments Platform", "Customer Experience"];
  await prisma.valueStream.createMany({
    data: vsNames.map((name, i) => ({
      id: vsIds[i]!,
      tenantId,
      name,
      description: `Wertstrom ${name}`,
      budgetAmount: [3_000_000, 2_400_000, 1_600_000][i]!,
      budgetCurrency: "EUR",
      financeApproverId: U.portfolio,
      vmoId: U.vmo,
    })),
  });

  const artNames = [
    "Onlinebanking ART",
    "Mobile ART",
    "Card Payments ART",
    "SEPA ART",
    "Web CX ART",
    "Contact-Center ART",
  ];
  await prisma.art.createMany({
    data: artNames.map((name, i) => ({
      id: artIds[i]!,
      tenantId,
      valueStreamId: vsIds[Math.floor(i / 2)]!,
      name,
      description: `${name} — Release Train`,
      rteId: U.rte,
      timelineId,
    })),
  });

  // PIs auf der Timeline (2 completed, 1 active, 1 planned)
  const piBase = addDays(now, -21);
  const piSpecs = [
    { key: "pi1", name: "PI 1", start: addDays(piBase, -140), status: "completed" },
    { key: "pi2", name: "PI 2", start: addDays(piBase, -70), status: "completed" },
    { key: "pi3", name: "PI 3", start: piBase, status: "active" },
    { key: "pi4", name: "PI 4", start: addDays(piBase, 70), status: "planned" },
  ];
  const piIds: Record<string, string> = {};
  for (const p of piSpecs) piIds[p.key] = uid(`pi:${p.key}`);
  await prisma.programIncrement.createMany({
    data: piSpecs.map((p) => ({
      id: piIds[p.key]!,
      tenantId,
      timelineId,
      artId: artIds[0]!,
      name: p.name,
      startDate: p.start,
      endDate: addDays(p.start, 69),
      status: p.status,
      capacityJobSize: 120,
      capacityAmount: 900_000,
      ...(p.status === "completed"
        ? { systemDemoAt: addDays(p.start, 68), inspectAdaptAt: addDays(p.start, 69) }
        : {}),
    })),
  });
  const activePi = piIds["pi3"]!;
  const prevPi = piIds["pi2"]!;

  // ── Phase 4: Initiatives (Epics + Features) ───────────────────────────────
  console.log("\n── Delivery (Epics + Features)");
  const STAGE_GATES = ["L0", "L1", "L2", "L3", "L4", "L5"];
  const EPIC_STATUS = ["draft", "active", "active", "active", "done"];
  const EPIC_TYPES = ["epic", "enabler", "solution"];
  const HORIZONS = ["H1", "H2", "H3"];

  const epicTitles = [
    "Optimieren der vorhandenen Netzpläne", // idx 0 = TAT-Epic (kpi_tree)
    "Instant-Payments Rollout",
    "Mobile Onboarding Redesign",
    "SEPA-Request-to-Pay",
    "Self-Service Portal 2.0",
    "Betrugserkennung ML",
    "Open-Banking APIs",
    "Karten-Tokenization",
    "Contact-Center KI-Assist",
    "Datenplattform Konsolidierung",
    "Cloud-Migration Kernbanken",
    "Nachhaltigkeits-Reporting",
    "Kredit-Entscheidung Automatisierung",
    "Omnichannel Notifications",
    "Identity & KYC Modernisierung",
    "Zahlungsverkehr Observability",
    "Wealth-Management Cockpit",
    "Regulatorik-Automatisierung",
  ];

  const epicIds = epicTitles.map((_, i) => uid(`epic:${i}`));
  const epicRows: Prisma.InitiativeCreateManyInput[] = epicTitles.map((title, i) => {
    const start = addDays(now, -120 + i * 20);
    return {
      id: epicIds[i]!,
      tenantId,
      level: 0,
      path: epicIds[i]!,
      title,
      description: `Epic: ${title}`,
      ownerId: i % 3 === 0 ? U.owner : i % 3 === 1 ? U.portfolio : null,
      assigneeIds: i % 2 === 0 ? [U.owner] : [],
      valueStreamId: vsIds[i % 3]!,
      stageGate: STAGE_GATES[i % STAGE_GATES.length]!,
      status: EPIC_STATUS[i % EPIC_STATUS.length]!,
      epicType: EPIC_TYPES[i % EPIC_TYPES.length]!,
      investmentHorizon: HORIZONS[i % HORIZONS.length]!,
      needsSteeringAttention: i % 5 === 0,
      stagedForBudgeting: i % 4 === 0,
      plannedStartAt: start,
      plannedEndAt: addDays(start, 120),
      benefitHypothesis: {
        measuresHypothesis: `Durch „${title}" verbessern wir das Ergebnis messbar.`,
        changeFromBaseline: "Signifikante Verbesserung ggü. Startpunkt.",
        businessOutcomes: ["Höhere Effizienz", "Bessere Kundenerfahrung"],
        leadingIndicators: ["Adoption-Rate", "Durchlaufzeit"],
        risks: ["Abhängigkeit von Legacy-System"],
      },
      ...(i % 3 === 0
        ? {
            businessCase: {
              costSlices: [{ period: H1, amount: 120_000 + i * 5_000 }],
              assumptions: "Standard-Annahmen für das Business Case.",
            },
          }
        : {}),
      ...(i % 4 === 0 ? { approvalPhase: "hypothesis_review" } : {}),
      createdBy: ADMIN,
      updatedBy: ADMIN,
    };
  });
  await prisma.initiative.createMany({ data: epicRows });

  // Features (2–3 pro Epic), WSJF-Spread, Owner/Assignees = echte User
  const FEATURE_STATUS = ["draft", "in_progress", "in_progress", "completed"];
  const FEATURE_TYPES = ["feature", "enabler"];
  const featureRows: Prisma.InitiativeCreateManyInput[] = [];
  const featureIdsByEpic: Record<number, string[]> = {};
  epicIds.forEach((epicId, ei) => {
    const count = 2 + (ei % 2); // 2 oder 3
    featureIdsByEpic[ei] = [];
    for (let f = 0; f < count; f++) {
      const fid = uid(`feat:${ei}:${f}`);
      featureIdsByEpic[ei]!.push(fid);
      const bv = 3 + ((ei + f) % 8);
      const tc = 2 + ((ei * 2 + f) % 7);
      const rr = 1 + ((ei + f * 2) % 6);
      const js = 2 + ((ei + f) % 9);
      const wsjf = Number((((bv + tc + rr) / js) as number).toFixed(2));
      const status = FEATURE_STATUS[(ei + f) % FEATURE_STATUS.length]!;
      const pi = f === 0 ? activePi : (ei + f) % 3 === 0 ? piIds["pi4"]! : activePi;
      const start = addDays(now, -30 + f * 15);
      featureRows.push({
        id: fid,
        tenantId,
        level: 1,
        parentId: epicId,
        path: `${epicId}/${fid}`,
        title: `${epicTitles[ei]} — Feature ${f + 1}`,
        description: "Feature-Beschreibung.",
        ownerId: (ei + f) % 2 === 0 ? U.owner : U.fo,
        assigneeIds: [U.owner, U.fo].slice(0, ((ei + f) % 2) + 1),
        artId: artIds[ei % artIds.length]!,
        piId: status === "completed" ? prevPi : pi,
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: wsjf,
        featureType: FEATURE_TYPES[(ei + f) % FEATURE_TYPES.length]!,
        stageGate: "L3",
        status,
        completedAt: status === "completed" ? addDays(now, -10) : null,
        plannedStartAt: start,
        plannedEndAt: addDays(start, 40),
        acceptanceCriteria: ["Kriterium A erfüllt", "Kriterium B erfüllt"],
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  });
  await prisma.initiative.createMany({ data: featureRows });
  console.log(`  ✓ ${epicIds.length} Epics + ${featureRows.length} Features`);

  // Netzplan-Positionen für das erste Epic
  await prisma.initiativeGraphPosition.createMany({
    data: (featureIdsByEpic[0] ?? []).map((fid, k) => ({
      id: uid(`pos:${fid}`),
      tenantId,
      epicId: epicIds[0]!,
      initiativeId: fid,
      x: 120 + k * 220,
      y: 80,
      updatedBy: ADMIN,
    })),
  });

  // ── Phase 5: KPIs (mit Zeitreihen-Simulation) + Budgets ───────────────────
  console.log("\n── KPIs + Budgets");
  const kpiNetzplaeneId = uid("kpi:netzplaene");
  const kpiRows: Prisma.KpiCreateManyInput[] = [];
  // Primär-KPI je Epic (treibt später die Ziel-Bindung) — Index = Epic-Index.
  const epicPrimaryKpi: { id: string; valuePerUnit: number; baseline: number; target: number }[] =
    [];

  // Epic 0: TAT-KPI fest verdrahtet — Verlauf 0→50 über Monate, letzter Wert exakt 50.
  kpiRows.push({
    id: kpiNetzplaeneId,
    tenantId,
    initiativeId: epicIds[0]!,
    name: "Überarbeitete Netzpläne",
    unit: "Netzpläne",
    baseline: 0,
    target: 100,
    measurements: simulateSeries(0, 100, { monthsBack: 9, fraction: 0.5, seed: 1, endExact: 50 }),
    valuePerUnit: 8_000,
    benefitKind: "recurring",
    recurringInterval: "yearly",
    calculationNote: "Jeder überarbeitete Netzplan reduziert die TAT um 0,5 Tage.",
    createdBy: ADMIN,
    updatedBy: ADMIN,
  });
  epicPrimaryKpi[0] = { id: kpiNetzplaeneId, valuePerUnit: 8_000, baseline: 0, target: 100 };

  // Weitere KPIs je Epic (1–2), jeweils mit simulierter Monats-Zeitreihe.
  epicIds.forEach((epicId, ei) => {
    const k = 1 + (ei % 2);
    for (let j = 0; j < k; j++) {
      if (ei === 0 && j === 0) continue; // TAT-KPI bereits gesetzt
      const base = 100 + ei * 10;
      const tgt = base + 50 + j * 20;
      const valuePerUnit = 1_500 + ei * 100;
      const fraction = 0.35 + ((ei * 3 + j) % 5) * 0.1; // 0.35 … 0.75
      kpiRows.push({
        id: uid(`kpi:${ei}:${j}`),
        tenantId,
        initiativeId: epicId,
        name: ["Durchlaufzeit", "NPS", "Automatisierungsgrad", "Fehlerquote"][(ei + j) % 4]!,
        unit: ["Tage", "Punkte", "%", "ppm"][(ei + j) % 4]!,
        baseline: base,
        target: tgt,
        measurements: simulateSeries(base, tgt, { monthsBack: 9, fraction, seed: ei * 7 + j }),
        valuePerUnit,
        benefitKind: j % 2 === 0 ? "recurring" : "one_time",
        recurringInterval: j % 2 === 0 ? "yearly" : "monthly",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
      if (j === 0)
        epicPrimaryKpi[ei] = {
          id: uid(`kpi:${ei}:${j}`),
          valuePerUnit,
          baseline: base,
          target: tgt,
        };
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
  // BudgetPlanRevision-Snapshot (gültiges Payload)
  await prisma.budgetPlanRevision.create({
    data: {
      id: uid(`bprev:${H1}`),
      tenantId,
      cycleKey: H1,
      capturedBy: ADMIN,
      payload: buildSnapshotPayload({
        cycleKey: H1,
        epics: epicIds.slice(0, 6).map((epicId, i) => ({
          epicId,
          title: epicTitles[i]!,
          valueStreamId: vsIds[i % 3]!,
          valueStreamName: vsNames[i % 3]!,
          priority: i,
          alloc: 80_000 + i * 6_000,
        })),
        valueStreams: vsIds.map((id, i) => ({
          id,
          name: vsNames[i]!,
          amount: 240_000 + i * 40_000,
        })),
        arts: artIds.map((id, i) => ({ id, name: artNames[i]!, amount: 400_000 + i * 30_000 })),
      }),
    },
  });

  // ── Phase 6: Dependencies, Impediments, System-Demos ───────
  console.log("\n── Programm-Inhalt (Deps, Impediments, Demos)");

  // Dependencies zwischen Features (Typen rotieren, unique from/to/type)
  const allFeatureIds = featureRows.map((f) => f.id as string);
  const DEP_TYPES = ["blocks", "depends_on", "relates_to"];
  const depRows: {
    id: string;
    tenantId: string;
    fromId: string;
    toId: string;
    type: string;
    createdBy: string;
  }[] = [];
  for (let i = 0; i < 24 && i + 3 < allFeatureIds.length; i++) {
    const fromId = allFeatureIds[i]!;
    const toId = allFeatureIds[(i * 3 + 5) % allFeatureIds.length]!;
    if (fromId === toId) continue;
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

  // Impediments (Severity/Status/ROAM-Spread)
  const SEV = ["low", "medium", "high", "critical"];
  const IMP_STATUS = ["open", "escalated", "resolved"];
  const ROAM = ["open", "owned", "accepted", "mitigated", "resolved"];
  await prisma.impediment.createMany({
    data: Array.from({ length: 14 }, (_, i) => {
      const status = IMP_STATUS[i % IMP_STATUS.length]!;
      return {
        id: uid(`imp:${i}`),
        tenantId,
        artId: artIds[i % artIds.length]!,
        piId: i % 2 === 0 ? activePi : null,
        title: `Impediment ${i + 1}: ${["Abhängigkeit blockiert", "Umgebung instabil", "Wissenslücke", "Externe Freigabe fehlt"][i % 4]}`,
        description: "Details zum Hindernis.",
        severity: SEV[i % SEV.length]!,
        status,
        roamStatus: ROAM[i % ROAM.length]!,
        raisedBy: U.rte,
        ...(status === "resolved"
          ? { resolvedAt: addDays(now, -3), resolvedBy: U.rte, resolution: "Behoben." }
          : {}),
      };
    }),
  });

  // System-Demos (aktiv + vorher)
  for (const [demoKey, piId] of [
    ["active", activePi],
    ["prev", prevPi],
  ] as const) {
    const demoId = uid(`demo:${demoKey}`);
    await prisma.systemDemo.create({
      data: {
        id: demoId,
        tenantId,
        piId,
        scheduledAt: addDays(now, demoKey === "active" ? 45 : -12),
        notes: "System Demo Agenda.",
        createdBy: ADMIN,
        items: {
          create: (featureIdsByEpic[0] ?? []).slice(0, 3).map((fid, k) => ({
            id: uid(`demoitem:${demoKey}:${k}`),
            tenantId,
            featureId: fid,
            title: `Demo-Item ${k + 1}`,
            ownerId: U.owner,
            presented: demoKey === "prev",
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
  await prisma.strategicTheme.createMany({
    data: [
      {
        id: themeBiz,
        tenantId,
        title: "Wachstum & Effizienz",
        kind: "business",
        color: "#6366f1",
        budgetPlanned: 6_000_000,
        ownerId: U.portfolio,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeEnabler,
        tenantId,
        title: "Technische Exzellenz",
        kind: "enabler",
        color: "#0ea5e9",
        budgetPlanned: 2_000_000,
        ownerId: U.vmo,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });

  // Custom Fields
  const cfSelect = uid("cf:prio");
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
        id: uid("cf:zielwert"),
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
  const grandchildren: Prisma.ObjectiveCreateManyInput[] = [];
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

  // (a) manual-Blatt (mit Check-in-Historie)
  const gManual = uid("goal:manual-nps");
  roots.push(
    objBase(gManual, themeBiz, "NPS auf 60 steigern", {
      progressMode: "manual",
      metricType: "number",
      metricUnit: "Punkte",
      baseline: 40,
      target: 60,
      current: 52,
      status: "on_track",
      period: `${YEAR}-H1`,
      ownerId: U.portfolio,
    }),
  );

  // (b) rollup-Ast mit 2 manual-Kindern
  const gRollup = uid("goal:rollup-kundenzufriedenheit");
  roots.push(
    objBase(gRollup, themeBiz, "Kundenzufriedenheit erhöhen", {
      progressMode: "rollup",
      status: "at_risk",
      period: `${YEAR}`,
      ownerId: U.portfolio,
    }),
  );
  children.push(
    objBase(uid("goal:rollup-k1"), themeBiz, "Beschwerdequote senken", {
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
    objBase(uid("goal:rollup-k2"), themeBiz, "Erstlösungsquote steigern", {
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

  // (c) Portfolio-Outcome-Baum: JEDES Epic realisiert genau eines dieser Ziele
  //     (werttreibend über seine Primär-KPI). gVS0 = auto_kpi (Demo), gVS1/2 =
  //     kpi_tree; alle drei sind €-Blätter unter dem kpi_tree-Ast gPortfolio.
  const gPortfolio = uid("goal:portfolio-value");
  const gVs = [uid("goal:vs0-value"), uid("goal:vs1-value"), uid("goal:vs2-value")];
  // Ziel-Target je VS = Σ realisierbarer € (|kpiΔ| × €/Einheit) der zugeordneten
  // Epics (Epic 0 zählt zu TAT, nicht zu gVS0).
  const vsTarget = [0, 0, 0];
  epicIds.forEach((_, ei) => {
    if (ei === 0) return; // TAT
    const k = epicPrimaryKpi[ei];
    if (!k) return;
    vsTarget[ei % 3]! += Math.abs(k.target - k.baseline) * k.valuePerUnit;
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

  // (d) kpi_tree — das TAT-Beispiel (€-Parent → Days-Kind → KPI Netzpläne)
  const gTatParent = uid("goal:tat-parent");
  const gTatChild = uid("goal:tat-child");
  roots.push(
    objBase(gTatParent, themeBiz, "TAT-Optimierung Wertbeitrag", {
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
    objBase(gTatChild, themeBiz, "TAT durch Netzplan-Optimierung senken", {
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

  // (e) geschlossene Ziele (Status-Abdeckung)
  const CLOSED = [
    ["achieved", "Zahlungsausfälle halbiert"],
    ["partial", "Onboarding-Zeit reduziert"],
    ["missed", "App-Store-Rating 4.8"],
    ["dropped", "Filial-Kiosk-Pilot"],
  ] as const;
  CLOSED.forEach(([status, title], i) => {
    roots.push(
      objBase(uid(`goal:closed:${i}`), i % 2 === 0 ? themeBiz : themeEnabler, title, {
        progressMode: "manual",
        metricType: "number",
        metricUnit: "%",
        baseline: 0,
        target: 100,
        current: status === "achieved" ? 100 : status === "partial" ? 60 : 30,
        status,
        closedAt: addDays(now, -20 + i),
        closingNote: "Quartals-Retrospektive abgeschlossen.",
        period: `${YEAR}-H1`,
      }),
    );
  });

  await prisma.objective.createMany({ data: roots });
  await prisma.objective.createMany({ data: children });
  if (grandchildren.length) await prisma.objective.createMany({ data: grandchildren });

  // GoalEpicLink: JEDES Epic realisiert genau EIN Ziel, werttreibend über seine
  // Primär-KPI. Epic 0 → TAT-Kind (Faktor 0,5); Epics 1–17 → VS-Outcome-Ziel
  // (conversionFactor = valuePerUnit ⇒ Beitrag = kpiΔ × €/Einheit = realisierter €).
  const goalLinkRows: Prisma.GoalEpicLinkCreateManyInput[] = epicIds.map((epicId, ei) => {
    if (ei === 0) {
      return {
        id: uid("gel:0"),
        tenantId,
        objectiveId: gTatChild,
        epicId,
        kpiId: kpiNetzplaeneId,
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
      objectiveId: gVs[ei % 3]!,
      epicId,
      kpiId: k.id,
      conversionFactor: k.valuePerUnit, // € je 1 KPI-Einheit
      impactKind: "recurring",
      recurringInterval: "yearly",
      createdBy: ADMIN,
    };
  });
  await prisma.goalEpicLink.createMany({ data: goalLinkRows });

  // Check-in-Historie (manual-Ziel → Verlaufschart)
  await prisma.goalCheckin.createMany({
    data: [
      {
        id: uid("ci:1"),
        tenantId,
        objectiveId: gManual,
        status: "on_track",
        value: 44,
        progress: 0.2,
        note: "Guter Start",
        createdAt: addDays(now, -60),
        createdBy: U.portfolio,
      },
      {
        id: uid("ci:2"),
        tenantId,
        objectiveId: gManual,
        status: "on_track",
        value: 48,
        progress: 0.4,
        createdAt: addDays(now, -30),
        createdBy: U.portfolio,
      },
      {
        id: uid("ci:3"),
        tenantId,
        objectiveId: gManual,
        status: "on_track",
        value: 52,
        progress: 0.6,
        note: "Auf Kurs",
        createdAt: addDays(now, -5),
        createdBy: U.portfolio,
      },
    ],
  });

  // Kommentare, Related Work, VS/ART-Links, Custom-Field-Werte
  await prisma.goalComment.createMany({
    data: [
      {
        id: uid("gc:1"),
        tenantId,
        objectiveId: gTatParent,
        body: "Sieht gut aus für Q-Ende.",
        createdAt: addDays(now, -4),
        createdBy: U.owner,
      },
      {
        id: uid("gc:2"),
        tenantId,
        objectiveId: gRollup,
        body: "Kind 2 braucht Unterstützung.",
        createdAt: addDays(now, -2),
        createdBy: U.portfolio,
      },
    ],
  });
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
    ],
  });
  await prisma.goalValueStreamLink.createMany({
    data: [
      {
        id: uid("gvsl:1"),
        tenantId,
        objectiveId: gTatParent,
        valueStreamId: vsIds[0]!,
        createdBy: ADMIN,
      },
    ],
  });
  await prisma.goalArtLink.createMany({
    data: [
      { id: uid("gal:1"), tenantId, objectiveId: gTatChild, artId: artIds[0]!, createdBy: ADMIN },
    ],
  });
  await prisma.goalCustomFieldValue.createMany({
    data: [
      {
        id: uid("cfv:1"),
        tenantId,
        defId: cfSelect,
        objectiveId: gTatParent,
        value: "Hoch",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("cfv:2"),
        tenantId,
        defId: uid("cf:zielwert"),
        objectiveId: gManual,
        value: "80",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });

  // ── Phase 8: Approvals, Audit, Anfragen, Setup, Transformation ────────────
  console.log("\n── Workflow + Admin-Inbox");
  // EpicApprovals: einige pending & dem eingeloggten User zugewiesen (my-approvals)
  const approvalRows: {
    id: string;
    tenantId: string;
    initiativeId: string;
    kind: string;
    party?: string;
    section?: string;
    approverUserId: string;
    status: string;
    createdBy: string;
    decidedAt?: Date;
    comment?: string;
  }[] = [];
  const PARTIES = ["mgmt", "business_owner", "finance", "irt_owner", "lace_vmo"];
  epicIds.slice(0, 6).forEach((epicId, i) => {
    approvalRows.push({
      id: uid(`appr:party:${i}`),
      tenantId,
      initiativeId: epicId,
      kind: "party",
      party: PARTIES[i % PARTIES.length]!,
      approverUserId: i % 2 === 0 ? U.admin : U.owner,
      status: i < 3 ? "pending" : i === 3 ? "approved" : "rejected",
      ...(i >= 3
        ? { decidedAt: addDays(now, -2), comment: i === 3 ? "OK" : "Bitte nachbessern" }
        : {}),
      createdBy: ADMIN,
    });
    approvalRows.push({
      id: uid(`appr:section:${i}`),
      tenantId,
      initiativeId: epicId,
      kind: "section",
      section: i % 2 === 0 ? "breakdown" : "kpis",
      approverUserId: U.owner,
      status: i < 2 ? "pending" : "approved",
      ...(i >= 2 ? { decidedAt: addDays(now, -1) } : {}),
      createdBy: ADMIN,
    });
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
        createdAt: now,
      },
    ],
  });

  // Audit-Log (~30 Events, echte Actor-/Resource-Ids)
  const AUDIT_ACTIONS = [
    ["initiative.create", "initiative"],
    ["initiative.update", "initiative"],
    ["epic.approve", "initiative"],
    ["goal.checkin", "objective"],
    ["goal.update", "objective"],
    ["budget.allocate", "budget_allocation"],
    ["impediment.raise", "impediment"],
    ["pi.plan", "program_increment"],
  ] as const;
  const actors = [U.admin, U.portfolio, U.owner, U.rte, U.vmo];
  const auditTargets = [...epicIds, gTatParent, gManual, activePi];
  await prisma.auditEvent.createMany({
    data: Array.from({ length: 30 }, (_, i) => {
      const [action, resourceType] = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]!;
      return {
        id: uid(`audit:${i}`),
        tenantId,
        occurredAt: addDays(now, -i),
        actorId: actors[i % actors.length]!,
        action,
        resourceType,
        resourceId: auditTargets[i % auditTargets.length]!,
        changes: { note: `Automatisch geseedetes Event #${i}` },
      };
    }),
  });

  // Setup-Progress (Mix erledigt)
  await prisma.setupProgress.createMany({
    data: ["value-streams", "arts", "teams", "first-pi"].map((checkId, i) => ({
      id: uid(`setup:${checkId}`),
      tenantId,
      checkId,
      updatedBy: ADMIN,
      updatedAt: addDays(now, -10 + i),
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
      targetTeamsTotal: 15,
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
        title: "PI-Planning-Kadenz vereinheitlichen",
        status: "in_progress",
        ownerId: U.transformation,
        dueDate: addDays(now, 30),
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: uid("ta:2"),
        tenantId,
        title: "WSJF-Schulung für Feature Owner",
        status: "open",
        ownerId: U.rte,
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

/** Baut ein gültiges BudgetPlanSnapshot-Payload (deterministisch, minimal). */
function buildSnapshotPayload(input: {
  cycleKey: string;
  epics: {
    epicId: string;
    title: string;
    valueStreamId: string;
    valueStreamName: string;
    priority: number;
    alloc: number;
  }[];
  valueStreams: { id: string; name: string; amount: number }[];
  arts: { id: string; name: string; amount: number }[];
}): Prisma.InputJsonValue {
  const periodTotal =
    input.epics.reduce((s, e) => s + e.alloc, 0) + input.arts.reduce((s, a) => s + a.amount, 0);
  return {
    cycleKey: input.cycleKey,
    cycleLabel: input.cycleKey.replace("-", " "),
    capturedAt: new Date().toISOString(),
    periods: [{ key: input.cycleKey, label: input.cycleKey.replace("-", " "), total: periodTotal }],
    budgetPoolByPeriod: { [input.cycleKey]: 2_000_000 },
    epics: input.epics.map((e) => ({
      epicId: e.epicId,
      title: e.title,
      valueStreamId: e.valueStreamId,
      valueStreamName: e.valueStreamName,
      priority: e.priority,
      allocations: { [input.cycleKey]: e.alloc },
      total: e.alloc,
      cycleBudget: e.alloc,
      cycleFeatures: [],
    })),
    valueStreams: input.valueStreams.map((v) => ({
      valueStreamId: v.id,
      name: v.name,
      byPeriod: { [input.cycleKey]: v.amount },
      total: v.amount,
    })),
    arts: input.arts.map((a) => ({
      artId: a.id,
      name: a.name,
      budgetByPeriod: { [input.cycleKey]: a.amount },
      loadByPeriod: { [input.cycleKey]: { featureCount: 3, jobSizeSum: 18 } },
    })),
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
