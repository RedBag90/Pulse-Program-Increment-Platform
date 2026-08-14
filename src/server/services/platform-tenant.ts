import type { Role } from "@/modules/core/kernel/domain/roles";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { Principal } from "@/server/auth/principal";
import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";
import { platformDb } from "@/server/auth/platform";
import { emitAuditEvent } from "@/server/audit/emit";
import { publishDomainEvent } from "@/server/events/publish";
import { signInviteToken } from "@/server/services/invitation";
import { findUserIdByEmail } from "@/server/services/user-directory";

/**
 * Cross-tenant Tenant-Verwaltung des `platform_admin` (Roadmap P2). Alle
 * Schreibpfade laufen über den `platformDb` (tenantId "") mit EXPLIZITER
 * tenantId; Audit wird gegen den **Ziel-Tenant** geschrieben, Actor ist der
 * Plattform-Admin. Der Guard (`isPlatformAdmin`) liegt beim Aufrufer
 * (Server-Action); die Services vertrauen dem übergebenen Principal NICHT
 * blind — sie prüfen erneut `assertPlatformAdmin` über den Guard-Import.
 */

export type ServiceResult<T = object> = { ok: true } & T;
export type ServiceOutcome<T = object> = ServiceResult<T> | { ok: false; error: string };

function requireAdmin(actor: Principal): string | null {
  return actor.isPlatformAdmin ? null : "Kein Plattform-Admin";
}

export interface CreateOrgTenantInput {
  name: string;
  region: string;
  enabledModules: string[];
  /** E-Mail des initialen Tenant-Admins (Pflicht — ein Tenant ohne Admin ist verwaist). */
  adminEmail: string;
}

/**
 * Legt eine neue Organisation an und macht `adminEmail` zum initialen
 * tenant_admin: existiert der User bereits, direkt als Assignment; sonst
 * gezielte JWT-Einladung (bestehende Outbox/E-Mail-Infra). `invited=true`
 * signalisiert den Einladungs-Pfad.
 */
export async function createOrgTenant(
  actor: Principal,
  input: CreateOrgTenantInput,
): Promise<ServiceOutcome<{ tenantId: string; invited: boolean }>> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const adminUserId = await findUserIdByEmail(input.adminEmail);

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        region: input.region,
        kind: "organization",
        enabledModules: input.enabledModules,
      },
    });
    await emitAuditEvent(tx, {
      tenantId: tenant.id as TenantId,
      actorId: actor.id,
      action: "tenant.created",
      resourceType: "tenant",
      resourceId: tenant.id,
    });

    if (adminUserId) {
      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId: adminUserId,
          tenantId: tenant.id,
          role: ROLES.TENANT_ADMIN,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });
      await emitAuditEvent(tx, {
        tenantId: tenant.id as TenantId,
        actorId: actor.id,
        action: "user.role.assigned",
        resourceType: "user_role_assignment",
        resourceId: assignment.id,
        changes: {
          role: { before: null, after: ROLES.TENANT_ADMIN },
          email: { before: null, after: input.adminEmail },
        },
      });
      return { tenantId: tenant.id, invited: false };
    }

    // Unbekannte E-Mail ⇒ gezielte Einladung in den frisch angelegten Tenant.
    const token = await signInviteToken({
      email: input.adminEmail,
      tenantId: tenant.id as TenantId,
      role: ROLES.TENANT_ADMIN,
    });
    await publishDomainEvent(tx, {
      type: "user.invited",
      tenantId: tenant.id as TenantId,
      actorId: actor.id,
      inviteeEmail: input.adminEmail,
      inviterEmail: actor.email,
      tenantName: input.name,
      role: ROLES.TENANT_ADMIN,
      locale: "de",
      token,
    });
    await emitAuditEvent(tx, {
      tenantId: tenant.id as TenantId,
      actorId: actor.id,
      action: "user.invited",
      resourceType: "user_role_assignment",
      resourceId: input.adminEmail,
      changes: {
        role: { before: null, after: ROLES.TENANT_ADMIN },
        email: { before: null, after: input.adminEmail },
      },
    });
    return { tenantId: tenant.id, invited: true };
  });

  return { ok: true, ...result };
}

/** Entitlement-Set (Modul-Keys) eines Tenants setzen. Audit `tenant.updated`. */
export async function setTenantModules(
  actor: Principal,
  tenantId: string,
  enabledModules: string[],
): Promise<ServiceOutcome> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const existing = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { enabledModules: true },
  });
  if (!existing) return { ok: false, error: "Tenant nicht gefunden" };

  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { enabledModules } });
    await emitAuditEvent(tx, {
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      action: "tenant.updated",
      resourceType: "tenant",
      resourceId: tenantId,
      changes: { enabledModules: { before: existing.enabledModules, after: enabledModules } },
    });
  });
  return { ok: true };
}

/**
 * Mitglied hinzufügen: existiert der User, direkt als Assignment (Rolle);
 * sonst gezielte Einladung. Idempotenz-Schutz: hält der User die Rolle im
 * Tenant schon, ist es ein No-op-Fehler.
 */
export async function addTenantMember(
  actor: Principal,
  tenantId: string,
  email: string,
  role: Role,
): Promise<ServiceOutcome<{ invited: boolean }>> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };

  const userId = await findUserIdByEmail(email);

  if (userId) {
    const dupe = await db.userRoleAssignment.findFirst({
      where: { tenantId, userId, role },
      select: { id: true },
    });
    if (dupe) return { ok: false, error: "Nutzer hat diese Rolle bereits" };

    await db.$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId,
          tenantId,
          role,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });
      await emitAuditEvent(tx, {
        tenantId: tenantId as TenantId,
        actorId: actor.id,
        action: "user.role.assigned",
        resourceType: "user_role_assignment",
        resourceId: assignment.id,
        changes: { role: { before: null, after: role }, email: { before: null, after: email } },
      });
    });
    return { ok: true, invited: false };
  }

  const token = await signInviteToken({ email, tenantId: tenantId as TenantId, role });
  await db.$transaction(async (tx) => {
    await publishDomainEvent(tx, {
      type: "user.invited",
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      inviteeEmail: email,
      inviterEmail: actor.email,
      tenantName: tenant.name,
      role,
      locale: "de",
      token,
    });
    await emitAuditEvent(tx, {
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      action: "user.invited",
      resourceType: "user_role_assignment",
      resourceId: email,
      changes: { role: { before: null, after: role }, email: { before: null, after: email } },
    });
  });
  return { ok: true, invited: true };
}

export type TenantStatus = "active" | "suspended" | "archived";

const STATUS_AUDIT: Record<
  Exclude<TenantStatus, "active"> | "active",
  "tenant.suspended" | "tenant.archived" | "tenant.reactivated"
> = {
  suspended: "tenant.suspended",
  archived: "tenant.archived",
  active: "tenant.reactivated",
};

/**
 * Lifecycle-Status setzen: `suspended` (Login-Sperre), `archived` (Stilllegung /
 * Löschen-Ersatz für nicht-leere Tenants) oder zurück auf `active`. Personal-
 * Tenants (privater Free-Bereich) sind ausgenommen — sie werden nie gesperrt.
 */
export async function setTenantStatus(
  actor: Principal,
  tenantId: string,
  status: TenantStatus,
): Promise<ServiceOutcome> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, kind: true },
  });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };
  if (tenant.kind === "personal") {
    return { ok: false, error: "Private Bereiche können nicht gesperrt werden" };
  }
  if (tenant.status === status) return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { status } });
    await emitAuditEvent(tx, {
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      action: STATUS_AUDIT[status],
      resourceType: "tenant",
      resourceId: tenantId,
      changes: { status: { before: tenant.status, after: status } },
    });
  });
  return { ok: true };
}

/**
 * Harte Löschung — NUR für vollständig leere Tenants (keine Tenant-Cascades im
 * Schema; ein Delete mit Kind-Rows schlägt an der FK fehl). Bei Inhalt gibt der
 * Service einen Fehler zurück → „Archivieren" ist der Ersatz. Der Emptiness-
 * Check deckt die großen Content-Tabellen ab; ein FK-Fehler beim Delete fängt
 * den Rest ab.
 */
export async function deleteTenant(actor: Principal, tenantId: string): Promise<ServiceOutcome> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };

  const [members, valueStreams, arts, initiatives, objectives, themes, kpis, timelines] =
    await Promise.all([
      db.userRoleAssignment.count({ where: { tenantId } }),
      db.valueStream.count({ where: { tenantId } }),
      db.art.count({ where: { tenantId } }),
      db.initiative.count({ where: { tenantId } }),
      db.objective.count({ where: { tenantId } }),
      db.strategicTheme.count({ where: { tenantId } }),
      db.kpi.count({ where: { tenantId } }),
      db.timeline.count({ where: { tenantId } }),
    ]);
  const total =
    members + valueStreams + arts + initiatives + objectives + themes + kpis + timelines;
  if (total > 0) {
    return { ok: false, error: "Tenant ist nicht leer — bitte archivieren statt löschen" };
  }

  try {
    await db.$transaction(async (tx) => {
      // Audit VOR dem Delete (Ziel-Tenant existiert noch); FK auf tenant im
      // AuditEvent? — audit_events referenzieren tenantId als String ohne FK.
      await emitAuditEvent(tx, {
        tenantId: tenantId as TenantId,
        actorId: actor.id,
        action: "tenant.deleted",
        resourceType: "tenant",
        resourceId: tenantId,
      });
      await tx.tenant.delete({ where: { id: tenantId } });
    });
  } catch {
    return { ok: false, error: "Tenant ist nicht leer — bitte archivieren statt löschen" };
  }
  return { ok: true };
}

/**
 * Mitglied (ein Assignment) entfernen. Guardrail: den **letzten tenant_admin**
 * eines Tenants nicht entziehen (sonst wäre die Organisation verwaist).
 */
export async function removeTenantMember(
  actor: Principal,
  tenantId: string,
  assignmentId: string,
): Promise<ServiceOutcome> {
  const denied = requireAdmin(actor);
  if (denied) return { ok: false, error: denied };

  const db = platformDb(actor.id);
  const assignment = await db.userRoleAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    select: { id: true, role: true, userId: true },
  });
  if (!assignment) return { ok: false, error: "Zuweisung nicht gefunden" };

  if (assignment.role === ROLES.TENANT_ADMIN) {
    const remaining = await db.userRoleAssignment.count({
      where: { tenantId, role: ROLES.TENANT_ADMIN, id: { not: assignmentId } },
    });
    if (remaining === 0) {
      return { ok: false, error: "Letzten Tenant-Admin kann man nicht entfernen" };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.userRoleAssignment.delete({ where: { id: assignmentId } });
    await emitAuditEvent(tx, {
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      action: "user.role.removed",
      resourceType: "user_role_assignment",
      resourceId: assignmentId,
      changes: {
        role: { before: assignment.role, after: null },
        targetUserId: { before: assignment.userId as UserId, after: null },
      },
    });
  });
  return { ok: true };
}
