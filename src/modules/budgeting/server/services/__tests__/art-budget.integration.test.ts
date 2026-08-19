import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { saveArtBudget } from "@/modules/budgeting/server/services/art-budget";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

/**
 * Baut einen Principal mit Rolle + passendem Capability-Grant. Die Capability
 * spiegelt den Policy-Eintrag: `value_stream`-scoped fuer den Wertstrom-Owner,
 * ungescoped fuer den Portfolio-Manager.
 */
function contextWith(
  roles: Role[],
  opts: { valueStreamIds?: string[]; scoped?: boolean } = {},
): RequestContext {
  const base = testRequestContext(db, seed);
  return {
    ...base,
    principal: {
      ...base.principal,
      roles,
      scopes: { valueStreamIds: opts.valueStreamIds ?? [], artIds: [], teamIds: [] },
      capabilities: [{ action: "art_budget.manage", scope: opts.scoped ? "value_stream" : null }],
    },
  };
}

const BUDGET = { "2026-H1": 400_000, "2026-H2": 380_000 };

describe("saveArtBudget — Autorisierung am Service-Seam (REQ-A5, ADR-0002)", () => {
  it("der Portfolio-Manager darf verteilen", async () => {
    const res = await saveArtBudget(contextWith(["portfolio_manager"]), {
      artId: seed.artId,
      byPeriod: BUDGET,
    });

    expect(isOk(res)).toBe(true);
    const row = await db.artBudget.findUnique({ where: { artId: seed.artId } });
    expect(row?.byPeriod).toEqual(BUDGET);
  });

  it("die Finance-Partei des Wertstroms darf verteilen — ganz ohne Rolle", async () => {
    await db.valueStream.update({
      where: { id: seed.valueStreamId },
      data: { financeApproverId: seed.actorId },
    });

    const res = await saveArtBudget(testRequestContext(db, seed), {
      artId: seed.artId,
      byPeriod: BUDGET,
    });

    expect(isOk(res)).toBe(true);
  });

  /**
   * Befund F-01: die Policy erlaubte dem Wertstrom-Owner `art_budget.manage`,
   * der Service lehnte ihn ab — die Seite zeigte ihm ein editierbares Grid,
   * dessen Speichern scheiterte. Jetzt entscheidet EINE Regel.
   */
  it("der Wertstrom-Owner darf SEINEN Wertstrom verteilen", async () => {
    const res = await saveArtBudget(
      contextWith(["value_stream_owner"], {
        valueStreamIds: [seed.valueStreamId],
        scoped: true,
      }),
      { artId: seed.artId, byPeriod: BUDGET },
    );

    expect(isOk(res)).toBe(true);
  });

  it("ein Wertstrom-Owner eines ANDEREN Wertstroms wird abgewiesen", async () => {
    const res = await saveArtBudget(
      contextWith(["value_stream_owner"], {
        valueStreamIds: [randomUUID()],
        scoped: true,
      }),
      { artId: seed.artId, byPeriod: BUDGET },
    );

    expect(isErr(res)).toBe(true);
    expect(await db.artBudget.count({ where: { artId: seed.artId } })).toBe(0);
  });

  it("ein Principal ohne jede Berechtigung wird abgewiesen", async () => {
    const res = await saveArtBudget(testRequestContext(db, seed), {
      artId: seed.artId,
      byPeriod: BUDGET,
    });

    expect(isErr(res)).toBe(true);
    expect(await db.artBudget.count({ where: { artId: seed.artId } })).toBe(0);
  });

  it("eine ART-Id aus einem fremden Tenant ist not_found, nicht forbidden", async () => {
    const testDb = createTestPrismaClient();
    const other = await seedTenant(testDb);
    await testDb.$disconnect();

    const res = await saveArtBudget(contextWith(["portfolio_manager"]), {
      artId: other.artId,
      byPeriod: BUDGET,
    });

    expect(isErr(res)).toBe(true);
    expect(await db.artBudget.count({ where: { artId: other.artId } })).toBe(0);
  });

  it("ist ein Upsert und auditiert jeden Schreibvorgang", async () => {
    const ctx = contextWith(["portfolio_manager"]);
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await saveArtBudget(ctx, { artId: seed.artId, byPeriod: { "2026-H1": 1 } });
    await saveArtBudget(ctx, { artId: seed.artId, byPeriod: { "2026-H2": 2 } });

    expect(await db.artBudget.count({ where: { artId: seed.artId } })).toBe(1);
    const row = await db.artBudget.findUnique({ where: { artId: seed.artId } });
    expect(row?.byPeriod).toEqual({ "2026-H2": 2 });
    expect(await db.auditEvent.count({ where: { tenantId: seed.tenantId } })).toBe(before + 2);
  });
});
