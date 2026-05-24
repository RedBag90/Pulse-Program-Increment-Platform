import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
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
  | "pi.started"
  | "pi.completed"
  | "pi.deleted"
  | "pi_objective.created"
  | "pi_objective.updated"
  | "pi_objective.deleted"
  | "impediment.raised"
  | "impediment.escalated"
  | "impediment.resolved"
  | "kpi.created"
  | "kpi.updated"
  | "kpi.deleted"
  | "user.invited"
  | "user.role.assigned"
  | "user.role.removed"
  | "user.erased"
  | "user.data_exported"
  | "tenant.created"
  | "target.created"
  | "target.updated"
  | "target.activated"
  | "target_outcome.created"
  | "target_outcome.updated"
  | "target_outcome.deleted"
  | "transformation_action.created"
  | "transformation_action.updated"
  | "transformation_action.deleted"
  | "transformation_goal.created"
  | "transformation_goal.updated"
  | "transformation_goal.deleted"
  | "goal_epic.linked"
  | "goal_epic.unlinked"
  | "transformation_snapshot.captured";

export type AuditResourceType =
  | "initiative"
  | "program_increment"
  | "sprint"
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
  | "target_operating_model"
  | "target_outcome"
  | "transformation_action"
  | "transformation_goal"
  | "goal_epic_link"
  | "transformation_snapshot";

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
