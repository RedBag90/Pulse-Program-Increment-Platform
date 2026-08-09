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
  | "initiative.stage_gate.advanced"
  | "initiative.dependency.linked"
  | "initiative.dependency.unlinked"
  // Epic multi-party approval workflow
  | "epic.hypothesis.submitted"
  | "epic.hypothesis.approved"
  | "epic.hypothesis.rejected"
  | "epic.approval.configured"
  | "epic.business_case.submitted"
  | "epic.business_case.reopened"
  | "epic.approval.granted"
  | "epic.approval.rejected"
  | "epic.section.signed_off"
  | "epic.approved"
  | "epic.revision.started"
  | "epic.owner.assigned"
  | "feature.delivery.transitioned"
  | "wsjf.scored"
  | "value_stream.created"
  | "value_stream.updated"
  | "value_stream.deleted"
  | "art.created"
  | "art.updated"
  | "art.deleted"
  | "team.created"
  | "team.updated"
  | "team.deleted"
  | "pi.created"
  | "pi.updated"
  | "pi.capacity.updated"
  | "pi.started"
  | "pi.completed"
  | "pi.deleted"
  | "pi_standard.created"
  | "pi_standard.deleted"
  | "pi_objective.created"
  | "pi_objective.updated"
  | "pi_objective.deleted"
  | "system_demo.created"
  | "system_demo.updated"
  | "system_demo.reordered"
  | "system_demo_item.added"
  | "system_demo_item.updated"
  | "system_demo_item.deleted"
  | "impediment.raised"
  | "impediment.escalated"
  | "impediment.resolved"
  | "impediment.updated"
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
  | "art_budget.saved"
  | "budget_plan.revision.captured"
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
  | "risk.settings.updated";

export type AuditResourceType =
  | "initiative"
  | "program_increment"
  | "pi_standard"
  | "value_stream"
  | "art"
  | "team"
  | "pi_objective"
  | "impediment"
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
  | "art_budget"
  | "budget_plan_revision"
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
  | "risk_settings";

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
