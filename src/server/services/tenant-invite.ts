import { randomBytes } from "crypto";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { Principal } from "@/server/auth/principal";
import type { TenantId, UserId } from "@/domain/types";
import { createPrismaClient } from "@/server/db/prisma";
import { emitAuditEvent } from "@/server/audit/emit";
import { publishDomainEvent } from "@/server/events/publish";
import { signInviteToken } from "@/server/services/invitation";
import { findUserIdByEmail } from "@/server/services/user-directory";
import type { ServiceOutcome } from "@/server/services/platform-tenant";

/**
 * Offener Selbst-Service-Beitritt (Roadmap P5): geteilter Link + Code je Tenant.
 * Verwaltung liegt beim tenant_admin (tenant-scoped, Gate `tenant.users.manage`
 * in der Server-Action); der öffentliche `submitJoinRequest`-Pfad läuft ohne
 * Auth. Genehmigung offener (nicht-autoAccept) Anfragen erfolgt in
 * `/admin/anfragen`. Neu beigetretene Mitglieder erhalten die Rolle `viewer`.
 */

const JOIN_ROLE = ROLES.VIEWER;

export interface InviteView {
  linkToken: string;
  joinCode: string;
  autoAccept: boolean;
  active: boolean;
}

/** 8-stelliger, gut lesbarer Beitrittscode (keine mehrdeutigen Zeichen). */
function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

function generateLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

function toView(i: {
  linkToken: string;
  joinCode: string;
  autoAccept: boolean;
  active: boolean;
}): InviteView {
  return {
    linkToken: i.linkToken,
    joinCode: i.joinCode,
    autoAccept: i.autoAccept,
    active: i.active,
  };
}

// ── tenant_admin (tenant-scoped) ────────────────────────────────────────────

/** Aktiven Invite des aktiven Tenants holen — oder anlegen (idempotenter Einstieg). */
export async function getOrCreateInvite(principal: Principal): Promise<InviteView> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const active = await db.tenantInvite.findFirst({
    where: { tenantId: principal.tenantId, active: true },
  });
  if (active) return toView(active);

  const created = await db.tenantInvite.create({
    data: {
      tenantId: principal.tenantId,
      linkToken: generateLinkToken(),
      joinCode: generateJoinCode(),
      createdBy: principal.id,
    },
  });
  return toView(created);
}

/** Invite rotieren: aktiven deaktivieren, frischen anlegen. */
export async function rotateInvite(principal: Principal): Promise<ServiceOutcome<InviteView>> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const invite = await db.$transaction(async (tx) => {
    await tx.tenantInvite.updateMany({
      where: { tenantId: principal.tenantId, active: true },
      data: { active: false },
    });
    const created = await tx.tenantInvite.create({
      data: {
        tenantId: principal.tenantId,
        linkToken: generateLinkToken(),
        joinCode: generateJoinCode(),
        createdBy: principal.id,
      },
    });
    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "invite.rotated",
      resourceType: "tenant_invite",
      resourceId: created.id,
    });
    return created;
  });
  return { ok: true, ...toView(invite) };
}

/** Invite deaktivieren (Link/Code werden ungültig). */
export async function deactivateInvite(principal: Principal): Promise<ServiceOutcome> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const active = await db.tenantInvite.findFirst({
    where: { tenantId: principal.tenantId, active: true },
    select: { id: true },
  });
  if (!active) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.tenantInvite.update({ where: { id: active.id }, data: { active: false } });
    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "invite.deactivated",
      resourceType: "tenant_invite",
      resourceId: active.id,
    });
  });
  return { ok: true };
}

/** autoAccept des aktiven Invite umschalten (sofort-Beitritt vs. Genehmigung). */
export async function setInviteAutoAccept(
  principal: Principal,
  autoAccept: boolean,
): Promise<ServiceOutcome<InviteView>> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const active = await db.tenantInvite.findFirst({
    where: { tenantId: principal.tenantId, active: true },
  });
  if (!active) return { ok: false, error: "Kein aktiver Einladungslink" };
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.tenantInvite.update({
      where: { id: active.id },
      data: { autoAccept },
    });
    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "invite.auto_accept.set",
      resourceType: "tenant_invite",
      resourceId: active.id,
      changes: { autoAccept: { before: active.autoAccept, after: autoAccept } },
    });
    return u;
  });
  return { ok: true, ...toView(updated) };
}

/**
 * Offene Beitritts-Anfrage entscheiden (tenant_admin, tenant-scoped). Genehmigen:
 * existiert der Account, direkt `viewer`-Assignment; sonst gezielte JWT-Einladung.
 * Guard: die Anfrage muss zum aktiven Tenant des Actors gehören.
 */
export async function decideJoinRequest(
  principal: Principal,
  requestId: string,
  approve: boolean,
): Promise<ServiceOutcome> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const req = await db.tenantJoinRequest.findFirst({
    where: { id: requestId, tenantId: principal.tenantId, status: "pending" },
  });
  if (!req) return { ok: false, error: "Anfrage nicht gefunden" };

  if (!approve) {
    await db.$transaction(async (tx) => {
      await tx.tenantJoinRequest.update({
        where: { id: req.id },
        data: { status: "rejected", decidedBy: principal.id, decidedAt: new Date() },
      });
      await emitAuditEvent(tx, {
        tenantId: principal.tenantId,
        actorId: principal.id,
        action: "join_request.rejected",
        resourceType: "tenant_join_request",
        resourceId: req.id,
        changes: { email: { before: req.email, after: req.email } },
      });
    });
    return { ok: true };
  }

  const userId = req.userId ?? (await findUserIdByEmail(req.email));
  const tenant = await db.tenant.findUnique({
    where: { id: principal.tenantId },
    select: { name: true },
  });

  await db.$transaction(async (tx) => {
    if (userId) {
      const dupe = await tx.userRoleAssignment.findFirst({
        where: { tenantId: principal.tenantId, userId, role: JOIN_ROLE },
        select: { id: true },
      });
      if (!dupe) {
        const a = await tx.userRoleAssignment.create({
          data: {
            userId,
            tenantId: principal.tenantId,
            role: JOIN_ROLE,
            valueStreamIds: [],
            artIds: [],
            teamIds: [],
          },
        });
        await emitAuditEvent(tx, {
          tenantId: principal.tenantId,
          actorId: principal.id,
          action: "user.role.assigned",
          resourceType: "user_role_assignment",
          resourceId: a.id,
          changes: {
            role: { before: null, after: JOIN_ROLE },
            email: { before: null, after: req.email },
          },
        });
      }
    } else {
      // Kein Konto → gezielte Einladung (wie createOrgTenant für unbekannte User).
      const token = await signInviteToken({
        email: req.email,
        tenantId: principal.tenantId,
        role: JOIN_ROLE,
      });
      await publishDomainEvent(tx, {
        type: "user.invited",
        tenantId: principal.tenantId,
        actorId: principal.id,
        inviteeEmail: req.email,
        inviterEmail: principal.email,
        tenantName: tenant?.name ?? "",
        role: JOIN_ROLE,
        locale: "de",
        token,
      });
    }
    await tx.tenantJoinRequest.update({
      where: { id: req.id },
      data: { status: "approved", decidedBy: principal.id, decidedAt: new Date() },
    });
    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "join_request.approved",
      resourceType: "tenant_join_request",
      resourceId: req.id,
      changes: { email: { before: null, after: req.email } },
    });
  });
  return { ok: true };
}

// ── öffentlich (kein Auth) ──────────────────────────────────────────────────

export interface SubmitJoinInput {
  token?: string;
  code?: string;
  email: string;
}

/**
 * Öffentlicher Beitritts-Antrag über Link-Token oder Code. `autoAccept` +
 * existierender Account ⇒ sofortiges `viewer`-Assignment (Anfrage direkt
 * `approved`); sonst `pending` für den tenant_admin. Läuft ohne Principal
 * (Bootstrap-Client). `pending`-Duplikate werden zusammengefasst.
 */
export async function submitJoinRequest(
  input: SubmitJoinInput,
): Promise<ServiceOutcome<{ autoAccepted: boolean }>> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "E-Mail fehlt" };

  const db = createPrismaClient({ userId: "" as UserId, tenantId: "" as TenantId });
  const invite = await db.tenantInvite.findFirst({
    where: {
      active: true,
      ...(input.token ? { linkToken: input.token } : {}),
      ...(input.code ? { joinCode: input.code.trim().toUpperCase() } : {}),
    },
  });
  if (!invite) return { ok: false, error: "Ungültiger oder deaktivierter Einladungslink" };

  const via = input.token ? "link" : "code";
  const userId = await findUserIdByEmail(email);

  // Bereits Mitglied?
  if (userId) {
    const member = await db.userRoleAssignment.findFirst({
      where: { tenantId: invite.tenantId, userId },
      select: { id: true },
    });
    if (member) return { ok: false, error: "Du bist bereits Mitglied dieses Bereichs" };
  }

  // Schon eine offene Anfrage?
  const pending = await db.tenantJoinRequest.findFirst({
    where: { tenantId: invite.tenantId, email, status: "pending" },
    select: { id: true },
  });
  if (pending) return { ok: true, autoAccepted: false };

  if (invite.autoAccept && userId) {
    await db.$transaction(async (tx) => {
      const dupe = await tx.userRoleAssignment.findFirst({
        where: { tenantId: invite.tenantId, userId, role: JOIN_ROLE },
        select: { id: true },
      });
      if (!dupe) {
        await tx.userRoleAssignment.create({
          data: {
            userId,
            tenantId: invite.tenantId,
            role: JOIN_ROLE,
            valueStreamIds: [],
            artIds: [],
            teamIds: [],
          },
        });
      }
      await tx.tenantJoinRequest.create({
        data: {
          tenantId: invite.tenantId,
          email,
          userId,
          via,
          status: "approved",
          decidedAt: new Date(),
        },
      });
      await emitAuditEvent(tx, {
        tenantId: invite.tenantId as TenantId,
        actorId: userId as UserId,
        action: "join_request.approved",
        resourceType: "tenant_join_request",
        resourceId: invite.tenantId,
        changes: { email: { before: null, after: email }, via: { before: null, after: via } },
      });
    });
    return { ok: true, autoAccepted: true };
  }

  await db.tenantJoinRequest.create({
    data: {
      tenantId: invite.tenantId,
      email,
      ...(userId ? { userId } : {}),
      via,
      status: "pending",
    },
  });
  return { ok: true, autoAccepted: false };
}

/** Öffentliche Tenant-Kurzinfo für die Join-Seite (Name), per Token oder Code. */
export async function resolveInviteTarget(opts: {
  token?: string;
  code?: string;
}): Promise<{ tenantName: string } | null> {
  const db = createPrismaClient({ userId: "" as UserId, tenantId: "" as TenantId });
  const invite = await db.tenantInvite.findFirst({
    where: {
      active: true,
      ...(opts.token ? { linkToken: opts.token } : {}),
      ...(opts.code ? { joinCode: opts.code.trim().toUpperCase() } : {}),
    },
    select: { tenantId: true },
  });
  if (!invite) return null;
  const tenant = await db.tenant.findUnique({
    where: { id: invite.tenantId },
    select: { name: true },
  });
  return tenant ? { tenantName: tenant.name } : null;
}
