import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
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

/** Ein Tenant, in dem der User mindestens ein Assignment hält (Switcher-Datenquelle). */
export interface UserTenant {
  id: TenantId;
  name: string;
  /** "personal" | "organization". */
  kind: string;
}

/**
 * Alle Tenants eines Users, dedupliziert über seine Role-Assignments —
 * persönlicher Bereich zuerst, danach Organisationen alphabetisch. Läuft über
 * den Bootstrap-Client (Identitäts-Feststellung, wie `getPrincipal`).
 */
export async function listUserTenants(db: PrismaClient, userId: UserId): Promise<UserTenant[]> {
  const assignments = await db.userRoleAssignment.findMany({
    where: { userId },
    select: { tenant: { select: { id: true, name: true, kind: true } } },
  });
  const byId = new Map(assignments.map((a) => [a.tenant.id, a.tenant]));
  return [...byId.values()]
    .map((t) => ({ id: t.id as TenantId, name: t.name, kind: t.kind }))
    .sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name, "de") : a.kind === "personal" ? -1 : 1,
    );
}
