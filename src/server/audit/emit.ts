import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";
import type { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Audit event input
// ---------------------------------------------------------------------------

export interface AuditEventInput {
  tenantId: TenantId;
  actorId: UserId;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  /**
   * JSON Patch or before/after diff describing what changed.
   * Omit for create/delete events where the full resource is the change.
   */
  changes?: Record<string, { before: unknown; after: unknown }> | undefined;
  traceId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

// ---------------------------------------------------------------------------
// Action vocabulary
// ---------------------------------------------------------------------------

export type AuditAction =
  | "initiative.created"
  | "initiative.updated"
  | "initiative.deleted"
  // Reifegrad (Stage Gate): Antrag → namentliche Abnahme → Wechsel.
  // `advanced` bleibt der vollzogene Wechsel und behält seinen Namen, damit
  // bestehende Audit-Zeilen und die Activity-Feed-Auswertung weiterlaufen.
  | "initiative.stage_gate.requested"
  | "initiative.stage_gate.approval.granted"
  | "initiative.stage_gate.approval.rejected"
  | "initiative.stage_gate.advanced"
  | "initiative.stage_gate.request.rejected"
  | "initiative.stage_gate.request.withdrawn"
  | "initiative.stage_gate.reverted"
  | "stage_gate.approvers.configured"
  | "initiative.dependency.linked"
  | "initiative.dependency.unlinked"
  // Epic multi-party approval workflow
  | "epic.hypothesis.submitted"
  | "epic.hypothesis.approved"
  | "epic.hypothesis.rejected"
  | "epic.approval.configured"
  // Ausnahme von der Kostenregel (Guardrail 3): dieses Epic bleibt
  // Portfolio-Sache, obwohl seine Kosten unter dem Limit liegen.
  | "epic.portfolio_override.set"
  | "epic.business_case.submitted"
  | "epic.business_case.reopened"
  | "epic.approval.granted"
  | "epic.approval.rejected"
  | "epic.section.signed_off"
  | "epic.approved"
  | "epic.revision.started"
  | "epic.owner.assigned"
  | "feature.owner.assigned"
  | "feature.delivery.transitioned"
  | "wsjf.scored"
  | "value_stream.created"
  | "value_stream.updated"
  | "value_stream.guardrails.updated"
  | "art.epic_allocation.set"
  | "value_stream.deleted"
  | "art.created"
  | "art.updated"
  | "art.deleted"
  | "pi.created"
  | "pi.updated"
  | "pi.capacity.updated"
  | "pi.started"
  | "pi.completed"
  | "pi.cadence.advanced"
  | "pi.deleted"
  | "pi_standard.created"
  | "pi_standard.deleted"
  | "system_demo.created"
  | "system_demo.updated"
  | "system_demo.reordered"
  | "system_demo_item.added"
  | "system_demo_item.updated"
  | "system_demo_item.deleted"
  | "kpi.created"
  | "kpi.updated"
  | "kpi.deleted"
  | "user.invited"
  | "user.role.assigned"
  | "user.role.removed"
  | "platform.user.suspended"
  | "platform.user.reactivated"
  | "invite.rotated"
  | "invite.deactivated"
  | "invite.auto_accept.set"
  | "join_request.submitted"
  | "join_request.approved"
  | "join_request.rejected"
  | "provision_request.approved"
  | "provision_request.rejected"
  | "user.erased"
  | "user.data_exported"
  | "tenant.created"
  | "tenant.updated"
  | "tenant.suspended"
  | "tenant.reactivated"
  | "tenant.archived"
  | "tenant.deleted"
  | "target.created"
  | "target.updated"
  | "target.activated"
  | "budget_allocation.saved"
  | "budget_pool.saved"
  | "budget_defaults.saved"
  | "solution.created"
  | "solution.updated"
  | "solution.deleted"
  | "solution.promoted"
  | "solution.lifecycle.changed"
  | "solution.investment_mode.changed"
  // Abgelöst: die Run-Baseline an der Solution ist in die
  // Run-the-Business-Positionen aufgegangen. Bleibt in der Union, weil
  // Bestandszeilen im Audit-Log darauf stehen.
  | "solution.run.updated"
  | "epic.solutions.set"
  | "art_budget.saved"
  | "budget_plan.revision.captured"
  | "budget.cycle.advanced"
  | "budget.window.sized"
  | "budget.round.created"
  | "budget.round.started"
  | "budget.round.decided"
  | "budget.round.closed"
  | "budget.round.deleted"
  | "budget.group.created"
  | "budget.group.updated"
  | "budget.group.deleted"
  | "budget.group.captured"
  | "budget.decision.recorded"
  | "budget.reserve.carried"
  | "budget.participant.added"
  | "budget.participant.removed"
  | "budget.candidate.curated"
  | "budget.candidate.removed"
  | "budget.group.contributed"
  | "budget.group.submitted"
  | "budget.period.finalized"
  | "budget.period.reopened"
  | "rtb_item.saved"
  | "rtb_item.removed"
  | "timeline.created"
  | "timeline.updated"
  | "timeline.deleted"
  | "timeline.art.joined"
  | "timeline.art.left"
  | "role.capability.granted"
  | "role.capability.revoked"
  | "role.capability.reset"
  // Ziele-Modul V2 (Theme = Objective → KR)
  | "objective.created"
  | "objective.updated"
  | "objective.deleted"
  | "key_result.created"
  | "key_result.updated"
  | "key_result.deleted"
  | "key_result.kpi.bound"
  | "key_result.kpi.updated"
  | "key_result.kpi.unbound"
  | "goal.epic.linked"
  | "goal.epic.unlinked"
  | "goal.related_work.added"
  | "goal.related_work.removed"
  | "goal.value_stream.linked"
  | "goal.value_stream.unlinked"
  | "goal.art.linked"
  | "goal.art.unlinked"
  | "goal.custom_field.created"
  | "goal.custom_field.updated"
  | "goal.custom_field.deleted"
  | "goal.custom_field.value.set"
  | "goal.checkin"
  | "goal.progress.updated"
  | "goal.comment.added"
  | "setup.check.toggled"
  // Risks-Modul
  | "risk.suggested"
  | "risk.documented"
  | "risk.reviewed"
  | "risk.updated"
  | "risk.owner.assigned"
  | "risk.mitigation.added"
  | "risk.mitigation.removed"
  | "risk.reassessed"
  | "risk.roamed"
  | "risk.deleted"
  | "risk.epic.linked"
  | "risk.epic.unlinked"
  | "risk.settings.updated"
  // Issue-Cluster (verschachtelbar) — Epic- und Portfolio-Ebene.
  | "issue.cluster.created"
  | "issue.cluster.renamed"
  | "issue.cluster.assigned"
  | "issue.cluster.unassigned"
  | "issue.cluster.nested"
  | "issue.cluster.deleted"
  | "issue.cluster.scored"
  | "issue.reparented"
  | "portfolio_filter.saved"
  | "portfolio_filter.deleted"
  // Rollen-Onboarding: bewusst NUR die Quittung. Das Fortschreiben gesehener
  // Tour-Schritte feuert bei jedem Schrittwechsel und hat keinen
  // Compliance-Wert — das Audit-Log soll nicht mit Tour-Klicks volllaufen.
  | "role.onboarding.acknowledged";

export type AuditResourceType =
  | "initiative"
  // Nur für `stage_gate.approvers.configured`. Alle *Wechsel*-Ereignisse
  // bleiben auf `initiative` + der Epic-ID, weil `listInitiativeHistory` genau
  // auf dieses Paar filtert — so nimmt die Epic-Activity-Sidebar sie ohne
  // Zusatzarbeit auf.
  | "stage_gate_approver_rule"
  | "program_increment"
  | "pi_standard"
  | "value_stream"
  | "art"
  | "dependency"
  | "kpi"
  | "user_role_assignment"
  | "user"
  | "tenant"
  | "tenant_invite"
  | "tenant_join_request"
  | "tenant_provision_request"
  | "target_operating_model"
  | "budget_allocation"
  | "budget_pool"
  | "budget_defaults"
  | "solution"
  | "art_budget"
  | "budget_plan_revision"
  | "budget_round"
  | "budget_group"
  | "budget_decision"
  | "budget_participant"
  | "budget_candidate"
  | "run_the_business_item"
  | "timeline"
  | "role_capability"
  | "role"
  | "system_demo"
  | "system_demo_item"
  // Ziele-Modul V2
  | "objective"
  | "key_result"
  | "kr_kpi_contribution"
  | "goal_epic_link"
  | "goal_related_work"
  | "goal_value_stream_link"
  | "goal_art_link"
  | "goal_custom_field_def"
  | "goal_custom_field_value"
  | "setup_progress"
  | "risk"
  | "risk_epic_link"
  | "risk_mitigation"
  | "risk_assessment"
  | "risk_settings"
  | "issue"
  | "issue_cluster"
  | "saved_portfolio_filter"
  | "role_onboarding";

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the W3C trace ID for an audit event. Prefers an explicitly passed
 * id, then the Sentry active span / propagation context (so audit events
 * correlate with Sentry traces — concept §13.3), and finally a fresh UUID so
 * the column is never null.
 */
function resolveTraceId(explicit: string | undefined): string {
  if (explicit) return explicit;
  try {
    const span = Sentry.getActiveSpan();
    if (span) return span.spanContext().traceId;
    const propagation = Sentry.getCurrentScope().getPropagationContext();
    if (propagation.traceId) return propagation.traceId;
  } catch {
    // Sentry not initialised (e.g. unit tests) — fall through to a random id.
  }
  return randomUUID();
}

/**
 * Writes an audit event using the provided Prisma client (or transaction).
 * Must be called within the same transaction as the mutation it records,
 * so that audit and mutation are atomic.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   const epic = await tx.initiative.create({ data: { … } });
 *   await emitAuditEvent(tx, {
 *     tenantId, actorId, action: 'initiative.created',
 *     resourceType: 'initiative', resourceId: epic.id,
 *   });
 * });
 */
export async function emitAuditEvent(
  db: Pick<PrismaClient, "auditEvent">,
  input: AuditEventInput,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      traceId: resolveTraceId(input.traceId),
      // Omit nullish fields so Prisma uses the column default (SQL NULL)
      ...(input.changes !== undefined && { changes: input.changes as Prisma.InputJsonValue }),
      ...(input.ipAddress !== undefined && { ipAddress: input.ipAddress }),
      ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
    },
  });
}

// ---------------------------------------------------------------------------
// Request metadata extraction
// ---------------------------------------------------------------------------

/**
 * Pulls IP and User-Agent from the Next.js request headers for audit events.
 * Call with `await headers()` from `next/headers`.
 */
export function extractRequestMeta(headerList: Awaited<ReturnType<typeof headers>>): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      undefined,
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}
