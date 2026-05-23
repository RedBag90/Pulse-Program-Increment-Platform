import type { PrismaClient, Prisma } from "@/generated/prisma";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId, TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { ChangeMap } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import {
  parseBusinessCase,
  businessCaseHasContent,
  type ApprovalParty,
} from "@/domain/business-case";
import {
  canSubmitHypothesis,
  canDecideHypothesis,
  canConfigureApprovers,
  canSubmitBusinessCase,
  canDecideApproval,
  canStartRevision,
  revisionStartPhase,
  decisionStatus,
  isFullyApproved,
  APPROVAL_SECTIONS,
  type ApprovalDecision,
  type ApprovalSection,
  type ApprovalRecord,
  type ApprovalPhase,
  type RevisionMode,
} from "@/domain/epic-approval";

/**
 * Epic multi-party approval workflow — the audited, transactional service over
 * the pure phase machine in [epic-approval.ts] domain module. Each decision is
 * a separate audited mutation, so approvals appear (with date) in the Epic's
 * history. Distinct from the L0–L5 stage gate (independent axis).
 */

const EPIC_WHERE = (id: string, tenantId: string) => ({
  id,
  tenantId,
  level: InitiativeLevel.EPIC,
  deletedAt: null,
});

/** Treats a legacy null phase as the start of the workflow. */
function phaseOf(epic: { approvalPhase: string | null }): ApprovalPhase {
  return (epic.approvalPhase as ApprovalPhase | null) ?? "draft";
}

/** The Epic's active approval revision (1 for legacy rows). */
function revisionOf(epic: { approvalRevision: number | null }): number {
  return epic.approvalRevision ?? 1;
}

type ApprovalRow = {
  kind: string;
  party: string | null;
  section: string | null;
  status: string;
};

function toRecord(row: ApprovalRow): ApprovalRecord {
  return {
    kind: row.kind === "section" ? "section" : "party",
    party: row.party as ApprovalParty | null,
    section: row.section as ApprovalSection | null,
    status: row.status as ApprovalRecord["status"],
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — Benefit Hypothesis review (VMO)
// ---------------------------------------------------------------------------

export async function submitHypothesis(
  ctx: RequestContext,
  input: { epicId: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canSubmitHypothesis(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Epic in Phase "${phase}" kann die Hypothese nicht einreichen`,
      });
    }

    await tx.initiative.update({
      where: { id: epicId },
      data: { approvalPhase: "hypothesis_review", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.hypothesis.submitted",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approvalPhase: { before: phase, after: "hypothesis_review" } },
      },
    });
  });
}

export async function decideHypothesis(
  ctx: RequestContext,
  input: { epicId: EpicId; decision: ApprovalDecision },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, decision } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canDecideHypothesis(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Epic in Phase "${phase}" erwartet keine Hypothese-Entscheidung`,
      });
    }

    const target: ApprovalPhase = decision === "approve" ? "business_case" : "draft";
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        approvalPhase: target,
        updatedBy: mctx.actorId,
        // Timeline actual for the "Selected for Detailing" phase.
        ...(decision === "approve" && { hypothesisApprovedAt: new Date() }),
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: decision === "approve" ? "epic.hypothesis.approved" : "epic.hypothesis.rejected",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approvalPhase: { before: phase, after: target } },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — Business Case: configure approvers, submit to stakeholders
// ---------------------------------------------------------------------------

export async function configureApprovers(
  ctx: RequestContext,
  input: {
    epicId: EpicId;
    assignments: { party: ApprovalParty; userIds: string[] }[];
    /** One responsible reviewer per section (Breakdown / KPIs). */
    sections: { section: ApprovalSection; userId: string }[];
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, assignments, sections } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canConfigureApprovers(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Approver können nur in der Business-Case-Phase konfiguriert werden (aktuell "${phase}")`,
      });
    }

    const rev = revisionOf(epic);
    // Replace this revision's party + section assignments wholesale (no decisions
    // exist yet in this phase). Archived revisions are left untouched.
    await tx.epicApproval.deleteMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        kind: { in: ["party", "section"] },
        revision: rev,
      },
    });
    const partyRows = assignments.flatMap((a) =>
      a.userIds.map((userId) => ({
        tenantId: mctx.tenantId,
        initiativeId: epicId,
        revision: rev,
        kind: "party",
        party: a.party,
        approverUserId: userId,
        status: "pending",
        createdBy: mctx.actorId,
      })),
    );
    // Each section gets one assigned owner — only they may sign it off later.
    const sectionRows = sections
      .filter((s) => APPROVAL_SECTIONS.includes(s.section) && s.userId)
      .map((s) => ({
        tenantId: mctx.tenantId,
        initiativeId: epicId,
        revision: rev,
        kind: "section",
        section: s.section,
        approverUserId: s.userId,
        status: "pending",
        createdBy: mctx.actorId,
      }));
    const rows = [...partyRows, ...sectionRows];
    if (rows.length > 0) await tx.epicApproval.createMany({ data: rows });

    return ok({
      result: undefined,
      audit: {
        action: "epic.approval.configured",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approverCount: { before: null, after: rows.length } },
      },
    });
  });
}

export async function submitBusinessCase(
  ctx: RequestContext,
  input: { epicId: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canSubmitBusinessCase(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Business Case kann in Phase "${phase}" nicht eingereicht werden`,
      });
    }
    if (!businessCaseHasContent(parseBusinessCase(epic.businessCase).current)) {
      return err({ kind: "conflict" as const, reason: "Business Case hat noch keinen Inhalt" });
    }
    const rev = revisionOf(epic);
    const partyCount = await tx.epicApproval.count({
      where: { initiativeId: epicId, tenantId: mctx.tenantId, kind: "party", revision: rev },
    });
    if (partyCount === 0) {
      return err({
        kind: "conflict" as const,
        reason: "Mindestens ein Approver muss konfiguriert sein",
      });
    }

    // Both review sections (Breakdown, KPIs) need an assigned owner before the
    // Business Case goes out — the sign-offs are configured, not auto-created.
    const existingSections = await tx.epicApproval.findMany({
      where: { initiativeId: epicId, tenantId: mctx.tenantId, kind: "section", revision: rev },
      select: { section: true },
    });
    const have = new Set(existingSections.map((s) => s.section));
    if (!APPROVAL_SECTIONS.every((s) => have.has(s))) {
      return err({
        kind: "conflict" as const,
        reason: "Für Breakdown und KPIs muss je ein Verantwortlicher zugewiesen sein",
      });
    }

    // Each submission opens a fresh review round: reset every decision on this
    // revision (incl. prior rejections/approvals after a rework) back to pending.
    await tx.epicApproval.updateMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        revision: rev,
        kind: { in: ["party", "section"] },
      },
      data: { status: "pending", decidedAt: null, comment: null },
    });

    await tx.initiative.update({
      where: { id: epicId },
      data: { approvalPhase: "stakeholder_review", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.business_case.submitted",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approvalPhase: { before: phase, after: "stakeholder_review" } },
      },
    });
  });
}

/**
 * Owner-initiated rework: returns a `stakeholder_review` Epic to `business_case`
 * so the Business Case becomes editable again — the recovery path after a party
 * rejects. Decisions are kept as-is here and only reset on the next
 * {@link submitBusinessCase}.
 */
export async function reviseBusinessCase(
  ctx: RequestContext,
  input: { epicId: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (phase !== "stakeholder_review") {
      return err({
        kind: "conflict" as const,
        reason: `Der Business Case kann nur aus der Stakeholder-Phase überarbeitet werden (aktuell "${phase}")`,
      });
    }

    await tx.initiative.update({
      where: { id: epicId },
      data: { approvalPhase: "business_case", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.business_case.reopened",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approvalPhase: { before: phase, after: "business_case" } },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Phase 3 — Stakeholder decisions + section sign-offs (+ auto-finalize)
// ---------------------------------------------------------------------------

/**
 * Recomputes the epic phase after a decision: only the last outstanding
 * approval finalizes the Epic to `approved`. A rejection does **not** change the
 * phase — it blocks finalization (the Epic stays in `stakeholder_review`) until
 * the Owner explicitly reworks via {@link reviseBusinessCase}. Returns the
 * resulting phase change for the audit, or null.
 */
async function applyDecisionOutcome(
  tx: Prisma.TransactionClient,
  epicId: string,
  tenantId: string,
  revision: number,
  decision: ApprovalDecision,
  fromPhase: ApprovalPhase,
): Promise<{ before: ApprovalPhase; after: ApprovalPhase } | null> {
  if (decision === "reject") return null;
  const rows = await tx.epicApproval.findMany({
    where: { initiativeId: epicId, tenantId, revision },
    select: { kind: true, party: true, section: true, status: true },
  });
  if (isFullyApproved(rows.map(toRecord))) {
    await tx.initiative.update({
      where: { id: epicId },
      // businessCaseApprovedAt = timeline actual for the "Business Case" phase.
      data: { approvalPhase: "approved", status: "approved", businessCaseApprovedAt: new Date() },
    });
    return { before: fromPhase, after: "approved" };
  }
  return null;
}

export async function decideApproval(
  ctx: RequestContext,
  input: { approvalId: string; decision: ApprovalDecision; comment?: string | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { approvalId, decision, comment } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.epicApproval.findFirst({
      where: { id: approvalId, tenantId: mctx.tenantId, kind: "party" },
    });
    if (!row)
      return err({ kind: "not_found" as const, resourceType: "EpicApproval", id: approvalId });
    // Service-layer scope: only the assigned approver may decide their row.
    if (row.approverUserId !== mctx.actorId) {
      return err({
        kind: "conflict" as const,
        reason: "Nur der zugewiesene Approver darf diese Freigabe entscheiden",
      });
    }
    const epic = await tx.initiative.findFirst({
      where: EPIC_WHERE(row.initiativeId, mctx.tenantId),
    });
    if (!epic)
      return err({ kind: "not_found" as const, resourceType: "Epic", id: row.initiativeId });
    const phase = phaseOf(epic);
    const rev = revisionOf(epic);
    if (row.revision !== rev) {
      return err({
        kind: "conflict" as const,
        reason: "Freigabe gehört zu einer früheren Revision",
      });
    }
    if (!canDecideApproval(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Epic in Phase "${phase}" erwartet keine Freigabe-Entscheidung`,
      });
    }

    const status = decisionStatus(decision);
    await tx.epicApproval.update({
      where: { id: approvalId },
      data: { status, decidedAt: new Date(), comment: comment ?? null },
    });

    const phaseChange = await applyDecisionOutcome(
      tx,
      row.initiativeId,
      mctx.tenantId,
      rev,
      decision,
      phase,
    );
    const changes: ChangeMap = {
      party: { before: null, after: row.party },
      status: { before: row.status, after: status },
      ...(phaseChange && { approvalPhase: phaseChange }),
    };

    return ok({
      result: undefined,
      audit: {
        action: decision === "approve" ? "epic.approval.granted" : "epic.approval.rejected",
        resourceType: "initiative",
        resourceId: row.initiativeId,
        changes,
      },
    });
  });
}

export async function signoffSection(
  ctx: RequestContext,
  input: {
    epicId: EpicId;
    section: ApprovalSection;
    decision: ApprovalDecision;
    comment?: string | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, section, decision, comment } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canDecideApproval(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Sign-off ist in Phase "${phase}" nicht möglich`,
      });
    }
    const rev = revisionOf(epic);
    const row = await tx.epicApproval.findFirst({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        kind: "section",
        section,
        revision: rev,
      },
    });
    if (!row)
      return err({ kind: "not_found" as const, resourceType: "EpicApprovalSection", id: section });
    // Service-layer scope: only the assigned reviewer may sign off their section.
    if (row.approverUserId !== mctx.actorId) {
      return err({
        kind: "conflict" as const,
        reason: "Nur der zugewiesene Reviewer darf diesen Abschnitt abnehmen",
      });
    }

    const status = decisionStatus(decision);
    await tx.epicApproval.update({
      where: { id: row.id },
      data: {
        status,
        decidedAt: new Date(),
        comment: comment ?? null,
      },
    });

    const phaseChange = await applyDecisionOutcome(tx, epicId, mctx.tenantId, rev, decision, phase);
    const changes: ChangeMap = {
      section: { before: null, after: section },
      status: { before: row.status, after: status },
      ...(phaseChange && { approvalPhase: phaseChange }),
    };

    return ok({
      result: undefined,
      audit: {
        action: "epic.section.signed_off",
        resourceType: "initiative",
        resourceId: epicId,
        changes,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Revisions — re-open an approved Epic for a new approval cycle
// ---------------------------------------------------------------------------

export async function startRevision(
  ctx: RequestContext,
  input: { epicId: EpicId; mode: RevisionMode },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, mode } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({ where: EPIC_WHERE(epicId, mctx.tenantId) });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    const phase = phaseOf(epic);
    if (!canStartRevision(phase)) {
      return err({
        kind: "conflict" as const,
        reason: `Eine neue Revision kann nur aus einem freigegebenen Epic gestartet werden (aktuell "${phase}")`,
      });
    }

    const rev = revisionOf(epic);
    const nextRev = rev + 1;

    // Carry the previous revision's party + section assignments forward as
    // pending rows, so the Owner starts from the prior approver set (adjustable).
    const prevRows = await tx.epicApproval.findMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        kind: { in: ["party", "section"] },
        revision: rev,
      },
      select: { kind: true, party: true, section: true, approverUserId: true },
    });
    if (prevRows.length > 0) {
      await tx.epicApproval.createMany({
        data: prevRows.map((p) => ({
          tenantId: mctx.tenantId,
          initiativeId: epicId,
          revision: nextRev,
          kind: p.kind,
          party: p.party,
          section: p.section,
          approverUserId: p.approverUserId,
          status: "pending",
          createdBy: mctx.actorId,
        })),
      });
    }

    const nextPhase = revisionStartPhase(mode);
    // Snapshot the just-approved artefacts as the baseline for the new revision's
    // side-by-side diff (content is frozen between approval and re-open).
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        approvalRevision: nextRev,
        approvalPhase: nextPhase,
        status: "draft",
        updatedBy: mctx.actorId,
        ...(epic.businessCase != null && {
          baselineBusinessCase: epic.businessCase as Prisma.InputJsonValue,
        }),
        ...(epic.benefitHypothesis != null && {
          baselineBenefitHypothesis: epic.benefitHypothesis as Prisma.InputJsonValue,
        }),
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.revision.started",
        resourceType: "initiative",
        resourceId: epicId,
        changes: {
          revision: { before: rev, after: nextRev },
          mode: { before: null, after: mode },
          approvalPhase: { before: phase, after: nextPhase },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** All approval/sign-off rows for an Epic — backs the approval overview. */
export async function listEpicApprovals(db: PrismaClient, tenantId: TenantId, epicId: EpicId) {
  return db.epicApproval.findMany({
    where: { tenantId, initiativeId: epicId },
    orderBy: [{ kind: "asc" }, { party: "asc" }, { requestedAt: "asc" }],
  });
}

/** Distinct tenant users with their roles — the approver picker source. */
export async function listTenantApprovers(db: PrismaClient, tenantId: TenantId) {
  const assignments = await db.userRoleAssignment.findMany({
    where: { tenantId },
    select: { userId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const byUser = new Map<string, string[]>();
  for (const a of assignments) {
    (byUser.get(a.userId) ?? byUser.set(a.userId, []).get(a.userId)!).push(a.role);
  }
  return [...byUser.entries()].map(([userId, roles]) => ({ userId, roles }));
}
