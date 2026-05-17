import type { TenantId } from "@/domain/types";
import { ROLES } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

export type TenantRegion = "EU" | "US" | "APAC";

export interface CreateTenantInput {
  name: string;
  region: TenantRegion;
}

export interface CreatedTenant {
  id: TenantId;
  name: string;
  region: TenantRegion;
  createdAt: Date;
}

/**
 * Creates a new tenant and seeds a tenant_admin role assignment for the actor.
 * The audit event is recorded against the *newly created* tenant (not the
 * actor's current tenant context).
 */
export async function createTenant(
  ctx: RequestContext,
  input: CreateTenantInput,
): Promise<Result<CreatedTenant>> {
  const mctx = toMutationContext(ctx);
  const { name, region } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const tenant = await tx.tenant.create({ data: { name, region } });

      await tx.userRoleAssignment.create({
        data: {
          userId: mctx.actorId,
          tenantId: tenant.id,
          role: ROLES.TENANT_ADMIN,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });

      return ok({
        result: {
          id: tenant.id as TenantId,
          name: tenant.name,
          region: tenant.region as TenantRegion,
          createdAt: tenant.createdAt,
        },
        audit: {
          action: "tenant.created" as const,
          resourceType: "tenant" as const,
          resourceId: tenant.id,
          tenantId: tenant.id as TenantId,
        },
      });
    },
    { onPrismaError: onUniqueConstraint(`Tenant "${name}" already exists`) },
  );
}
