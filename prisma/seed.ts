/* eslint-disable no-console */
/**
 * Development seed.
 *
 * Wipes all domain data for the demo tenant, then recreates a fresh example
 * portfolio. Auth accounts, the tenant itself and role assignments are kept.
 *
 * Test users (created once, reused on every run):
 *   admin@pulse.dev        / Admin1234!   → tenant_admin + portfolio_editor
 *   portfolio@pulse.dev    / Test1234!    → portfolio_editor
 *   viewer@pulse.dev       / Test1234!    → (no special role — read-only)
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/index.js";

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

async function upsertAuthUser(email: string, password: string): Promise<string> {
  // Check if user already exists
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
 * accounts, the Tenant and UserRoleAssignment rows are left untouched.
 */
async function wipeDomainData(tenantId: string): Promise<void> {
  console.log("\n── Wiping existing domain data");
  await prisma.dependency.deleteMany({ where: { tenantId } });
  await prisma.kpi.deleteMany({ where: { tenantId } });
  for (const level of [3, 2, 1, 0]) {
    await prisma.initiative.deleteMany({ where: { tenantId, level } });
  }
  await prisma.impediment.deleteMany({ where: { tenantId } });
  await prisma.piObjective.deleteMany({ where: { tenantId } });
  await prisma.sprint.deleteMany({ where: { tenantId } });
  await prisma.programIncrement.deleteMany({ where: { tenantId } });
  await prisma.team.deleteMany({ where: { tenantId } });
  await prisma.art.deleteMany({ where: { tenantId } });
  await prisma.valueStream.deleteMany({ where: { tenantId } });
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
  await upsertAuthUser("viewer@pulse.dev", "Test1234!");

  // 2. Tenant
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

  // 3. Role assignments
  console.log("\n── Role assignments");
  await Promise.all([
    prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId: adminId, tenantId, role: "tenant_admin" } },
      create: {
        userId: adminId,
        tenantId,
        role: "tenant_admin",
        valueStreamIds: [],
        artIds: [],
        teamIds: [],
      },
      update: {},
    }),
    prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId: adminId, tenantId, role: "portfolio_editor" } },
      create: {
        userId: adminId,
        tenantId,
        role: "portfolio_editor",
        valueStreamIds: [],
        artIds: [],
        teamIds: [],
      },
      update: {},
    }),
    prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId: portfolioId, tenantId, role: "portfolio_editor" } },
      create: {
        userId: portfolioId,
        tenantId,
        role: "portfolio_editor",
        valueStreamIds: [],
        artIds: [],
        teamIds: [],
      },
      update: {},
    }),
  ]);
  console.log("  ✓ roles assigned");

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
    },
  });
  const vs2 = await prisma.valueStream.create({
    data: {
      tenantId,
      name: "Payments & Lending",
      description: "Payment rails, cards and credit products",
      budgetAmount: "1800000",
      budgetCurrency: "EUR",
    },
  });
  console.log("  ✓ Retail Banking, Payments & Lending");

  // 5. ARTs
  console.log("\n── ARTs");
  const art1 = await prisma.art.create({
    data: { tenantId, valueStreamId: vs1.id, name: "Mobile Banking ART", piCadenceWeeks: 10 },
  });
  const art2 = await prisma.art.create({
    data: { tenantId, valueStreamId: vs2.id, name: "Payments ART", piCadenceWeeks: 12 },
  });
  console.log("  ✓ Mobile Banking ART, Payments ART");

  // 6. Teams
  console.log("\n── Teams");
  await prisma.team.create({ data: { tenantId, artId: art1.id, name: "Atlas Team" } });
  await prisma.team.create({ data: { tenantId, artId: art1.id, name: "Orion Team" } });
  await prisma.team.create({ data: { tenantId, artId: art2.id, name: "Vega Team" } });
  console.log("  ✓ Atlas Team, Orion Team, Vega Team");

  // 7. Program Increments
  console.log("\n── Program Increments");
  await prisma.programIncrement.create({
    data: {
      id: "00000000-0000-0000-0000-000000000010",
      tenantId,
      artId: art1.id,
      name: "PI 2026-Q1",
      startDate: new Date("2026-01-05"),
      endDate: new Date("2026-03-13"),
      status: "completed",
    },
  });
  const pi2 = await prisma.programIncrement.create({
    data: {
      id: "00000000-0000-0000-0000-000000000011",
      tenantId,
      artId: art1.id,
      name: "PI 2026-Q2",
      startDate: new Date("2026-03-16"),
      endDate: new Date("2026-05-22"),
      status: "active",
    },
  });
  const pi3 = await prisma.programIncrement.create({
    data: {
      id: "00000000-0000-0000-0000-000000000012",
      tenantId,
      artId: art1.id,
      name: "PI 2026-Q3",
      startDate: new Date("2026-05-25"),
      endDate: new Date("2026-07-31"),
      status: "planned",
    },
  });
  console.log("  ✓ PI 2026-Q1 (completed), PI 2026-Q2 (active), PI 2026-Q3 (planned)");

  // 8. Epics
  console.log("\n── Epics");
  const epic1 = await prisma.initiative.create({
    data: {
      id: "00000000-0000-0000-0000-000000000020",
      tenantId,
      level: 0,
      title: "Instant Account Opening",
      path: "00000000-0000-0000-0000-000000000020",
      description:
        "Let new customers open a fully verified current account in under 5 minutes from their phone.",
      valueStreamId: vs1.id,
      stageGate: "L3",
      status: "in_progress",
      ownerId: adminId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis:
            "Replace branch and paper onboarding with a fully digital, sub-5-minute account opening.",
          changeFromBaseline:
            "Today onboarding takes 3 days and 38% of applicants drop off before completion.",
          businessOutcomes: [
            "Onboarding completion rate rises above 80%",
            "New-account cost-to-serve is cut in half",
          ],
          leadingIndicators: ["Application completion time", "Step-by-step drop-off rate"],
          risks: ["KYC/AML regulatory sign-off", "Identity-fraud exposure on automated checks"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription:
            "Manual onboarding takes 3 days and loses 38% of applicants, capping new-account growth.",
          businessOutcomeHypothesis:
            "A frictionless digital flow converts more applicants and cuts processing cost.",
          analysisSummary: "Completion rate climbs past 80% within two PIs of launch.",
          costSlices: [{ amount: 180000 }, { amount: 120000 }],
          oneTimeBenefit: 400000,
          recurringBenefit: 3200000,
          approvals: [],
        },
        history: [],
      },
    },
  });
  const epic2 = await prisma.initiative.create({
    data: {
      id: "00000000-0000-0000-0000-000000000021",
      tenantId,
      level: 0,
      title: "AI-Powered Fraud Detection",
      path: "00000000-0000-0000-0000-000000000021",
      description:
        "Detect and block fraudulent transactions in real time with a machine-learning risk model.",
      valueStreamId: vs2.id,
      stageGate: "L2",
      status: "approved",
      ownerId: adminId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis:
            "Score every transaction in real time with an ML fraud model before authorisation.",
          changeFromBaseline:
            "Replaces static rule lists that miss 1 in 4 fraud cases and over-decline genuine payments.",
          businessOutcomes: ["Fraud losses fall by 60%", "False-positive declines drop by a third"],
          leadingIndicators: ["Fraud detection recall", "False-positive rate"],
          risks: ["Model bias and explainability", "Latency budget at authorisation time"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription:
            "Rule-based fraud screening misses 25% of fraud, costing €2.1M/year in losses.",
          businessOutcomeHypothesis:
            "A real-time ML model catches more fraud while declining fewer genuine payments.",
          analysisSummary: "Fraud losses fall 60% within one PI of full rollout.",
          costSlices: [{ amount: 260000 }, { amount: 200000 }],
          oneTimeBenefit: 250000,
          recurringBenefit: 2100000,
          approvals: [],
        },
        history: [],
      },
    },
  });
  const epic3 = await prisma.initiative.create({
    data: {
      id: "00000000-0000-0000-0000-000000000022",
      tenantId,
      level: 0,
      title: "Open Banking Aggregation",
      path: "00000000-0000-0000-0000-000000000022",
      description:
        "Let customers see balances and transactions from their external bank accounts inside the app.",
      valueStreamId: vs1.id,
      stageGate: "L1",
      status: "in_review",
      ownerId: portfolioId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis:
            "Aggregate external account data via open-banking APIs into a single dashboard.",
          changeFromBaseline:
            "Customers today switch between 3+ banking apps with no consolidated view.",
          businessOutcomes: [
            "Daily active users increase by 20%",
            "Higher cross-sell of savings and credit products",
          ],
          leadingIndicators: ["Linked external accounts per user", "Dashboard engagement rate"],
          risks: ["Open-banking API reliability across banks", "Consent-renewal friction"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription:
            "Customers manage money across 3+ apps; the bank sees only part of their finances.",
          businessOutcomeHypothesis:
            "A consolidated view increases engagement and surfaces cross-sell moments.",
          analysisSummary: "Daily active users rise 20% within three months of launch.",
          costSlices: [{ amount: 90000 }, { amount: 70000 }],
          oneTimeBenefit: 120000,
          recurringBenefit: 1100000,
          approvals: [],
        },
        history: [],
      },
    },
  });
  const epic4 = await prisma.initiative.create({
    data: {
      id: "00000000-0000-0000-0000-000000000023",
      tenantId,
      level: 0,
      title: "Real-Time Payments Rail",
      path: "00000000-0000-0000-0000-000000000023",
      description:
        "Move outbound payments from overnight batch to instant 24/7 settlement on a new rail.",
      valueStreamId: vs2.id,
      stageGate: "L4",
      status: "in_progress",
      ownerId: adminId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis:
            "Replace overnight batch settlement with an instant 24/7 payments rail.",
          changeFromBaseline:
            "Payments today settle in 1–2 business days; customers now expect instant transfers.",
          businessOutcomes: [
            "Median settlement time drops to under 10 seconds",
            "'Where is my payment' support contacts fall sharply",
          ],
          leadingIndicators: ["Median settlement time", "Payment-status support tickets"],
          risks: ["24/7 operational resilience", "Liquidity management for instant settlement"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription:
            "Batch settlement delays payments 1–2 days and drives 30% of support contacts.",
          businessOutcomeHypothesis:
            "Instant settlement meets customer expectations and cuts support load.",
          analysisSummary: "Median settlement time drops from 1 day to under 10 seconds.",
          costSlices: [{ amount: 320000 }, { amount: 180000 }],
          recurringBenefit: 1800000,
          approvals: [],
        },
        history: [],
      },
    },
  });
  console.log("  ✓ 4 epics (L1–L4 stage gates)");

  // 9. Features
  console.log("\n── Features");
  const features = [
    {
      id: "00000000-0000-0000-0000-000000000030",
      title: "Biometric identity verification",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi2.id,
      bv: 13,
      tc: 8,
      rr: 8,
      js: 5,
      ac: [
        "Given a new applicant, when they complete a face scan, then identity is verified against the document photo",
        "Given verification succeeds, then the applicant proceeds without manual review",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000031",
      title: "Digital KYC document capture",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi2.id,
      bv: 8,
      tc: 8,
      rr: 5,
      js: 3,
      ac: [
        "Given an applicant photographs an ID document, then key fields are extracted within 5s",
        "Given a document is unreadable, then the user is prompted to retake the photo",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000032",
      title: "Same-day virtual card issuance",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi3.id,
      bv: 13,
      tc: 5,
      rr: 3,
      js: 5,
      ac: [
        "Given an account is opened, then a virtual card is issued and added to the mobile wallet immediately",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000033",
      title: "Transaction anomaly scoring service",
      parentId: epic2.id,
      artId: art2.id,
      piId: pi3.id,
      bv: 13,
      tc: 8,
      rr: 13,
      js: 13,
      ac: [
        "Given an inbound transaction, when scored, then a risk score is returned within 200ms",
        "Given a score above threshold, then the transaction is held for step-up authentication",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000034",
      title: "External bank connection & consent",
      parentId: epic3.id,
      artId: art1.id,
      bv: 8,
      tc: 8,
      rr: 8,
      js: 8,
      ac: [
        "Given a customer selects an external bank, then they are redirected through the open-banking consent flow",
        "Given consent is granted, then accounts and balances appear within 30s",
        "Given consent expires, then the customer is prompted to renew it",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000035",
      title: "ISO 20022 payment message gateway",
      parentId: epic4.id,
      artId: art2.id,
      piId: pi2.id,
      bv: 13,
      tc: 13,
      rr: 8,
      js: 8,
      ac: [
        "Given an outbound payment, when submitted, then a valid ISO 20022 pacs.008 message is generated",
        "Given a malformed message, then it is rejected with a structured error",
      ],
    },
  ];

  for (const f of features) {
    const computed = Math.round(((f.bv + f.tc + f.rr) / f.js) * 100) / 100;
    await prisma.initiative.create({
      data: {
        id: f.id,
        tenantId,
        level: 1,
        parentId: f.parentId,
        artId: f.artId,
        ...(f.piId ? { piId: f.piId } : {}),
        path: `${f.parentId}.${f.id}`,
        title: f.title,
        ownerId: adminId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        wsjfBusinessValue: f.bv,
        wsjfTimeCriticality: f.tc,
        wsjfRiskReduction: f.rr,
        wsjfJobSize: f.js,
        wsjfComputed: computed,
        acceptanceCriteria: f.ac,
        status: f.piId === pi2.id ? "in_progress" : "draft",
      },
    });
  }
  console.log(`  ✓ ${features.length} features with WSJF scores`);

  // 10. Dependencies
  console.log("\n── Dependencies");
  // Biometric verification needs the document photo first → KYC capture blocks it.
  await prisma.dependency.create({
    data: {
      tenantId,
      fromId: "00000000-0000-0000-0000-000000000031",
      toId: "00000000-0000-0000-0000-000000000030",
      type: "blocks",
      createdBy: adminId,
    },
  });
  await prisma.dependency.create({
    data: {
      tenantId,
      fromId: "00000000-0000-0000-0000-000000000033",
      toId: "00000000-0000-0000-0000-000000000035",
      type: "relates_to",
      createdBy: adminId,
    },
  });
  console.log("  ✓ 2 dependencies linked");

  // 11. Stories
  console.log("\n── Stories");
  const feat30Path = `${epic1.id}.00000000-0000-0000-0000-000000000030`;
  const feat33Path = `${epic2.id}.00000000-0000-0000-0000-000000000033`;
  const stories = [
    {
      id: "00000000-0000-0000-0000-000000000040",
      title: "Store verified identity documents securely",
      parentId: "00000000-0000-0000-0000-000000000030",
      parentPath: feat30Path,
      piId: pi2.id,
      points: 5,
      status: "in_progress",
    },
    {
      id: "00000000-0000-0000-0000-000000000041",
      title: "Liveness check during the face scan",
      parentId: "00000000-0000-0000-0000-000000000030",
      parentPath: feat30Path,
      piId: pi2.id,
      points: 3,
      status: "in_progress",
    },
    {
      id: "00000000-0000-0000-0000-000000000042",
      title: "Risk-score threshold configuration UI",
      parentId: "00000000-0000-0000-0000-000000000033",
      parentPath: feat33Path,
      points: 8,
      status: "draft",
    },
  ];
  for (const s of stories) {
    await prisma.initiative.create({
      data: {
        id: s.id,
        tenantId,
        level: 2,
        parentId: s.parentId,
        path: `${s.parentPath}/${s.id}`,
        title: s.title,
        ownerId: adminId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        storyPoints: s.points,
        acceptanceCriteria: [],
        status: s.status,
        ...(s.piId ? { piId: s.piId } : {}),
      },
    });
  }
  console.log(`  ✓ ${stories.length} stories`);

  // 12. Tasks
  console.log("\n── Tasks");
  const tasks = [
    {
      id: "00000000-0000-0000-0000-000000000050",
      title: "Encrypt stored document images at rest",
      parentId: "00000000-0000-0000-0000-000000000040",
      hours: 8,
      status: "completed",
    },
    {
      id: "00000000-0000-0000-0000-000000000051",
      title: "Build the identity-document storage API",
      parentId: "00000000-0000-0000-0000-000000000040",
      hours: 12,
      status: "in_progress",
    },
    {
      id: "00000000-0000-0000-0000-000000000052",
      title: "Define the fraud risk-score thresholds",
      parentId: "00000000-0000-0000-0000-000000000042",
      hours: 4,
      status: "draft",
    },
  ];
  for (const t of tasks) {
    const parentStory = stories.find((s) => s.id === t.parentId)!;
    await prisma.initiative.create({
      data: {
        id: t.id,
        tenantId,
        level: 3,
        parentId: t.parentId,
        path: `${parentStory.parentPath}/${parentStory.id}/${t.id}`,
        title: t.title,
        ownerId: adminId,
        assigneeIds: [],
        createdBy: adminId,
        updatedBy: adminId,
        estimateHours: t.hours,
        status: t.status,
      },
    });
  }
  console.log(`  ✓ ${tasks.length} tasks`);

  // 13. KPIs
  console.log("\n── KPIs");
  const kpis = [
    {
      id: "00000000-0000-0000-0000-000000000060",
      initiativeId: epic1.id,
      name: "Onboarding completion rate",
      unit: "%",
      baseline: 62,
      target: 82,
      measurements: [
        { date: "2026-01-15", value: 62 },
        { date: "2026-03-15", value: 70 },
        { date: "2026-05-01", value: 76 },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000061",
      initiativeId: epic2.id,
      name: "Fraud loss rate (bps)",
      unit: "bps",
      baseline: 18,
      target: 7,
      measurements: [
        { date: "2026-03-15", value: 18 },
        { date: "2026-05-01", value: 14 },
      ],
    },
  ];
  for (const k of kpis) {
    await prisma.kpi.create({
      data: {
        id: k.id,
        tenantId,
        initiativeId: k.initiativeId,
        name: k.name,
        unit: k.unit,
        baseline: k.baseline,
        target: k.target,
        measurements: k.measurements,
        createdBy: adminId,
        updatedBy: adminId,
      },
    });
  }
  console.log(`  ✓ ${kpis.length} KPIs`);

  console.log("\n✅  Seed complete!\n");
  console.log("Test accounts:");
  console.log("  admin@pulse.dev     / Admin1234!   (tenant_admin + portfolio_editor)");
  console.log("  portfolio@pulse.dev / Test1234!    (portfolio_editor)");
  console.log("  viewer@pulse.dev    / Test1234!    (viewer — read-only)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
