import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  addSystemDemoItem,
  updateSystemDemo,
  updateSystemDemoItem,
  deleteSystemDemoItem,
  reorderSystemDemoItems,
  getSystemDemoForPi,
  type SystemDemoItemId,
} from "@/server/services/system-demo";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk, isErr } from "@/domain/errors";
import type { PiId } from "@/domain/types";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let piId: PiId;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();

  const pi = await db.programIncrement.create({
    data: {
      tenantId: seed.tenantId,
      timelineId: seed.timelineId,
      name: "PI 2026-Q1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      status: "active",
    },
  });
  piId = pi.id as PiId;
});

describe("addSystemDemoItem", () => {
  it("auto-creates the SystemDemo row on first call and appends items in order", async () => {
    const ctx = testRequestContext(db, seed);

    const a = await addSystemDemoItem(ctx, { piId, title: "Login redesign demo" });
    expect(isOk(a)).toBe(true);
    const b = await addSystemDemoItem(ctx, { piId, title: "Search v2 demo" });
    expect(isOk(b)).toBe(true);

    const demo = await getSystemDemoForPi(db, seed.tenantId, piId);
    expect(demo).not.toBeNull();
    expect(demo!.items).toHaveLength(2);
    expect(demo!.items[0]!.position).toBe(0);
    expect(demo!.items[1]!.position).toBe(1);
    expect(demo!.items[0]!.title).toBe("Login redesign demo");
  });
});

describe("updateSystemDemo", () => {
  it("setzt scheduledAt und recordingUrl, wenn ein Demo existiert", async () => {
    const ctx = testRequestContext(db, seed);
    await addSystemDemoItem(ctx, { piId, title: "Item 1" });

    const r = await updateSystemDemo(ctx, {
      piId,
      scheduledAt: new Date("2026-03-25T14:00:00Z"),
      recordingUrl: "https://example.com/demo.mp4",
    });
    expect(isOk(r)).toBe(true);

    const demo = await getSystemDemoForPi(db, seed.tenantId, piId);
    expect(demo!.scheduledAt).toEqual(new Date("2026-03-25T14:00:00Z"));
    expect(demo!.recordingUrl).toBe("https://example.com/demo.mp4");
  });

  it("liefert not_found, wenn fuer den PI noch kein Demo existiert", async () => {
    const r = await updateSystemDemo(testRequestContext(db, seed), {
      piId,
      scheduledAt: new Date(),
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("not_found");
  });
});

describe("updateSystemDemoItem", () => {
  it("flippt presented-Flag und schreibt einen Audit-Event", async () => {
    const ctx = testRequestContext(db, seed);
    const created = await addSystemDemoItem(ctx, { piId, title: "Demo X" });
    if (!isOk(created)) throw new Error("setup failed");

    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    const r = await updateSystemDemoItem(ctx, {
      id: created.value.id as SystemDemoItemId,
      presented: true,
    });
    expect(isOk(r)).toBe(true);

    const item = await db.systemDemoItem.findFirst({
      where: { id: created.value.id },
    });
    expect(item!.presented).toBe(true);

    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });
});

describe("reorderSystemDemoItems", () => {
  it("rotiert die positions auf die uebergebene Reihenfolge", async () => {
    const ctx = testRequestContext(db, seed);
    const a = await addSystemDemoItem(ctx, { piId, title: "A" });
    const b = await addSystemDemoItem(ctx, { piId, title: "B" });
    const c = await addSystemDemoItem(ctx, { piId, title: "C" });
    if (!isOk(a) || !isOk(b) || !isOk(c)) throw new Error("setup failed");

    const r = await reorderSystemDemoItems(ctx, {
      piId,
      orderedItemIds: [
        c.value.id as SystemDemoItemId,
        a.value.id as SystemDemoItemId,
        b.value.id as SystemDemoItemId,
      ],
    });
    expect(isOk(r)).toBe(true);

    const demo = await getSystemDemoForPi(db, seed.tenantId, piId);
    expect(demo!.items.map((i) => i.title)).toEqual(["C", "A", "B"]);
  });

  it("erzwingt vollstaendige Listen-Abdeckung im Reorder", async () => {
    const ctx = testRequestContext(db, seed);
    const a = await addSystemDemoItem(ctx, { piId, title: "A" });
    const b = await addSystemDemoItem(ctx, { piId, title: "B" });
    if (!isOk(a) || !isOk(b)) throw new Error("setup failed");

    const r = await reorderSystemDemoItems(ctx, {
      piId,
      orderedItemIds: [a.value.id as SystemDemoItemId],
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("conflict");
  });
});

describe("deleteSystemDemoItem", () => {
  it("loescht das Item und schreibt ein Audit-Event", async () => {
    const ctx = testRequestContext(db, seed);
    const created = await addSystemDemoItem(ctx, { piId, title: "Doomed" });
    if (!isOk(created)) throw new Error("setup failed");

    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    const r = await deleteSystemDemoItem(ctx, {
      id: created.value.id as SystemDemoItemId,
    });
    expect(isOk(r)).toBe(true);

    const after = await db.systemDemoItem.count({ where: { id: created.value.id } });
    expect(after).toBe(0);
    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });
});
