"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { emitAuditEvent, extractRequestMeta } from "@/server/audit/emit";
import { ALL_ROLES } from "@/modules/core/kernel/domain/roles";
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

  // Änderung und Protokoll in **einem** Vorgang: vorher standen sie
  // nacheinander, und wenn das Protokoll scheiterte, galt die Zuweisung
  // trotzdem — die Fläche zeigte einen Fehler über einer gesetzten Rolle.
  await db.$transaction(async (tx) => {
    const before = await tx.roleCapability.findUnique({
      where: { tenantId_role_action: { tenantId: principal.tenantId, role, action } },
      select: { scope: true },
    });
    const row = await tx.roleCapability.upsert({
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

    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "role.capability.granted",
      resourceType: "role_capability",
      // Die Zeile selbst — `resource_id` ist eine uuid-Spalte. Wer die
      // Zuweisung sucht, findet sie über `changes`.
      resourceId: row.id,
      changes: {
        role: { before: before ? role : null, after: role },
        action: { before: before ? action : null, after: action },
        scope: { before: before?.scope ?? null, after: scope },
      },
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    });
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

  await db.$transaction(async (tx) => {
    // Erst lesen, dann löschen: das Protokoll braucht die Id der Zeile, und
    // nach dem Löschen gibt es sie nicht mehr.
    const row = await tx.roleCapability.findUnique({
      where: { tenantId_role_action: { tenantId: principal.tenantId, role, action } },
      select: { id: true, scope: true },
    });
    if (!row) return; // Nichts zu entziehen — wie bisher stiller Erfolg.

    await tx.roleCapability.delete({ where: { id: row.id } });

    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "role.capability.revoked",
      resourceType: "role_capability",
      resourceId: row.id,
      changes: {
        role: { before: role, after: null },
        action: { before: action, after: null },
        scope: { before: row.scope, after: null },
      },
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    });
  });

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

  // Transaktion: weg mit allen aktuellen, rein mit allen Defaults — und das
  // Protokoll gehört mit hinein, nicht dahinter.
  await db.$transaction(async (tx) => {
    const removed = await tx.roleCapability.deleteMany({
      where: { tenantId: principal.tenantId, role },
    });
    await tx.roleCapability.createMany({
      data: defaults.map((t) => ({
        tenantId: principal.tenantId,
        role: t.role,
        action: t.action,
        scope: t.scope as ScopeCheck | null,
        createdBy: principal.id,
      })),
    });

    await emitAuditEvent(tx, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      action: "role.capability.reset",
      resourceType: "role",
      // Eine Rolle ist keine Zeile — wie `budget_defaults` und `risk_settings`
      // trägt das Ereignis die Mandanten-Id; welche Rolle, sagt `changes`.
      resourceId: principal.tenantId,
      changes: {
        role: { before: role, after: role },
        capabilityCount: { before: removed.count, after: defaults.length },
      },
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    });
  });

  revalidatePath("/admin/roles");
  return { success: true };
}
