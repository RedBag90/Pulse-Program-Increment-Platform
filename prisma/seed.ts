/* eslint-disable no-console */
/**
 * Development seed — idempotent (safe to run multiple times).
 *
 * Test users created:
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

  // 4. Value Streams
  console.log("\n── Value Streams");
  const vs1 = await prisma.valueStream.upsert({
    where: { tenantId_name: { tenantId, name: "Digital Products" } },
    create: {
      tenantId,
      name: "Digital Products",
      description: "Customer-facing web & mobile products",
      budgetAmount: "2500000",
      budgetCurrency: "EUR",
    },
    update: {},
  });
  const vs2 = await prisma.valueStream.upsert({
    where: { tenantId_name: { tenantId, name: "Platform & Infrastructure" } },
    create: {
      tenantId,
      name: "Platform & Infrastructure",
      description: "Internal developer platform and cloud infra",
      budgetAmount: "1200000",
      budgetCurrency: "EUR",
    },
    update: {},
  });
  console.log("  ✓ Digital Products, Platform & Infrastructure");

  // 5. ARTs
  console.log("\n── ARTs");
  const art1 = await prisma.art.upsert({
    where: { tenantId_name: { tenantId, name: "Commerce ART" } },
    create: { tenantId, valueStreamId: vs1.id, name: "Commerce ART", piCadenceWeeks: 10 },
    update: {},
  });
  const art2 = await prisma.art.upsert({
    where: { tenantId_name: { tenantId, name: "Platform ART" } },
    create: { tenantId, valueStreamId: vs2.id, name: "Platform ART", piCadenceWeeks: 12 },
    update: {},
  });
  console.log("  ✓ Commerce ART, Platform ART");

  // 6. Teams
  console.log("\n── Teams");
  await prisma.team.upsert({
    where: { tenantId_name: { tenantId, name: "Phoenix Team" } },
    create: { tenantId, artId: art1.id, name: "Phoenix Team" },
    update: {},
  });
  await prisma.team.upsert({
    where: { tenantId_name: { tenantId, name: "Nebula Team" } },
    create: { tenantId, artId: art1.id, name: "Nebula Team" },
    update: {},
  });
  await prisma.team.upsert({
    where: { tenantId_name: { tenantId, name: "Infra Team" } },
    create: { tenantId, artId: art2.id, name: "Infra Team" },
    update: {},
  });
  console.log("  ✓ Phoenix Team, Nebula Team, Infra Team");

  // 7. Program Increments
  console.log("\n── Program Increments");
  await prisma.programIncrement.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      tenantId,
      artId: art1.id,
      name: "PI 2025-Q2",
      startDate: new Date("2025-04-07"),
      endDate: new Date("2025-06-13"),
      status: "completed",
    },
    update: {},
  });
  const pi2 = await prisma.programIncrement.upsert({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      tenantId,
      artId: art1.id,
      name: "PI 2025-Q3",
      startDate: new Date("2025-06-16"),
      endDate: new Date("2025-08-22"),
      status: "active",
    },
    update: {},
  });
  const pi3 = await prisma.programIncrement.upsert({
    where: { id: "00000000-0000-0000-0000-000000000012" },
    create: {
      id: "00000000-0000-0000-0000-000000000012",
      tenantId,
      artId: art1.id,
      name: "PI 2025-Q4",
      startDate: new Date("2025-08-25"),
      endDate: new Date("2025-10-31"),
      status: "planned",
    },
    update: {},
  });
  console.log("  ✓ PI 2025-Q2 (completed), PI 2025-Q3 (active), PI 2025-Q4 (planned)");

  // 8. Epics
  console.log("\n── Epics");
  const epic1 = await prisma.initiative.upsert({
    where: { id: "00000000-0000-0000-0000-000000000020" },
    create: {
      id: "00000000-0000-0000-0000-000000000020",
      tenantId,
      level: 0,
      title: "Next-Gen Checkout Experience",
      path: "00000000-0000-0000-0000-000000000020",
      description: "Redesign the end-to-end checkout flow to reduce cart abandonment by 30%.",
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
            "Redesign the end-to-end checkout into a streamlined single-page flow.",
          changeFromBaseline:
            "Replaces today's multi-step checkout that drives a 72% abandonment rate.",
          businessOutcomes: [
            "Cart abandonment rate drops below 45%",
            "Higher conversion and order revenue",
          ],
          leadingIndicators: ["Time-to-purchase", "Per-step drop-off rate"],
          risks: ["Payment gateway integration complexity", "Mobile UX edge cases"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription: "Current checkout has a 72% abandonment rate, costing €4M/year.",
          businessOutcomeHypothesis:
            "Faster, smoother checkout reduces friction and increases conversion.",
          analysisSummary: "Abandonment rate drops below 45% within 2 PIs of launch.",
          costRows: [{ projectType: "impact", costsMonths1to6: 350000, annualImpact: 4000000 }],
          approvals: [],
        },
        history: [],
      },
    },
    update: {},
  });
  const epic2 = await prisma.initiative.upsert({
    where: { id: "00000000-0000-0000-0000-000000000021" },
    create: {
      id: "00000000-0000-0000-0000-000000000021",
      tenantId,
      level: 0,
      title: "Personalisation Engine",
      path: "00000000-0000-0000-0000-000000000021",
      description: "ML-driven product recommendations and dynamic homepage personalisation.",
      valueStreamId: vs1.id,
      stageGate: "L2",
      status: "approved",
      ownerId: adminId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis: "Introduce an ML-driven recommendation and personalisation engine.",
          changeFromBaseline:
            "Replaces the generic homepage that converts 40% worse than targeted pages.",
          businessOutcomes: [
            "Average order value increases by 15%",
            "Higher engagement and repeat visits",
          ],
          leadingIndicators: ["Click-through on recommendations", "Average basket size"],
          risks: ["Data privacy compliance", "Cold-start problem for new users"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription: "Generic homepage converts 40% worse than targeted landing pages.",
          businessOutcomeHypothesis: "Users see relevant products, increasing average basket size.",
          analysisSummary: "Average order value increases by 15% within 3 months.",
          costRows: [{ projectType: "impact", costsMonths1to6: 600000, annualImpact: 2500000 }],
          approvals: [],
        },
        history: [],
      },
    },
    update: {},
  });
  const epic3 = await prisma.initiative.upsert({
    where: { id: "00000000-0000-0000-0000-000000000022" },
    create: {
      id: "00000000-0000-0000-0000-000000000022",
      tenantId,
      level: 0,
      title: "Self-Service Returns Portal",
      path: "00000000-0000-0000-0000-000000000022",
      description: "Allow customers to initiate and track returns without contacting support.",
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
            "Build a self-service portal for customers to initiate and track returns.",
          changeFromBaseline:
            "Replaces phone/email returns handling that drives 60% of support tickets.",
          businessOutcomes: [
            "Support ticket volume drops 50%",
            "€900k/year saved in handling cost",
          ],
          leadingIndicators: ["Self-service returns rate", "First-contact resolution rate"],
          risks: ["Fraud risk from automated approvals", "Warehouse integration"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription:
            "60% of support tickets are return-related, costing €900k/year in handling.",
          businessOutcomeHypothesis:
            "Customers get instant returns confirmation without waiting on hold.",
          analysisSummary: "Support ticket volume drops 50% within 1 PI.",
          costRows: [{ projectType: "impact", costsMonths1to6: 180000, annualImpact: 900000 }],
          approvals: [],
        },
        history: [],
      },
    },
    update: {},
  });
  const epic4 = await prisma.initiative.upsert({
    where: { id: "00000000-0000-0000-0000-000000000023" },
    create: {
      id: "00000000-0000-0000-0000-000000000023",
      tenantId,
      level: 0,
      title: "Developer Platform — Internal APIs",
      path: "00000000-0000-0000-0000-000000000023",
      description: "Unified internal API gateway and self-service onboarding for product teams.",
      valueStreamId: vs2.id,
      stageGate: "L4",
      status: "in_progress",
      ownerId: adminId,
      assigneeIds: [],
      createdBy: adminId,
      updatedBy: adminId,
      benefitHypothesis: {
        current: {
          measuresHypothesis: "Build a unified internal API gateway with self-service onboarding.",
          changeFromBaseline:
            "Replaces manual infra provisioning that takes teams an average of 3 weeks.",
          businessOutcomes: [
            "Onboarding time drops from 3 weeks to 2 days",
            "Faster product delivery across teams",
          ],
          leadingIndicators: ["Provisioning lead time", "Self-service onboarding rate"],
          risks: ["Security review bottlenecks", "Legacy service compatibility"],
        },
        history: [],
      },
      businessCase: {
        current: {
          initiativeDescription: "Teams spend avg 3 weeks waiting for infra provisioning.",
          businessOutcomeHypothesis: "Internal teams ship faster with less ops dependency.",
          analysisSummary: "Onboarding time drops from 3 weeks to 2 days.",
          costRows: [{ projectType: "enabler", costsMonths1to6: 450000, annualImpact: 1500000 }],
          approvals: [],
        },
        history: [],
      },
    },
    update: {},
  });
  console.log("  ✓ 4 epics (L1–L4 stage gates)");

  // 9. Features
  console.log("\n── Features");
  const features = [
    {
      id: "00000000-0000-0000-0000-000000000030",
      title: "One-click checkout for returning customers",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi2.id,
      bv: 13,
      tc: 8,
      rr: 5,
      js: 3,
      ac: [
        "Given a returning customer, when they click 'Buy now', then payment is processed with saved details",
        "Given checkout is complete, then confirmation email is sent within 30s",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000031",
      title: "Apple Pay & Google Pay integration",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi2.id,
      bv: 13,
      tc: 13,
      rr: 3,
      js: 8,
      ac: [
        "Given a mobile user, when they select Apple Pay, then payment sheet appears natively",
        "Given payment succeeds, then order is created and inventory reserved",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000032",
      title: "Address auto-complete via Google Places",
      parentId: epic1.id,
      artId: art1.id,
      piId: pi2.id,
      bv: 5,
      tc: 3,
      rr: 2,
      js: 2,
      ac: [
        "Given a user types 3+ characters in address field, then suggestions appear within 300ms",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000033",
      title: "ML-based 'You may also like' carousel",
      parentId: epic2.id,
      artId: art1.id,
      piId: pi3.id,
      bv: 8,
      tc: 5,
      rr: 8,
      js: 13,
      ac: [
        "Given a product detail page, when loaded, then carousel shows ≥5 relevant recommendations",
        "Given a recommendation is clicked, then click-through is tracked",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000034",
      title: "Return initiation flow (web)",
      parentId: epic3.id,
      artId: art1.id,
      bv: 8,
      tc: 8,
      rr: 13,
      js: 5,
      ac: [
        "Given a customer with an order, when they visit My Orders, then they can select items to return",
        "Given return is submitted, then a prepaid label is emailed within 2 minutes",
        "Given return is registered, then status is visible in My Orders",
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000035",
      title: "Internal API gateway — rate limiting & auth",
      parentId: epic4.id,
      artId: art2.id,
      piId: pi2.id,
      bv: 13,
      tc: 8,
      rr: 13,
      js: 8,
      ac: [
        "Given an API key, when rate limit is exceeded, then 429 is returned with Retry-After header",
        "Given an invalid key, then 401 is returned within 50ms",
      ],
    },
  ];

  for (const f of features) {
    const computed = Math.round(((f.bv + f.tc + f.rr) / f.js) * 100) / 100;
    await prisma.initiative.upsert({
      where: { id: f.id },
      create: {
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
      update: {},
    });
  }
  console.log(`  ✓ ${features.length} features with WSJF scores`);

  // 10. Dependencies
  console.log("\n── Dependencies");
  await prisma.dependency.upsert({
    where: {
      fromId_toId_type: {
        fromId: "00000000-0000-0000-0000-000000000031",
        toId: "00000000-0000-0000-0000-000000000030",
        type: "blocks",
      },
    },
    create: {
      tenantId,
      fromId: "00000000-0000-0000-0000-000000000031",
      toId: "00000000-0000-0000-0000-000000000030",
      type: "blocks",
      createdBy: adminId,
    },
    update: {},
  });
  await prisma.dependency.upsert({
    where: {
      fromId_toId_type: {
        fromId: "00000000-0000-0000-0000-000000000034",
        toId: "00000000-0000-0000-0000-000000000030",
        type: "relates_to",
      },
    },
    create: {
      tenantId,
      fromId: "00000000-0000-0000-0000-000000000034",
      toId: "00000000-0000-0000-0000-000000000030",
      type: "relates_to",
      createdBy: adminId,
    },
    update: {},
  });
  console.log("  ✓ 2 dependencies linked");

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
