import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  submitForReview,
  decideReview,
  listEpicsInReview,
  listFeaturesInReview,
  type InitiativeKind,
} from "@/server/services/initiative-review";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { InitiativeId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function makeEpic(status = "draft"): Promise<InitiativeId> {
  const epic = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Epic",
      path: "",
      valueStreamId: seed.valueStreamId,
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
      status,
    },
  });
  return epic.id as InitiativeId;
}

async function makeFeature(status = "draft"): Promise<InitiativeId> {
  const parentId = await makeEpic("approved");
  const feature = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.FEATURE,
      title: "Feature",
      path: "",
      parentId,
      artId: seed.artId,
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
      status,
    },
  });
  return feature.id as InitiativeId;
}

const makers: Record<InitiativeKind, (status?: string) => Promise<InitiativeId>> = {
  epic: makeEpic,
  feature: makeFeature,
};

// The submit/decide path is a single body parameterised by kind, so the
// contract is proven once per kind through the module's interface.
describe.each(["epic", "feature"] as const)("initiative review — %s mutations", (kind) => {
  const make = makers[kind];

  it("submit moves draft → in_review and emits one audit", async () => {
    const id = await make("draft");
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await submitForReview(testRequestContext(db, seed), { kind, id });

    expect(isOk(result)).toBe(true);
    const row = await db.initiative.findFirst({ where: { id } });
    expect(row!.status).toBe("in_review");
    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("submit on a non-draft → conflict, row unchanged", async () => {
    const id = await make("in_review");
    const result = await submitForReview(testRequestContext(db, seed), { kind, id });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
    const row = await db.initiative.findFirst({ where: { id } });
    expect(row!.status).toBe("in_review");
  });

  it("decide approve → approved", async () => {
    const id = await make("in_review");
    const result = await decideReview(testRequestContext(db, seed), {
      kind,
      id,
      decision: "approve",
    });

    expect(isOk(result)).toBe(true);
    const row = await db.initiative.findFirst({ where: { id } });
    expect(row!.status).toBe("approved");
  });

  it("decide reject → draft", async () => {
    const id = await make("in_review");
    const result = await decideReview(testRequestContext(db, seed), {
      kind,
      id,
      decision: "reject",
    });

    expect(isOk(result)).toBe(true);
    const row = await db.initiative.findFirst({ where: { id } });
    expect(row!.status).toBe("draft");
  });

  it("decide on a draft (not awaiting) → conflict", async () => {
    const id = await make("draft");
    const result = await decideReview(testRequestContext(db, seed), {
      kind,
      id,
      decision: "approve",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });

  it("unknown id → not_found", async () => {
    const result = await submitForReview(testRequestContext(db, seed), {
      kind,
      id: randomUUID() as InitiativeId,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });
});

describe("initiative review — cross-kind guard", () => {
  it("an Epic id submitted as a Feature → not_found (level filter)", async () => {
    const epicId = await makeEpic("draft");
    const result = await submitForReview(testRequestContext(db, seed), {
      kind: "feature",
      id: epicId,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });
});

describe("initiative review — render-ready reads", () => {
  it("listEpicsInReview returns only in_review epics as render rows", async () => {
    const reviewing = await makeEpic("in_review");
    await makeEpic("draft");

    const rows = await listEpicsInReview(db, seed.tenantId);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(reviewing);
    expect(rows[0]!.href).toBe(`/portfolio/epics/${reviewing}`);
    expect(rows[0]!.valueStream?.name).toBe("Test Value Stream");
  });

  it("listFeaturesInReview returns flattened rows and honors the ART scope", async () => {
    const id = await makeFeature("in_review");

    const all = await listFeaturesInReview(db, seed.tenantId);
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(id);
    expect(all[0]!.href).toBe(`/feature/${id}`);
    expect(all[0]!.parentTitle).toBe("Epic");
    expect(all[0]!.art?.name).toBe("Test ART");

    const inScope = await listFeaturesInReview(db, seed.tenantId, [seed.artId]);
    expect(inScope).toHaveLength(1);

    const outOfScope = await listFeaturesInReview(db, seed.tenantId, [randomUUID()]);
    expect(outOfScope).toHaveLength(0);
  });
});
