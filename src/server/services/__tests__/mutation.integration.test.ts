import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import {
  withAuditedTransaction,
  onUniqueConstraint,
  type MutationContext,
} from "@/server/services/mutation";
import { ok, err, isOk, isErr } from "@/domain/errors";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let mctx: MutationContext;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
  mctx = { db, tenantId: seed.tenantId, actorId: seed.actorId };
});

describe("withAuditedTransaction", () => {
  it("writes exactly one audit row on success", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await withAuditedTransaction(mctx, async (tx) => {
      const vs = await tx.valueStream.create({
        data: { tenantId: seed.tenantId, name: "VS audited" },
      });
      return ok({
        result: { id: vs.id },
        audit: { action: "value_stream.created", resourceType: "value_stream", resourceId: vs.id },
      });
    });

    expect(isOk(result)).toBe(true);
    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("writes no audit row when the body returns err", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await withAuditedTransaction(mctx, async () =>
      err({ kind: "not_found" as const, resourceType: "ValueStream", id: "x" }),
    );

    expect(isErr(result)).toBe(true);
    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before);
  });

  it("rolls back the mutation when the body throws", async () => {
    const vsBefore = await db.valueStream.count({ where: { tenantId: seed.tenantId } });

    await expect(
      withAuditedTransaction(mctx, async (tx) => {
        await tx.valueStream.create({ data: { tenantId: seed.tenantId, name: "VS rollback" } });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const vsAfter = await db.valueStream.count({ where: { tenantId: seed.tenantId } });
    expect(vsAfter).toBe(vsBefore);
  });

  it("maps a unique-constraint violation via onUniqueConstraint", async () => {
    await db.valueStream.create({ data: { tenantId: seed.tenantId, name: "Dup VS" } });

    const result = await withAuditedTransaction(
      mctx,
      async (tx) => {
        const vs = await tx.valueStream.create({
          data: { tenantId: seed.tenantId, name: "Dup VS" },
        });
        return ok({
          result: { id: vs.id },
          audit: {
            action: "value_stream.created",
            resourceType: "value_stream",
            resourceId: vs.id,
          },
        });
      },
      { onPrismaError: onUniqueConstraint("Value stream already exists") },
    );

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });
});
