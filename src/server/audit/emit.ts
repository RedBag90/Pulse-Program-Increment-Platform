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
  | "pi.started"
  | "pi.completed"
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
  | "dependency"
  | "user_role_assignment"
  | "tenant";

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------

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
      // Omit nullish fields so Prisma uses the column default (SQL NULL)
      ...(input.changes !== undefined && { changes: input.changes as Prisma.InputJsonValue }),
      ...(input.traceId !== undefined && { traceId: input.traceId }),
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
