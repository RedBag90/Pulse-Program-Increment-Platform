import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createPi, startPi, completePi } from "@/server/services/pi";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import type { ArtId, PiId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

describe("createPi", () => {
  it("inserts a ProgramIncrement row and returns its id", async () => {
    const startDate = new Date("2024-01-15");
    const endDate = new Date("2024-04-15");

    const result = await createPi(testRequestContext(db, seed), {
      artId: seed.artId,
      name: "PI 24.1",
      startDate,
      endDate,
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const pi = await db.programIncrement.findFirst({ where: { id: result.value.id } });
    expect(pi).not.toBeNull();
    expect(pi!.name).toBe("PI 24.1");
    expect(pi!.status).toBe("planned");
  });

  it("auto-generates sprints for each team in the ART", async () => {
    await db.team.createMany({
      data: [
        { tenantId: seed.tenantId, artId: seed.artId, name: "Team Alpha" },
        { tenantId: seed.tenantId, artId: seed.artId, name: "Team Beta" },
      ],
    });

    const result = await createPi(testRequestContext(db, seed), {
      artId: seed.artId,
      name: "PI 24.1",
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-04-15"),
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const sprints = await db.sprint.findMany({ where: { piId: result.value.id } });
    expect(sprints.length).toBeGreaterThan(0);
    // 2 teams → sprints per team count > 0
    const teamIds = [...new Set(sprints.map((s) => s.teamId))];
    expect(teamIds).toHaveLength(2);
  });

  it("returns conflict when endDate <= startDate", async () => {
    const result = await createPi(testRequestContext(db, seed), {
      artId: seed.artId,
      name: "PI bad dates",
      startDate: new Date("2024-04-15"),
      endDate: new Date("2024-01-15"),
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });

  it("returns not_found for unknown artId", async () => {
    const result = await createPi(testRequestContext(db, seed), {
      artId: randomUUID() as ArtId,
      name: "PI orphan",
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-04-15"),
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("emits an AuditEvent row on success", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await createPi(testRequestContext(db, seed), {
      artId: seed.artId,
      name: "PI 24.1",
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-04-15"),
    });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });
});

describe("startPi", () => {
  async function createPlannedPi(name = "PI 24.1"): Promise<PiId> {
    // Add a team with a committed objective so startPi succeeds
    const team = await db.team.create({
      data: { tenantId: seed.tenantId, artId: seed.artId, name: "Team Alpha" },
    });
    const pi = await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        name,
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "planned",
      },
    });
    await db.piObjective.create({
      data: {
        tenantId: seed.tenantId,
        piId: pi.id,
        teamId: team.id,
        title: "Deliver feature X",
        committed: true,
        createdBy: seed.actorId,
      },
    });
    return pi.id as PiId;
  }

  it("transitions a planned PI to active", async () => {
    const piId = await createPlannedPi();

    const result = await startPi(testRequestContext(db, seed), { id: piId });

    expect(isOk(result)).toBe(true);
    const pi = await db.programIncrement.findFirst({ where: { id: piId } });
    expect(pi!.status).toBe("active");
  });

  it("returns conflict if another PI is already active in the ART", async () => {
    const pi1 = await createPlannedPi("PI 24.1");
    const pi2 = await createPlannedPi("PI 24.2");

    await startPi(testRequestContext(db, seed), { id: pi1 });

    const result = await startPi(testRequestContext(db, seed), { id: pi2 });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });

  it("emits an AuditEvent row on start", async () => {
    const piId = await createPlannedPi();
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await startPi(testRequestContext(db, seed), { id: piId });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBeGreaterThan(before);
  });
});

describe("completePi", () => {
  it("transitions an active PI to completed", async () => {
    const pi = await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        name: "PI 24.1",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "active",
      },
    });

    const result = await completePi(testRequestContext(db, seed), { id: pi.id as PiId });

    expect(isOk(result)).toBe(true);
    const updated = await db.programIncrement.findFirst({ where: { id: pi.id } });
    expect(updated!.status).toBe("completed");
  });

  it("returns conflict if PI is not active", async () => {
    const pi = await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        name: "PI planned",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "planned",
      },
    });

    const result = await completePi(testRequestContext(db, seed), { id: pi.id as PiId });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });
});
