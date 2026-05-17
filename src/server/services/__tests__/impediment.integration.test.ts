import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createImpediment, escalateImpediment } from "@/server/services/impediment";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import type { ImpedimentId } from "@/server/services/impediment";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

describe("createImpediment", () => {
  it("inserts an impediment row and emits an AuditEvent", async () => {
    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await createImpediment(testRequestContext(db, seed), {
      artId: seed.artId,
      title: "Build is broken",
      severity: "high",
    });

    expect(isOk(result)).toBe(true);
    const imp = await db.impediment.findFirst({ where: { tenantId: seed.tenantId } });
    expect(imp).not.toBeNull();
    expect(imp!.title).toBe("Build is broken");
    expect(imp!.status).toBe("open");

    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });
});

describe("escalateImpediment", () => {
  async function createOpenImpediment(): Promise<ImpedimentId> {
    const result = await createImpediment(testRequestContext(db, seed), {
      artId: seed.artId,
      title: "Escalation test",
      severity: "critical",
    });
    if (!isOk(result)) throw new Error("Failed to create impediment");
    return result.value.id;
  }

  it("sets status to escalated", async () => {
    const impId = await createOpenImpediment();

    const result = await escalateImpediment(testRequestContext(db, seed), { id: impId });

    expect(isOk(result)).toBe(true);
    const imp = await db.impediment.findFirst({ where: { id: impId } });
    expect(imp!.status).toBe("escalated");
  });

  it("returns conflict when impediment is already escalated", async () => {
    const impId = await createOpenImpediment();
    await escalateImpediment(testRequestContext(db, seed), { id: impId });

    const result = await escalateImpediment(testRequestContext(db, seed), { id: impId });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });
});
