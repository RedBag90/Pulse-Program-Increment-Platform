"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/platform";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import {
  createOrgTenant,
  setTenantModules,
  addTenantMember,
  removeTenantMember,
  setTenantStatus,
  deleteTenant,
} from "@/server/services/platform-tenant";

/**
 * Server-Actions des Plattform-Tenants-Tabs. Bewusst KEIN `createServerAction`
 * (dessen Factory autorisiert gegen den aktiven Tenant) — hier wird
 * tenant-übergreifend gearbeitet, der Wächter ist `requirePlatformAdmin`
 * (globale, tenant-blinde Rolle). Danach delegieren sie an die
 * `platform-tenant`-Services (Audit gegen Ziel-Tenant).
 */

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Bei Anlage: Id des neuen Tenants (für Navigation); bei Einladung: Hinweis. */
  tenantId?: string;
  invited?: boolean;
}

const moduleKeySchema = z.enum(MODULE_KEYS as unknown as [string, ...string[]]);
const roleSchema = z.enum(Object.values(ROLES) as [Role, ...Role[]]);

export async function createTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Name zu kurz"),
      region: z.enum(["eu", "us", "apac"]),
      adminEmail: z.string().email("Ungültige E-Mail"),
      modules: z.array(moduleKeySchema),
    })
    .safeParse({
      name: formData.get("name"),
      region: formData.get("region"),
      adminEmail: formData.get("adminEmail"),
      modules: formData.getAll("modules"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const actor = await requirePlatformAdmin();
  const res = await createOrgTenant(actor, {
    name: parsed.data.name,
    region: parsed.data.region,
    enabledModules: parsed.data.modules,
    adminEmail: parsed.data.adminEmail,
  });
  if (!res.ok) return { error: res.error };
  return { success: true, tenantId: res.tenantId, invited: res.invited };
}

export async function setTenantModulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ tenantId: z.string().uuid(), modules: z.array(moduleKeySchema) })
    .safeParse({
      tenantId: formData.get("tenantId"),
      modules: formData.getAll("modules"),
    });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await setTenantModules(actor, parsed.data.tenantId, parsed.data.modules);
  if (!res.ok) return { error: res.error };
  return { success: true };
}

export async function addTenantMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      tenantId: z.string().uuid(),
      email: z.string().email("Ungültige E-Mail"),
      role: roleSchema,
    })
    .safeParse({
      tenantId: formData.get("tenantId"),
      email: formData.get("email"),
      role: formData.get("role"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const actor = await requirePlatformAdmin();
  const res = await addTenantMember(
    actor,
    parsed.data.tenantId,
    parsed.data.email,
    parsed.data.role,
  );
  if (!res.ok) return { error: res.error };
  return { success: true, invited: res.invited };
}

export async function removeTenantMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ tenantId: z.string().uuid(), assignmentId: z.string().uuid() })
    .safeParse({
      tenantId: formData.get("tenantId"),
      assignmentId: formData.get("assignmentId"),
    });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await removeTenantMember(actor, parsed.data.tenantId, parsed.data.assignmentId);
  if (!res.ok) return { error: res.error };
  return { success: true };
}

export async function setTenantStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      tenantId: z.string().uuid(),
      status: z.enum(["active", "suspended", "archived"]),
    })
    .safeParse({
      tenantId: formData.get("tenantId"),
      status: formData.get("status"),
    });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await setTenantStatus(actor, parsed.data.tenantId, parsed.data.status);
  if (!res.ok) return { error: res.error };
  return { success: true };
}

export async function deleteTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ tenantId: z.string().uuid() })
    .safeParse({ tenantId: formData.get("tenantId") });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await deleteTenant(actor, parsed.data.tenantId);
  if (!res.ok) return { error: res.error };
  return { success: true };
}
