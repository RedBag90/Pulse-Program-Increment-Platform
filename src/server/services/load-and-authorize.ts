import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { authorizeResource, type AuthResource } from "@/server/auth/authorize";
import type { Principal } from "@/server/auth/principal";
import type { Action } from "@/server/auth/policies";

/**
 * "Load row → authorize against the *real* row → return it" — the seam that
 * ADR-0002 mandates for by-id mutations. Every authoritative scope check
 * (`value_stream`/`art`/`own`) needs the loaded row's actual ownership
 * fields, not the input alone, otherwise grants are satisfied vacuously by
 * an attacker controlling only the id in the body.
 *
 * About ~15 services inlined the same three steps before this helper:
 *
 *   const existing = await tx.foo.findFirst({ where: { id, tenantId, … } });
 *   if (!existing) return err({ kind: "not_found", resourceType, id });
 *   const authz = authorizeResource(principal, action, buildScope(existing));
 *   if (isErr(authz)) return authz;
 *   // …actual work…
 *
 * Concentrating them here means a new scope dimension (e.g. `regionId`) or a
 * change to the not-found vocabulary flips once, not per-service.
 *
 * `finder` returns the loaded row (or null) — typically wraps a
 * `tx.someTable.findFirst` with whatever `select` the caller needs.
 * `toResource` maps the loaded row to the `AuthResource` the policy expects.
 */
export async function loadAndAuthorize<TRow>(args: {
  principal: Principal;
  action: Action;
  resourceType: string;
  id: string;
  finder: () => Promise<TRow | null>;
  toResource: (row: TRow) => AuthResource;
}): Promise<Result<TRow>> {
  const row = await args.finder();
  if (!row) {
    return err({ kind: "not_found" as const, resourceType: args.resourceType, id: args.id });
  }
  const authz = authorizeResource(args.principal, args.action, args.toResource(row));
  if (isErr(authz)) return authz;
  return ok(row);
}
