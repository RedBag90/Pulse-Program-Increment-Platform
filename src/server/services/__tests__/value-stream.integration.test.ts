import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  createValueStream,
  softDeleteValueStream,
  listValueStreams,
  getValueStream,
} from "@/server/services/value-stream";
import { isOk } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import type { ValueStreamId } from "@/domain/types";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function create(name: string): Promise<ValueStreamId> {
  const result = await createValueStream(testRequestContext(db, seed), { name });
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error("create failed");
  return result.value.id;
}

describe("softDeleteValueStream — deletion test", () => {
  it("sets deletedAt and excludes the row from list/get", async () => {
    const id = await create("Payments");

    const del = await softDeleteValueStream(testRequestContext(db, seed), { id });
    expect(isOk(del)).toBe(true);

    const row = await db.valueStream.findUnique({ where: { id } });
    expect(row?.deletedAt).not.toBeNull();

    const list = await listValueStreams(db, seed.tenantId);
    expect(list.find((vs) => vs.id === id)).toBeUndefined();

    expect(await getValueStream(db, seed.tenantId, id)).toBeNull();
  });

  it("emits an AuditEvent on delete", async () => {
    const id = await create("Logistics");
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await softDeleteValueStream(testRequestContext(db, seed), { id });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBeGreaterThan(before);
  });

  it("returns not_found when deleting an already-deleted value stream", async () => {
    const id = await create("Mobility");
    await softDeleteValueStream(testRequestContext(db, seed), { id });

    const again = await softDeleteValueStream(testRequestContext(db, seed), { id });
    expect(isOk(again)).toBe(false);
  });
});

describe("partial unique index — name reuse after delete", () => {
  it("allows creating a new value stream with the same name after the original is deleted", async () => {
    const first = await create("Retail");
    await softDeleteValueStream(testRequestContext(db, seed), { id: first });

    // The full @@unique was replaced by a partial index (WHERE deleted_at IS NULL),
    // so the freed name can be reused.
    const second = await createValueStream(testRequestContext(db, seed), { name: "Retail" });
    expect(isOk(second)).toBe(true);
  });

  it("still rejects a duplicate name among active value streams", async () => {
    await create("Unique VS");
    const dup = await createValueStream(testRequestContext(db, seed), { name: "Unique VS" });
    expect(isOk(dup)).toBe(false);
  });
});
