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
  | "wsjf.scored"
  | "value_stream.created"
  | "value_stream.updated"
  | "value_stream.deleted"
  | "art.created"
  | "art.updated"
  | "team.created"
  | "team.updated"
  | "pi.created"
  | "pi.updated"
  | "pi.started"
  | "pi.completed"
  | "pi_objective.created"
  | "pi_objective.updated"
  | "impediment.raised"
  | "impediment.escalated"
  | "impediment.resolved"
  | "user.invited"
  | "user.role.assigned"
  | "user.role.removed"
  | "tenant.created";

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
  | "user_role_assignment"
  | "tenant";

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
