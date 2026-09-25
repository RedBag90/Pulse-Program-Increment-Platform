import type { Dependency, Prisma, PrismaClient } from "@/generated/prisma";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import { detectCycle } from "@/modules/core/kernel/domain/dependency-graph";
import { emitAuditEvent } from "@/server/audit/emit";
import type { MutationContext } from "@/modules/core/kernel/server/mutation";
import type { TenantId } from "@/modules/core/kernel/domain/types";

// ---------------------------------------------------------------------------
// Dependency-edge primitive — the single owner of Dependency-edge mutations.
//
// A Dependency is a directed link between two Initiatives, and Work owns the
// Initiative. The shared edge primitive therefore lives HERE, in Work, at the
// bottom of the {Drumbeat, Budgeting} tier (Core ← Work ← {Drumbeat, …}). Both
// consumers reach it by importing DOWN:
//   • `feature.ts` (same layer — Work) calls it directly, which is why the
//     Netzplan quick-add / edge-insertion no longer hand-roll edge rows even
//     though Work may NOT import Drumbeat's dependency service.
//   • Drumbeat's `dependency.ts` (a layer above) delegates into it, so the
//     cycle-check + audit shapes live in exactly ONE place.
//
// These functions are deliberately impure: they take an open Prisma `tx` and a
// `MutationContext`, run inside the caller's transaction, and emit their audit
// rows inline (the same way the caller's primary mutation audit commits
// atomically with the write). They do NOT open their own transaction.
// ---------------------------------------------------------------------------

export type DependencyType = "blocks" | "depends_on" | "relates_to";

/** The minimal edge shape the delete/split primitives need. A Prisma
 *  `Dependency` row satisfies it structurally. */
export interface EdgeRow {
  id: string;
  type: string;
  fromId: string;
  toId: string;
}

const DEFAULT_CYCLE_REASON = "This dependency would create a circular dependency chain";

/** Emits the `initiative.dependency.linked` audit for a freshly written edge.
 *  `auditBefore` overrides the `before` side (default: a null → value diff, i.e.
 *  a genuine new link); a type-migration passes the prior edge so the event
 *  reads as one before/after `linked` row. */
function linkedChanges(
  input: { fromId: string; toId: string; type: DependencyType },
  auditBefore?: { type: DependencyType; fromId: string; toId: string },
) {
  return {
    type: { before: auditBefore?.type ?? null, after: input.type },
    fromId: { before: auditBefore?.fromId ?? null, after: input.fromId },
    toId: { before: auditBefore?.toId ?? null, after: input.toId },
  };
}

/** Create-and-audit, WITHOUT a cycle-check. The private core shared by
 *  `createEdge` (which adds the cycle-check) and `splitEdge` (which needs no
 *  cycle-check). */
async function insertEdge(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  input: { fromId: string; toId: string; type: DependencyType },
  auditBefore?: { type: DependencyType; fromId: string; toId: string },
): Promise<Dependency> {
  const dep = await tx.dependency.create({
    data: {
      tenantId: mctx.tenantId,
      fromId: input.fromId,
      toId: input.toId,
      type: input.type,
      createdBy: mctx.actorId,
    },
  });

  await emitAuditEvent(tx, {
    tenantId: mctx.tenantId,
    actorId: mctx.actorId,
    action: "initiative.dependency.linked",
    resourceType: "dependency",
    resourceId: dep.id,
    changes: linkedChanges(input, auditBefore),
    ipAddress: mctx.ipAddress,
    userAgent: mctx.userAgent,
  });

  return dep;
}

export interface CreateEdgeOptions {
  /**
   * Overrides the `before` side of the emitted `dependency.linked` audit.
   * Defaults to a fresh-link diff (`before: null`). `changeDependencyType`
   * passes the prior edge's `{ type, fromId, toId }` so a type-migration reads
   * as a single before/after `linked` event — preserving the pre-refactor
   * audit log (one row, not unlink+link).
   */
  auditBefore?: { type: DependencyType; fromId: string; toId: string };
  /**
   * Human-readable reason for the `conflict` returned when the edge would
   * cycle. Defaults to the wording `linkDependency` has always used; the
   * type-change path passes its own message.
   */
  cycleReason?: string;
}

/**
 * Creates a directed dependency edge `from → to`, running the tenant-wide
 * cycle-check FIRST (via Core's `detectCycle`) exactly as Drumbeat's
 * `linkDependency` always has: `relates_to` edges are purely informational and
 * are skipped by the check (both as the proposed edge and within the existing
 * edge set). Emits the `initiative.dependency.linked` audit on success.
 *
 * Returns `err({ kind: "conflict" })` when the edge would close a cycle. A
 * duplicate edge surfaces as a thrown unique-constraint error that propagates
 * to the caller's transaction boundary (mapped to `conflict` there, unchanged
 * from before) — this primitive does not swallow it.
 */
export async function createEdge(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  input: { fromId: string; toId: string; type: DependencyType },
  opts: CreateEdgeOptions = {},
): Promise<Result<Dependency>> {
  if (input.type !== "relates_to") {
    const existingEdges = await tx.dependency.findMany({
      where: { tenantId: mctx.tenantId, type: { not: "relates_to" } },
      select: { fromId: true, toId: true },
    });
    if (detectCycle(input.fromId, input.toId, existingEdges)) {
      return err({ kind: "conflict" as const, reason: opts.cycleReason ?? DEFAULT_CYCLE_REASON });
    }
  }

  const dep = await insertEdge(tx, mctx, input, opts.auditBefore);
  return ok(dep);
}

export interface DeleteEdgeOptions {
  /**
   * When `false`, deletes the row WITHOUT emitting the `unlinked` audit. Used
   * only by `changeDependencyType`, where a single combined `linked` audit (via
   * `createEdge`'s `auditBefore`) already represents the whole type-swap, so the
   * intermediate delete must stay silent. Defaults to `true`.
   */
  emitAudit?: boolean;
}

/**
 * Deletes an edge and (by default) emits the `initiative.dependency.unlinked`
 * audit. No cycle-check — removing an edge can never create one.
 */
export async function deleteEdge(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  edge: EdgeRow,
  opts: DeleteEdgeOptions = {},
): Promise<void> {
  await tx.dependency.delete({ where: { id: edge.id } });

  if (opts.emitAudit === false) return;

  await emitAuditEvent(tx, {
    tenantId: mctx.tenantId,
    actorId: mctx.actorId,
    action: "initiative.dependency.unlinked",
    resourceType: "dependency",
    resourceId: edge.id,
    changes: {
      type: { before: edge.type, after: null },
      fromId: { before: edge.fromId, after: null },
      toId: { before: edge.toId, after: null },
    },
    ipAddress: mctx.ipAddress,
    userAgent: mctx.userAgent,
  });
}

/**
 * Splits an existing edge `from → to` around a new node: deletes `existing` and
 * creates `from → newNode` and `newNode → to`, all keeping `type`. Emits the
 * unlinked + linked + linked audits in that order.
 *
 * NO cycle-check by design: `existing` was already part of an acyclic graph, and
 * re-routing `from → to` through a brand-new node (which has no other edges)
 * cannot introduce a cycle. Documenting this is the reason it does not reuse
 * `createEdge`'s check.
 */
export async function splitEdge(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  input: { existing: EdgeRow; newNodeId: string; type: DependencyType },
): Promise<Result<[Dependency, Dependency]>> {
  const { existing, newNodeId, type } = input;

  await deleteEdge(tx, mctx, existing);
  const depA = await insertEdge(tx, mctx, { fromId: existing.fromId, toId: newNodeId, type });
  const depB = await insertEdge(tx, mctx, { fromId: newNodeId, toId: existing.toId, type });

  return ok([depA, depB]);
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

/** One breakdown-network edge that has at least one endpoint among the Epic's
 *  Features. Cross-Epic endpoints carry their `parent` (the other Epic) so the
 *  network can render them as ghost-nodes with a click-through. */
export interface BreakdownDependencyEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  from: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  to: { id: string; title: string; parent: { id: string; title: string } | null } | null;
}

/**
 * Kanten mit **mindestens einem** Endpunkt in `featureIds` — das Rohmaterial
 * des Epic-Netzplans. Leere Menge ⇒ `[]`.
 *
 * **Warum die Abfrage hier steht und nicht mehr bei Drumbeat.** Sie lag in
 * `drumbeat/server/services/dependency.ts`, mit der Begründung „Drumbeat
 * besitzt die Tabelle". Das stimmte, bis `dependency.` im September 2026 zu
 * Work wanderte. Danach ging der **Schreibweg** durch die Work-Schranke,
 * während der Leseweg an der Drumbeat-Scheibe des Epic-Modells hing: wer Work
 * ohne Drumbeat hatte, legte eine Kante an und sah sie eine Sekunde später
 * wieder verschwinden.
 *
 * Jetzt wohnt der Leseweg dort, wo `createEdge` seit jeher wohnt — dieselbe
 * Schicht, dieselbe Tabelle, derselbe Besitzer. Die eigene Fläche
 * `/dependencies` bleibt davon unberührt: die hängt am **Segment** Drumbeat,
 * nicht an der Aktion.
 *
 * Anders als die Nachbarn in dieser Datei ist sie rein lesend und nimmt
 * deshalb einen `PrismaClient`, keine offene Transaktion.
 */
export async function listBreakdownDependencies(
  db: PrismaClient,
  tenantId: TenantId,
  featureIds: readonly string[],
): Promise<BreakdownDependencyEdge[]> {
  if (featureIds.length === 0) return [];
  return db.dependency.findMany({
    where: {
      tenantId,
      OR: [{ fromId: { in: featureIds as string[] } }, { toId: { in: featureIds as string[] } }],
    },
    select: {
      id: true,
      fromId: true,
      toId: true,
      type: true,
      from: {
        select: { id: true, title: true, parent: { select: { id: true, title: true } } },
      },
      to: {
        select: { id: true, title: true, parent: { select: { id: true, title: true } } },
      },
    },
  });
}
