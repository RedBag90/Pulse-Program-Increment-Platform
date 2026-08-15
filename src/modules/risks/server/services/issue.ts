import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId } from "@/modules/core/kernel/domain/types";
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
import { wouldCreateCycle } from "@/modules/risks/domain/issue-tree";

/**
 * Unified Issue service — the merged Risk+Impediment write/read layer against
 * `db.issue`. `kind` ("risk"|"impediment") carries both assessment axes.
 * Phase 2 (additive): reuses the existing `risk.*` / `impediment.*` RBAC + audit
 * vocabulary so no registry churn is needed until the UI cutover.
 */

export type IssueId = string & { readonly __brand: "IssueId" };

// ── validation helpers ────────────────────────────────────────────────────────

function validateScoring(
  probability: string | undefined,
  impact: string | undefined,
): Result<{ probability: string | null; impact: string | null }> {
  const hasP = probability != null && probability !== "";
  const hasI = impact != null && impact !== "";
  if (!hasP && !hasI) return ok({ probability: null, impact: null });
  if (!hasP || !hasI) {
    return err({ kind: "validation" as const, issues: ["Probability und Impact zusammen setzen."] });
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

function dateOrNull(d: string | Date | null | undefined): Date | null {
  if (d == null || d === "") return null;
  return d instanceof Date ? d : new Date(d);
}

/** Scope gate for document/review: allow if authorized for the linked work item's
 *  VS (or the tenant when unlinked). */
function assertIssueScope(
  principal: Principal,
  action: Action,
  vsId: string | null,
): Result<void> {
  const allowed = vsId
    ? authorize(action, { tenantId: principal.tenantId, valueStreamId: vsId }, principal).allow
    : authorize(action, { tenantId: principal.tenantId }, principal).allow;
  return allowed
    ? ok(undefined)
    : err({ kind: "forbidden" as const, reason: "Kein Zugriff auf den Wertstrom dieses Issues." });
}

/** Next per-tenant number under an advisory lock (gapless, concurrency-safe). */
async function nextIssueNumber(tx: Prisma.TransactionClient, tenantId: TenantId): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId})::int8)`;
  const s = await tx.issueSettings.upsert({
    where: { tenantId },
    create: { tenantId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return s.lastNumber;
}

/** Resolve the value-stream of a work item (Feature → via parent Epic). */
async function resolveInitiativeVs(
  tx: Prisma.TransactionClient,
  tenantId: TenantId,
  initiativeId: string | null | undefined,
): Promise<Result<string | null>> {
  if (!initiativeId) return ok(null);
  const init = await tx.initiative.findFirst({
    where: { id: initiativeId, tenantId, deletedAt: null },
    select: { id: true, valueStreamId: true, parent: { select: { valueStreamId: true } } },
  });
  if (!init) return err({ kind: "not_found" as const, resourceType: "Initiative", id: initiativeId });
  return ok(init.valueStreamId ?? init.parent?.valueStreamId ?? null);
}

// ── read scope ────────────────────────────────────────────────────────────────

/**
 * Read-visibility for issues: managers (portfolio_manager/tenant_admin/
 * platform_admin) and empty-scope principals see all; others see issues on a
 * work item (or its parent Epic) in their VS scope, plus ones they own/raised.
 */
export function issueReadFilter(principal: Principal): Prisma.IssueWhereInput {
  const vs = principal.scopes.valueStreamIds;
  const managerLike =
    principal.isPlatformAdmin ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("portfolio_manager") ||
    vs.length === 0;
  if (managerLike) return {};
  return {
    OR: [
      { initiative: { valueStreamId: { in: vs } } },
      { initiative: { parent: { valueStreamId: { in: vs } } } },
      { ownerId: principal.id },
      { raisedBy: principal.id },
    ],
  };
}

// ── create: risk (suggest/document) ───────────────────────────────────────────

export interface CreateRiskIssueInput {
  title: string;
  description?: string | undefined;
  probability?: string | undefined;
  impact?: string | undefined;
  category?: string | undefined;
  targetResolutionDate?: string | Date | null | undefined;
  ownerId?: string | null | undefined;
  initiativeId?: string | null | undefined;
}

async function createRiskIssue(
  ctx: RequestContext,
  input: CreateRiskIssueInput,
  mode: "suggested" | "documented",
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const scoring = validateScoring(input.probability, input.impact);
  if (isErr(scoring)) return scoring;
  const category = validateCategory(input.category);
  if (isErr(category)) return category;

  return withAuditedTransaction(mctx, async (tx) => {
    const vs = await resolveInitiativeVs(tx, mctx.tenantId, input.initiativeId);
    if (isErr(vs)) return vs;

    if (mode === "documented") {
      const scoped = assertIssueScope(ctx.principal, "risk.document", vs.value);
      if (isErr(scoped)) return scoped;
    }

    const issueNumber = mode === "documented" ? await nextIssueNumber(tx, mctx.tenantId) : null;

    const issue = await tx.issue.create({
      data: {
        tenantId: mctx.tenantId,
        title: input.title,
        reviewStatus: mode,
        raisedBy: mctx.actorId,
        probability: scoring.value.probability,
        impact: scoring.value.impact,
        category: category.value,
        ...(issueNumber != null && { issueNumber }),
        ...(input.description != null && { description: input.description }),
        ...(input.ownerId != null && { ownerId: input.ownerId }),
        ...(input.initiativeId != null && { initiativeId: input.initiativeId }),
        ...(dateOrNull(input.targetResolutionDate) && {
          targetResolutionDate: dateOrNull(input.targetResolutionDate),
        }),
        ...(mode === "documented" && { reviewedBy: mctx.actorId, reviewedAt: new Date() }),
      },
      select: { id: true },
    });

    return ok({
      result: { id: issue.id },
      audit: {
        action: mode === "documented" ? ("risk.documented" as const) : ("risk.suggested" as const),
        resourceType: "risk" as const,
        resourceId: issue.id,
      },
    });
  });
}

export function suggestIssue(ctx: RequestContext, input: CreateRiskIssueInput) {
  return createRiskIssue(ctx, input, "suggested");
}
export function documentIssue(ctx: RequestContext, input: CreateRiskIssueInput) {
  return createRiskIssue(ctx, input, "documented");
}

// ── review (risk suggestions) ──────────────────────────────────────────────────

export async function reviewIssue(
  ctx: RequestContext,
  input: { id: string; decision: ReviewDecision },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true, reviewStatus: true, initiativeId: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    if (!canReview(issue.reviewStatus as "suggested" | "documented" | "rejected")) {
      return err({ kind: "conflict" as const, reason: "Nur Vorschläge können reviewt werden." });
    }
    const vs = await resolveInitiativeVs(tx, mctx.tenantId, issue.initiativeId);
    if (isErr(vs)) return vs;
    const scoped = assertIssueScope(ctx.principal, "risk.review", vs.value);
    if (isErr(scoped)) return scoped;

    const target = reviewTarget(input.decision);
    const issueNumber = target === "documented" ? await nextIssueNumber(tx, mctx.tenantId) : null;
    await tx.issue.update({
      where: { id: input.id },
      data: {
        reviewStatus: target,
        reviewedBy: mctx.actorId,
        reviewedAt: new Date(),
        ...(issueNumber != null && { issueNumber }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "risk.reviewed" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { reviewStatus: { before: issue.reviewStatus, after: target } },
      },
    });
  });
}

// ── edit / owner / roam / mitigation / reassess / delivery / link / delete ─────

export interface UpdateIssueInput {
  id: string;
  title?: string | undefined;
  description?: string | null | undefined;
  probability?: string | undefined;
  impact?: string | undefined;
  category?: string | undefined;
  targetResolutionDate?: string | Date | null | undefined;
  ownerId?: string | null | undefined;
}

export async function updateIssue(ctx: RequestContext, input: UpdateIssueInput): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const scoring = validateScoring(input.probability, input.impact);
  const category = validateCategory(input.category);
  if (isErr(scoring)) return scoring;
  if (isErr(category)) return category;
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    const data: Prisma.IssueUpdateInput = {};
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
    await tx.issue.update({ where: { id: input.id }, data });
    return ok({
      result: undefined,
      audit: { action: "risk.updated" as const, resourceType: "risk" as const, resourceId: input.id },
    });
  });
}

export async function assignIssueOwner(
  ctx: RequestContext,
  input: { id: string; ownerId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    await tx.issue.update({ where: { id: input.id }, data: { ownerId: input.ownerId } });
    return ok({
      result: undefined,
      audit: {
        action: "risk.owner.assigned" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { ownerId: { before: issue.ownerId, after: input.ownerId } },
      },
    });
  });
}

export async function setIssueRoam(
  ctx: RequestContext,
  input: { id: string; roamStatus: string; roamRationale?: string | null | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { roamStatus: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    await tx.issue.update({
      where: { id: input.id },
      data: {
        roamStatus: input.roamStatus,
        roamedAt: new Date(),
        roamedBy: mctx.actorId,
        ...(input.roamRationale !== undefined && { roamRationale: input.roamRationale }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "risk.roamed" as const,
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { roamStatus: { before: issue.roamStatus, after: input.roamStatus } },
      },
    });
  });
}

export async function addIssueMitigation(
  ctx: RequestContext,
  input: { issueId: string; description: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.issueId, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.issueId });
    const row = await tx.issueMitigation.create({
      data: {
        tenantId: mctx.tenantId,
        issueId: input.issueId,
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

export async function removeIssueMitigation(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const { count } = await tx.issueMitigation.deleteMany({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (count === 0) {
      return err({ kind: "not_found" as const, resourceType: "IssueMitigation", id: input.id });
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

export async function reassessIssue(
  ctx: RequestContext,
  input: { id: string; probability: string; impact: string; note?: string | undefined },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  if (!isRiskLevel(input.probability) || !isRiskLevel(input.impact)) {
    return err({ kind: "validation" as const, issues: ["Ungültiges Probability/Impact-Level."] });
  }
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    const row = await tx.issueAssessment.create({
      data: {
        tenantId: mctx.tenantId,
        issueId: input.id,
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

/**
 * Re-parent an issue under a head-issue (or to top-level, newParentId=null).
 * Bundling under a head = drag A onto B. Rejects cycles (a node under its own
 * descendant) server-side; children of the moved node follow automatically.
 */
export async function reparentIssue(
  ctx: RequestContext,
  input: { id: string; newParentId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  if (input.newParentId === input.id) {
    return err({ kind: "validation" as const, issues: ["Ein Issue kann nicht sein eigenes Head sein."] });
  }
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });

    if (input.newParentId) {
      const target = await tx.issue.findFirst({
        where: { id: input.newParentId, tenantId: mctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!target) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.newParentId });
      // Cycle guard: can't nest a node under itself or one of its descendants.
      const all = await tx.issue.findMany({
        where: { tenantId: mctx.tenantId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      const parentOf = new Map(all.map((r) => [r.id, r.parentId]));
      if (wouldCreateCycle(input.id, input.newParentId, parentOf)) {
        return err({ kind: "validation" as const, issues: ["Verschachtelung würde einen Zyklus bilden."] });
      }
    }

    await tx.issue.update({ where: { id: input.id }, data: { parentId: input.newParentId } });
    return ok({
      result: undefined,
      audit: {
        action: "issue.reparented" as const,
        resourceType: "issue" as const,
        resourceId: input.id,
        changes: { parentId: { before: issue.parentId, after: input.newParentId } },
      },
    });
  });
}

/** Link the issue to a work item (Feature/Epic), or clear it (initiativeId=null). */
export async function linkIssueToInitiative(
  ctx: RequestContext,
  input: { id: string; initiativeId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { initiativeId: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    if (input.initiativeId) {
      const init = await tx.initiative.findFirst({
        where: { id: input.initiativeId, tenantId: mctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!init) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: input.initiativeId });
      }
    }
    await tx.issue.update({ where: { id: input.id }, data: { initiativeId: input.initiativeId } });
    return ok({
      result: undefined,
      audit: {
        action: input.initiativeId ? ("risk.epic.linked" as const) : ("risk.epic.unlinked" as const),
        resourceType: "risk" as const,
        resourceId: input.id,
        changes: { initiativeId: { before: issue.initiativeId, after: input.initiativeId } },
      },
    });
  });
}

export async function deleteIssue(ctx: RequestContext, input: { id: string }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const issue = await tx.issue.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!issue) return err({ kind: "not_found" as const, resourceType: "Issue", id: input.id });
    // Children rise to the deleted node's parent so they don't vanish.
    await tx.issue.updateMany({
      where: { parentId: input.id, tenantId: mctx.tenantId },
      data: { parentId: issue.parentId },
    });
    await tx.issue.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
    return ok({
      result: undefined,
      audit: { action: "risk.deleted" as const, resourceType: "risk" as const, resourceId: input.id },
    });
  });
}

// ── read ──────────────────────────────────────────────────────────────────────

/** Shared include for the list/detail page-model (trail + mitigations + work item). */
export const ISSUE_LIST_INCLUDE = {
  assessments: { orderBy: { createdAt: "asc" } },
  mitigations: { select: { id: true, description: true, createdAt: true } },
  initiative: { select: { id: true, title: true, level: true, parentId: true } },
} satisfies Prisma.IssueInclude;

export async function listIssues(
  db: PrismaClient,
  principal: Principal,
  pageParams: PageParams = { page: 1, pageSize: 500 },
) {
  const where: Prisma.IssueWhereInput = {
    tenantId: principal.tenantId,
    deletedAt: null,
    AND: [issueReadFilter(principal)],
  };
  return paginate(
    ({ take, skip }) =>
      db.issue.findMany({ where, orderBy: [{ createdAt: "desc" }], take, skip, include: ISSUE_LIST_INCLUDE }),
    () => db.issue.count({ where }),
    pageParams,
  );
}

export async function getIssue(db: PrismaClient, tenantId: TenantId, id: string) {
  return db.issue.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: ISSUE_LIST_INCLUDE,
  });
}

/**
 * Open, un-ROAMed issues scoped to a set of ARTs — for PI-closure readiness and
 * PI summaries (replaces the old impediment count). "Open" = roamStatus "open".
 */
export async function countOpenIssuesForArts(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: ArtId[],
  options?: { piId?: string },
): Promise<number> {
  if (artIds.length === 0) return 0;
  return db.issue.count({
    where: {
      tenantId,
      deletedAt: null,
      roamStatus: "open",
      artId: { in: artIds },
      ...(options?.piId ? { piId: options.piId } : {}),
    },
  });
}
