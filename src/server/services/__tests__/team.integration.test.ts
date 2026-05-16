import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTeam } from "@/server/services/team";
import { isOk } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

describe("createTeam — sprint backfill", () => {
  it("generates sprints in an existing planned PI for the new team", async () => {
    const pi = await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        name: "PI 24.1",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "planned",
      },
    });

    const result = await createTeam(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      artId: seed.artId,
      name: "Team Alpha",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const sprints = await db.sprint.findMany({
      where: { piId: pi.id, teamId: result.value.id },
    });
    expect(sprints.length).toBeGreaterThan(0);
  });

  it("does not add sprints to an active or completed PI", async () => {
    const completed = await db.programIncrement.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        name: "PI done",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-04-15"),
        status: "completed",
      },
    });

    const result = await createTeam(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      artId: seed.artId,
      name: "Team Beta",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const sprints = await db.sprint.findMany({ where: { piId: completed.id } });
    expect(sprints).toHaveLength(0);
  });

  it("creates a team with no sprints when the ART has no planned PIs", async () => {
    const result = await createTeam(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      artId: seed.artId,
      name: "Team Gamma",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const sprints = await db.sprint.findMany({ where: { teamId: result.value.id } });
    expect(sprints).toHaveLength(0);
  });
});
