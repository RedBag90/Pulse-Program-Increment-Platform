import type { TenantId } from "@/domain/types";
import { ok, err, type Result } from "@/domain/errors";

// ---------------------------------------------------------------------------
// Tenant-scoped read primitive
//
// Every write service first loads the row it is about to mutate and 404s if it
// is missing — `findFirst({ where: { id, tenantId } })` then `if (!row) return
// err({ kind: "not_found", … })`. That guard is **security-load-bearing** (a
// forgotten `tenantId` is a cross-tenant read) yet it was retyped at ~60 call
// sites. This module owns it: the tenant filter is supplied by the primitive,
// so a caller cannot forget it, and the not-found contract lives in one place.
//
// Soft-deletable Initiatives keep their own `findInitiativeAtLevel`
// (initiative-write.ts) which also filters `deletedAt` and `level`.
// ---------------------------------------------------------------------------

/** The slice of a Prisma model delegate this primitive needs. */
interface TenantScopedReader<TRow> {
  findFirst(args: { where: { id: string; tenantId: string } }): Promise<TRow | null>;
}

/**
 * Loads a tenant-owned row by id, or returns a `not_found` domain error tagged
 * with `resourceType`. The `{ id, tenantId }` filter is applied here, so the
 * tenant guard can never be omitted at the call site.
 *
 * @example
 * const found = await findOr404(tx.piObjective, {
 *   id, tenantId: mctx.tenantId, resourceType: "PiObjective",
 * });
 * if (isErr(found)) return found;
 * const objective = found.value;
 */
export async function findOr404<TRow>(
  reader: TenantScopedReader<TRow>,
  args: { id: string; tenantId: TenantId; resourceType: string },
): Promise<Result<TRow>> {
  const row = await reader.findFirst({ where: { id: args.id, tenantId: args.tenantId } });
  if (!row) {
    return err({ kind: "not_found" as const, resourceType: args.resourceType, id: args.id });
  }
  return ok(row);
}
