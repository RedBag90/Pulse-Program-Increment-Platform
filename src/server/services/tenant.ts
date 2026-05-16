import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import { ROLES } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export type TenantRegion = "EU" | "US" | "APAC";

export interface CreateTenantInput {
  name: string;
  region: TenantRegion;
  /** The platform admin performing the creation — becomes the first tenant_admin */
  actorId: UserId;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface CreatedTenant {
  id: TenantId;
  name: string;
  region: TenantRegion;
  createdAt: Date;
}

/**
 * Creates a new tenant and seeds a tenant_admin role assignment for the actor.
 * Must be called with a Prisma client that already has JWT claims set (via
 * createPrismaClient) — this ensures RLS allows the insert.
 */
export async function createTenant(
  db: PrismaClient,
  input: CreateTenantInput,
): Promise<Result<CreatedTenant>> {
  const { name, region, actorId, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name, region },
      });

      await tx.userRoleAssignment.create({
        data: {
          userId: actorId,
          tenantId: tenant.id,
          role: ROLES.TENANT_ADMIN,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId: tenant.id as TenantId,
        actorId,
        action: "tenant.created",
        resourceType: "tenant",
        resourceId: tenant.id,
        ipAddress,
        userAgent,
      });

      return ok({
        id: tenant.id as TenantId,
        name: tenant.name,
        region: tenant.region as TenantRegion,
        createdAt: tenant.createdAt,
      });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `Tenant "${name}" already exists` });
      }
      throw e;
    });
}
