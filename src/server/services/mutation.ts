import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import { ok, err, isErr, type Result } from "@/domain/errors";
import { emitAuditEvent, type AuditAction, type AuditResourceType } from "@/server/audit/emit";
import type { ChangeMap } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";

// ---------------------------------------------------------------------------
// Audited-mutation module
//
// The single deep module behind every write. It owns the transaction, the
// audit-event write (in the same transaction, so mutation + audit commit
// atomically), and the Prisma error → domain error mapping. Service functions
// describe *what* changed and *what to audit*; this module guarantees the rest.
// ---------------------------------------------------------------------------

/** Tenant + actor context for an audited mutation. */
export interface MutationContext {
  db: PrismaClient;
  tenantId: TenantId;
  actorId: UserId;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/** Derives a MutationContext from the HTTP/action RequestContext. */
export function toMutationContext(ctx: RequestContext): MutationContext {
  return {
    db: ctx.db,
    tenantId: ctx.principal.tenantId,
    actorId: ctx.principal.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

/** What the mutation records in the audit log; context fields are added by the wrapper. */
export interface MutationAudit {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  changes?: ChangeMap | undefined;
  /**
   * Overrides the audited tenant. Defaults to `ctx.tenantId`; a tenant-creating
   * mutation sets this to the newly created tenant's id.
   */
  tenantId?: TenantId | undefined;
}

/** A successful mutation body returns its result plus the audit description. */
export interface AuditedResult<T> {
  result: T;
  audit: MutationAudit;
}

export interface AuditedMutationOptions {
  /**
   * Maps a thrown Prisma error to a domain error. Return a `Result` to swallow
   * the throw (e.g. unique-constraint → conflict), or `undefined` to rethrow.
   */
  onPrismaError?: (e: unknown) => Result<never> | undefined;
}

/**
 * Runs a mutation inside one transaction and writes its audit event in the same
 * transaction. The body returns the operation result plus a `MutationAudit`;
 * this wrapper supplies tenant/actor/IP context and emits the event. If the
 * body returns an `err`, no audit row is written and the transaction unwinds.
 */
export async function withAuditedTransaction<T>(
  ctx: MutationContext,
  body: (tx: Prisma.TransactionClient) => Promise<Result<AuditedResult<T>>>,
  options: AuditedMutationOptions = {},
): Promise<Result<T>> {
  try {
    return await ctx.db.$transaction(async (tx) => {
      const outcome = await body(tx);
      if (isErr(outcome)) return outcome;

      const { result, audit } = outcome.value;
      await emitAuditEvent(tx, {
        tenantId: audit.tenantId ?? ctx.tenantId,
        actorId: ctx.actorId,
        action: audit.action,
        resourceType: audit.resourceType,
        resourceId: audit.resourceId,
        changes: audit.changes,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return ok(result);
    });
  } catch (e) {
    const mapped = options.onPrismaError?.(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Common `onPrismaError` mapper: turns a Postgres unique-constraint violation
 * into a `conflict` domain error with the given human-readable reason.
 */
export function onUniqueConstraint(reason: string): (e: unknown) => Result<never> | undefined {
  return (e) => {
    const message = e instanceof Error ? e.message : String(e);
    return message.includes("Unique constraint")
      ? err({ kind: "conflict" as const, reason })
      : undefined;
  };
}
