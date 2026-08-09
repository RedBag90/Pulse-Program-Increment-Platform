import type { PrismaClient } from "@/generated/prisma";
import type {
  TenantId,
  FeatureId,
  EpicId,
  ArtId,
  PiId,
  FibonacciValue,
} from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import { computeWsjf } from "@/domain/schemas/initiative";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import {
  createInitiativeWithDerivedPath,
  findValidatedParent,
} from "@/modules/core/kernel/server/initiative-write";
import { paginate, type PageParams } from "@/server/db/paginate";
import { rangeOverlapsPlannedWindow } from "@/modules/work/domain/epic-schedule";
import { canDeliveryTransition } from "@/modules/core/kernel/domain/initiative-status";
import {
  earliestStartFromBlockers,
  type BlockerWindow,
} from "@/modules/core/kernel/domain/dependency-graph";
import type { FeatureType } from "@/modules/work/domain/portfolio-guardrails";
import { emitAuditEvent } from "@/server/audit/emit";

/** Non-fatal advisories surfaced alongside a successful mutation (e.g. setFeaturePi). */
export interface MutationWarnings {
  warnings: string[];
}

export interface CreateFeatureInput {
  parentId: EpicId;
  artId: ArtId;
  piId?: PiId | undefined;
  title: string;
  description?: string | undefined;
  wsjfBusinessValue: FibonacciValue;
  wsjfTimeCriticality: FibonacciValue;
  wsjfRiskReduction: FibonacciValue;
  wsjfJobSize: FibonacciValue;
  acceptanceCriteria?: string[] | undefined;
  /** SAFe Capacity-Guardrail Klassifikation. `null`/`undefined` = unklassifiziert. */
  featureType?: FeatureType | null | undefined;
}

export interface UpdateFeatureInput {
  id: FeatureId;
  title?: string | undefined;
  description?: string | undefined;
  wsjfBusinessValue?: FibonacciValue | undefined;
  wsjfTimeCriticality?: FibonacciValue | undefined;
  wsjfRiskReduction?: FibonacciValue | undefined;
  wsjfJobSize?: FibonacciValue | undefined;
  acceptanceCriteria?: string[] | undefined;
  piId?: PiId | undefined;
  /** SAFe Capacity-Guardrail Klassifikation. `null` cleart, `undefined` belaesst. */
  featureType?: FeatureType | null | undefined;
}

export async function createFeature(
  ctx: RequestContext,
  input: CreateFeatureInput,
): Promise<Result<{ id: FeatureId }>> {
  const mctx = toMutationContext(ctx);
  const {
    parentId,
    artId,
    piId,
    title,
    description,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    acceptanceCriteria,
    featureType,
  } = input;

  const wsjfComputed = computeWsjf({
    businessValue: wsjfBusinessValue,
    timeCriticality: wsjfTimeCriticality,
    riskReduction: wsjfRiskReduction,
    jobSize: wsjfJobSize,
  });

  return withAuditedTransaction(mctx, async (tx) => {
    const parentResult = await findValidatedParent(tx, mctx, InitiativeLevel.FEATURE, parentId);
    if (isErr(parentResult)) return parentResult;
    const epic = parentResult.value!; // non-null for a FEATURE's EPIC parent

    const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
    if (!art) {
      return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
    }

    const feature = await createInitiativeWithDerivedPath(tx, {
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        parentId,
        artId,
        title,
        // Features starten in der Delivery-Lane „Bereit". QA-Gate
        // (draft→in_review→approved) wurde 2026-06 entfernt.
        status: "approved",
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        wsjfBusinessValue,
        wsjfTimeCriticality,
        wsjfRiskReduction,
        wsjfJobSize,
        wsjfComputed,
        acceptanceCriteria: acceptanceCriteria ?? [],
        ...(description !== undefined && { description }),
        ...(piId !== undefined && { piId }),
        ...(featureType != null && { featureType }),
      },
      parentPath: epic.path,
    });

    return ok({
      result: { id: feature.id as FeatureId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: feature.id },
    });
  });
}

const QUICK_ADD_WSJF = 3 as FibonacciValue;

export interface CreateFeatureWithDependencyInput {
  parentId: EpicId;
  artId: ArtId;
  predecessorId: FeatureId;
  title: string;
  featureType?: FeatureType | null | undefined;
  edgeType?: "blocks" | "depends_on" | "relates_to" | undefined;
}

/**
 * Netzplan-Quick-Add (Roadmap-N3): legt ein neues Feature mit Default-WSJF
 * 3/3/3/3 an und verbindet es als Folge-Knoten an einen bestehenden
 * Predecessor — alles atomar in einer Transaktion. Default-Edge-Typ
 * `depends_on`.
 */
export async function createFeatureWithDependency(
  ctx: RequestContext,
  input: CreateFeatureWithDependencyInput,
): Promise<Result<{ id: FeatureId; dependencyId: string }>> {
  const mctx = toMutationContext(ctx);
  const { parentId, artId, predecessorId, title, featureType, edgeType = "depends_on" } = input;
  const wsjfComputed = computeWsjf({
    businessValue: QUICK_ADD_WSJF,
    timeCriticality: QUICK_ADD_WSJF,
    riskReduction: QUICK_ADD_WSJF,
    jobSize: QUICK_ADD_WSJF,
  });

  return withAuditedTransaction(mctx, async (tx) => {
    const parentResult = await findValidatedParent(tx, mctx, InitiativeLevel.FEATURE, parentId);
    if (isErr(parentResult)) return parentResult;
    const epic = parentResult.value!;

    const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
    if (!art) {
      return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
    }

    const predecessor = await tx.initiative.findFirst({
      where: {
        id: predecessorId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
    });
    if (!predecessor) {
      return err({
        kind: "not_found" as const,
        resourceType: "Initiative",
        id: predecessorId,
      });
    }

    const feature = await createInitiativeWithDerivedPath(tx, {
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        parentId,
        artId,
        title,
        status: "approved",
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        wsjfBusinessValue: QUICK_ADD_WSJF,
        wsjfTimeCriticality: QUICK_ADD_WSJF,
        wsjfRiskReduction: QUICK_ADD_WSJF,
        wsjfJobSize: QUICK_ADD_WSJF,
        wsjfComputed,
        acceptanceCriteria: [],
        ...(featureType != null && { featureType }),
      },
      parentPath: epic.path,
    });

    const dep = await tx.dependency.create({
      data: {
        tenantId: mctx.tenantId,
        fromId: predecessorId,
        toId: feature.id,
        type: edgeType,
        createdBy: mctx.actorId,
      },
    });

    await emitAuditEvent(tx, {
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      action: "initiative.dependency.linked",
      resourceType: "dependency",
      resourceId: dep.id,
      changes: {
        type: { before: null, after: edgeType },
        fromId: { before: null, after: predecessorId },
        toId: { before: null, after: feature.id },
      },
      ipAddress: mctx.ipAddress,
      userAgent: mctx.userAgent,
    });

    return ok({
      result: { id: feature.id as FeatureId, dependencyId: dep.id },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: feature.id },
    });
  });
}

export interface InsertFeatureBetweenInput {
  parentId: EpicId;
  artId: ArtId;
  fromId: FeatureId;
  toId: FeatureId;
  edgeType: "blocks" | "depends_on" | "relates_to";
  title: string;
  featureType?: FeatureType | null | undefined;
}

/**
 * Netzplan-Edge-Insertion (Roadmap-N3): legt ein neues Feature an und
 * spaltet den bestehenden Edge `from → to` in `from → new → to`. Atomar
 * in einer Transaktion. Der Edge-Typ bleibt erhalten.
 */
export async function insertFeatureBetween(
  ctx: RequestContext,
  input: InsertFeatureBetweenInput,
): Promise<Result<{ id: FeatureId; addedDependencyIds: [string, string] }>> {
  const mctx = toMutationContext(ctx);
  const { parentId, artId, fromId, toId, edgeType, title, featureType } = input;
  const wsjfComputed = computeWsjf({
    businessValue: QUICK_ADD_WSJF,
    timeCriticality: QUICK_ADD_WSJF,
    riskReduction: QUICK_ADD_WSJF,
    jobSize: QUICK_ADD_WSJF,
  });

  return withAuditedTransaction(mctx, async (tx) => {
    const parentResult = await findValidatedParent(tx, mctx, InitiativeLevel.FEATURE, parentId);
    if (isErr(parentResult)) return parentResult;
    const epic = parentResult.value!;

    const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
    if (!art) {
      return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
    }

    const existingEdge = await tx.dependency.findFirst({
      where: { tenantId: mctx.tenantId, fromId, toId, type: edgeType },
    });
    if (!existingEdge) {
      return err({
        kind: "not_found" as const,
        resourceType: "dependency",
        id: `${fromId}:${toId}:${edgeType}`,
      });
    }

    const feature = await createInitiativeWithDerivedPath(tx, {
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        parentId,
        artId,
        title,
        status: "approved",
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        wsjfBusinessValue: QUICK_ADD_WSJF,
        wsjfTimeCriticality: QUICK_ADD_WSJF,
        wsjfRiskReduction: QUICK_ADD_WSJF,
        wsjfJobSize: QUICK_ADD_WSJF,
        wsjfComputed,
        acceptanceCriteria: [],
        ...(featureType != null && { featureType }),
      },
      parentPath: epic.path,
    });

    await tx.dependency.delete({ where: { id: existingEdge.id } });
    const depA = await tx.dependency.create({
      data: {
        tenantId: mctx.tenantId,
        fromId,
        toId: feature.id,
        type: edgeType,
        createdBy: mctx.actorId,
      },
    });
    const depB = await tx.dependency.create({
      data: {
        tenantId: mctx.tenantId,
        fromId: feature.id,
        toId,
        type: edgeType,
        createdBy: mctx.actorId,
      },
    });

    await emitAuditEvent(tx, {
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      action: "initiative.dependency.unlinked",
      resourceType: "dependency",
      resourceId: existingEdge.id,
      changes: {
        type: { before: edgeType, after: null },
        fromId: { before: fromId, after: null },
        toId: { before: toId, after: null },
      },
      ipAddress: mctx.ipAddress,
      userAgent: mctx.userAgent,
    });
    await emitAuditEvent(tx, {
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      action: "initiative.dependency.linked",
      resourceType: "dependency",
      resourceId: depA.id,
      changes: {
        type: { before: null, after: edgeType },
        fromId: { before: null, after: fromId },
        toId: { before: null, after: feature.id },
      },
      ipAddress: mctx.ipAddress,
      userAgent: mctx.userAgent,
    });
    await emitAuditEvent(tx, {
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      action: "initiative.dependency.linked",
      resourceType: "dependency",
      resourceId: depB.id,
      changes: {
        type: { before: null, after: edgeType },
        fromId: { before: null, after: feature.id },
        toId: { before: null, after: toId },
      },
      ipAddress: mctx.ipAddress,
      userAgent: mctx.userAgent,
    });

    return ok({
      result: { id: feature.id as FeatureId, addedDependencyIds: [depA.id, depB.id] },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: feature.id },
    });
  });
}

export async function updateFeature(
  ctx: RequestContext,
  input: UpdateFeatureInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const {
    id,
    title,
    description,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    acceptanceCriteria,
    piId,
    featureType,
  } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Feature", id });
    }

    const newBv = wsjfBusinessValue ?? (existing.wsjfBusinessValue as FibonacciValue);
    const newTc = wsjfTimeCriticality ?? (existing.wsjfTimeCriticality as FibonacciValue);
    const newRr = wsjfRiskReduction ?? (existing.wsjfRiskReduction as FibonacciValue);
    const newJs = wsjfJobSize ?? (existing.wsjfJobSize as FibonacciValue);

    const wsjfChanged =
      wsjfBusinessValue !== undefined ||
      wsjfTimeCriticality !== undefined ||
      wsjfRiskReduction !== undefined ||
      wsjfJobSize !== undefined;

    const newComputed = wsjfChanged
      ? computeWsjf({
          businessValue: newBv,
          timeCriticality: newTc,
          riskReduction: newRr,
          jobSize: newJs,
        })
      : undefined;

    // Scalar fields diff via the shared changelog helper; WSJF is a compound
    // field, so its before/after is built explicitly. Description / WSJF
    // components / acceptance / piId are written but not audited as scalars —
    // either irrelevant noise or rolled into the "wsjf" composite below.
    const { changes, data } = recordedUpdate({
      existing,
      updates: { title, featureType },
      fields: ["title", "featureType"] as const,
    });
    if (wsjfChanged) {
      changes["wsjf"] = {
        before: {
          bv: existing.wsjfBusinessValue,
          tc: existing.wsjfTimeCriticality,
          rr: existing.wsjfRiskReduction,
          js: existing.wsjfJobSize,
        },
        after: { bv: newBv, tc: newTc, rr: newRr, js: newJs },
      };
    }

    await tx.initiative.update({
      where: { id },
      data: {
        ...data,
        updatedBy: mctx.actorId,
        ...(description !== undefined && { description }),
        ...(wsjfBusinessValue !== undefined && { wsjfBusinessValue }),
        ...(wsjfTimeCriticality !== undefined && { wsjfTimeCriticality }),
        ...(wsjfRiskReduction !== undefined && { wsjfRiskReduction }),
        ...(wsjfJobSize !== undefined && { wsjfJobSize }),
        ...(newComputed !== undefined && { wsjfComputed: newComputed }),
        ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
        ...(piId !== undefined && { piId }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

export interface SetFeaturePiInput {
  featureId: FeatureId;
  /** Target PI, or null to move the feature back to the backlog. */
  piId: PiId | null;
}

/**
 * Assign a feature to a PI (or back to the backlog). Enforces the same-ART rule
 * (hard) and checks softer constraints — notably the parent Epic's planned
 * delivery window ("Soll-Fenster") — returning advisory `warnings` instead of
 * rejecting. The platform stays deliberately permissive at this seam; the UI
 * surfaces the warnings as toasts so the planner sees but isn't blocked by them.
 */
export async function setFeaturePi(
  ctx: RequestContext,
  input: SetFeaturePiInput,
): Promise<Result<MutationWarnings>> {
  const mctx = toMutationContext(ctx);
  const { featureId, piId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const feature = await tx.initiative.findFirst({
      where: {
        id: featureId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
      include: { art: { select: { timelineId: true } } },
    });
    if (!feature) {
      return err({ kind: "not_found" as const, resourceType: "Feature", id: featureId });
    }

    const warnings: string[] = [];

    if (piId !== null) {
      const pi = await tx.programIncrement.findFirst({
        where: { id: piId, tenantId: mctx.tenantId },
      });
      if (!pi) {
        return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id: piId });
      }
      // Hard invariant: Feature's ART must subscribe to the same Timeline as
      // the PI's Timeline. Replaces the old per-ART check now that PIs are
      // shared across ARTs of a Timeline.
      if (!feature.art?.timelineId || feature.art.timelineId !== pi.timelineId) {
        return err({
          kind: "conflict" as const,
          reason: "Feature gehört zu einer ART, die diese Timeline nicht abonniert hat",
        });
      }

      // Soft check: does the PI window overlap the parent Epic's planned window?
      // Only when both endpoints of the Soll-Fenster are set on the Epic.
      if (feature.parentId) {
        const epic = await tx.initiative.findFirst({
          where: { id: feature.parentId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC },
          select: { plannedStartAt: true, plannedEndAt: true, title: true },
        });
        if (
          epic &&
          !rangeOverlapsPlannedWindow(
            { plannedStartAt: epic.plannedStartAt, plannedEndAt: epic.plannedEndAt },
            { start: pi.startDate, end: pi.endDate },
          )
        ) {
          warnings.push(
            `Ziel-PI liegt außerhalb des geplanten Umsetzungsfensters des Epics „${epic.title}".`,
          );
        }
      }

      // Soft check: would the target PI start before all upstream blockers end?
      // One-hop dependencies only — same shape `getBlockerWindowsForFeatures`
      // uses for the planning board. Unscheduled blockers contribute uncertainty,
      // not a date; they're surfaced separately so the planner can react.
      const blockerEdges = await tx.dependency.findMany({
        where: {
          tenantId: mctx.tenantId,
          OR: [
            { type: "blocks", toId: featureId },
            { type: "depends_on", fromId: featureId },
          ],
        },
        include: {
          from: { select: { id: true, title: true, pi: { select: { endDate: true } } } },
          to: { select: { id: true, title: true, pi: { select: { endDate: true } } } },
        },
      });
      const blockerWindows: BlockerWindow[] = blockerEdges.map((e) => {
        const isBlocks = e.type === "blocks";
        const blocker = isBlocks ? e.from : e.to;
        return {
          blockerId: blocker.id,
          blockerTitle: blocker.title,
          blockerEndDate: blocker.pi?.endDate ?? null,
        };
      });
      const { earliest, unscheduledBlockers } = earliestStartFromBlockers(blockerWindows);
      if (earliest && pi.startDate < earliest) {
        const blockerNote =
          unscheduledBlockers.length > 0
            ? ` (${unscheduledBlockers.length} weitere noch unscheduled)`
            : "";
        warnings.push(
          `Ziel-PI startet vor dem frühestmöglichen Termin laut Blockern (frühestens ${earliest.toISOString().slice(0, 10)})${blockerNote}.`,
        );
      } else if (!earliest && unscheduledBlockers.length > 0) {
        warnings.push(
          `Frühestmöglicher Start ist noch unbestimmt — Blocker sind ungeplant: ${unscheduledBlockers.slice(0, 3).join(", ")}.`,
        );
      }
    }

    await tx.initiative.update({
      where: { id: featureId },
      data: { piId, updatedBy: mctx.actorId },
    });

    return ok({
      result: { warnings },
      audit: {
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: featureId,
        changes: { piId: { before: feature.piId, after: piId } },
      },
    });
  });
}

export interface ScoreFeatureInput {
  id: FeatureId;
  wsjfBusinessValue: FibonacciValue;
  wsjfTimeCriticality: FibonacciValue;
  wsjfRiskReduction: FibonacciValue;
  wsjfJobSize: FibonacciValue;
}

export async function scoreFeature(
  ctx: RequestContext,
  input: ScoreFeatureInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, wsjfBusinessValue, wsjfTimeCriticality, wsjfRiskReduction, wsjfJobSize } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Feature", id });

    const wsjfComputed = computeWsjf({
      businessValue: wsjfBusinessValue,
      timeCriticality: wsjfTimeCriticality,
      riskReduction: wsjfRiskReduction,
      jobSize: wsjfJobSize,
    });

    await tx.initiative.update({
      where: { id },
      data: {
        wsjfBusinessValue,
        wsjfTimeCriticality,
        wsjfRiskReduction,
        wsjfJobSize,
        wsjfComputed,
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "wsjf.scored",
        resourceType: "initiative",
        resourceId: id,
        changes: { wsjfComputed: { before: existing.wsjfComputed, after: wsjfComputed } },
      },
    });
  });
}

export async function listFeatures(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const where = { tenantId, artId, level: InitiativeLevel.FEATURE, deletedAt: null };
  const include = {
    parent: { select: { id: true, title: true } },
    pi: { select: { id: true, name: true } },
  };
  const orderBy = [{ wsjfComputed: "desc" as const }, { createdAt: "asc" as const }];

  return paginate(
    ({ take, skip }) => db.initiative.findMany({ where, include, orderBy, take, skip }),
    () => db.initiative.count({ where }),
    pageParams,
  );
}

export async function getFeature(db: PrismaClient, tenantId: TenantId, id: FeatureId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    include: {
      // The parent Epic's stageGate gates the "Umsetzung starten"-Aktion in the
      // delivery controls — surfaced here so the page can pre-disable cleanly.
      parent: { select: { id: true, title: true, stageGate: true } },
      art: { select: { id: true, name: true } },
      pi: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Delivery lifecycle — `approved → in_progress ↔ blocked → completed | cancelled`.
// Picks up where the QS gate leaves off; the matrix lives in `initiative-status`.
// ---------------------------------------------------------------------------

export type FeatureDeliveryStatus =
  | "approved"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface SetFeatureDeliveryStatusInput {
  id: FeatureId;
  to: FeatureDeliveryStatus;
  /** Optional context — required by the action layer for pause/cancel transitions. */
  reason?: string | undefined;
}

/**
 * Transitions a Feature's delivery status. Validates the transition against the
 * delivery matrix and, when starting (`→ in_progress`), the operational
 * preconditions that make starting meaningful: the Feature must be assigned to
 * a PI and the parent Epic must be in implementation (`L4`) or done (`L5`).
 *
 * The `reason` field is persisted on the audit `changes` map — no schema
 * change for v1, same idiom as the "Meine Freigaben" comments.
 */
export async function setFeatureDeliveryStatus(
  ctx: RequestContext,
  input: SetFeatureDeliveryStatusInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, to, reason } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const feature = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
      select: { id: true, status: true, piId: true, parentId: true },
    });
    if (!feature) {
      return err({ kind: "not_found" as const, resourceType: "Feature", id });
    }

    if (!canDeliveryTransition(feature.status, to)) {
      return err({
        kind: "conflict" as const,
        reason: `Übergang von "${feature.status}" nach "${to}" ist im Delivery-Lebenszyklus nicht erlaubt`,
      });
    }

    // Starting preconditions: PI assigned + parent Epic mindestens in „Budget
    // alloziert" (L3). Reifegrad-Modell v2 (Plan vom 2026-06-07): Start eines
    // Features schiebt das Epic von L3 auf L4 (Implementation läuft). So
    // entfällt der manuelle „Implementing"-Klick durch den RTE und L3→L4 ist
    // der natürliche Übergang.
    let advanceParentToL4 = false;
    if (to === "in_progress") {
      if (feature.piId === null) {
        return err({
          kind: "conflict" as const,
          reason: "Feature ist keinem PI zugewiesen — bitte erst einplanen",
        });
      }
      if (feature.parentId) {
        const epic = await tx.initiative.findFirst({
          where: { id: feature.parentId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC },
          select: { stageGate: true },
        });
        const gate = epic?.stageGate;
        if (!epic || (gate !== "L3" && gate !== "L4" && gate !== "L5")) {
          return err({
            kind: "conflict" as const,
            reason:
              "Epic noch nicht in Implementation (mind. L3 Budget alloziert nötig) — Feature kann noch nicht gestartet werden",
          });
        }
        if (gate === "L3") {
          advanceParentToL4 = true;
        }
      }
    }

    // Ist-Lieferdatum stempeln: Übergang nach "completed" setzt completedAt;
    // Rücknahme (weg von completed) leert es wieder. Basis für Plantreue/
    // Terminabweichung im LPM-Portfolio-Review.
    const completedAtPatch: { completedAt?: Date | null } =
      to === "completed"
        ? { completedAt: new Date() }
        : feature.status === "completed"
          ? { completedAt: null }
          : {};

    await tx.initiative.update({
      where: { id },
      data: { status: to, updatedBy: mctx.actorId, ...completedAtPatch },
    });

    if (advanceParentToL4 && feature.parentId) {
      // Importiert lazy aus epic.ts, sonst gäbe es einen Zirkel beim
      // top-level `import` (feature.ts ↔ epic.ts).
      const { autoAdvanceStageGate } = await import("@/modules/work/server/services/epic");
      await autoAdvanceStageGate(tx, mctx, feature.parentId, "L4");
    }

    return ok({
      result: undefined,
      audit: {
        action: "feature.delivery.transitioned",
        resourceType: "initiative",
        resourceId: id,
        changes: {
          status: { before: feature.status, after: to },
          ...(reason ? { reason: { before: null, after: reason } } : {}),
        },
      },
    });
  });
}

/** Convenience wrapper for the most common transition (Bereit → Umsetzung). */
export async function startFeature(
  ctx: RequestContext,
  input: { id: FeatureId },
): Promise<Result<void>> {
  return setFeatureDeliveryStatus(ctx, { id: input.id, to: "in_progress" });
}

// ---------------------------------------------------------------------------
// Delete Feature (soft)
// ---------------------------------------------------------------------------

export async function softDeleteFeature(
  ctx: RequestContext,
  input: { id: FeatureId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Feature", id });

    await tx.initiative.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.deleted", resourceType: "initiative", resourceId: id },
    });
  });
}
