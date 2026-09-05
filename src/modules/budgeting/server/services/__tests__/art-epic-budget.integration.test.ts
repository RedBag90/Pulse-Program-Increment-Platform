import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { loadArtEpicBudgets } from "@/modules/budgeting/server/services/art-epic-budget";

/**
 * Was ein Fake **nicht** beweisen kann.
 *
 * Die Unit-Tests dieses Moduls prüfen die Faltung: Summen je ART, jeder gefragte
 * ART in der Karte, der Rest als Differenz. Zwei Dinge liegen aber im
 * `where`-Ausdruck und damit hinter der Schnittstelle des Fakes:
 *
 *  - dass **inaktive** Positionen nicht zählen — genau der Filter, der zuletzt
 *    fehlte und das Budget samt Deckel zu hoch rechnete;
 *  - dass **Betriebspositionen** nicht zählen — der Filter, der Run von Grow
 *    trennt.
 *
 * Ein Fake kann darauf nur mit `expect(query.mock.calls[0][0])` antworten, also
 * mit der Form des Aufrufs statt mit dem Ergebnis. Solche Behauptungen brechen,
 * wenn sich die Abfrage ändert, obwohl das Verhalten stimmt — genau das ist in
 * dieser Sitzung passiert, als der Filter von einer Unterabfrage auf einen
 * Relationsfilter umgestellt wurde. Hier steht dieselbe Frage als Verhalten.
 *
 * Braucht `DATABASE_URL_TEST` und eine laufende Test-Datenbank
 * (`supabase start`); läuft nicht in `pnpm test`, sondern in
 * `pnpm test:integration`.
 */

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

const CYCLE = "2026-H2";

/** Eine Position mit ihrem Zuspruch — der Weg, auf dem ein ART an Geld kommt. */
async function givePosition(opts: {
  kind: "run" | "art_change";
  active: boolean;
  awarded: number;
}): Promise<void> {
  const item = await db.runTheBusinessItem.create({
    data: {
      tenantId: seed.tenantId,
      valueStreamId: seed.valueStreamId,
      artId: seed.artId,
      name: `${opts.kind} ${opts.active ? "aktiv" : "inaktiv"}`,
      plannedAmount: opts.awarded,
      interval: "half_yearly",
      kind: opts.kind,
      active: opts.active,
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  await db.rtbItemAward.create({
    data: {
      tenantId: seed.tenantId,
      rtbItemId: item.id,
      cycleKey: CYCLE,
      amount: opts.awarded,
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
}

async function budgetOfSeedArt(): Promise<{ total: number; distributed: number }> {
  const m = await loadArtEpicBudgets(db, seed.tenantId, [seed.artId], CYCLE);
  const b = m.get(seed.artId);
  return { total: b?.total ?? -1, distributed: b?.distributed ?? -1 };
}

describe("loadArtEpicBudgets — gegen eine echte Datenbank", () => {
  it("zählt eine aktive ART-Epic-Budget-Position", async () => {
    await givePosition({ kind: "art_change", active: true, awarded: 100_000 });
    expect((await budgetOfSeedArt()).total).toBe(100_000);
  });

  it("zählt eine **deaktivierte** Position nicht", async () => {
    await givePosition({ kind: "art_change", active: true, awarded: 100_000 });
    await givePosition({ kind: "art_change", active: false, awarded: 400_000 });
    // Vor dem `active`-Filter stand hier 500.000 € — und derselbe Betrag als
    // Deckel, gegen den verteilt werden durfte.
    expect((await budgetOfSeedArt()).total).toBe(100_000);
  });

  it("zählt Betriebspositionen nicht — Run ist kein Grow", async () => {
    await givePosition({ kind: "art_change", active: true, awarded: 100_000 });
    await givePosition({ kind: "run", active: true, awarded: 900_000 });
    expect((await budgetOfSeedArt()).total).toBe(100_000);
  });

  it("zieht die Zuteilungen dieses ARTs im selben Halbjahr ab", async () => {
    await givePosition({ kind: "art_change", active: true, awarded: 100_000 });
    const epic = await db.initiative.create({
      data: {
        tenantId: seed.tenantId,
        level: 3,
        title: "ART-Epic",
        path: "",
        ownerId: seed.actorId,
        assigneeIds: [],
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
        valueStreamId: seed.valueStreamId,
        artId: seed.artId,
      },
    });
    await db.artEpicAllocation.create({
      data: {
        tenantId: seed.tenantId,
        artId: seed.artId,
        epicId: epic.id,
        cycleKey: CYCLE,
        amount: 30_000,
        ask: 30_000,
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });
    expect(await budgetOfSeedArt()).toEqual({ total: 100_000, distributed: 30_000 });
  });

  it("hält die Halbjahre auseinander", async () => {
    await givePosition({ kind: "art_change", active: true, awarded: 100_000 });
    const m = await loadArtEpicBudgets(db, seed.tenantId, [seed.artId], "2027-H1");
    expect(m.get(seed.artId)?.total).toBe(0);
  });
});
