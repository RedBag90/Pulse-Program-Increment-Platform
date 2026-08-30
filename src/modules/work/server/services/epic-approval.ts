import type { PrismaClient, Prisma } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId, TenantId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import type { ChangeMap } from "@/modules/core/kernel/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  type MutationContext,
} from "@/modules/core/kernel/server/mutation";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";
import {
  parseBusinessCase,
  businessCaseHasContent,
  type ApprovalParty,
} from "@/modules/work/domain/business-case";
import {
  nextPhaseFor,
  decisionStatus,
  isFullyApproved,
  isValidApproverSet,
  assertAssignedApprover,
  type ApprovalDecision,
  type ApprovalRecord,
  type ApprovalPhase,
  type RevisionMode,
} from "@/modules/work/domain/epic-approval";

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
  status: string;
};

function toRecord(row: ApprovalRow): ApprovalRecord {
  return {
    kind: "party",
    party: row.party as ApprovalParty | null,
    status: row.status as ApprovalRecord["status"],
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — Benefit Hypothesis review (Portfolio Manager)
// ---------------------------------------------------------------------------

export async function submitHypothesis(
  ctx: RequestContext,
  input: { epicId: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.hypothesis.submit",
      select: { approvalPhase: true },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
    const phase = phaseOf(epic);
    const target = nextPhaseFor(phase, { kind: "submit_hypothesis" });
    if (!target.ok) return target;

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

/**
 * The Portfolio Manager decides the Benefit Hypothesis: approve → `business_case`, reject → `draft`.
 * Optional `comment` is persisted on the audit (no schema change for v1); the
 * "Meine Freigaben" inbox uses it to capture the reviewer's reasoning, and
 * `intent: "clarification"` lets a "Rückfrage" be distinguished from an outright
 * rejection in the audit tail.
 */
export async function decideHypothesis(
  ctx: RequestContext,
  input: {
    epicId: EpicId;
    decision: ApprovalDecision;
    comment?: string | undefined;
    intent?: "decision" | "clarification" | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, decision, comment, intent } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.hypothesis.decide",
      select: { approvalPhase: true },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
    const phase = phaseOf(epic);
    const next = nextPhaseFor(phase, { kind: "decide_hypothesis", decision });
    if (!next.ok) return next;
    const target = next.value as ApprovalPhase;
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        approvalPhase: target,
        updatedBy: mctx.actorId,
        // On approval: stamp the "Selected for Detailing" timeline actual and flag
        // the Epic for the next steering meeting.
        ...(decision === "approve" && {
          hypothesisApprovedAt: new Date(),
          needsSteeringAttention: true,
        }),
      },
    });

    // Kein Auto-Advance mehr. `hypothesisApprovedAt` wird oben weiter gestempelt
    // und ist damit das Readiness-Kriterium für L1 — aber der Wechsel selbst
    // wird beantragt und abgenommen. Das war die letzte Stelle, an der ein Gate
    // sich als Nebenwirkung eines anderen Vorgangs bewegte.

    return ok({
      result: undefined,
      audit: {
        action: decision === "approve" ? "epic.hypothesis.approved" : "epic.hypothesis.rejected",
        resourceType: "initiative",
        resourceId: epicId,
        changes: {
          approvalPhase: { before: phase, after: target },
          ...(comment ? { comment: { before: null, after: comment } } : {}),
          ...(intent ? { intent: { before: null, after: intent } } : {}),
        },
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
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, assignments } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.approval.configure",
      select: { approvalPhase: true, approvalRevision: true },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
    const phase = phaseOf(epic);
    const guard = nextPhaseFor(phase, { kind: "configure_approvers" });
    if (!guard.ok) return guard;

    const rev = revisionOf(epic);
    // Replace this revision's assignments wholesale (no decisions exist yet in
    // this phase). Archived revisions are left untouched. Das `section` im
    // Filter raeumt zugleich Legacy-Zeilen der abgeschafften Sektions-Abnahme.
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
    if (partyRows.length > 0) await tx.epicApproval.createMany({ data: partyRows });

    return ok({
      result: undefined,
      audit: {
        action: "epic.approval.configured",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { approverCount: { before: null, after: partyRows.length } },
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
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.businesscase.submit",
      select: { approvalPhase: true, approvalRevision: true, businessCase: true },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
    const phase = phaseOf(epic);
    const next = nextPhaseFor(phase, { kind: "submit_business_case" });
    if (!next.ok) return next;
    if (!businessCaseHasContent(parseBusinessCase(epic.businessCase).current)) {
      return err({ kind: "conflict" as const, reason: "Business Case hat noch keinen Inhalt" });
    }
    const rev = revisionOf(epic);
    // A valid approver set = ≥1 configured party. Read the revision's rows back
    // and re-verify through the same predicate the config write is bound by.
    const configuredRows = await tx.epicApproval.findMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        kind: "party",
        revision: rev,
      },
      select: { kind: true, party: true, status: true },
    });
    const valid = isValidApproverSet(configuredRows.map(toRecord));
    if (!valid.ok) {
      return err({
        kind: "conflict" as const,
        reason: valid.reason ?? "Ungültige Approver-Konfiguration",
      });
    }

    // Each submission opens a fresh review round: reset every decision on this
    // revision (incl. prior rejections/approvals after a rework) back to pending.
    await tx.epicApproval.updateMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        revision: rev,
        kind: "party",
      },
      data: { status: "pending", decidedAt: null, comment: null },
    });

    await tx.initiative.update({
      where: { id: epicId },
      data: { approvalPhase: "stakeholder_review", updatedBy: mctx.actorId },
    });

    // Der frühere L1→L2-Backstop ist entfallen. Backstops braucht nur, wer
    // Zustand in einem Slot hält, der hinter der Wirklichkeit zurückfallen kann;
    // Readiness wird beim Lesen abgeleitet und kann nicht veralten.

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
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.businesscase.submit",
      select: { approvalPhase: true },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
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
// Phase 3 — Stakeholder decisions (+ auto-finalize)
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
  mctx: MutationContext,
  epicId: string,
  revision: number,
  decision: ApprovalDecision,
  fromPhase: ApprovalPhase,
): Promise<{ before: ApprovalPhase; after: ApprovalPhase } | null> {
  if (decision === "reject") return null;
  // Explizit auf Parteien gefiltert: Bestands-Datenbanken tragen noch Zeilen der
  // abgeschafften Sektions-Abnahme, und eine alt-abgelehnte darunter haette das
  // Epic sonst dauerhaft in Nacharbeit gehalten.
  const rows = await tx.epicApproval.findMany({
    where: { initiativeId: epicId, tenantId: mctx.tenantId, revision, kind: "party" },
    select: { kind: true, party: true, status: true },
  });
  if (isFullyApproved(rows.map(toRecord))) {
    await tx.initiative.update({
      where: { id: epicId },
      // businessCaseApprovedAt = timeline actual for the "Business Case" phase;
      // flag the Epic for the next steering meeting.
      data: {
        approvalPhase: "approved",
        status: "approved",
        businessCaseApprovedAt: new Date(),
        needsSteeringAttention: true,
      },
    });
    // Reifegrad-Modell v2 (Plan vom 2026-06-07): Der BC-Approval schiebt
    // das Epic nicht mehr automatisch auf L3 — L3 = „Budget alloziert"
    // verlangt zusätzlich eine BudgetAllocation mit Σ > 0. Der
    // Auto-Advance hängt jetzt am `saveBudgetAllocation` (siehe
    // `src/server/services/budgeting.ts`).
    return { before: fromPhase, after: "approved" };
  }
  return null;
}

export async function decideApproval(
  ctx: RequestContext,
  input: {
    approvalId: string;
    decision: ApprovalDecision;
    comment?: string | undefined;
    /** Tags the audit so a "Rückfrage" can be distinguished from an outright rejection. */
    intent?: "decision" | "clarification" | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { approvalId, decision, comment, intent } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.epicApproval.findFirst({
      where: { id: approvalId, tenantId: mctx.tenantId, kind: "party" },
    });
    if (!row)
      return err({ kind: "not_found" as const, resourceType: "EpicApproval", id: approvalId });
    // Service-layer scope: only the assigned approver may decide their row.
    const assigned = assertAssignedApprover(row, mctx.actorId);
    if (isErr(assigned)) return assigned;
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
    const guard = nextPhaseFor(phase, { kind: "decide_approval" });
    if (!guard.ok) return guard;

    const status = decisionStatus(decision);
    await tx.epicApproval.update({
      where: { id: approvalId },
      data: { status, decidedAt: new Date(), comment: comment ?? null },
    });

    const phaseChange = await applyDecisionOutcome(
      tx,
      mctx,
      row.initiativeId,
      rev,
      decision,
      phase,
    );
    const changes: ChangeMap = {
      party: { before: null, after: row.party },
      status: { before: row.status, after: status },
      ...(phaseChange && { approvalPhase: phaseChange }),
      ...(intent ? { intent: { before: null, after: intent } } : {}),
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

// ---------------------------------------------------------------------------
// Revisions — start a fresh approval cycle: re-open a fully approved Epic, or
// reset an in-progress cycle back to draft and restart it (Epic-owner reset).
// ---------------------------------------------------------------------------

export async function startRevision(
  ctx: RequestContext,
  input: { epicId: EpicId; mode: RevisionMode },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, mode } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.revision.start",
      select: {
        approvalPhase: true,
        approvalRevision: true,
        businessCase: true,
        benefitHypothesis: true,
      },
    });
    if (isErr(loaded)) return loaded;
    const epic = loaded.value;
    const phase = phaseOf(epic);
    const next = nextPhaseFor(phase, { kind: "start_revision", mode });
    if (!next.ok) return next;
    const nextPhase = next.value as ApprovalPhase;

    const rev = revisionOf(epic);
    const nextRev = rev + 1;

    // Carry the previous revision's party assignments forward as pending rows,
    // so the Owner starts from the prior approver set (adjustable).
    const prevRows = await tx.epicApproval.findMany({
      where: {
        initiativeId: epicId,
        tenantId: mctx.tenantId,
        kind: "party",
        revision: rev,
      },
      select: { party: true, approverUserId: true },
    });
    if (prevRows.length > 0) {
      await tx.epicApproval.createMany({
        data: prevRows.map((p) => ({
          tenantId: mctx.tenantId,
          initiativeId: epicId,
          revision: nextRev,
          kind: "party",
          party: p.party,
          approverUserId: p.approverUserId,
          status: "pending",
          createdBy: mctx.actorId,
        })),
      });
    }

    // Re-opening an *approved* Epic snapshots the just-approved artefacts as the
    // baseline for the new revision's side-by-side diff (content is frozen between
    // approval and re-open). A mid-flight reset has no meaningful baseline (the
    // content is still being edited), so it is skipped there.
    const snapshotBaseline = phase === "approved";
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        approvalRevision: nextRev,
        approvalPhase: nextPhase,
        status: "draft",
        updatedBy: mctx.actorId,
        ...(snapshotBaseline &&
          epic.businessCase != null && {
            baselineBusinessCase: epic.businessCase as Prisma.InputJsonValue,
          }),
        ...(snapshotBaseline &&
          epic.benefitHypothesis != null && {
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
