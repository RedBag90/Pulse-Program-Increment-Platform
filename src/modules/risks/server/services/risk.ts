import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { ok, err, isErr, type Result } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { Principal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { paginate, type PageParams } from "@/server/db/paginate";
import { isRiskLevel } from "@/modules/risks/domain/risk-matrix";
import { isRiskCategory } from "@/modules/risks/domain/risk-category";
import { canReview, reviewTarget, type ReviewDecision } from "@/modules/risks/domain/risk-review";
import { riskReadFilter } from "@/modules/risks/server/services/risk-read-scope";

export type RiskId = string & { readonly __brand: "RiskId" };

export interface CreateRiskInput {
  title: string;
  description?: string | undefined;
  probability?: string | undefined;
  impact?: string | undefined;
  category?: string | undefined;
  targetResolutionDate?: string | Date | null | undefined;
  ownerId?: string | null | undefined;
  epicIds?: string[] | undefined;
}

// ── validation + small helpers ────────────────────────────────────────────────

function validateScoring(
  probability: string | undefined,
  impact: string | undefined,
): Result<{ probability: string | null; impact: string | null }> {
  const hasP = probability != null && probability !== "";
  const hasI = impact != null && impact !== "";
  if (!hasP && !hasI) return ok({ probability: null, impact: null });
  if (!hasP || !hasI) {
    return err({
      kind: "validation" as const,
      issues: ["Probability und Impact zusammen setzen."],
    });
  }
  if (!isRiskLevel(probability) || !isRiskLevel(impact)) {
    return err({ kind: "validation" as const, issues: ["Ungültiges Probability/Impact-Level."] });
  }
  return ok({ probability, impact });
}

function validateCategory(category: string | undefined): Result<string | null> {
  if (category == null || category === "") return ok(null);
  return isRiskCategory(category)
    ? ok(category)
    : err({ kind: "validation" as const, issues: ["Ungültige Risiko-Kategorie."] });
}

/** Scope gate for document/review: allow if authorized for ANY linked Epic's VS
 *  (or the tenant when the risk is unlinked). */
function assertRiskScope(
  principal: Principal,
  action: Action,
  vsIds: readonly (string | null)[],
): Result<void> {
  const clean = vsIds.filter((v): v is string => !!v);
  const allowed =
    clean.length === 0
      ? authorize(action, { tenantId: principal.tenantId }, principal).allow
      : clean.some(
          (vs) =>
            authorize(action, { tenantId: principal.tenantId, valueStreamId: vs }, principal).allow,
        );
  return allowed
    ? ok(undefined)
    : err({
        kind: "forbidden" as const,
        reason: "Kein Zugriff auf ein verknüpftes Epic dieses Risikos.",
      });
}

/** Next per-tenant number under an advisory lock (gapless, concurrency-safe). */
async function nextRiskNumber(tx: Prisma.TransactionClient, tenantId: TenantId): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId})::int8)`;
  const s = await tx.riskSettings.upsert({
    where: { tenantId },
    create: { tenantId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return s.lastNumber;
}

/** Validate that every epicId is a live Epic in the tenant; return their VSs. */
async function resolveEpicVs(
  tx: Prisma.TransactionClient,
  tenantId: TenantId,
  epicIds: readonly string[],
): Promise<Result<{ id: string; valueStreamId: string | null }[]>> {
  if (epicIds.length === 0) return ok([]);
  const epics = await tx.initiative.findMany({
    where: { id: { in: [...epicIds] }, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    select: { id: true, valueStreamId: true },
  });
  if (epics.length !== new Set(epicIds).size) {
    return err({ kind: "not_found" as const, resourceType: "Initiative", id: epicIds.join(",") });
  }
  return ok(epics);
}

function dateOrNull(d: string | Date | null | undefined): Date | null {
  if (d == null || d === "") return null;
  return d instanceof Date ? d : new Date(d);
}

// ── create: suggest / document ────────────────────────────────────────────────

async function createRisk(
  ctx: RequestContext,
  input: CreateRiskInput,
  mode: "suggested" | "documented",
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const scoring = validateScoring(input.probability, input.impact);
  if (isErr(scoring)) return scoring;
  const category = validateCategory(input.category);
  if (isErr(category)) return category;

  return withAuditedTransaction(mctx, async (tx) => {
    const epicIds = input.epicIds ?? [];
    const epics = await resolveEpicVs(tx, mctx.tenantId, epicIds);
    if (isErr(epics)) return epics;

    if (mode === "documented") {
      const scoped = assertRiskScope(
        ctx.principal,
        "risk.document",
        epics.value.map((e) => e.valueStreamId),
      );
      if (isErr(scoped)) return scoped;
    }

    const riskNumber = mode === "documented" ? await nextRiskNumber(tx, mctx.tenantId) : null;

    const risk = await tx.risk.create({
      data: {
        tenantId: mctx.tenantId,
        title: input.title,
        reviewStatus: mode,
        raisedBy: mctx.actorId,
        probability: scoring.value.probability,
        impact: scoring.value.impact,
        category: category.value,
        ...(riskNumber != null && { riskNumber }),
        ...(input.description != null && { description: input.description }),
        ...(input.ownerId != null && { ownerId: input.ownerId }),
        ...(dateOrNull(input.targetResolutionDate) && {
          targetResolutionDate: dateOrNull(input.targetResolutionDate),
        }),
        ...(mode === "documented" && { reviewedBy: mctx.actorId, reviewedAt: new Date() }),
        epicLinks: {
          create: epicIds.map((epicId) => ({
            tenantId: mctx.tenantId,
            epicId,
            createdBy: mctx.actorId,
          })),
        },
      },
      select: { id: true },
    });

    return ok({
      result: { id: risk.id },
      audit: {
        action: mode === "documented" ? ("risk.documented" as const) : ("risk.suggested" as const),
        resourceType: "risk" as const,
        resourceId: risk.id,
      },
    });
  });
}

export function suggestRisk(ctx: RequestContext, input: CreateRiskInput) {
  return createRisk(ctx, input, "suggested");
}
export function documentRisk(ctx: RequestContext, input: CreateRiskInput) {
  return createRisk(ctx, input, "documented");
}

// ── review a suggestion ───────────────────────────────────────────────────────

export async function reviewRisk(
  ctx: RequestContext,
  input: { id: string; decision: ReviewDecision },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: {
        id: true,
        reviewStatus: true,
        epicLinks: { select: { epic: { select: { valueStreamId: true } } } },
      },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    if (!canReview(risk.reviewStatus as "suggested" | "documented" | "rejected")) {
      return err({ kind: "conflict" as const, reason: "Nur Vorschläge können reviewt werden." });
    }
    const scoped = assertRiskScope(
      ctx.principal,
      "risk.review",
      risk.epicLinks.map((l) => l.epic.valueStreamId),
    );
    if (isErr(scoped)) return scoped;

    const target = reviewTarget(input.decision);
    const riskNumber = target === "documented" ? await nextRiskNumber(tx, mctx.tenantId) : null;
    await tx.risk.update({
      where: { id: input.id },
      data: {
        reviewStatus: target,
        reviewedBy: mctx.actorId,
        reviewedAt: new Date(),
        ...(riskNumber != null && { riskNumber }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "risk.reviewed" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { reviewStatus: { before: risk.reviewStatus, after: target } },
      },
    });
  });
}

// ── edit / owner / roam / mitigation / reassess / delete ──────────────────────

export interface UpdateRiskInput {
  id: string;
  title?: string | undefined;
  description?: string | null | undefined;
  probability?: string | undefined;
  impact?: string | undefined;
  category?: string | undefined;
  targetResolutionDate?: string | Date | null | undefined;
  ownerId?: string | null | undefined;
}

export async function updateRisk(
  ctx: RequestContext,
  input: UpdateRiskInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const scoring = validateScoring(input.probability, input.impact);
  const category = validateCategory(input.category);
  if (isErr(scoring)) return scoring;
  if (isErr(category)) return category;
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    const data: Prisma.RiskUpdateInput = {};
    if (input.title != null) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.probability !== undefined || input.impact !== undefined) {
      data.probability = scoring.value.probability;
      data.impact = scoring.value.impact;
    }
    if (input.category !== undefined) data.category = category.value;
    if (input.targetResolutionDate !== undefined) {
      data.targetResolutionDate = dateOrNull(input.targetResolutionDate);
    }
    if (input.ownerId !== undefined) data.ownerId = input.ownerId;
    await tx.risk.update({ where: { id: input.id }, data });
    return ok({
      result: undefined,
      audit: {
        action: "risk.updated" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
      },
    });
  });
}

export async function assignRiskOwner(
  ctx: RequestContext,
  input: { id: string; ownerId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    await tx.risk.update({ where: { id: input.id }, data: { ownerId: input.ownerId } });
    return ok({
      result: undefined,
      audit: {
        action: "risk.owner.assigned" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { ownerId: { before: risk.ownerId, after: input.ownerId } },
      },
    });
  });
}

export async function setRiskRoam(
  ctx: RequestContext,
  input: { id: string; roamStatus: string; roamRationale?: string | null | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { roamStatus: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    await tx.risk.update({
      where: { id: input.id },
      data: {
        roamStatus: input.roamStatus,
        ...(input.roamRationale !== undefined && { roamRationale: input.roamRationale }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "risk.roamed" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { roamStatus: { before: risk.roamStatus, after: input.roamStatus } },
      },
    });
  });
}

export async function addRiskMitigation(
  ctx: RequestContext,
  input: { riskId: string; description: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.riskId, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.riskId });
    const row = await tx.riskMitigation.create({
      data: {
        tenantId: mctx.tenantId,
        riskId: input.riskId,
        description: input.description,
        createdBy: mctx.actorId,
      },
      select: { id: true },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "risk.mitigation.added" as const,
        resourceType: "risk_mitigation" as const,
        resourceId: row.id,
      },
    });
  });
}

export async function removeRiskMitigation(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const { count } = await tx.riskMitigation.deleteMany({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (count === 0) {
      return err({ kind: "not_found" as const, resourceType: "RiskMitigation", id: input.id });
    }
    return ok({
      result: undefined,
      audit: {
        action: "risk.mitigation.removed" as const,
        resourceType: "risk_mitigation" as const,
        resourceId: input.id,
      },
    });
  });
}

export async function reassessRisk(
  ctx: RequestContext,
  input: { id: string; probability: string; impact: string; note?: string | undefined },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  if (!isRiskLevel(input.probability) || !isRiskLevel(input.impact)) {
    return err({ kind: "validation" as const, issues: ["Ungültiges Probability/Impact-Level."] });
  }
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    const row = await tx.riskAssessment.create({
      data: {
        tenantId: mctx.tenantId,
        riskId: input.id,
        probability: input.probability,
        impact: input.impact,
        createdBy: mctx.actorId,
        ...(input.note != null && { note: input.note }),
      },
      select: { id: true },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "risk.reassessed" as const,
        resourceType: "risk_assessment" as const,
        resourceId: row.id,
      },
    });
  });
}

export async function deleteRisk(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const risk = await tx.risk.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.id });
    await tx.risk.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
    return ok({
      result: undefined,
      audit: {
        action: "risk.deleted" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
      },
    });
  });
}

// ── read ──────────────────────────────────────────────────────────────────────

/** Shared include for the list/detail page-model (trail + mitigation text + epic titles). */
export const RISK_LIST_INCLUDE = {
  assessments: { orderBy: { createdAt: "asc" } },
  epicLinks: { select: { epicId: true, epic: { select: { id: true, title: true } } } },
  mitigations: { select: { id: true, description: true, createdAt: true } },
} satisfies Prisma.RiskInclude;

/** The risk row shape the page-model consumes (with its assessment trail + links). */
export async function listRisks(
  db: PrismaClient,
  principal: Principal,
  pageParams: PageParams = { page: 1, pageSize: 500 },
) {
  const where: Prisma.RiskWhereInput = {
    tenantId: principal.tenantId,
    deletedAt: null,
    AND: [riskReadFilter(principal)],
  };
  return paginate(
    ({ take, skip }) =>
      db.risk.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        include: RISK_LIST_INCLUDE,
      }),
    () => db.risk.count({ where }),
    pageParams,
  );
}
