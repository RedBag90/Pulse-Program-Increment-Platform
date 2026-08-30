import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  createFeature,
  createFeatureWithDependency,
  insertFeatureBetween,
  updateFeature,
  scoreFeature,
  assignFeatureOwner,
} from "@/modules/work/server/services/feature";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId, FeatureId, ArtId } from "@/modules/core/kernel/domain/types";
import { randomUUID } from "crypto";
import type { RequestContext } from "@/server/http/mutation-handler";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let epicId: EpicId;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);

  const epic = await testDb.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Test Epic",
      path: "",
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  epicId = epic.id as EpicId;
  await testDb.initiative.update({
    where: { id: epic.id },
    data: { path: epic.id },
  });

  await testDb.$disconnect();
});

describe("createFeature", () => {
  it("creates a feature with computed WSJF and returns its id", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Implement login",
      wsjfBusinessValue: 8,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 3,
      wsjfJobSize: 5,
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const feature = await db.initiative.findFirst({ where: { id: result.value.id } });
    expect(feature).not.toBeNull();
    expect(feature!.title).toBe("Implement login");
    expect(feature!.wsjfComputed).not.toBeNull();
  });

  it("returns not_found for unknown epic parentId", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: randomUUID() as EpicId,
      artId: seed.artId,
      title: "Orphan feature",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("returns not_found for unknown artId", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: randomUUID() as ArtId,
      title: "Feature with bad ART",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("rejects an ART outside the parent Epic's value stream", async () => {
    // Epic in den Seed-Wertstrom hängen und einen ART in einem zweiten
    // Wertstrom anlegen — genau die Paarung, die die UI-Kaskade ausschließt.
    const testDb = createTestPrismaClient();
    await testDb.initiative.update({
      where: { id: epicId },
      data: { valueStreamId: seed.valueStreamId },
    });
    const otherVs = await testDb.valueStream.create({
      data: { tenantId: seed.tenantId, name: "Other Value Stream" },
    });
    const foreignArt = await testDb.art.create({
      data: { tenantId: seed.tenantId, valueStreamId: otherVs.id, name: "Foreign ART" },
    });
    await testDb.$disconnect();

    const rejected = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: foreignArt.id as ArtId,
      title: "Feature in the wrong value stream",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isErr(rejected)).toBe(true);
    if (!isErr(rejected)) return;
    expect(rejected.error.kind).toBe("not_found");

    // Der ART aus dem Wertstrom des Epics geht durch.
    const accepted = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Feature in the right value stream",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isOk(accepted)).toBe(true);
  });

  it("emits an AuditEvent row on creation", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Feature with audit",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });
});

describe("updateFeature", () => {
  async function createTestFeature(): Promise<FeatureId> {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Original title",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(result)) throw new Error("Failed to create test feature");
    return result.value.id;
  }

  it("updates the feature title and writes an AuditEvent", async () => {
    const featureId = await createTestFeature();
    const auditsBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await updateFeature(testRequestContext(db, seed), {
      id: featureId,
      title: "Updated title",
    });

    expect(isOk(result)).toBe(true);
    const feature = await db.initiative.findFirst({ where: { id: featureId } });
    expect(feature!.title).toBe("Updated title");

    const auditsAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditsAfter).toBeGreaterThan(auditsBefore);
  });
});

describe("scoreFeature", () => {
  it("recalculates wsjfComputed after scoring", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Feature to score",
      wsjfBusinessValue: 1,
      wsjfTimeCriticality: 1,
      wsjfRiskReduction: 1,
      wsjfJobSize: 1,
    });
    if (!isOk(result)) throw new Error("Failed to create feature");
    const featureId = result.value.id;
    const before = await db.initiative.findFirst({ where: { id: featureId } });

    await scoreFeature(testRequestContext(db, seed), {
      id: featureId,
      wsjfBusinessValue: 13,
      wsjfTimeCriticality: 8,
      wsjfRiskReduction: 5,
      wsjfJobSize: 2,
    });

    const after = await db.initiative.findFirst({ where: { id: featureId } });
    expect(Number(after!.wsjfComputed)).toBeGreaterThan(Number(before!.wsjfComputed));
  });
});

describe("createFeatureWithDependency (Netzplan Quick-Add)", () => {
  async function makePredecessor(): Promise<FeatureId> {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Predecessor",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(result)) throw new Error("Failed to seed predecessor");
    return result.value.id;
  }

  it("legt feature + depends_on-edge in derselben transaktion an", async () => {
    const predecessorId = await makePredecessor();
    const result = await createFeatureWithDependency(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      predecessorId,
      title: "Successor",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const feature = await db.initiative.findFirst({ where: { id: result.value.id } });
    expect(feature).not.toBeNull();
    expect(feature!.title).toBe("Successor");
    // WSJF-Defaults greifen.
    expect(feature!.wsjfBusinessValue).toBe(3);
    expect(feature!.wsjfTimeCriticality).toBe(3);
    expect(feature!.wsjfRiskReduction).toBe(3);
    expect(feature!.wsjfJobSize).toBe(3);
    expect(Number(feature!.wsjfComputed)).toBeCloseTo(3);

    const dep = await db.dependency.findFirst({
      where: { fromId: predecessorId, toId: result.value.id },
    });
    expect(dep).not.toBeNull();
    expect(dep!.type).toBe("depends_on");
  });

  it("akzeptiert featureType + custom edgeType", async () => {
    const predecessorId = await makePredecessor();
    const result = await createFeatureWithDependency(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      predecessorId,
      title: "Enabler block",
      featureType: "enabler",
      edgeType: "blocks",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const feature = await db.initiative.findFirst({ where: { id: result.value.id } });
    expect(feature!.featureType).toBe("enabler");

    const dep = await db.dependency.findFirst({
      where: { fromId: predecessorId, toId: result.value.id },
    });
    expect(dep!.type).toBe("blocks");
  });

  it("emittiert zwei audit-events (initiative.created + dependency.linked)", async () => {
    const predecessorId = await makePredecessor();
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await createFeatureWithDependency(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      predecessorId,
      title: "Audit-probe",
    });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 2);
  });

  it("rollbackt bei unbekanntem predecessor — kein feature, keine dep, keine audits", async () => {
    const beforeInits = await db.initiative.count({ where: { tenantId: seed.tenantId } });
    const beforeDeps = await db.dependency.count({ where: { tenantId: seed.tenantId } });
    const beforeAudits = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await createFeatureWithDependency(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      predecessorId: randomUUID() as FeatureId,
      title: "Orphan-successor",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");

    const afterInits = await db.initiative.count({ where: { tenantId: seed.tenantId } });
    const afterDeps = await db.dependency.count({ where: { tenantId: seed.tenantId } });
    const afterAudits = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(afterInits).toBe(beforeInits);
    expect(afterDeps).toBe(beforeDeps);
    expect(afterAudits).toBe(beforeAudits);
  });

  it("rollbackt bei unbekanntem epic-parent", async () => {
    const predecessorId = await makePredecessor();
    const result = await createFeatureWithDependency(testRequestContext(db, seed), {
      parentId: randomUUID() as EpicId,
      artId: seed.artId,
      predecessorId,
      title: "Orphan-parent",
    });
    expect(isErr(result)).toBe(true);
  });
});

describe("insertFeatureBetween (Netzplan Edge-Insertion)", () => {
  async function setupChain(): Promise<{ from: FeatureId; to: FeatureId; depId: string }> {
    const f1 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "From",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    const f2 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "To",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(f1) || !isOk(f2)) throw new Error("Failed to seed chain");
    const dep = await db.dependency.create({
      data: {
        tenantId: seed.tenantId,
        fromId: f1.value.id,
        toId: f2.value.id,
        type: "depends_on",
        createdBy: seed.actorId,
      },
    });
    return { from: f1.value.id, to: f2.value.id, depId: dep.id };
  }

  it("spaltet from->to in from->new->to und entfernt die alte edge", async () => {
    const { from, to, depId } = await setupChain();
    const result = await insertFeatureBetween(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      fromId: from,
      toId: to,
      edgeType: "depends_on",
      title: "Middle",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const middleId = result.value.id;

    // Alter Edge ist weg.
    const old = await db.dependency.findUnique({ where: { id: depId } });
    expect(old).toBeNull();

    // Zwei neue Edges existieren.
    const upstream = await db.dependency.findFirst({
      where: { fromId: from, toId: middleId, type: "depends_on" },
    });
    const downstream = await db.dependency.findFirst({
      where: { fromId: middleId, toId: to, type: "depends_on" },
    });
    expect(upstream).not.toBeNull();
    expect(downstream).not.toBeNull();
  });

  it("erhaelt den edge-typ ueber beide neue edges (blocks bleibt blocks)", async () => {
    const f1 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Blocked-from",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    const f2 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Blocked-to",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(f1) || !isOk(f2)) throw new Error("Failed to seed blocks chain");
    await db.dependency.create({
      data: {
        tenantId: seed.tenantId,
        fromId: f1.value.id,
        toId: f2.value.id,
        type: "blocks",
        createdBy: seed.actorId,
      },
    });

    const result = await insertFeatureBetween(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      fromId: f1.value.id,
      toId: f2.value.id,
      edgeType: "blocks",
      title: "Middle-blocks",
    });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const upstream = await db.dependency.findFirst({
      where: { fromId: f1.value.id, toId: result.value.id },
    });
    const downstream = await db.dependency.findFirst({
      where: { fromId: result.value.id, toId: f2.value.id },
    });
    expect(upstream!.type).toBe("blocks");
    expect(downstream!.type).toBe("blocks");
  });

  it("emittiert vier audit-events (1 created + 1 unlinked + 2 linked)", async () => {
    const { from, to } = await setupChain();
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await insertFeatureBetween(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      fromId: from,
      toId: to,
      edgeType: "depends_on",
      title: "Audited-middle",
    });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 4);
  });

  it("not_found wenn der zu spaltende edge nicht existiert", async () => {
    const f1 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "F1",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    const f2 = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "F2",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(f1) || !isOk(f2)) throw new Error("Failed to seed");

    const result = await insertFeatureBetween(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      fromId: f1.value.id,
      toId: f2.value.id,
      edgeType: "depends_on",
      title: "Phantom-middle",
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });
});

describe("assignFeatureOwner", () => {
  /**
   * Eigenes Epic **mit** Wertstrom: das Epic aus `beforeEach` hat keinen, und ein
   * Feature trägt selbst keine `valueStreamId`. Der Scope-Test unten liefe damit
   * ins Leere — `memberOrVacuous` lässt ein leeres Feld durch, die Prüfung wäre
   * grün, ohne je etwas geprüft zu haben.
   */
  async function makeFeatureInValueStream(): Promise<string> {
    const testDb = createTestPrismaClient();
    const epic = await testDb.initiative.create({
      data: {
        tenantId: seed.tenantId,
        level: InitiativeLevel.EPIC,
        title: "Epic im Wertstrom",
        path: "",
        valueStreamId: seed.valueStreamId,
        ownerId: seed.actorId,
        assigneeIds: [],
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });
    await testDb.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
    await testDb.$disconnect();

    const feature = await createFeature(testRequestContext(db, seed), {
      parentId: epic.id as EpicId,
      artId: seed.artId,
      title: "Antragsstrecke",
      wsjfBusinessValue: 8,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 3,
      wsjfJobSize: 5,
    });
    if (!isOk(feature)) throw new Error("Failed to seed feature");
    return feature.value.id;
  }

  it("setzt den Owner", async () => {
    const id = await makeFeatureInValueStream();
    const newOwner = randomUUID();

    const res = await assignFeatureOwner(testRequestContext(db, seed), { id, ownerId: newOwner });
    expect(isOk(res)).toBe(true);

    const row = await db.initiative.findFirst({ where: { id } });
    expect(row?.ownerId).toBe(newOwner);
  });

  it("entfernt den Owner mit `null`", async () => {
    const id = await makeFeatureInValueStream();
    await assignFeatureOwner(testRequestContext(db, seed), { id, ownerId: randomUUID() });

    const res = await assignFeatureOwner(testRequestContext(db, seed), { id, ownerId: null });
    expect(isOk(res)).toBe(true);

    const row = await db.initiative.findFirst({ where: { id } });
    expect(row?.ownerId).toBeNull();
  });

  it("schreibt Vorher/Nachher ins Audit", async () => {
    const id = await makeFeatureInValueStream();
    const first = randomUUID();
    const second = randomUUID();
    await assignFeatureOwner(testRequestContext(db, seed), { id, ownerId: first });
    await assignFeatureOwner(testRequestContext(db, seed), { id, ownerId: second });

    const event = await db.auditEvent.findFirst({
      where: { tenantId: seed.tenantId, action: "feature.owner.assigned", resourceId: id },
      orderBy: { occurredAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.changes).toMatchObject({ ownerId: { before: first, after: second } });
  });

  it("weist einen Value Stream Owner ausserhalb seines Wertstroms ab", async () => {
    const id = await makeFeatureInValueStream();
    const base = testRequestContext(db, seed);
    const outsider: RequestContext = {
      ...base,
      principal: {
        ...base.principal,
        roles: ["value_stream_owner"],
        scopes: {
          valueStreamIds: ["00000000-0000-0000-0000-000000000000"],
          artIds: [],
          teamIds: [],
        },
        capabilities: [{ action: "feature.owner.assign", scope: "value_stream" }],
      },
    };

    const res = await assignFeatureOwner(outsider, { id, ownerId: randomUUID() });
    expect(isErr(res)).toBe(true);

    const row = await db.initiative.findFirst({ where: { id } });
    expect(row?.ownerId).toBeNull();
  });
});
