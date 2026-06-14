/* eslint-disable no-console */
/**
 * Development seed — the canonical demo dataset.
 *
 * Wipes all domain data for the demo tenant, then recreates a rich example
 * portfolio that exercises every feature page in the app: portfolio dashboard,
 * Epic approval workflow (my-approvals inbox), PI planning + capacity overlay,
 * Team sprint boards, Impediments, PI Objectives, participatory budgeting,
 * transformation cockpit (goals, target outcomes, snapshots, target operating
 * model), KPIs, dependencies, roadmaps.
 *
 * Auth accounts, the tenant itself and role assignments are kept across runs
 * (idempotent upserts); domain rows are deleted and re-created so each run
 * yields the same dataset.
 *
 * Test users (created once, reused on every run):
 *   admin@pulse.dev           / Admin1234! → tenant_admin
 *   portfolio@pulse.dev       / Test1234!  → portfolio_manager
 *   vmo@pulse.dev             / Test1234!  → vmo (Epic QS)
 *   rte@pulse.dev             / Test1234!  → rte (Feature QS)
 *   owner@pulse.dev           / Test1234!  → epic_owner + feature_owner
 *   viewer@pulse.dev          / Test1234!  → viewer (read-only)
 *   vso@pulse.dev             / Test1234!  → value_stream_owner (scoped to vs1)
 *   featureowner@pulse.dev    / Test1234!  → feature_owner (scoped to art1)
 *   teameditor@pulse.dev      / Test1234!  → team_editor (scoped to one team)
 *   storyowner@pulse.dev      / Test1234!  → story_owner (scoped to art1)
 *   taskowner@pulse.dev       / Test1234!  → task_owner
 *   transformation@pulse.dev  / Test1234!  → transformation_lead
 *
 * Run with: `pnpm db:seed` (env loaded from .env.local).
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, Prisma } from "../src/generated/prisma/index.js";
import { backfillSprints } from "../src/server/services/sprint-backfill.js";
import type { EpicType, FeatureType, Horizon } from "../src/domain/portfolio-guardrails.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DIRECT_URL!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "Anchor" date the dataset is shaped around — keeps PI windows meaningful. */
const TODAY = new Date("2026-06-05T00:00:00Z");

function daysFromAnchor(days: number): Date {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const FIB: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13, 20];

/** Deterministic Fibonacci pick — seeded by index so the dataset is stable. */
function fib(seed: number): number {
  return FIB[Math.abs(seed) % FIB.length]!;
}

/** Round to 2 decimals — matches the wsjfComputed column. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function upsertAuthUser(email: string, password: string): Promise<string> {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ↳ auth user exists: ${email}`);
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
  console.log(`  ✓ created auth user: ${email}`);
  return data.user.id;
}

/**
 * Hard-deletes every domain row for the tenant. Order respects foreign keys:
 * rows that are referenced are deleted after the rows that reference them, and
 * Initiatives are removed leaf-first (task → story → feature → epic). Auth
 * accounts, the Tenant row and UserRoleAssignment rows are left untouched.
 */
async function wipeDomainData(tenantId: string): Promise<void> {
  console.log("\n── Wiping existing domain data");

  // Ziele V2 (Vision → Theme → OKR → KR + Bridges); leaf-first damit FKs halten.
  await prisma.krKpiContribution.deleteMany({ where: { tenantId } });
  await prisma.keyResult.deleteMany({ where: { tenantId } });
  await prisma.themeEpicLink.deleteMany({ where: { tenantId } });
  await prisma.objective.deleteMany({ where: { tenantId } });
  await prisma.strategicTheme.deleteMany({ where: { tenantId } });
  await prisma.portfolioVision.deleteMany({ where: { tenantId } });

  // Transformation / portfolio glue first (refer to Initiatives + Tenant)
  await prisma.goalEpicLink.deleteMany({ where: { tenantId } });
  await prisma.targetOutcome.deleteMany({ where: { tenantId } });
  await prisma.transformationGoal.deleteMany({ where: { tenantId } });
  await prisma.transformationAction.deleteMany({ where: { tenantId } });
  await prisma.transformationSnapshot.deleteMany({ where: { tenantId } });
  await prisma.targetOperatingModel.deleteMany({ where: { tenantId } });

  // Budgeting
  await prisma.budgetPlanRevision.deleteMany({ where: { tenantId } });
  await prisma.artBudget.deleteMany({ where: { tenantId } });
  await prisma.budgetAllocation.deleteMany({ where: { tenantId } });

  // Initiative side-tables (must precede Initiative deletion)
  await prisma.epicApproval.deleteMany({ where: { tenantId } });
  await prisma.kpi.deleteMany({ where: { tenantId } });
  await prisma.dependency.deleteMany({ where: { tenantId } });

  // Initiatives leaf-first
  for (const level of [3, 2, 1, 0]) {
    await prisma.initiative.deleteMany({ where: { tenantId, level } });
  }

  // PI-scoped tables
  await prisma.piObjective.deleteMany({ where: { tenantId } });
  await prisma.impediment.deleteMany({ where: { tenantId } });
  await prisma.sprint.deleteMany({ where: { tenantId } });
  await prisma.systemDemo.deleteMany({ where: { tenantId } });
  await prisma.programIncrement.deleteMany({ where: { tenantId } });

  // Org structure
  await prisma.team.deleteMany({ where: { tenantId } });
  await prisma.art.deleteMany({ where: { tenantId } });
  await prisma.timeline.deleteMany({ where: { tenantId } });
  await prisma.valueStream.deleteMany({ where: { tenantId } });

  // Standalone
  await prisma.piStandard.deleteMany({ where: { tenantId } });

  console.log("  ✓ domain data cleared (accounts, tenant & roles kept)");
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🌱  Pulse seed starting…\n");

  // 1. Auth users
  console.log("── Auth users");
  const adminId = await upsertAuthUser("admin@pulse.dev", "Admin1234!");
  const portfolioId = await upsertAuthUser("portfolio@pulse.dev", "Test1234!");
  const vmoId = await upsertAuthUser("vmo@pulse.dev", "Test1234!");
  const rteId = await upsertAuthUser("rte@pulse.dev", "Test1234!");
  const ownerId = await upsertAuthUser("owner@pulse.dev", "Test1234!");
  const viewerId = await upsertAuthUser("viewer@pulse.dev", "Test1234!");
  const vsoId = await upsertAuthUser("vso@pulse.dev", "Test1234!");
  const featureOwnerId = await upsertAuthUser("featureowner@pulse.dev", "Test1234!");
  const teamEditorId = await upsertAuthUser("teameditor@pulse.dev", "Test1234!");
  const storyOwnerId = await upsertAuthUser("storyowner@pulse.dev", "Test1234!");
  const taskOwnerId = await upsertAuthUser("taskowner@pulse.dev", "Test1234!");
  const transformationLeadId = await upsertAuthUser("transformation@pulse.dev", "Test1234!");

  // 2. Tenant (+ economics / budgeting settings)
  console.log("\n── Tenant");
  let tenant = await prisma.tenant.findFirst({ where: { name: "Pulse Demo Corp" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { id: "00000000-0000-0000-0000-000000000001", name: "Pulse Demo Corp", region: "eu" },
    });
    console.log("  ✓ created tenant: Pulse Demo Corp");
  } else {
    console.log("  ↳ tenant exists");
  }
  const tenantId = tenant.id;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      costNeutralTarget: "150000",
      dashboardHorizonEnd: new Date("2028-12-31"),
      budgetPoolByPeriod: { "2026-H1": 5000000, "2026-H2": 5500000, "2027-H1": 5800000 },
      costPerJobSizePoint: "12000",
      guardrailTargets: {
        horizon: { h1: 70, h2: 20, h3: 10 },
        capacity: { business: 80, enabler: 20 },
      } as Prisma.InputJsonValue,
    },
  });

  // 3. Role assignments — the scoped ones drive the cascade-scope auth machinery.
  console.log("\n── Role assignments");
  const assignRole = (
    userId: string,
    role: string,
    scopes: { valueStreamIds?: string[]; artIds?: string[]; teamIds?: string[] } = {},
  ) =>
    prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId, tenantId, role } },
      create: {
        userId,
        tenantId,
        role,
        valueStreamIds: scopes.valueStreamIds ?? [],
        artIds: scopes.artIds ?? [],
        teamIds: scopes.teamIds ?? [],
      },
      update: {
        valueStreamIds: scopes.valueStreamIds ?? [],
        artIds: scopes.artIds ?? [],
        teamIds: scopes.teamIds ?? [],
      },
    });

  // 3b. Wipe existing domain data — fresh portfolio on every run
  await wipeDomainData(tenantId);

  // 4. Value Streams
  console.log("\n── Value Streams");
  const vs1 = await prisma.valueStream.create({
    data: {
      tenantId,
      name: "Retail Banking",
      description: "Consumer banking app, accounts and customer onboarding",
      budgetAmount: "3000000",
      budgetCurrency: "EUR",
      vmoId,
      financeApproverId: portfolioId,
    },
  });
  const vs2 = await prisma.valueStream.create({
    data: {
      tenantId,
      name: "Payments & Lending",
      description: "Payment rails, cards and credit products",
      budgetAmount: "1800000",
      budgetCurrency: "EUR",
      vmoId,
      financeApproverId: portfolioId,
    },
  });
  const vs3 = await prisma.valueStream.create({
    data: {
      tenantId,
      name: "Wealth & Investments",
      description: "Brokerage, advisory and savings products",
      budgetAmount: "1200000",
      budgetCurrency: "EUR",
      vmoId,
      financeApproverId: portfolioId,
    },
  });
  console.log("  ✓ Retail Banking, Payments & Lending, Wealth & Investments");

  // 5. Timeline (shared cadence — replaces the legacy ART.piCadenceWeeks fallback)
  console.log("\n── Timeline");
  const timeline = await prisma.timeline.create({
    data: { tenantId, name: "Standard 10-week Cadence", cadenceWeeks: 10 },
  });
  console.log("  ✓ Standard 10-week Cadence");

  // 6. ARTs (linked to Timeline)
  console.log("\n── ARTs");
  const art1 = await prisma.art.create({
    data: {
      tenantId,
      valueStreamId: vs1.id,
      timelineId: timeline.id,
      name: "Mobile Banking ART",
      description: "Apps + identity + customer onboarding",
      piCadenceWeeks: 10,
      rteId,
    },
  });
  const art2 = await prisma.art.create({
    data: {
      tenantId,
      valueStreamId: vs2.id,
      timelineId: timeline.id,
      name: "Payments ART",
      description: "Outbound + card + ledger services",
      piCadenceWeeks: 10,
      rteId,
    },
  });
  const art3 = await prisma.art.create({
    data: {
      tenantId,
      valueStreamId: vs3.id,
      timelineId: timeline.id,
      name: "Wealth ART",
      description: "Brokerage, robo-advisor and reporting",
      piCadenceWeeks: 10,
      rteId,
    },
  });
  console.log("  ✓ Mobile Banking ART, Payments ART, Wealth ART");

  // 7. Teams (3 per ART for Mobile + Payments, 4 for Wealth = 10 total)
  console.log("\n── Teams");
  const teamPlan: Array<{
    art: typeof art1;
    name: string;
    type: string;
    velocity: number;
    headcount: number;
  }> = [
    { art: art1, name: "Atlas Team", type: "stream_aligned", velocity: 35, headcount: 7 },
    { art: art1, name: "Orion Team", type: "stream_aligned", velocity: 32, headcount: 6 },
    { art: art1, name: "Pegasus Team", type: "platform", velocity: 28, headcount: 5 },
    { art: art2, name: "Vega Team", type: "stream_aligned", velocity: 30, headcount: 6 },
    { art: art2, name: "Sirius Team", type: "complicated_subsystem", velocity: 25, headcount: 5 },
    { art: art2, name: "Lyra Team", type: "stream_aligned", velocity: 33, headcount: 7 },
    { art: art3, name: "Cygnus Team", type: "stream_aligned", velocity: 28, headcount: 6 },
    { art: art3, name: "Draco Team", type: "stream_aligned", velocity: 30, headcount: 6 },
    { art: art3, name: "Phoenix Team", type: "enabling", velocity: 22, headcount: 4 },
    { art: art3, name: "Hydra Team", type: "platform", velocity: 26, headcount: 5 },
  ];
  const teams = await Promise.all(
    teamPlan.map((t) =>
      prisma.team.create({
        data: {
          tenantId,
          artId: t.art.id,
          name: t.name,
          teamType: t.type,
          targetVelocity: t.velocity,
          headcount: t.headcount,
          scrumMasterId: teamEditorId,
          productOwnerId: featureOwnerId,
        },
      }),
    ),
  );
  console.log(`  ✓ ${teams.length} teams across 3 ARTs`);

  // Apply scoped role assignments now that IDs exist.
  await Promise.all([
    assignRole(adminId, "tenant_admin"),
    assignRole(portfolioId, "portfolio_manager"),
    assignRole(vmoId, "vmo"),
    assignRole(rteId, "rte"),
    assignRole(ownerId, "epic_owner"),
    assignRole(ownerId, "feature_owner"),
    assignRole(viewerId, "viewer"),
    assignRole(vsoId, "value_stream_owner", { valueStreamIds: [vs1.id] }),
    assignRole(featureOwnerId, "feature_owner", { artIds: [art1.id] }),
    assignRole(teamEditorId, "team_editor", { teamIds: [teams[0]!.id] }),
    assignRole(storyOwnerId, "story_owner", { artIds: [art1.id] }),
    assignRole(taskOwnerId, "task_owner"),
    assignRole(transformationLeadId, "transformation_lead"),
  ]);
  console.log("  ✓ roles assigned (with cascaded scopes)");

  // 8. Program Increments (Timeline-linked) — 2 completed, 1 active, 3 planned
  // PI 2026-Q2 spans 2026-04-13 → 2026-06-20 so today (2026-06-05) is inside it.
  console.log("\n── Program Increments");
  const piPlan: Array<{
    name: string;
    start: Date;
    end: Date;
    status: "completed" | "active" | "planned";
    capJob: number;
    capAmt: string;
  }> = [
    {
      name: "PI 2025-Q3",
      start: new Date("2025-07-07"),
      end: new Date("2025-09-12"),
      status: "completed",
      capJob: 60,
      capAmt: "720000",
    },
    {
      name: "PI 2025-Q4",
      start: new Date("2025-10-06"),
      end: new Date("2025-12-12"),
      status: "completed",
      capJob: 64,
      capAmt: "768000",
    },
    {
      name: "PI 2026-Q1",
      start: new Date("2026-01-12"),
      end: new Date("2026-03-20"),
      status: "completed",
      capJob: 68,
      capAmt: "816000",
    },
    {
      name: "PI 2026-Q2",
      start: new Date("2026-04-13"),
      end: new Date("2026-06-20"),
      status: "active",
      capJob: 72,
      capAmt: "864000",
    },
    {
      name: "PI 2026-Q3",
      start: new Date("2026-07-13"),
      end: new Date("2026-09-18"),
      status: "planned",
      capJob: 76,
      capAmt: "912000",
    },
    {
      name: "PI 2026-Q4",
      start: new Date("2026-10-12"),
      end: new Date("2026-12-18"),
      status: "planned",
      capJob: 80,
      capAmt: "960000",
    },
  ];
  const pis = await Promise.all(
    piPlan.map((p) =>
      prisma.programIncrement.create({
        data: {
          tenantId,
          timelineId: timeline.id,
          name: p.name,
          startDate: p.start,
          endDate: p.end,
          status: p.status,
          capacityJobSize: p.capJob,
          capacityAmount: p.capAmt,
        },
      }),
    ),
  );
  const piByName = new Map(pis.map((p) => [p.name, p]));
  const piCompletedC = piByName.get("PI 2026-Q1")!;
  const piActive = piByName.get("PI 2026-Q2")!;
  const piNext = piByName.get("PI 2026-Q3")!;
  const piLater = piByName.get("PI 2026-Q4")!;
  console.log(`  ✓ ${pis.length} PIs (3 completed, 1 active, 2 planned)`);

  // 9. Sprints — auto-generated via the same backfillSprints the service uses.
  console.log("\n── Sprints");
  let totalSprints = 0;
  await prisma.$transaction(async (tx) => {
    const r = await backfillSprints(tx, tenantId, pis, teams);
    totalSprints = r.created;
  });
  console.log(`  ✓ ${totalSprints} sprints auto-generated (PI × Team × cadence)`);

  // Pre-load sprint index for story assignment later.
  const allSprints = await prisma.sprint.findMany({
    where: { tenantId },
    select: { id: true, piId: true, teamId: true, indexInPi: true },
  });
  const sprintByPiTeam = new Map<string, typeof allSprints>();
  for (const s of allSprints) {
    const key = `${s.piId}/${s.teamId}`;
    const list = sprintByPiTeam.get(key) ?? [];
    list.push(s);
    sprintByPiTeam.set(key, list);
  }

  // 10. Epics — 25 across all stage gates with realistic artefacts.
  console.log("\n── Epics");
  type EpicSpec = {
    title: string;
    description: string;
    valueStreamId: string;
    stageGate: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
    status: string;
    needsSteering?: boolean;
    stagedForBudget?: boolean;
    plannedStart?: Date;
    plannedEnd?: Date;
    bh?: Record<string, unknown>;
    bc?: Record<string, unknown>;
    withBaseline?: boolean;
    /** SAFe Portfolio Guardrails (Roadmap-G1..G4). */
    epicType?: EpicType;
    horizon?: Horizon;
  };

  const bh = (
    over: Partial<{
      measuresHypothesis: string;
      changeFromBaseline: string;
      businessOutcomes: string[];
      leadingIndicators: string[];
      risks: string[];
    }>,
  ) => ({
    current: {
      measuresHypothesis: over.measuresHypothesis ?? "Hypothesis under formulation.",
      changeFromBaseline: over.changeFromBaseline ?? "Articulates the change vs. today.",
      businessOutcomes: over.businessOutcomes ?? ["Outcome to be defined"],
      leadingIndicators: over.leadingIndicators ?? ["Indicator to be defined"],
      risks: over.risks ?? ["Risk to be assessed"],
    },
    history: [],
  });

  const bc = (over: {
    initiativeDescription: string;
    businessOutcomeHypothesis: string;
    analysisSummary: string;
    costSlices: { amount: number }[];
    oneTimeBenefit?: number;
    recurringBenefit: number;
  }) => ({
    current: { ...over, approvals: [] },
    history: [],
  });

  const epicSpecs: EpicSpec[] = [
    // L5 — done
    {
      title: "Mobile App 2.0 launch",
      description: "Re-architect the consumer mobile app on a modular platform.",
      epicType: "solution",
      horizon: "h1",
      valueStreamId: vs1.id,
      stageGate: "L5",
      status: "completed",
      plannedStart: new Date("2024-10-01"),
      plannedEnd: new Date("2025-09-30"),
      bh: bh({
        measuresHypothesis: "A modern modular mobile app accelerates downstream feature delivery.",
        changeFromBaseline: "Legacy monolith took weeks to ship a new screen.",
        businessOutcomes: ["Feature lead-time cut by 60%", "Crash-free sessions ≥ 99.9%"],
        leadingIndicators: ["PR-to-prod time", "Crashlytics rate"],
        risks: ["Migration window for existing users"],
      }),
      bc: bc({
        initiativeDescription: "Legacy mobile monolith blocks rapid feature delivery.",
        businessOutcomeHypothesis:
          "A modular re-architecture compounds across all subsequent epics.",
        analysisSummary: "Feature lead-time falls 60%; engineering velocity rises 35%.",
        costSlices: [{ amount: 280000 }, { amount: 200000 }],
        oneTimeBenefit: 200000,
        recurringBenefit: 2400000,
      }),
    },
    {
      title: "Card tokenisation upgrade",
      description: "Replace legacy card storage with tokenised credentials end-to-end.",
      epicType: "enabler",
      horizon: "h1",
      valueStreamId: vs2.id,
      stageGate: "L5",
      status: "completed",
      plannedStart: new Date("2024-12-01"),
      plannedEnd: new Date("2025-12-15"),
      bh: bh({
        measuresHypothesis: "Tokenised card credentials cut PCI scope and fraud exposure.",
        changeFromBaseline:
          "Raw PAN handling sprawled across services; audits cost weeks per cycle.",
        businessOutcomes: ["PCI scope reduced by 40%", "Card fraud incidents ↓ 35%"],
        leadingIndicators: ["Services touching PAN", "Fraud cases / 1k cards"],
        risks: ["Migration cutover for existing tokens"],
      }),
      bc: bc({
        initiativeDescription:
          "Raw card data in legacy services widens PCI scope and fraud surface.",
        businessOutcomeHypothesis: "Network tokens cut both audit cost and card fraud.",
        analysisSummary: "PCI scope drops 40%; card fraud falls 35% within two PIs of rollout.",
        costSlices: [{ amount: 220000 }, { amount: 180000 }],
        recurringBenefit: 1600000,
      }),
    },

    // L4 — in delivery
    {
      title: "Real-Time Payments Rail",
      description: "Move outbound payments from overnight batch to instant 24/7 settlement.",
      epicType: "solution",
      horizon: "h1",
      valueStreamId: vs2.id,
      stageGate: "L4",
      status: "in_progress",
      needsSteering: true,
      plannedStart: new Date("2026-01-15"),
      plannedEnd: new Date("2026-12-15"),
      bh: bh({
        measuresHypothesis:
          "Replace overnight batch settlement with an instant 24/7 payments rail.",
        changeFromBaseline: "Payments today settle in 1–2 business days; customers expect instant.",
        businessOutcomes: ["Median settlement under 10 seconds", "Where-is-my-payment tickets ↓"],
        leadingIndicators: ["Median settlement time", "Payment-status support tickets"],
        risks: ["24/7 operational resilience", "Liquidity management"],
      }),
      bc: bc({
        initiativeDescription:
          "Batch settlement delays payments 1–2 days and drives 30% of support contacts.",
        businessOutcomeHypothesis: "Instant settlement meets expectations and cuts support load.",
        analysisSummary: "Median settlement time drops from 1 day to under 10 seconds.",
        costSlices: [{ amount: 320000 }, { amount: 180000 }],
        recurringBenefit: 1800000,
      }),
      withBaseline: true,
    },
    {
      title: "Instant Account Opening",
      description: "Fully verified current account in under 5 minutes from the app.",
      horizon: "h2",
      valueStreamId: vs1.id,
      stageGate: "L4",
      status: "in_progress",
      plannedStart: new Date("2026-02-01"),
      plannedEnd: new Date("2026-11-30"),
      bh: bh({
        measuresHypothesis:
          "Replace branch + paper onboarding with a fully digital sub-5-minute flow.",
        changeFromBaseline: "Today onboarding takes 3 days and 38% of applicants drop off.",
        businessOutcomes: ["Completion rate ≥ 80%", "Cost-to-serve halved"],
        leadingIndicators: ["Completion time", "Step-by-step drop-off"],
        risks: ["KYC/AML regulatory sign-off", "Identity-fraud exposure"],
      }),
      bc: bc({
        initiativeDescription: "Manual onboarding takes 3 days and loses 38% of applicants.",
        businessOutcomeHypothesis: "Frictionless digital flow converts more applicants, cuts cost.",
        analysisSummary: "Completion rate climbs past 80% within two PIs of launch.",
        costSlices: [{ amount: 180000 }, { amount: 120000 }],
        oneTimeBenefit: 400000,
        recurringBenefit: 3200000,
      }),
    },
    {
      title: "AI-Powered Fraud Detection",
      description: "Real-time ML fraud scoring at authorisation time.",
      epicType: "enabler",
      horizon: "h1",
      valueStreamId: vs2.id,
      stageGate: "L4",
      status: "in_progress",
      needsSteering: true,
      plannedStart: new Date("2026-03-01"),
      plannedEnd: new Date("2026-11-30"),
      bh: bh({
        measuresHypothesis:
          "Score every transaction in real time with an ML fraud model before authorisation.",
        changeFromBaseline:
          "Static rule lists miss 1 in 4 fraud cases and over-decline genuine payments.",
        businessOutcomes: ["Fraud losses ↓ 60%", "False-positive declines ↓ 33%"],
        leadingIndicators: ["Fraud detection recall", "False-positive rate"],
        risks: ["Model bias and explainability", "Latency budget at authorisation"],
      }),
      bc: bc({
        initiativeDescription: "Rule-based screening misses 25% of fraud, costing €2.1M/year.",
        businessOutcomeHypothesis:
          "ML model catches more fraud while declining fewer genuine payments.",
        analysisSummary: "Fraud losses fall 60% within one PI of full rollout.",
        costSlices: [{ amount: 260000 }, { amount: 200000 }],
        oneTimeBenefit: 250000,
        recurringBenefit: 2100000,
      }),
    },

    // L3 — approved, ready for delivery
    {
      title: "Open Banking Aggregation",
      description: "Aggregate external accounts via open-banking APIs into one dashboard.",
      horizon: "h2",
      valueStreamId: vs1.id,
      stageGate: "L3",
      status: "approved",
      stagedForBudget: true,
      plannedStart: new Date("2026-07-01"),
      plannedEnd: new Date("2027-03-31"),
      bh: bh({
        measuresHypothesis:
          "Aggregate external account data via open-banking APIs into a single dashboard.",
        changeFromBaseline: "Customers switch between 3+ banking apps; no consolidated view.",
        businessOutcomes: ["DAU +20%", "Higher cross-sell of savings & credit"],
        leadingIndicators: ["Linked external accounts/user", "Dashboard engagement"],
        risks: ["Open-banking API reliability", "Consent-renewal friction"],
      }),
      bc: bc({
        initiativeDescription:
          "Customers manage money across 3+ apps; bank sees only part of finances.",
        businessOutcomeHypothesis:
          "Consolidated view increases engagement and surfaces cross-sell.",
        analysisSummary: "DAU rises 20% within three months of launch.",
        costSlices: [{ amount: 90000 }, { amount: 70000 }],
        oneTimeBenefit: 120000,
        recurringBenefit: 1100000,
      }),
    },
    {
      title: "Robo-advisor for Wealth",
      description: "Automated portfolio rebalancing for retail wealth customers.",
      horizon: "h2",
      valueStreamId: vs3.id,
      stageGate: "L3",
      status: "approved",
      stagedForBudget: true,
      plannedStart: new Date("2026-08-01"),
      plannedEnd: new Date("2027-06-30"),
      bh: bh({
        measuresHypothesis: "Automate portfolio rebalancing on rules + customer risk profile.",
        changeFromBaseline: "Manual advisory limits coverage to top-decile customers.",
        businessOutcomes: ["Wealth AUM +15%", "Advisor cost ↓ 30%"],
        leadingIndicators: ["Onboarded portfolios/week", "Manual-touch ratio"],
        risks: ["BaFin sign-off on advisory rules"],
      }),
      bc: bc({
        initiativeDescription:
          "Manual advisory caps coverage; small accounts get little attention.",
        businessOutcomeHypothesis: "Automation scales advice and cuts the advisor cost line.",
        analysisSummary: "AUM grows 15%; advisor cost-per-client drops 30%.",
        costSlices: [{ amount: 140000 }, { amount: 100000 }],
        recurringBenefit: 980000,
      }),
    },
    {
      title: "ESG investment screen",
      description: "Filter brokerage offering by environmental and governance criteria.",
      horizon: "h3",
      valueStreamId: vs3.id,
      stageGate: "L3",
      status: "approved",
      plannedStart: new Date("2026-09-01"),
      plannedEnd: new Date("2027-03-31"),
      bh: bh({
        measuresHypothesis:
          "Surface ESG criteria on every traded instrument in the brokerage offering.",
        changeFromBaseline: "Customers leave the app to research ESG ratings elsewhere.",
        businessOutcomes: ["Conversion on ESG-tagged trades +25%"],
        leadingIndicators: ["ESG-filter usage / day"],
        risks: ["Vendor data licensing"],
      }),
      bc: bc({
        initiativeDescription:
          "ESG data sits outside the app; conversion drops when customers leave.",
        businessOutcomeHypothesis: "Inline ESG ratings keep traders engaged and convert more.",
        analysisSummary: "ESG trade conversion lifts 25% within two PIs.",
        costSlices: [{ amount: 70000 }, { amount: 50000 }],
        recurringBenefit: 540000,
      }),
    },
    {
      title: "Customer service AI assistant",
      description: "LLM-backed assistant inside the support channel for tier-1 enquiries.",
      horizon: "h2",
      valueStreamId: vs1.id,
      stageGate: "L3",
      status: "approved",
      plannedStart: new Date("2026-10-01"),
      plannedEnd: new Date("2027-05-31"),
      bh: bh({
        measuresHypothesis:
          "Deflect tier-1 enquiries to a self-serve AI assistant before they reach an agent.",
        changeFromBaseline:
          "Tier-1 volume is 65% of all contacts; agent handle-time consumes the queue.",
        businessOutcomes: ["Tier-1 deflection ≥ 35%", "Agent NPS ↑"],
        leadingIndicators: ["Deflection rate", "Time-to-handover"],
        risks: ["Hallucination on regulated topics"],
      }),
      bc: bc({
        initiativeDescription: "Tier-1 contacts swamp agents and erode tier-2 NPS.",
        businessOutcomeHypothesis:
          "Self-serve AI handles 35% of tier-1 and hands warm context to agents.",
        analysisSummary: "Average handle-time drops 18%; CSAT holds steady.",
        costSlices: [{ amount: 130000 }, { amount: 110000 }],
        recurringBenefit: 1450000,
      }),
    },
    {
      title: "Cross-border instant transfers (SEPA Instant)",
      description: "Adopt SEPA Instant Credit Transfer scheme across eligible corridors.",
      horizon: "h1",
      valueStreamId: vs2.id,
      stageGate: "L3",
      status: "approved",
      plannedStart: new Date("2026-09-15"),
      plannedEnd: new Date("2027-04-30"),
      bh: bh({
        measuresHypothesis: "Settle EUR cross-border payments in seconds using SEPA Instant rails.",
        changeFromBaseline: "Today cross-border EUR clears T+1; corporate clients demand instant.",
        businessOutcomes: ["FX corridor revenue +12%"],
        leadingIndicators: ["Instant-eligible volume"],
        risks: ["Liquidity in 24/7 nostro arrangements"],
      }),
      bc: bc({
        initiativeDescription:
          "T+1 settlement loses business to neo-bank competitors on instant rails.",
        businessOutcomeHypothesis: "SEPA Instant capture defends EUR-corridor revenue.",
        analysisSummary: "Cross-border instant-eligible volume captures 60% of T+1 today.",
        costSlices: [{ amount: 110000 }, { amount: 90000 }],
        recurringBenefit: 870000,
      }),
    },

    // L2 — business case in stakeholder review
    {
      title: "Embedded insurance offering",
      description: "Sell travel + device insurance inside the banking app journey.",
      horizon: "h2",
      valueStreamId: vs1.id,
      stageGate: "L2",
      status: "in_review",
      bh: bh({
        measuresHypothesis:
          "Embed travel + device insurance into account opening + card issuance flows.",
        changeFromBaseline:
          "Customers buy insurance via separate apps; bank captures none of the margin.",
        businessOutcomes: ["Attach rate ≥ 12% on eligible journeys"],
        leadingIndicators: ["Attach offers shown vs. taken"],
        risks: ["Underwriting-partner availability per geo"],
      }),
      bc: bc({
        initiativeDescription: "Bank app doesn't monetise its high-intent customer moments.",
        businessOutcomeHypothesis:
          "In-context insurance offers convert at 12% on eligible journeys.",
        analysisSummary: "12% attach × eligible cohort → €420k recurring margin.",
        costSlices: [{ amount: 80000 }, { amount: 60000 }],
        recurringBenefit: 420000,
      }),
    },
    {
      title: "Buy-now-pay-later at checkout",
      description: "Issue a regulated BNPL credit line at qualifying merchants.",
      horizon: "h2",
      valueStreamId: vs2.id,
      stageGate: "L2",
      status: "in_review",
      bh: bh({
        measuresHypothesis:
          "Offer regulated BNPL credit at the point of purchase for prime customers.",
        changeFromBaseline:
          "Unregulated BNPL competitors capture spend the bank already underwrites.",
        businessOutcomes: ["Net interest income +€600k/year"],
        leadingIndicators: ["BNPL applications / week", "BNPL default rate"],
        risks: ["Consumer-credit directive compliance"],
      }),
      bc: bc({
        initiativeDescription: "Unregulated BNPL captures revenue the bank already underwrites.",
        businessOutcomeHypothesis:
          "Regulated BNPL reclaims spend without raising credit risk materially.",
        analysisSummary: "Modelled €600k NII uplift with a 0.8% default ceiling.",
        costSlices: [{ amount: 100000 }, { amount: 80000 }],
        recurringBenefit: 600000,
      }),
    },
    {
      title: "Branch network rationalisation",
      description: "Consolidate the branch footprint while preserving cash-access coverage.",
      horizon: "h1",
      valueStreamId: vs1.id,
      stageGate: "L2",
      status: "draft",
      bh: bh({
        measuresHypothesis:
          "Close low-traffic branches; preserve cash access via ATM + partner network.",
        changeFromBaseline: "Branch footprint exceeds digital-first usage by 30%.",
        businessOutcomes: ["Operating cost ↓ €1.4M/year"],
        leadingIndicators: ["Traffic / branch / day"],
        risks: ["Customer trust and press response"],
      }),
      bc: bc({
        initiativeDescription: "Branch footprint outsizes digital-first usage.",
        businessOutcomeHypothesis:
          "Rationalising the footprint cuts cost without losing accessible cash.",
        analysisSummary: "€1.4M/yr savings; cash-access coverage held above 95%.",
        costSlices: [{ amount: 90000 }, { amount: 60000 }],
        recurringBenefit: 1400000,
      }),
    },
    {
      title: "Premium savings tier",
      description: "Differentiated rate tier for balances above €25k.",
      horizon: "h1",
      valueStreamId: vs3.id,
      stageGate: "L2",
      status: "in_review",
      bh: bh({
        measuresHypothesis:
          "Reward high-balance customers with a differentiated rate to retain deposits.",
        changeFromBaseline:
          "High-balance customers chase rates with competitors quarter-on-quarter.",
        businessOutcomes: ["Deposit retention +12%"],
        leadingIndicators: ["Outflow rate by balance band"],
        risks: ["NII impact of higher pass-through"],
      }),
      bc: bc({
        initiativeDescription: "Top-tier customers chase competitor rates each quarter.",
        businessOutcomeHypothesis:
          "A premium rate tier retains the most price-sensitive depositors.",
        analysisSummary: "Deposit retention +12%; NII drag offset by funding stability.",
        costSlices: [{ amount: 40000 }, { amount: 30000 }],
        recurringBenefit: 320000,
      }),
    },
    {
      title: "API marketplace",
      description: "Expose product APIs to fintech partners with metered billing.",
      epicType: "solution",
      horizon: "h3",
      valueStreamId: vs2.id,
      stageGate: "L2",
      status: "draft",
      bh: bh({
        measuresHypothesis: "Productise the bank's APIs for fintech partners with metered billing.",
        changeFromBaseline: "Partner integrations are bespoke; takes months to onboard each one.",
        businessOutcomes: ["New revenue line: €450k/year by year 2"],
        leadingIndicators: ["Partner sign-ups / quarter"],
        risks: ["Regulatory perimeter for re-distributors"],
      }),
      bc: bc({
        initiativeDescription: "Bespoke partner integrations don't scale and don't monetise.",
        businessOutcomeHypothesis: "Productised APIs open a metered revenue line.",
        analysisSummary: "€450k by year 2; pipeline of 18 partners.",
        costSlices: [{ amount: 130000 }, { amount: 90000 }],
        recurringBenefit: 450000,
      }),
    },

    // L1 — hypothesis in review
    {
      title: "Voice-banking via smart speakers",
      description: "Account balance + transfers via voice assistants.",
      horizon: "h3",
      valueStreamId: vs1.id,
      stageGate: "L1",
      status: "in_review",
      bh: bh({
        measuresHypothesis: "Account balance + transfers via Alexa / Google Assistant.",
        changeFromBaseline: "No voice channel; emerging cohort of voice-first users underserved.",
        businessOutcomes: ["Voice MAU > 30k within a year"],
        leadingIndicators: ["Voice intents / customer / month"],
        risks: ["Voice-auth reliability"],
      }),
    },
    {
      title: "Crypto-asset custody",
      description: "Regulated custody of select crypto-assets inside the brokerage account.",
      horizon: "h2",
      valueStreamId: vs3.id,
      stageGate: "L1",
      status: "in_review",
      bh: bh({
        measuresHypothesis: "Offer regulated custody of BTC / ETH inside the brokerage account.",
        changeFromBaseline: "Customers self-custody on exchanges, losing brokerage relationship.",
        businessOutcomes: ["Reactivate dormant brokerage accounts"],
        leadingIndicators: ["Crypto-eligible accounts opted in"],
        risks: ["MiCA compliance footprint"],
      }),
    },
    {
      title: "Sustainable-finance reporting",
      description: "Emissions-attribution for each customer's portfolio.",
      epicType: "enabler",
      horizon: "h1",
      valueStreamId: vs3.id,
      stageGate: "L1",
      status: "draft",
      bh: bh({
        measuresHypothesis:
          "Show each customer the carbon footprint of their portfolio + payments.",
        changeFromBaseline: "Customers ask for it; no consolidated view in market.",
        businessOutcomes: ["ESG-aware AUM share ↑"],
        leadingIndicators: ["Customers opted into the dashboard"],
        risks: ["Methodology defensibility"],
      }),
    },
    {
      title: "SME lending playbook",
      description: "Risk-scored small-business loan offering up to €100k.",
      horizon: "h1",
      valueStreamId: vs2.id,
      stageGate: "L1",
      status: "draft",
      bh: bh({
        measuresHypothesis:
          "Risk-score SME loans up to €100k using cashflow signals + bureau data.",
        changeFromBaseline: "SME demand is unmet; competitors quote 3-week decisions.",
        businessOutcomes: ["SME loan book +€8M in year 1"],
        leadingIndicators: ["Eligible cohort identified"],
        risks: ["Tier-1 capital allocation"],
      }),
    },
    {
      title: "Family-pack account bundles",
      description: "Combined account + card products for households.",
      horizon: "h1",
      valueStreamId: vs1.id,
      stageGate: "L1",
      status: "in_review",
      bh: bh({
        measuresHypothesis: "Bundle account + cards + spending controls for households.",
        changeFromBaseline:
          "Each member opens accounts separately; cross-account oversight is manual.",
        businessOutcomes: ["Household primary-bank share ↑"],
        leadingIndicators: ["Joined households / quarter"],
        risks: ["KYC for minors"],
      }),
    },

    // L0 — idea stage, owner unassigned
    {
      title: "Carbon-offset on card spend",
      description: "Optional offsetting tied to monthly card-spend footprint.",
      valueStreamId: vs2.id,
      stageGate: "L0",
      status: "draft",
    },
    {
      title: "Multi-currency wallet",
      description: "Hold balances in EUR + USD + GBP with mid-market FX.",
      valueStreamId: vs2.id,
      stageGate: "L0",
      status: "draft",
    },
    {
      title: "Self-serve dispute centre",
      description: "Customer can raise + track disputes without contacting support.",
      epicType: "enabler",
      valueStreamId: vs1.id,
      stageGate: "L0",
      status: "draft",
    },
    {
      title: "Pensions consolidation",
      description: "Aggregate external pension pots into a single dashboard.",
      valueStreamId: vs3.id,
      stageGate: "L0",
      status: "draft",
      needsSteering: true,
    },
    {
      title: "Open API for tax filings",
      description: "Read-only API that surfaces tax-relevant data to certified filers.",
      epicType: "enabler",
      valueStreamId: vs1.id,
      stageGate: "L0",
      status: "draft",
    },
  ];

  const epics: Array<{ id: string; spec: EpicSpec }> = [];
  for (const spec of epicSpecs) {
    const id = randomUUID();
    epics.push({ id, spec });
    await prisma.initiative.create({
      data: {
        id,
        tenantId,
        level: 0,
        title: spec.title,
        path: id,
        description: spec.description,
        valueStreamId: spec.valueStreamId,
        stageGate: spec.stageGate,
        status: spec.status,
        ownerId: spec.stageGate === "L0" ? null : ownerId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        benefitHypothesis: (spec.bh ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        businessCase: (spec.bc ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        baselineBusinessCase:
          spec.withBaseline && spec.bc ? (spec.bc as Prisma.InputJsonValue) : Prisma.JsonNull,
        plannedStartAt: spec.plannedStart ?? null,
        plannedEndAt: spec.plannedEnd ?? null,
        needsSteeringAttention: spec.needsSteering ?? false,
        stagedForBudgeting: spec.stagedForBudget ?? false,
        epicType: spec.epicType ?? "epic",
        ...(spec.horizon ? { investmentHorizon: spec.horizon } : {}),
        approvalPhase:
          spec.stageGate === "L0"
            ? null
            : spec.stageGate === "L1"
              ? "hypothesis_review"
              : spec.stageGate === "L2"
                ? "business_case"
                : spec.stageGate === "L3"
                  ? "approved"
                  : null,
        approvedBy: ["L3", "L4", "L5"].includes(spec.stageGate) ? portfolioId : null,
        approvedAt: ["L3", "L4", "L5"].includes(spec.stageGate) ? daysFromAnchor(-120) : null,
        selectedForDetailingAt: ["L1", "L2", "L3", "L4", "L5"].includes(spec.stageGate)
          ? daysFromAnchor(-200)
          : null,
        hypothesisApprovedAt: ["L2", "L3", "L4", "L5"].includes(spec.stageGate)
          ? daysFromAnchor(-160)
          : null,
        selectedForAnalyzingAt: ["L2", "L3", "L4", "L5"].includes(spec.stageGate)
          ? daysFromAnchor(-150)
          : null,
        businessCaseApprovedAt: ["L3", "L4", "L5"].includes(spec.stageGate)
          ? daysFromAnchor(-120)
          : null,
      },
    });
  }
  console.log(`  ✓ ${epics.length} epics across L0–L5`);

  // 11. EpicApprovals — section reviews for L1 Epics, party approvals for L2/L3.
  console.log("\n── EpicApprovals");
  const approvalRows: Array<{
    epicId: string;
    revision: number;
    kind: "section" | "party";
    section?: string | undefined;
    party?: string | undefined;
    approverUserId: string;
    status: "pending" | "approved" | "rejected";
    decidedAt?: Date | undefined;
    comment?: string | undefined;
  }> = [];

  for (const e of epics) {
    if (e.spec.stageGate === "L1") {
      approvalRows.push(
        {
          epicId: e.id,
          revision: 1,
          kind: "section",
          section: "breakdown",
          approverUserId: vmoId,
          status: "pending",
        },
        {
          epicId: e.id,
          revision: 1,
          kind: "section",
          section: "kpis",
          approverUserId: vmoId,
          status: e.spec.title.startsWith("Voice") ? "approved" : "pending",
          decidedAt: e.spec.title.startsWith("Voice") ? daysFromAnchor(-12) : undefined,
          comment: e.spec.title.startsWith("Voice")
            ? "KPI set ist plausibel — leading indicators ergänzt."
            : undefined,
        },
      );
    }
    if (e.spec.stageGate === "L2") {
      for (const party of ["mgmt", "business_owner", "finance", "irt_owner", "lace_vmo"]) {
        approvalRows.push({
          epicId: e.id,
          revision: 1,
          kind: "party",
          party,
          approverUserId:
            party === "finance" ? portfolioId : party === "lace_vmo" ? vmoId : adminId,
          status: party === "lace_vmo" ? "pending" : "approved",
          decidedAt: party === "lace_vmo" ? undefined : daysFromAnchor(-30),
          comment:
            party === "finance"
              ? "Business Case trägt im konservativen Szenario; +1% Sensitivität geprüft."
              : undefined,
        });
      }
    }
    if (e.spec.stageGate === "L3") {
      for (const party of ["mgmt", "business_owner", "finance", "irt_owner", "lace_vmo"]) {
        approvalRows.push({
          epicId: e.id,
          revision: 1,
          kind: "party",
          party,
          approverUserId:
            party === "finance" ? portfolioId : party === "lace_vmo" ? vmoId : adminId,
          status: "approved",
          decidedAt: daysFromAnchor(-90),
        });
      }
    }
  }

  for (const r of approvalRows) {
    await prisma.epicApproval.create({
      data: {
        tenantId,
        initiativeId: r.epicId,
        revision: r.revision,
        kind: r.kind,
        ...(r.section ? { section: r.section } : {}),
        ...(r.party ? { party: r.party } : {}),
        approverUserId: r.approverUserId,
        status: r.status,
        decidedAt: r.decidedAt ?? null,
        comment: r.comment ?? null,
        createdBy: ownerId,
      },
    });
  }
  console.log(`  ✓ ${approvalRows.length} approval rows`);

  // 12. Features — every Epic gets features. L3+ Epics get the bulk delivery
  // slate (60 features); L0–L2 Epics get a smaller, earlier-stage backlog
  // (2–4 per Epic, mostly status=draft, mostly without a PI) so each Epic's
  // detail page actually shows its feature breakdown.
  console.log("\n── Features");
  const deliveryEpics = epics.filter((e) => ["L3", "L4", "L5"].includes(e.spec.stageGate));
  const earlyEpics = epics.filter((e) => ["L0", "L1", "L2"].includes(e.spec.stageGate));
  const piPool = [piActive, piNext, piLater, piCompletedC];
  const artForEpic = (e: { spec: EpicSpec }) =>
    e.spec.valueStreamId === vs1.id ? art1 : e.spec.valueStreamId === vs2.id ? art2 : art3;

  const features: Array<{ id: string; epicId: string; artId: string; piId: string | null }> = [];

  // 12a. Early-stage Epics — 2 features for L0, 3 for L1, 4 for L2.
  // L0 features are exploratory (no PI, no WSJF); L1/L2 carry WSJF but stay
  // out of the active PI so the planning board doesn't fill up with not-yet-
  // approved work.
  let earlyIdx = 0;
  for (const epic of earlyEpics) {
    const gate = epic.spec.stageGate;
    const n = gate === "L0" ? 2 : gate === "L1" ? 3 : 4;
    const art = artForEpic(epic);
    for (let k = 0; k < n; k++) {
      const id = randomUUID();
      // L0 lives entirely in the backlog without WSJF (idea stage).
      // L1 has WSJF but no PI (hypothesis still under review).
      // L2 has WSJF; a handful drift into a *planned* PI to show the funnel
      // pulling work forward.
      const hasWsjf = gate !== "L0";
      const piId = gate === "L2" && k === 0 ? piLater.id : null;
      const seed = earlyIdx + k;
      const bv = hasWsjf ? fib(seed + 1) : null;
      const tc = hasWsjf ? fib(seed + 2) : null;
      const rr = hasWsjf ? fib(seed + 3) : null;
      const js = hasWsjf ? Math.max(1, fib(seed + 4)) : null;
      const computed =
        hasWsjf && bv !== null && tc !== null && rr !== null && js !== null
          ? round2((bv + tc + rr) / js)
          : null;
      features.push({ id, epicId: epic.id, artId: art.id, piId });
      await prisma.initiative.create({
        data: {
          id,
          tenantId,
          level: 1,
          parentId: epic.id,
          artId: art.id,
          ...(piId ? { piId } : {}),
          path: `${epic.id}.${id}`,
          title: `${epic.spec.title} — early-stage feature ${k + 1}`,
          description: `Early breakdown ${k + 1} of "${epic.spec.title}" — still in ${gate}.`,
          featureType: (seed % 4 === 0 ? "enabler" : "feature") as FeatureType,
          ownerId: featureOwnerId,
          assigneeIds: [],
          createdBy: adminId,
          updatedBy: adminId,
          ...(bv !== null ? { wsjfBusinessValue: bv } : {}),
          ...(tc !== null ? { wsjfTimeCriticality: tc } : {}),
          ...(rr !== null ? { wsjfRiskReduction: rr } : {}),
          ...(js !== null ? { wsjfJobSize: js } : {}),
          ...(computed !== null ? { wsjfComputed: computed } : {}),
          acceptanceCriteria:
            gate === "L0"
              ? []
              : [`Initial slice of "${epic.spec.title}" — refine the AC before pulling into a PI.`],
          status: "approved",
          stageGate: "L0",
        },
      });
    }
    earlyIdx += n;
  }
  console.log(`  ✓ ${features.length} early-stage features (L0/L1/L2 Epics)`);

  // 12b. Delivery Epics — 60 features with realistic WSJF + PI assignment.
  const earlyFeatureBaseline = features.length;
  const featureCount = 60;
  for (let i = 0; i < featureCount; i++) {
    const epic = deliveryEpics[i % deliveryEpics.length]!;
    const art = artForEpic(epic);
    const id = randomUUID();
    const tier = i % 10; // 0–2 high, 3–7 medium, 8–9 low
    const bv = tier < 3 ? fib(i + 5) : tier < 8 ? fib(i + 2) : fib(i);
    const tc = tier < 3 ? fib(i + 4) : fib(i + 1);
    const rr = tier < 3 ? fib(i + 6) : fib(i + 3);
    const js = tier < 3 ? Math.max(1, fib(i) % 6) : fib(i);
    const computed = round2((bv + tc + rr) / js);

    // ~55% land in a PI, ~45% in the backlog.
    const inPi = i % 11 < 6;
    const piId = inPi ? piPool[i % piPool.length]!.id : null;
    // Features starten in „Bereit" (= „approved") nach Abschaffung des
    // Feature-QA-Gates 2026-06. Backlog-Features ohne PI bekommen denselben
    // Default.
    const status =
      piId === piCompletedC.id ? "completed" : piId === piActive.id ? "in_progress" : "approved";

    features.push({ id, epicId: epic.id, artId: art.id, piId });
    await prisma.initiative.create({
      data: {
        id,
        tenantId,
        level: 1,
        parentId: epic.id,
        artId: art.id,
        ...(piId ? { piId } : {}),
        path: `${epic.id}.${id}`,
        title: `${epic.spec.title} — feature ${i + 1}`,
        description: `Slice ${i + 1} of "${epic.spec.title}".`,
        featureType: (i % 4 === 0 ? "enabler" : "feature") as FeatureType,
        ownerId: featureOwnerId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: computed,
        acceptanceCriteria: [
          `Given the user opens "${epic.spec.title}", when slice ${i + 1} is shipped, then the visible behaviour matches the AC.`,
          `Given an edge case occurs, then a structured error is logged and surfaced.`,
        ],
        status,
        stageGate: "L0",
      },
    });
  }
  console.log(
    `  ✓ ${features.length - earlyFeatureBaseline} delivery features (mixed WSJF, ~55% in a PI) — ${features.length} features total`,
  );

  // 13. Stories — 80 spread across active + next-planned PI Features and a few completed.
  console.log("\n── Stories");
  const storyCount = 80;
  const storyableFeatures = features.filter(
    (f) => f.piId === piActive.id || f.piId === piNext.id || f.piId === piCompletedC.id,
  );
  const stories: Array<{
    id: string;
    parentId: string;
    parentPath: string;
    piId: string | null;
    sprintId: string | null;
    status: string;
  }> = [];
  for (let i = 0; i < storyCount; i++) {
    const feat = storyableFeatures[i % storyableFeatures.length]!;
    const id = randomUUID();
    const team = teams.filter((t) => t.artId === feat.artId)[i % 3]!;
    // Pick a sprint within the feature's PI for this team — fall back to first sprint
    // if the team isn't on this PI for some reason.
    const candidateSprints = feat.piId ? (sprintByPiTeam.get(`${feat.piId}/${team.id}`) ?? []) : [];
    const sprintId =
      candidateSprints.length > 0 ? candidateSprints[i % candidateSprints.length]!.id : null;
    const statusPool =
      feat.piId === piCompletedC.id
        ? ["completed", "done"]
        : feat.piId === piActive.id
          ? ["draft", "in_progress", "in_progress", "completed"]
          : ["draft"];
    const status = statusPool[i % statusPool.length]!;
    const parentPath = `${feat.epicId}.${feat.id}`;
    stories.push({ id, parentId: feat.id, parentPath, piId: feat.piId, sprintId, status });
    await prisma.initiative.create({
      data: {
        id,
        tenantId,
        level: 2,
        parentId: feat.id,
        path: `${parentPath}/${id}`,
        title: `Story ${i + 1}`,
        ownerId: storyOwnerId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        storyPoints: fib(i + 3),
        acceptanceCriteria: [`Story ${i + 1} acceptance criterion.`],
        status,
        ...(feat.piId ? { piId: feat.piId } : {}),
        ...(sprintId ? { sprintId } : {}),
      },
    });
  }
  console.log(`  ✓ ${stories.length} stories assigned to sprints`);

  // 14. Tasks — ~40 across half of the in_progress stories.
  console.log("\n── Tasks");
  const taskParents = stories.filter((s) => s.status === "in_progress").slice(0, 20);
  let taskCount = 0;
  for (const story of taskParents) {
    const n = 2 + (taskCount % 3);
    for (let i = 0; i < n; i++) {
      const id = randomUUID();
      const status = i === 0 ? "completed" : i < n - 1 ? "in_progress" : "draft";
      const hours = (4 + ((i * 3) % 10)).toFixed(1);
      await prisma.initiative.create({
        data: {
          id,
          tenantId,
          level: 3,
          parentId: story.id,
          path: `${story.parentPath}/${story.id}/${id}`,
          title: `Task ${taskCount + 1}`,
          ownerId: taskOwnerId,
          assigneeIds: [],
          createdBy: adminId,
          updatedBy: adminId,
          estimateHours: hours,
          status,
        },
      });
      taskCount += 1;
      if (taskCount >= 40) break;
    }
    if (taskCount >= 40) break;
  }
  console.log(`  ✓ ${taskCount} tasks`);

  // 15. KPIs — 1–2 per Epic (≥ L1), with measurement history.
  console.log("\n── KPIs");
  const kpiTemplates: Array<{ name: string; unit: string; baseline: number; target: number }> = [
    { name: "Conversion rate", unit: "%", baseline: 38, target: 80 },
    { name: "Settlement time", unit: "min", baseline: 1440, target: 1 },
    { name: "Fraud loss rate", unit: "bps", baseline: 18, target: 7 },
    { name: "Daily active users", unit: "users", baseline: 42000, target: 60000 },
    { name: "Tier-1 deflection", unit: "%", baseline: 0, target: 35 },
    { name: "Crash-free sessions", unit: "%", baseline: 98.5, target: 99.9 },
    { name: "Attach rate", unit: "%", baseline: 0, target: 12 },
    { name: "AUM growth", unit: "€M", baseline: 240, target: 276 },
  ];
  let kpiTotal = 0;
  for (let i = 0; i < epics.length; i++) {
    const epic = epics[i]!;
    if (epic.spec.stageGate === "L0") continue;
    const count = epic.spec.stageGate === "L1" ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const tpl = kpiTemplates[(i * 2 + k) % kpiTemplates.length]!;
      const delta = (tpl.target - tpl.baseline) / 6;
      const measurements = Array.from({ length: 6 }, (_, m) => ({
        date: daysFromAnchor(-180 + m * 30)
          .toISOString()
          .slice(0, 10),
        value: round2(tpl.baseline + delta * m * (0.6 + (m % 3) * 0.15)),
      }));
      await prisma.kpi.create({
        data: {
          tenantId,
          initiativeId: epic.id,
          name: tpl.name,
          unit: tpl.unit,
          baseline: tpl.baseline.toString(),
          target: tpl.target.toString(),
          measurements,
          benefitWeight: count === 2 ? (k === 0 ? "0.6" : "0.4") : null,
          valuePerUnit: k === 0 ? "12000" : null,
          createdBy: ownerId,
          updatedBy: ownerId,
        },
      });
      kpiTotal += 1;
    }
  }
  console.log(`  ✓ ${kpiTotal} KPIs with monthly measurement history`);

  // 16. Dependencies — 15 mixed types, including one cross-ART.
  console.log("\n── Dependencies");
  const pickFeat = (offset: number) => features[(offset * 7) % features.length]!;
  const depRows = [
    { from: pickFeat(0), to: pickFeat(1), type: "blocks" },
    { from: pickFeat(2), to: pickFeat(3), type: "blocks" },
    { from: pickFeat(4), to: pickFeat(5), type: "blocks" },
    { from: pickFeat(6), to: pickFeat(7), type: "blocks" },
    { from: pickFeat(8), to: pickFeat(9), type: "blocks" },
    { from: pickFeat(10), to: pickFeat(11), type: "depends_on" },
    { from: pickFeat(12), to: pickFeat(13), type: "depends_on" },
    { from: pickFeat(14), to: pickFeat(15), type: "depends_on" },
    { from: pickFeat(16), to: pickFeat(17), type: "depends_on" },
    { from: pickFeat(18), to: pickFeat(19), type: "depends_on" },
    { from: pickFeat(20), to: pickFeat(21), type: "relates_to" },
    { from: pickFeat(22), to: pickFeat(23), type: "relates_to" },
    { from: pickFeat(24), to: pickFeat(25), type: "relates_to" },
    { from: pickFeat(26), to: pickFeat(27), type: "relates_to" },
    { from: pickFeat(28), to: pickFeat(29), type: "relates_to" },
  ];
  const depKeys = new Set<string>();
  let depCount = 0;
  for (const d of depRows) {
    if (d.from.id === d.to.id) continue;
    const key = `${d.from.id}->${d.to.id}/${d.type}`;
    if (depKeys.has(key)) continue;
    depKeys.add(key);
    await prisma.dependency.create({
      data: {
        tenantId,
        fromId: d.from.id,
        toId: d.to.id,
        type: d.type,
        createdBy: adminId,
      },
    });
    depCount += 1;
  }
  console.log(`  ✓ ${depCount} dependencies`);

  // 17. Impediments — 20 across severity × status, some resolved.
  console.log("\n── Impediments");
  const impTitles = [
    "Third-party API rate limit blocking onboarding tests",
    "Identity-fraud vendor outage",
    "PCI environment refresh delayed",
    "Card-network sandbox down",
    "ML training cluster GPU quota exhausted",
    "Open-banking consent flow rejected by partner bank",
    "Legacy ledger batch window conflict",
    "Robo-advisor compliance review parked",
    "Sprint demo environment unstable",
    "Test data refresh blocked by GDPR review",
    "Spike in fraud false-positives during canary",
    "Mobile build broken on iOS 17.5",
    "Salesforce integration token expired",
    "Production logs missing for last 24h",
    "Support tooling export deprecated",
    "ESG data feed schema changed",
    "BNPL credit policy clarification needed",
    "Pen-test findings to triage",
    "Translation backlog blocking release",
    "Database connection-pool saturation in staging",
  ];
  const severities = ["low", "medium", "high", "critical"] as const;
  const statuses = ["open", "open", "escalated", "resolved"] as const;
  for (let i = 0; i < impTitles.length; i++) {
    const art = i % 3 === 0 ? art1 : i % 3 === 1 ? art2 : art3;
    const sev = severities[i % severities.length]!;
    const status = statuses[i % statuses.length]!;
    const piLink = i % 4 === 0 ? piActive.id : i % 4 === 1 ? piNext.id : null;
    const sprintCandidate = piLink
      ? (sprintByPiTeam.get(`${piLink}/${teams.find((t) => t.artId === art.id)?.id}`) ?? [])[0]
      : null;
    await prisma.impediment.create({
      data: {
        tenantId,
        artId: art.id,
        ...(piLink ? { piId: piLink } : {}),
        ...(sprintCandidate ? { sprintId: sprintCandidate.id } : {}),
        title: impTitles[i]!,
        description: `Auto-seeded impediment ${i + 1}.`,
        severity: sev,
        status,
        raisedBy: rteId,
        ...(status === "resolved"
          ? {
              resolvedAt: daysFromAnchor(-(i + 3)),
              resolvedBy: rteId,
              resolution: "Mitigated by switching to the backup provider.",
            }
          : {}),
      },
    });
  }
  console.log(`  ✓ ${impTitles.length} impediments`);

  // 18. PiObjectives — 4 per team for active + next PI.
  console.log("\n── PiObjectives");
  let objCount = 0;
  for (const pi of [piActive, piNext]) {
    for (const team of teams) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        await prisma.piObjective.create({
          data: {
            tenantId,
            piId: pi.id,
            teamId: team.id,
            title: `${team.name} — Objective ${i + 1} for ${pi.name}`,
            description:
              i === n - 1
                ? "Uncommitted stretch objective — bonus if landed within the PI."
                : "Committed objective with team confidence.",
            businessValue: 4 + ((i * 2) % 6),
            committed: i !== n - 1,
            confidence: 3 + (i % 3),
            createdBy: rteId,
          },
        });
        objCount += 1;
      }
    }
  }
  console.log(`  ✓ ${objCount} PI objectives`);

  // 19. Budgeting — ArtBudgets, BudgetAllocations, BudgetPlanRevisions.
  console.log("\n── Budgeting");
  for (const art of [art1, art2, art3]) {
    await prisma.artBudget.create({
      data: {
        tenantId,
        artId: art.id,
        byPeriod: { "2025-H2": 1200000, "2026-H1": 1300000, "2026-H2": 1400000 },
        createdBy: portfolioId,
        updatedBy: portfolioId,
      },
    });
  }
  const allocEpics = epics.filter((e) => e.spec.stageGate !== "L0").slice(0, 20);
  for (let i = 0; i < allocEpics.length; i++) {
    const e = allocEpics[i]!;
    await prisma.budgetAllocation.create({
      data: {
        tenantId,
        epicId: e.id,
        priority: i + 1,
        ...(e.spec.stageGate === "L1" ? { hypothesisBudget: "40000" } : {}),
        allocations: {
          "2026-H1": 80000 + (i % 6) * 20000,
          "2026-H2": 90000 + (i % 5) * 20000,
        },
        createdBy: portfolioId,
        updatedBy: portfolioId,
      },
    });
  }
  await prisma.budgetPlanRevision.create({
    data: {
      tenantId,
      cycleKey: "2025-H2",
      capturedAt: daysFromAnchor(-180),
      capturedBy: portfolioId,
      payload: { note: "Initial captured snapshot — seed placeholder", capturedAt: "2025-12-15" },
    },
  });
  await prisma.budgetPlanRevision.create({
    data: {
      tenantId,
      cycleKey: "2026-H1",
      capturedAt: daysFromAnchor(-30),
      capturedBy: portfolioId,
      payload: { note: "Mid-cycle captured snapshot — seed placeholder", capturedAt: "2026-05-06" },
    },
  });
  console.log(`  ✓ 3 ART budgets, ${allocEpics.length} epic allocations, 2 plan revisions`);

  // 20. Target Operating Model (1 active + 1 archived).
  console.log("\n── Target Operating Model");
  await prisma.targetOperatingModel.create({
    data: {
      tenantId,
      status: "archived",
      template: "team_level",
      targetDate: new Date("2025-06-30"),
      targetValueStreams: 2,
      targetArtsTotal: 2,
      targetTeamsTotal: 6,
      targetPiCadenceWeeks: 12,
      portfolioLevel: false,
      programLevel: true,
      stageGates: false,
      wsjf: true,
      multiPartyApproval: false,
      featureQs: false,
      dependencies: true,
      piObjectives: true,
      createdBy: transformationLeadId,
      updatedBy: transformationLeadId,
    },
  });
  await prisma.targetOperatingModel.create({
    data: {
      tenantId,
      status: "active",
      template: "essential_safe",
      targetDate: new Date("2026-12-31"),
      targetValueStreams: 3,
      targetArtsTotal: 3,
      targetTeamsTotal: 12,
      targetPiCadenceWeeks: 10,
      portfolioLevel: true,
      programLevel: true,
      stageGates: true,
      wsjf: true,
      multiPartyApproval: true,
      featureQs: true,
      dependencies: true,
      piObjectives: true,
      createdBy: transformationLeadId,
      updatedBy: transformationLeadId,
    },
  });
  console.log("  ✓ 2 target operating models (1 active, 1 archived)");

  // 21. Transformation goals + outcomes + actions + snapshots + epic links.
  console.log("\n── Transformation");
  const goalSpecs = [
    { title: "Customer experience leadership", status: "active" },
    { title: "Operational efficiency", status: "active" },
    { title: "Risk & compliance posture", status: "active" },
    { title: "New revenue lines", status: "active" },
    { title: "Talent & engineering excellence", status: "achieved" },
  ];
  const goals: { id: string; title: string }[] = [];
  for (const g of goalSpecs) {
    const id = randomUUID();
    goals.push({ id, title: g.title });
    await prisma.transformationGoal.create({
      data: {
        id,
        tenantId,
        title: g.title,
        description: `Strategic goal: ${g.title}.`,
        ownerId: transformationLeadId,
        dueDate: new Date("2026-12-31"),
        status: g.status,
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
  }

  const outcomeSpecs: Array<{
    goalIndex: number | null;
    title: string;
    unit: string;
    baseline: number;
    target: number;
    current: number;
  }> = [
    { goalIndex: 0, title: "NPS", unit: "score", baseline: 32, target: 55, current: 41 },
    {
      goalIndex: 0,
      title: "App store rating",
      unit: "stars",
      baseline: 4.2,
      target: 4.7,
      current: 4.4,
    },
    {
      goalIndex: 1,
      title: "Cost-to-serve / customer",
      unit: "€",
      baseline: 42,
      target: 28,
      current: 36,
    },
    {
      goalIndex: 1,
      title: "Straight-through processing",
      unit: "%",
      baseline: 64,
      target: 90,
      current: 78,
    },
    {
      goalIndex: 2,
      title: "Audit findings open > 90d",
      unit: "count",
      baseline: 14,
      target: 0,
      current: 5,
    },
    {
      goalIndex: 2,
      title: "Critical CVEs unpatched",
      unit: "count",
      baseline: 8,
      target: 0,
      current: 2,
    },
    {
      goalIndex: 3,
      title: "New revenue lines launched",
      unit: "count",
      baseline: 0,
      target: 4,
      current: 2,
    },
    {
      goalIndex: 3,
      title: "Partner integrations live",
      unit: "count",
      baseline: 1,
      target: 12,
      current: 5,
    },
    {
      goalIndex: null,
      title: "Hiring conversion rate",
      unit: "%",
      baseline: 24,
      target: 40,
      current: 31,
    },
    {
      goalIndex: null,
      title: "Onboarding NPS (new joiners)",
      unit: "score",
      baseline: 38,
      target: 55,
      current: 49,
    },
    {
      goalIndex: null,
      title: "Spend on consultants",
      unit: "€k/mo",
      baseline: 320,
      target: 180,
      current: 240,
    },
    {
      goalIndex: null,
      title: "Cycle time from PR to prod",
      unit: "h",
      baseline: 36,
      target: 4,
      current: 12,
    },
  ];
  for (const o of outcomeSpecs) {
    await prisma.targetOutcome.create({
      data: {
        tenantId,
        goalId: o.goalIndex === null ? null : goals[o.goalIndex]!.id,
        title: o.title,
        metricUnit: o.unit,
        baseline: o.baseline,
        target: o.target,
        current: o.current,
        dueDate: new Date("2026-12-31"),
        valuePerUnit: "8000",
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
  }

  const actionTitles = [
    "Standardise OKR cadence across ARTs",
    "Stand up the Architecture Review Board",
    "Run quarterly capability uplift workshops",
    "Migrate critical services to new identity platform",
    "Roll out coaching pairs for new RTEs",
    "Decommission legacy reporting cube",
    "Adopt feature-flag-as-policy framework",
    "Refresh the engineering on-call rotation",
    "Charter the Value Management Office",
    "Define the Lean Portfolio operating cadence",
    "Establish the PI demo broadcast",
    "Centralise the dependency-tracking board",
    "Land the developer-experience baseline",
    "Renegotiate the cloud commit + spend guardrails",
    "Publish the customer-permission inventory",
  ];
  for (let i = 0; i < actionTitles.length; i++) {
    const status = i % 5 === 0 ? "done" : i % 3 === 0 ? "in_progress" : "open";
    await prisma.transformationAction.create({
      data: {
        tenantId,
        title: actionTitles[i]!,
        status,
        ownerId: transformationLeadId,
        dueDate: daysFromAnchor(30 + i * 10),
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
  }

  // Daily snapshots for the last 60 days — goalAchievement walks up 0.35 → 0.62.
  for (let i = 0; i < 60; i++) {
    const day = daysFromAnchor(-(60 - i));
    const goalAchievement = round2(0.35 + (0.27 * i) / 59);
    const structureProgress = round2(0.42 + (0.31 * i) / 59);
    const achievedGoalCount = i < 30 ? 0 : i < 50 ? 1 : 2;
    await prisma.transformationSnapshot.create({
      data: {
        tenantId,
        capturedOn: day,
        goalAchievement,
        structureProgress,
        goalCount: 5,
        achievedGoalCount,
      },
    });
  }

  // GoalEpicLinks — each active goal touches a handful of delivery epics.
  let linkCount = 0;
  for (let g = 0; g < goals.length; g++) {
    for (let i = 0; i < Math.min(4, deliveryEpics.length); i++) {
      const epic = deliveryEpics[(g + i * 2) % deliveryEpics.length]!;
      try {
        await prisma.goalEpicLink.create({
          data: {
            tenantId,
            goalId: goals[g]!.id,
            epicId: epic.id,
            createdBy: transformationLeadId,
          },
        });
        linkCount += 1;
        if (linkCount >= 20) break;
      } catch {
        // Unique constraint — skip duplicate goal/epic combos.
      }
    }
    if (linkCount >= 20) break;
  }
  console.log(
    `  ✓ ${goals.length} goals, ${outcomeSpecs.length} target outcomes, ${actionTitles.length} actions, 60 snapshots, ${linkCount} goal↔epic links`,
  );

  // 22. Ziele V2 (Vision → Themes → OKRs → KRs + KPI-Bridges + Theme↔Epic).
  console.log("\n── Ziele V2");

  // KPIs des Tenants laden, damit auto_from_kpi-KRs an existierende Epic-KPIs
  // gebunden werden koennen. Substring-Match auf den Namen reicht — die seeded
  // KPIs sind aus einer kleinen Library (Conversion %, Settlement time, NPS, …).
  const allTenantKpis = await prisma.kpi.findMany({
    where: { tenantId },
    select: { id: true, name: true, baseline: true, target: true, valuePerUnit: true },
  });
  function pickKpis(...patterns: string[]): { id: string }[] {
    const hits = allTenantKpis.filter((k) =>
      patterns.some((p) => k.name.toLowerCase().includes(p.toLowerCase())),
    );
    return hits.length > 0 ? hits.slice(0, 2) : allTenantKpis.slice(0, 1);
  }

  // 22a) Tenant-Vision
  const visionId = randomUUID();
  await prisma.portfolioVision.create({
    data: {
      id: visionId,
      tenantId,
      scope: "tenant",
      valueStreamId: null,
      title: "Pulse 2030 — Connected Banking Leader",
      narrative:
        "Wir wollen 2030 die fuehrende Connected-Banking-Plattform in EMEA sein — gemessen an NPS, Marktanteil und Plattform-Reife.",
      horizonStart: new Date("2025-01-01"),
      horizonEnd: new Date("2030-12-31"),
      ownerId: transformationLeadId,
      status: "published",
      createdBy: transformationLeadId,
      updatedBy: transformationLeadId,
    },
  });

  // 22b) Strategic Themes — 4 mappen auf Legacy-Goal-Identitaeten,
  //      Theme #5 „Cloud Foundation" ist V2-nativ.
  const themeSpecs: Array<{
    title: string;
    narrative: string;
    kind: "business" | "enabler";
    color: string;
    budget: number;
  }> = [
    {
      title: "Customer Experience Leadership",
      narrative: "Kundenexzellenz durch radikale Vereinfachung der mobile-first Journey.",
      kind: "business",
      color: "#6366f1",
      budget: 1_200_000,
    },
    {
      title: "Operational Efficiency",
      narrative: "Straight-through Processing und Self-Service ueber alle Kanaele.",
      kind: "business",
      color: "#0ea5e9",
      budget: 800_000,
    },
    {
      title: "New Revenue Lines",
      narrative: "Wealth-Subscription + Partner-Integrations als zweite Saeule.",
      kind: "business",
      color: "#10b981",
      budget: 600_000,
    },
    {
      title: "Security & Compliance Modernization",
      narrative: "Zero-Trust + Compliance-by-Design als nicht-verhandelbare Foundation.",
      kind: "enabler",
      color: "#f59e0b",
      budget: 400_000,
    },
    {
      title: "Cloud Foundation",
      narrative:
        "Cloud-Migration aller Tier-1-Workloads bis 2027 — Voraussetzung fuer alles andere.",
      kind: "enabler",
      color: "#a855f7",
      budget: 800_000,
    },
  ];
  const themes: { id: string; title: string; kind: "business" | "enabler" }[] = [];
  for (let i = 0; i < themeSpecs.length; i++) {
    const spec = themeSpecs[i]!;
    const id = randomUUID();
    themes.push({ id, title: spec.title, kind: spec.kind });
    await prisma.strategicTheme.create({
      data: {
        id,
        tenantId,
        visionId,
        title: spec.title,
        narrative: spec.narrative,
        color: spec.color,
        kind: spec.kind,
        budgetPlanned: spec.budget,
        ownerId: transformationLeadId,
        sortOrder: i,
        status: "active",
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
  }

  // 22c) Objectives — Periode + Confidence + Status streuen.
  //      Q1-2026 (achieved), Q2-2026 (current — viele active), Q3, Q4.
  const objectiveSpecs: Array<{
    themeIdx: number;
    title: string;
    narrative: string;
    period: string | null;
    confidence: number;
    status: string;
  }> = [
    {
      themeIdx: 0,
      title: "Konversion verdoppeln",
      narrative: "Time-to-Yes runter, NPS hoch — die zwei Hebel der mobile Journey.",
      period: "2026-Q2",
      confidence: 4,
      status: "active",
    },
    {
      themeIdx: 0,
      title: "NPS +20 Punkte",
      narrative: "Stabilisierung nach Onboarding-Re-Design.",
      period: "2026-Q3",
      confidence: 3,
      status: "active",
    },
    {
      themeIdx: 1,
      title: "Cart-Abbruch -30 %",
      narrative: "Recovery-Mails + Self-Service-Konsolidierung.",
      period: "2026-Q2",
      confidence: 3,
      status: "active",
    },
    {
      themeIdx: 1,
      title: "Time-to-Yes < 2 min",
      narrative: "Schon erreicht in Q1; Anker fuer Q2-Story.",
      period: "2026-Q1",
      confidence: 5,
      status: "achieved",
    },
    {
      themeIdx: 2,
      title: "Self-Service-Rate 80 %",
      narrative: "Wealth-Onboarding fully self-service.",
      period: "2026-Q2",
      confidence: 4,
      status: "active",
    },
    {
      themeIdx: 2,
      title: "API-Onboarding < 1 Tag",
      narrative: "Partner-Onboarding via Public-API.",
      period: "2026-Q4",
      confidence: 2,
      status: "draft",
    },
    {
      themeIdx: 3,
      title: "Audit-Findings 0",
      narrative: "Critical-CVE-Backlog auf Null bis Q3.",
      period: "2026-Q2",
      confidence: 4,
      status: "active",
    },
    {
      themeIdx: 4,
      title: "60 % Workloads auf Cloud",
      narrative: "Migration der Tier-1-Services in Q3.",
      period: "2026-Q3",
      confidence: 4,
      status: "active",
    },
  ];
  const objectives: { id: string; themeIdx: number }[] = [];
  for (let i = 0; i < objectiveSpecs.length; i++) {
    const spec = objectiveSpecs[i]!;
    const id = randomUUID();
    objectives.push({ id, themeIdx: spec.themeIdx });
    await prisma.objective.create({
      data: {
        id,
        tenantId,
        themeId: themes[spec.themeIdx]!.id,
        title: spec.title,
        narrative: spec.narrative,
        period: spec.period,
        confidence: spec.confidence,
        ownerId: transformationLeadId,
        sortOrder: i,
        status: spec.status,
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
  }

  // 22d) Key Results — 2 je Objective, Mix aus auto_from_kpi und manual.
  //      Drift-Demo: ein KR pro Theme mit current = baseline (0 % achievement).
  const krSpecs: Array<{
    objIdx: number;
    title: string;
    unit: string;
    formula: "auto_from_kpi" | "manual";
    kpiPatterns?: string[];
    baseline?: number;
    target?: number;
    current?: number;
    valuePerUnitOverride?: number;
  }> = [
    {
      objIdx: 0,
      title: "Konversion 8 → 16 %",
      unit: "%",
      formula: "auto_from_kpi",
      kpiPatterns: ["Conversion"],
    },
    {
      objIdx: 0,
      title: "Time-to-Yes < 2 min",
      unit: "min",
      formula: "manual",
      baseline: 8,
      target: 2,
      current: 4,
    },
    {
      objIdx: 1,
      title: "NPS Mobile +15",
      unit: "pts",
      formula: "auto_from_kpi",
      kpiPatterns: ["NPS"],
    },
    {
      objIdx: 1,
      title: "NPS Web +12 (Drift)",
      unit: "pts",
      formula: "manual",
      baseline: 28,
      target: 40,
      current: 28,
    },
    {
      objIdx: 2,
      title: "Cart-Rate -30 %",
      unit: "%",
      formula: "auto_from_kpi",
      kpiPatterns: ["Conversion"],
    },
    {
      objIdx: 2,
      title: "Recovery-Mails CTR > 25 %",
      unit: "%",
      formula: "manual",
      baseline: 12,
      target: 25,
      current: 18,
    },
    {
      objIdx: 3,
      title: "Settlement < 2 min",
      unit: "min",
      formula: "auto_from_kpi",
      kpiPatterns: ["Settlement time"],
    },
    {
      objIdx: 3,
      title: "Customer-Sat-Score 4.8",
      unit: "score",
      formula: "manual",
      baseline: 4.2,
      target: 4.8,
      current: 4.8,
    },
    {
      objIdx: 4,
      title: "Self-Service-Rate 80 %",
      unit: "%",
      formula: "auto_from_kpi",
      kpiPatterns: ["Tier-1 deflection"],
    },
    {
      objIdx: 4,
      title: "Time-to-Onboard < 5 min",
      unit: "min",
      formula: "manual",
      baseline: 12,
      target: 5,
      current: 8,
    },
    {
      objIdx: 5,
      title: "Public-API-Calls > 10k/Tag",
      unit: "calls",
      formula: "manual",
      baseline: 200,
      target: 10000,
      current: 200,
    },
    {
      objIdx: 6,
      title: "Audit-Findings open > 90 d",
      unit: "count",
      formula: "auto_from_kpi",
      kpiPatterns: ["Fraud", "Crash-free"],
    },
    {
      objIdx: 6,
      title: "Critical-CVEs unpatched",
      unit: "count",
      formula: "manual",
      baseline: 8,
      target: 0,
      current: 3,
    },
    {
      objIdx: 7,
      title: "Cloud-Coverage 30 → 60 %",
      unit: "%",
      formula: "auto_from_kpi",
      kpiPatterns: ["AUM"],
      valuePerUnitOverride: 12_000,
    },
    {
      objIdx: 7,
      title: "Latency < 200 ms p95",
      unit: "ms",
      formula: "manual",
      baseline: 450,
      target: 200,
      current: 320,
    },
  ];
  let contribCount = 0;
  let krCount = 0;
  for (let i = 0; i < krSpecs.length; i++) {
    const spec = krSpecs[i]!;
    const krId = randomUUID();
    krCount += 1;
    await prisma.keyResult.create({
      data: {
        id: krId,
        tenantId,
        objectiveId: objectives[spec.objIdx]!.id,
        title: spec.title,
        metricName: spec.title,
        metricUnit: spec.unit,
        baseline: spec.baseline ?? null,
        target: spec.target ?? null,
        current: spec.current ?? null,
        formula: spec.formula,
        ownerId: transformationLeadId,
        sortOrder: i,
        createdBy: transformationLeadId,
        updatedBy: transformationLeadId,
      },
    });
    if (spec.formula === "auto_from_kpi" && spec.kpiPatterns) {
      const kpis = pickKpis(...spec.kpiPatterns);
      const weight = kpis.length > 0 ? Number((1 / kpis.length).toFixed(4)) : 1;
      for (let j = 0; j < kpis.length; j++) {
        const kpi = kpis[j]!;
        await prisma.krKpiContribution.create({
          data: {
            id: randomUUID(),
            tenantId,
            keyResultId: krId,
            kpiId: kpi.id,
            weight,
            valuePerUnitOverride:
              j === 0 && spec.valuePerUnitOverride != null ? spec.valuePerUnitOverride : null,
            createdBy: transformationLeadId,
          },
        });
        contribCount += 1;
      }
    }
  }

  // 22e) Theme ↔ Epic Links — die ersten 6 L0-Epics auf passende Themes binden.
  const topEpics = epics.slice(0, 6);
  let epicLinkCount = 0;
  for (let i = 0; i < topEpics.length; i++) {
    const epic = topEpics[i]!;
    const theme = themes[i % themes.length]!;
    try {
      await prisma.themeEpicLink.create({
        data: {
          id: randomUUID(),
          tenantId,
          themeId: theme.id,
          epicId: epic.id,
          createdBy: transformationLeadId,
        },
      });
      epicLinkCount += 1;
    } catch {
      // Unique-Constraint auf (themeId, epicId) — Duplikate skippen.
    }
  }

  // 22f) Pflege-Tab-Coverage: 3 KPIs auf valuePerUnit=null setzen, damit das
  //      „Setup offen"-Badge in der KPI-Bibliothek erscheint.
  const someKpis = await prisma.kpi.findMany({
    where: { tenantId },
    select: { id: true },
    take: 3,
    orderBy: { name: "asc" },
  });
  for (const k of someKpis) {
    await prisma.kpi.update({ where: { id: k.id }, data: { valuePerUnit: null } });
  }

  console.log(
    `  ✓ V2 Ziele: 1 Vision, ${themes.length} Themes, ${objectives.length} Objectives, ${krCount} KRs, ${contribCount} KR↔KPI bindings, ${epicLinkCount} Theme↔Epic links, ${someKpis.length} valuePerUnit-Gaps`,
  );

  // 23. PI standards (named cadence templates).
  console.log("\n── PI standards");
  await prisma.piStandard.create({
    data: {
      tenantId,
      name: "Quarterly 13-week",
      anchorMonth: 1,
      anchorDay: 5,
      cadenceWeeks: 13,
      piCount: 4,
      createdBy: adminId,
    },
  });
  await prisma.piStandard.create({
    data: {
      tenantId,
      name: "Decadal 10-week",
      anchorMonth: 1,
      anchorDay: 5,
      cadenceWeeks: 10,
      piCount: 5,
      createdBy: adminId,
    },
  });
  console.log("  ✓ 2 PI standards");

  console.log("\n✅  Seed complete!\n");
  console.log("Test accounts (admin password Admin1234!, others Test1234!):");
  console.log("  admin@pulse.dev            tenant_admin");
  console.log("  portfolio@pulse.dev        portfolio_manager");
  console.log("  vmo@pulse.dev              vmo (Epic QS)");
  console.log("  rte@pulse.dev              rte (Feature QS)");
  console.log("  owner@pulse.dev            epic_owner + feature_owner");
  console.log("  viewer@pulse.dev           viewer (read-only)");
  console.log("  vso@pulse.dev              value_stream_owner (scoped: Retail Banking)");
  console.log("  featureowner@pulse.dev     feature_owner (scoped: Mobile Banking ART)");
  console.log("  teameditor@pulse.dev       team_editor (scoped: Atlas Team)");
  console.log("  storyowner@pulse.dev       story_owner (scoped: Mobile Banking ART)");
  console.log("  taskowner@pulse.dev        task_owner");
  console.log("  transformation@pulse.dev   transformation_lead\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
