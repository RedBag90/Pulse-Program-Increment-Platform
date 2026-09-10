import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { createSolution, setSolutionLifecycle } from "@/modules/work/server/services/solution";

/**
 * **Die Leiter gilt auch ohne Oberfläche.**
 *
 * Bis ADR-0020 stand `SOLUTION_TRANSITIONS` allein in der Lebenszyklus-Leiste:
 * über die Server-Action war jeder Sprung möglich, auch `Decommissioning →
 * R&D`. Diese Datei hält beides fest — die neue Regel „in H3 gibt es keine
 * Solution" und die Kanten-Prüfung, ohne die sie eine reine UI-Zusage bliebe.
 */

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

const ctx = () => testRequestContext(db, { tenantId: seed.tenantId, actorId: seed.actorId });

async function makeSolution(horizon: "h2" | "h1" | "h0", mode: "investing" | "extracting" | null) {
  const row = await db.solution.create({
    data: {
      tenantId: seed.tenantId,
      name: "Produkt",
      valueStreamId: seed.valueStreamId,
      horizon,
      investmentMode: mode,
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
    select: { id: true },
  });
  return row.id;
}

describe("In H3 gibt es keine Solution", () => {
  it("weist das Anlegen in H3 mit Begründung ab", async () => {
    const res = await createSolution(ctx(), {
      name: "Explorativ",
      valueStreamId: seed.valueStreamId,
      artId: null,
      horizon: "h3",
    });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.kind).toBe("conflict");
      expect(String((res.error as { reason?: string }).reason)).toContain("H3");
    }
  });

  it("legt dieselbe Solution in H2 an", async () => {
    const res = await createSolution(ctx(), {
      name: "Anwärter",
      valueStreamId: seed.valueStreamId,
      artId: null,
      horizon: "h2",
    });
    expect(isOk(res)).toBe(true);
  });

  it("lässt eine bestehende Solution nicht nach H3 zurückfallen", async () => {
    const id = await makeSolution("h2", null);
    const res = await setSolutionLifecycle(ctx(), { id, horizon: "h3" });
    expect(isErr(res)).toBe(true);
  });
});

describe("setSolutionLifecycle prüft die Kanten", () => {
  it("erlaubt den Schritt, der auf der Leiter steht", async () => {
    // H1.1 → H1.2: ein Klick, keine Rückfrage.
    const id = await makeSolution("h1", "investing");
    const res = await setSolutionLifecycle(ctx(), {
      id,
      horizon: "h1",
      investmentMode: "extracting",
    });
    expect(isOk(res)).toBe(true);
    const after = await db.solution.findUniqueOrThrow({ where: { id } });
    expect(after.investmentMode).toBe("extracting");
  });

  it("weist einen Sprung ab, den die Leiter nicht kennt", async () => {
    // Aus dem Auslauf führt genau eine Kante zurück — ins Investieren, nicht
    // nach H2. Vorher ging beides.
    const id = await makeSolution("h0", null);
    const res = await setSolutionLifecycle(ctx(), { id, horizon: "h2" });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
    const after = await db.solution.findUniqueOrThrow({ where: { id } });
    expect(after.horizon).toBe("h0");
  });

  it("erlaubt den einen Weg aus dem Auslauf zurück", async () => {
    const id = await makeSolution("h0", null);
    const res = await setSolutionLifecycle(ctx(), {
      id,
      horizon: "h1",
      investmentMode: "investing",
    });
    expect(isOk(res)).toBe(true);
  });

  it("führt den Anwärter, der scheitert, nach H0 statt zurück nach H3", async () => {
    const id = await makeSolution("h2", null);
    const res = await setSolutionLifecycle(ctx(), { id, horizon: "h0" });
    expect(isOk(res)).toBe(true);
    const after = await db.solution.findUniqueOrThrow({ where: { id } });
    expect(after.horizon).toBe("h0");
  });
});
