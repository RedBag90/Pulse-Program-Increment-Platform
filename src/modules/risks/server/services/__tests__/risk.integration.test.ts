import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  suggestRisk,
  documentRisk,
  reviewRisk,
  reassessRisk,
  setRiskRoam,
} from "@/modules/risks/server/services/risk";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

/** Tenant-admin context — bypasses the scope gates via the authorize fast-path. */
function adminCtx(): RequestContext {
  const base = testRequestContext(db, seed);
  return { ...base, principal: { ...base.principal, roles: ["tenant_admin"] } };
}

async function makeEpic(): Promise<string> {
  const epic = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      title: "Epic for risk",
      level: InitiativeLevel.EPIC,
      valueStreamId: seed.valueStreamId,
      ownerId: seed.actorId,
      path: "epic-for-risk",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
    select: { id: true },
  });
  return epic.id;
}

describe("suggestRisk", () => {
  it("creates a suggested risk with no number", async () => {
    const r = await suggestRisk(testRequestContext(db, seed), { title: "A vague worry" });
    expect(isOk(r)).toBe(true);
    const row = await db.risk.findFirst({ where: { tenantId: seed.tenantId } });
    expect(row!.reviewStatus).toBe("suggested");
    expect(row!.riskNumber).toBeNull();
  });
});

describe("documentRisk + numbering", () => {
  it("assigns gapless sequential numbers only on document", async () => {
    await suggestRisk(testRequestContext(db, seed), { title: "suggestion, no number" });
    const a = await documentRisk(adminCtx(), { title: "R1", probability: "high", impact: "high" });
    const b = await documentRisk(adminCtx(), { title: "R2" });
    expect(isOk(a) && isOk(b)).toBe(true);
    const nums = await db.risk.findMany({
      where: { tenantId: seed.tenantId, riskNumber: { not: null } },
      orderBy: { riskNumber: "asc" },
      select: { riskNumber: true },
    });
    expect(nums.map((n) => n.riskNumber)).toEqual([1, 2]);
  });
});

describe("reviewRisk", () => {
  it("accept → documented with a number", async () => {
    const s = await suggestRisk(testRequestContext(db, seed), { title: "to accept" });
    if (!isOk(s)) throw new Error("suggest failed");
    const rev = await reviewRisk(adminCtx(), { id: s.value.id, decision: "accept" });
    expect(isOk(rev)).toBe(true);
    const row = await db.risk.findFirst({ where: { id: s.value.id } });
    expect(row!.reviewStatus).toBe("documented");
    expect(row!.riskNumber).toBe(1);
    expect(row!.reviewedBy).toBe(seed.actorId);
  });
});

describe("reassessRisk trail + roam", () => {
  it("appends assessment rows and moves ROAM", async () => {
    const d = await documentRisk(adminCtx(), { title: "R", probability: "high", impact: "high" });
    if (!isOk(d)) throw new Error("document failed");
    await reassessRisk(adminCtx(), { id: d.value.id, probability: "medium", impact: "high" });
    await reassessRisk(adminCtx(), { id: d.value.id, probability: "low", impact: "medium" });
    const trail = await db.riskAssessment.findMany({
      where: { riskId: d.value.id },
      orderBy: { createdAt: "asc" },
    });
    expect(trail).toHaveLength(2);
    await setRiskRoam(adminCtx(), { id: d.value.id, roamStatus: "mitigated" });
    const row = await db.risk.findFirst({ where: { id: d.value.id } });
    expect(row!.roamStatus).toBe("mitigated");
  });
});

describe("scope", () => {
  it("an epic-owner outside the epic's value stream cannot document it", async () => {
    const epicId = await makeEpic();
    const base = testRequestContext(db, seed);
    const outsider: RequestContext = {
      ...base,
      principal: {
        ...base.principal,
        roles: ["epic_owner"],
        scopes: {
          valueStreamIds: ["00000000-0000-0000-0000-000000000000"],
          artIds: [],
          teamIds: [],
        },
        capabilities: [{ action: "risk.document", scope: "value_stream" }],
      },
    };
    const r = await documentRisk(outsider, { title: "scoped", epicIds: [epicId] });
    expect(isOk(r)).toBe(false);
  });
});
