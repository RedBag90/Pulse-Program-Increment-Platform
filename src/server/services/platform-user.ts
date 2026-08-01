import { ROLES } from "@/domain/roles";
import type { Principal } from "@/server/auth/principal";
import type { TenantId, UserId } from "@/domain/types";
import { platformDb, assertPlatformAdmin } from "@/server/auth/platform";
import { emitAuditEvent } from "@/server/audit/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceOutcome } from "@/server/services/platform-tenant";

/**
 * Cross-tenant Nutzer-Verwaltung des `platform_admin` (Roadmap P4): globale
 * Rolle (platform_admin) vergeben/entziehen + Konto sperren/entsperren
 * (Supabase-Ban). Guardrails: kein Selbst-Suspend, den letzten platform_admin
 * nicht demoten. Audit gegen den Personal-Tenant des Ziel-Nutzers (dessen
 * plattformweites Zuhause).
 */

// Supabase-Ban „für immer" (Go-Duration). „none" hebt den Ban auf.
const BAN_FOREVER = "876000h";

/** Personal-Tenant eines Users (Audit-Home der plattformweiten Aktion). */
async function personalTenantOf(
  db: ReturnType<typeof platformDb>,
  userId: string,
): Promise<string | null> {
  const t = await db.tenant.findFirst({
    where: { kind: "personal", userRoleAssignments: { some: { userId } } },
    select: { id: true },
  });
  return t?.id ?? null;
}

/**
 * Globale `platform_admin`-Rolle setzen (grant) oder entziehen. Die Rolle liegt
 * im Personal-Tenant des Ziel-Users (tenant-blinde Auflösung in getPrincipal).
 * Guardrail: den letzten Plattform-Admin nicht entziehen.
 */
export async function setPlatformRole(
  actor: Principal,
  userId: string,
  grant: boolean,
): Promise<ServiceOutcome> {
  assertPlatformAdmin(actor);
  const db = platformDb(actor.id);

  if (grant) {
    const existing = await db.userRoleAssignment.findFirst({
      where: { userId, role: ROLES.PLATFORM_ADMIN },
      select: { id: true },
    });
    if (existing) return { ok: true };

    const personalTenantId = await personalTenantOf(db, userId);
    if (!personalTenantId) {
      return { ok: false, error: "Nutzer hat noch keinen Bereich (einmal einloggen lassen)" };
    }
    await db.$transaction(async (tx) => {
      const a = await tx.userRoleAssignment.create({
        data: {
          userId,
          tenantId: personalTenantId,
          role: ROLES.PLATFORM_ADMIN,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });
      await emitAuditEvent(tx, {
        tenantId: personalTenantId as TenantId,
        actorId: actor.id,
        action: "user.role.assigned",
        resourceType: "user_role_assignment",
        resourceId: a.id,
        changes: {
          role: { before: null, after: ROLES.PLATFORM_ADMIN },
          targetUserId: { before: null, after: userId as UserId },
        },
      });
    });
    return { ok: true };
  }

  // Entziehen — Guardrail: nicht den letzten platform_admin.
  const admins = await db.userRoleAssignment.groupBy({
    by: ["userId"],
    where: { role: ROLES.PLATFORM_ADMIN },
  });
  if (admins.length <= 1 && admins.some((g) => g.userId === userId)) {
    return { ok: false, error: "Den letzten Plattform-Admin kann man nicht entziehen" };
  }

  const rows = await db.userRoleAssignment.findMany({
    where: { userId, role: ROLES.PLATFORM_ADMIN },
    select: { id: true, tenantId: true },
  });
  if (rows.length === 0) return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.userRoleAssignment.deleteMany({ where: { userId, role: ROLES.PLATFORM_ADMIN } });
    for (const r of rows) {
      await emitAuditEvent(tx, {
        tenantId: r.tenantId as TenantId,
        actorId: actor.id,
        action: "user.role.removed",
        resourceType: "user_role_assignment",
        resourceId: r.id,
        changes: {
          role: { before: ROLES.PLATFORM_ADMIN, after: null },
          targetUserId: { before: userId as UserId, after: null },
        },
      });
    }
  });
  return { ok: true };
}

/** Konto sperren (Supabase-Ban). Guardrail: kein Selbst-Suspend. */
export async function suspendUser(actor: Principal, userId: string): Promise<ServiceOutcome> {
  assertPlatformAdmin(actor);
  if (userId === actor.id) return { ok: false, error: "Selbst-Sperrung ist nicht möglich" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
  if (error) return { ok: false, error: "Sperren fehlgeschlagen" };

  await writeUserAudit(actor, userId, "platform.user.suspended");
  return { ok: true };
}

/** Konto entsperren (Ban aufheben). */
export async function reactivateUser(actor: Principal, userId: string): Promise<ServiceOutcome> {
  assertPlatformAdmin(actor);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) return { ok: false, error: "Entsperren fehlgeschlagen" };

  await writeUserAudit(actor, userId, "platform.user.reactivated");
  return { ok: true };
}

async function writeUserAudit(
  actor: Principal,
  userId: string,
  action: "platform.user.suspended" | "platform.user.reactivated",
): Promise<void> {
  const db = platformDb(actor.id);
  const tenantId = (await personalTenantOf(db, userId)) ?? actor.tenantId;
  await emitAuditEvent(db, {
    tenantId: tenantId as TenantId,
    actorId: actor.id,
    action,
    resourceType: "user",
    resourceId: userId,
  });
}
