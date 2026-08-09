import type { Principal } from "@/server/auth/principal";
import type { TenantId } from "@/domain/types";
import { platformDb, assertPlatformAdmin } from "@/server/auth/platform";
import { createPrismaClient } from "@/server/db/prisma";
import { emitAuditEvent } from "@/server/audit/emit";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { createOrgTenant, type ServiceOutcome } from "@/server/services/platform-tenant";
import type { UserId } from "@/domain/types";

/**
 * Öffentliche Provisioning-Anträge für neue Organisationen (Roadmap P6). Ein
 * Interessent stellt via `/request-tenant` (kein Auth) einen Antrag; der
 * platform_admin genehmigt ihn im „Tenant-Anfragen"-Tab — approve legt den
 * Tenant via `createOrgTenant` an (inkl. Einladung des Antragstellers als
 * tenant_admin).
 */

export interface SubmitProvisionInput {
  email: string;
  desiredName: string;
  note?: string;
}

/** Öffentlicher Antrag (kein Auth) — legt eine pending-Zeile an. */
export async function submitProvisionRequest(input: SubmitProvisionInput): Promise<ServiceOutcome> {
  const email = input.email.trim().toLowerCase();
  const desiredName = input.desiredName.trim();
  if (!email || desiredName.length < 2) return { ok: false, error: "Ungültige Eingabe" };

  const db = createPrismaClient({ userId: "" as UserId, tenantId: "" as TenantId });
  const pending = await db.tenantProvisionRequest.findFirst({
    where: { email, status: "pending" },
    select: { id: true },
  });
  if (pending) return { ok: true };

  await db.tenantProvisionRequest.create({
    data: {
      email,
      desiredName,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    },
  });
  return { ok: true };
}

/**
 * Antrag entscheiden (platform_admin). Genehmigen: `createOrgTenant` (alle
 * Module, Antragsteller als tenant_admin) + Antrag als approved markieren mit
 * `createdTenantId`. Ablehnen: nur Status setzen.
 */
export async function decideProvisionRequest(
  actor: Principal,
  requestId: string,
  approve: boolean,
): Promise<ServiceOutcome<{ tenantId?: string }>> {
  assertPlatformAdmin(actor);
  const db = platformDb(actor.id);

  const req = await db.tenantProvisionRequest.findFirst({
    where: { id: requestId, status: "pending" },
  });
  if (!req) return { ok: false, error: "Antrag nicht gefunden" };

  if (!approve) {
    await db.$transaction(async (tx) => {
      await tx.tenantProvisionRequest.update({
        where: { id: req.id },
        data: { status: "rejected", decidedBy: actor.id, decidedAt: new Date() },
      });
      await emitAuditEvent(tx, {
        tenantId: actor.tenantId,
        actorId: actor.id,
        action: "provision_request.rejected",
        resourceType: "tenant_provision_request",
        resourceId: req.id,
        changes: { email: { before: req.email, after: req.email } },
      });
    });
    return { ok: true };
  }

  // Tenant anlegen (inkl. Einladung/Assignment des Antragstellers).
  const created = await createOrgTenant(actor, {
    name: req.desiredName,
    region: "eu",
    enabledModules: [...MODULE_KEYS],
    adminEmail: req.email,
  });
  if (!created.ok) return created;

  await db.$transaction(async (tx) => {
    await tx.tenantProvisionRequest.update({
      where: { id: req.id },
      data: {
        status: "approved",
        decidedBy: actor.id,
        decidedAt: new Date(),
        createdTenantId: created.tenantId,
      },
    });
    await emitAuditEvent(tx, {
      tenantId: created.tenantId as TenantId,
      actorId: actor.id,
      action: "provision_request.approved",
      resourceType: "tenant_provision_request",
      resourceId: req.id,
      changes: {
        email: { before: null, after: req.email },
        tenant: { before: null, after: created.tenantId },
      },
    });
  });
  return { ok: true, tenantId: created.tenantId };
}

export interface ProvisionRequestRow {
  id: string;
  email: string;
  desiredName: string;
  note: string | null;
  status: string;
  createdAt: string;
  createdTenantId: string | null;
}

/** Alle Provisioning-Anträge (Platform-Tab) — pending zuerst. */
export async function listProvisionRequests(
  db: ReturnType<typeof platformDb>,
): Promise<ProvisionRequestRow[]> {
  const rows = await db.tenantProvisionRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    desiredName: r.desiredName,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString().slice(0, 10),
    createdTenantId: r.createdTenantId,
  }));
}
