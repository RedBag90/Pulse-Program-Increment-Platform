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
  deleteTenantWithData,
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
  /**
   * **Die Zugangsdaten der erzeugten Testnutzer — einmalig.** Supabase speichert
   * nur den Hash; was hier nicht ankommt, ist nicht mehr zu beschaffen. Die
   * Fläche zeigt es deshalb prominent und sagt dazu, dass es nicht wiederkommt.
   */
  testUsers?: { email: string; role: string }[];
  testUserPassword?: string;
  /** Was beim Anlegen nicht geklappt hat — der Mandant steht trotzdem. */
  warnings?: string[];
}

import { SEED_PROFILES, type SeedProfile } from "../../../../prisma/seed-profile-meta";
import { seedTenant, resetTenant } from "@/server/services/platform-tenant-seed";
import {
  generateTestUsers,
  MAX_TEST_USERS,
  type GeneratedUser,
} from "@/server/services/platform-test-users";

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
      seedProfile: z.enum(SEED_PROFILES as unknown as [string, ...string[]]),
      /** Eine Zahl je Rolle, als `testUsers.<rolle>` im Formular. */
      counts: z.record(z.string(), z.number().int().min(0).max(MAX_TEST_USERS)),
    })
    .safeParse({
      name: formData.get("name"),
      region: formData.get("region"),
      adminEmail: formData.get("adminEmail"),
      modules: formData.getAll("modules"),
      seedProfile: formData.get("seedProfile") ?? "none",
      counts: leseAnzahlen(formData),
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

  // Reihenfolge: erst die Nutzer, dann der Datensatz — der Seeder besetzt seine
  // Figuren mit ihnen. Umgekehrt stünde der Mandanten-Admin an jeder Stelle.
  const warnings: string[] = [];
  let erzeugt: GeneratedUser[] = [];
  let passwort: string | undefined;

  const gesamt = Object.values(parsed.data.counts).reduce((a, b) => a + b, 0);
  if (gesamt > 0) {
    const users = await generateTestUsers(actor, res.tenantId, {
      counts: parsed.data.counts as Partial<Record<Role, number>>,
    });
    if (users.ok) {
      erzeugt = users.users;
      passwort = users.password;
      warnings.push(...users.failed);
    } else {
      warnings.push(`Testnutzer: ${users.error}`);
    }
  }

  if (parsed.data.seedProfile !== "none") {
    const seeded = await seedTenant(actor, res.tenantId, {
      profile: parsed.data.seedProfile as SeedProfile,
      users: erzeugt,
    });
    // **Der Mandant bleibt stehen, auch wenn der Datensatz scheitert.** Ihn
    // wieder zu löschen hiesse, den erfolgreichen Teil rückgängig zu machen —
    // und das Anlegen ist der teurere Schritt (Konten, Einladung).
    if (!seeded.ok) warnings.push(`Datensatz: ${seeded.error}`);
  }

  return {
    success: true,
    tenantId: res.tenantId,
    invited: res.invited,
    ...(erzeugt.length > 0 && {
      testUsers: erzeugt.map((u) => ({ email: u.email, role: u.role })),
    }),
    ...(passwort !== undefined && { testUserPassword: passwort }),
    ...(warnings.length > 0 && { warnings }),
  };
}

/**
 * Liest die Zahlenfelder `testUsers.<rolle>` aus dem Formular.
 *
 * Leere Felder zählen als 0 statt als Fehler — ein Formular mit acht
 * Rollenzeilen, von denen man zwei ausfüllt, ist der Normalfall.
 */
function leseAnzahlen(formData: FormData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("testUsers.")) continue;
    const n = Number.parseInt(String(value), 10);
    if (Number.isFinite(n) && n > 0) counts[key.slice("testUsers.".length)] = n;
  }
  return counts;
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

/**
 * **Löschen samt Inhalt.** Der abgetippte Name wird hier **erneut** geprüft
 * (im Dienst), nicht nur im Browser: diese Action ist ein Endpunkt, der Knopf
 * davor nur eine Schaltfläche.
 */
export async function deleteTenantWithDataAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      tenantId: z.string().uuid(),
      confirmName: z.string().min(1, "Bitte den Mandantennamen eingeben"),
      alsoDeleteUsers: z.boolean(),
    })
    .safeParse({
      tenantId: formData.get("tenantId"),
      confirmName: formData.get("confirmName"),
      alsoDeleteUsers: formData.get("alsoDeleteUsers") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await deleteTenantWithData(actor, parsed.data.tenantId, {
    confirmName: parsed.data.confirmName,
    alsoDeleteUsers: parsed.data.alsoDeleteUsers,
  });
  if (!res.ok) return { error: res.error };

  const warnings: string[] = [];
  if (res.keptUsers.length > 0) {
    warnings.push(
      `${res.keptUsers.length} Konto/Konten blieben stehen — sie sind noch in anderen Mandanten.`,
    );
  }
  if (res.failedUsers.length > 0) {
    warnings.push(`${res.failedUsers.length} Konto/Konten konnten nicht gelöscht werden.`);
  }
  return { success: true, ...(warnings.length > 0 && { warnings }) };
}

/**
 * **Zurücksetzen:** räumen und neu säen, ohne den Mandanten zu löschen. Der
 * Griff, den man beim Testen am häufigsten braucht.
 */
export async function resetTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      tenantId: z.string().uuid(),
      confirmName: z.string().min(1, "Bitte den Mandantennamen eingeben"),
      seedProfile: z.enum(SEED_PROFILES as unknown as [string, ...string[]]),
    })
    .safeParse({
      tenantId: formData.get("tenantId"),
      confirmName: formData.get("confirmName"),
      seedProfile: formData.get("seedProfile") ?? "none",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await resetTenant(actor, parsed.data.tenantId, {
    confirmName: parsed.data.confirmName,
    profile: parsed.data.seedProfile as SeedProfile,
  });
  if (!res.ok) return { error: res.error };
  return { success: true };
}
