import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createArt, softDeleteArt, listArts, getArt } from "@/server/services/art";
import { isOk } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import type { ArtId, ValueStreamId } from "@/domain/types";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function create(name: string): Promise<ArtId> {
  const result = await createArt(testRequestContext(db, seed), {
    valueStreamId: seed.valueStreamId as ValueStreamId,
    name,
  });
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error("create failed");
  return result.value.id;
}

describe("softDeleteArt — deletion test", () => {
  it("sets deletedAt and excludes the row from list/get", async () => {
    const id = await create("ART Aurora");

    const del = await softDeleteArt(testRequestContext(db, seed), { id });
    expect(isOk(del)).toBe(true);

    const row = await db.art.findUnique({ where: { id } });
    expect(row?.deletedAt).not.toBeNull();

    const list = await listArts(db, seed.tenantId);
    expect(list.find((a) => a.id === id)).toBeUndefined();

    expect(await getArt(db, seed.tenantId, id)).toBeNull();
  });

  it("blocks deletion when the ART still has Program Increments", async () => {
    const id = await create("ART With PI");
    await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: id,
        name: "PI 1",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "planned",
      },
    });

    const del = await softDeleteArt(testRequestContext(db, seed), { id });
    expect(isOk(del)).toBe(false);

    const row = await db.art.findUnique({ where: { id } });
    expect(row?.deletedAt).toBeNull();
  });

  it("blocks deletion when the ART still has teams", async () => {
    const id = await create("ART With Team");
    await db.team.create({ data: { tenantId: seed.tenantId, artId: id, name: "Team X" } });

    const del = await softDeleteArt(testRequestContext(db, seed), { id });
    expect(isOk(del)).toBe(false);
  });
});

describe("partial unique index — ART name reuse after delete", () => {
  it("allows a new ART with the same name once the original is deleted", async () => {
    const first = await create("ART Reuse");
    await softDeleteArt(testRequestContext(db, seed), { id: first });

    const second = await createArt(testRequestContext(db, seed), {
      valueStreamId: seed.valueStreamId as ValueStreamId,
      name: "ART Reuse",
    });
    expect(isOk(second)).toBe(true);
  });

  it("still rejects a duplicate name among active ARTs", async () => {
    await create("ART Dup");
    const dup = await createArt(testRequestContext(db, seed), {
      valueStreamId: seed.valueStreamId as ValueStreamId,
      name: "ART Dup",
    });
    expect(isOk(dup)).toBe(false);
  });
});
