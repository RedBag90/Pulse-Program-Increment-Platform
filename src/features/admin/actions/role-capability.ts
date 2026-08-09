"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import { ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import { enumerateDefaultCapabilities, type Action, type ScopeCheck } from "@/server/auth/policies";

const ROLE_SET = new Set<string>(ALL_ROLES);
const SCOPE_SET = new Set<string>(["value_stream", "art", "team", "own"]);
const ACTION_SET = new Set<string>(enumerateDefaultCapabilities().map((t) => t.action));
// `role.capability.manage` und `tenant.create` sind keine echten Actions im
// Bundle aus POLICIES (tenant.create hat einen leeren Grants-Array), aber
// trotzdem zuweisbar. Wir nehmen sie für die Validierung mit auf.
ACTION_SET.add("role.capability.manage");
ACTION_SET.add("tenant.create");

const TENANT_CREATE_LOCK: Action = "tenant.create";

export type RoleCapabilityActionState = {
  error?: string;
  success?: boolean;
};

/**
 * Setzt eine Capability für eine Rolle (mit optionalem Scope). Idempotent —
 * doppeltes Setzen aktualisiert nur den Scope. `tenant.create` ist
 * hartkodiert auf `platform_admin` und kann hier nicht überschrieben werden.
 */
export async function setRoleCapabilityAction(
  _prev: RoleCapabilityActionState,
  fd: FormData,
): Promise<RoleCapabilityActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Nicht authentifiziert" };

  if (!authorize("role.capability.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Keine Berechtigung für Rollenverwaltung" };
  }

  const parsed = z
    .object({
      role: z.string().refine((r) => ROLE_SET.has(r), { message: "Unbekannte Rolle" }),
      action: z
        .string()
        .refine((a) => ACTION_SET.has(a), { message: "Unbekannte Capability" })
        .refine((a) => a !== TENANT_CREATE_LOCK, {
          message: "tenant.create ist platform-admin-only und nicht zuweisbar",
        }),
      scope: z
        .string()
        .nullable()
        .optional()
        .transform((v) => (v && SCOPE_SET.has(v) ? v : null)),
    })
    .safeParse({
      role: fd.get("role"),
      action: fd.get("action"),
      scope: fd.get("scope"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }

  const { role, action, scope } = parsed.data;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());

  await db.roleCapability.upsert({
    where: { tenantId_role_action: { tenantId: principal.tenantId, role, action } },
    update: { scope },
    create: {
      tenantId: principal.tenantId,
      role,
      action,
      scope,
      createdBy: principal.id,
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "role.capability.granted",
      resourceType: "role_capability",
      resourceId: `${role}:${action}`,
      changes: { role, action, scope },
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    },
  });

  revalidatePath("/admin/roles");
  return { success: true };
}

/** Entzieht eine Capability einer Rolle. */
export async function removeRoleCapabilityAction(
  _prev: RoleCapabilityActionState,
  fd: FormData,
): Promise<RoleCapabilityActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Nicht authentifiziert" };

  if (!authorize("role.capability.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Keine Berechtigung für Rollenverwaltung" };
  }

  const role = String(fd.get("role") ?? "");
  const action = String(fd.get("action") ?? "");
  if (!ROLE_SET.has(role) || !ACTION_SET.has(action)) {
    return { error: "Ungültige Rolle oder Capability" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());

  // deleteMany statt delete — kein Fehler, wenn die Row nicht existiert.
  const res = await db.roleCapability.deleteMany({
    where: { tenantId: principal.tenantId, role, action },
  });

  if (res.count > 0) {
    await db.auditEvent.create({
      data: {
        tenantId: principal.tenantId,
        actorId: principal.id,
        action: "role.capability.revoked",
        resourceType: "role_capability",
        resourceId: `${role}:${action}`,
        changes: { role, action },
        ...(ipAddress !== undefined && { ipAddress }),
        ...(userAgent !== undefined && { userAgent }),
      },
    });
  }

  revalidatePath("/admin/roles");
  return { success: true };
}

/**
 * Stellt eine Rolle auf das Default-Bundle aus `POLICIES` zurück. Löscht alle
 * Tenant-Anpassungen und ersetzt sie durch die Defaults. Schreibt einen
 * Audit-Event mit der Anzahl betroffener Capabilities.
 */
export async function resetRoleToDefaultAction(
  _prev: RoleCapabilityActionState,
  fd: FormData,
): Promise<RoleCapabilityActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Nicht authentifiziert" };

  if (!authorize("role.capability.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Keine Berechtigung für Rollenverwaltung" };
  }

  const role = String(fd.get("role") ?? "");
  if (!ROLE_SET.has(role)) return { error: "Unbekannte Rolle" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());

  const defaults = enumerateDefaultCapabilities().filter((t) => t.role === role);

  // Transaktion: weg mit allen aktuellen, rein mit allen Defaults.
  await db.$transaction([
    db.roleCapability.deleteMany({
      where: { tenantId: principal.tenantId, role },
    }),
    ...defaults.map((t) =>
      db.roleCapability.create({
        data: {
          tenantId: principal.tenantId,
          role: t.role,
          action: t.action,
          scope: t.scope as ScopeCheck | null,
          createdBy: principal.id,
        },
      }),
    ),
  ]);

  await db.auditEvent.create({
    data: {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "role.capability.reset",
      resourceType: "role",
      resourceId: role as Role,
      changes: { role, restoredCount: defaults.length },
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    },
  });

  revalidatePath("/admin/roles");
  return { success: true };
}
