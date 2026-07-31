import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import { ROLES } from "@/domain/roles";
import { PERSONAL_DEFAULT_MODULES } from "@/domain/modules";
import { emitAuditEvent } from "@/server/audit/emit";
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

/**
 * Persönlichen Free-Tenant eines Users sicherstellen (find-or-create,
 * idempotent). Läuft OHNE RequestContext — der Aufrufer (/start) hat evtl.
 * noch gar keinen Principal (Session ohne Assignment; fixt die frühere
 * /start↔/sign-in-Endlosschleife). kind=personal, Free-Set `["ziele"]`,
 * User = tenant_admin seines eigenen Bereichs (unscoped).
 */
export async function ensurePersonalTenant(
  db: PrismaClient,
  userId: UserId,
  email: string,
): Promise<{ tenantId: TenantId; created: boolean }> {
  const existing = await db.tenant.findFirst({
    where: { kind: "personal", userRoleAssignments: { some: { userId } } },
    select: { id: true },
  });
  if (existing) return { tenantId: existing.id as TenantId, created: false };

  const localpart = email.split("@")[0] || "privat";
  const tenantId = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: `Mein Bereich (${localpart})`,
        region: "eu",
        kind: "personal",
        enabledModules: [...PERSONAL_DEFAULT_MODULES],
      },
    });
    await tx.userRoleAssignment.create({
      data: {
        userId,
        tenantId: tenant.id,
        role: ROLES.TENANT_ADMIN,
        valueStreamIds: [],
        artIds: [],
        teamIds: [],
      },
    });
    await emitAuditEvent(tx, {
      tenantId: tenant.id as TenantId,
      actorId: userId,
      action: "tenant.created",
      resourceType: "tenant",
      resourceId: tenant.id,
    });
    return tenant.id as TenantId;
  });
  return { tenantId, created: true };
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
