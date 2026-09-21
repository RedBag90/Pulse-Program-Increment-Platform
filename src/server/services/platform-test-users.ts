import { randomBytes } from "node:crypto";
import { ROLES, ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import type { Principal } from "@/server/auth/principal";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { platformDb, assertPlatformAdmin } from "@/server/auth/platform";
import { emitAuditEvent } from "@/server/audit/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceOutcome } from "@/server/services/platform-tenant";

/**
 * **Testnutzer für einen Mandanten erzeugen — echte Konten, keine Karteileichen.**
 *
 * Bis September 2026 gab es dafür genau einen Weg: `scripts/seed-test-accounts.mjs`,
 * das zwölf feste `@pulse.dev`-Konten in einen **fest verdrahteten** Mandanten
 * legt. Wer einen zweiten Mandanten zum Testen wollte, hatte keine Möglichkeit —
 * und jedes dieser Konten ist global, also in allen Mandanten dasselbe.
 *
 * **Warum echte Supabase-Konten und nicht nur Rollenzeilen:** eine Zeile in
 * `user_role_assignments` mit erfundener `userId` füllt Listen und Zähler, aber
 * niemand kann sich damit anmelden. Getestet wäre dann die Darstellung, nicht
 * das Produkt.
 */

/** `platform_admin` ist hier nicht wählbar — dieselbe Sperre wie in `addTenantMember`. */
export const TEST_USER_ROLES: readonly Role[] = ALL_ROLES.filter((r) => r !== ROLES.PLATFORM_ADMIN);

/**
 * Obergrenze je Lauf. Nicht aus Sorge um die Datenbank, sondern weil jedes Konto
 * ein Rundlauf zur Supabase-Admin-API ist: fünfzig dauern schon spürbar, und ein
 * vertipptes Feld soll keine Viertelstunde blockieren.
 */
export const MAX_TEST_USERS = 50;

export interface GeneratedUser {
  userId: string;
  email: string;
  role: Role;
}

export interface GenerateResult {
  users: GeneratedUser[];
  /**
   * **Einmal und nie wieder.** Supabase speichert nur den Hash; die Fläche zeigt
   * das Passwort nach dem Anlegen und kann es danach nicht erneut beschaffen.
   */
  password: string;
}

/** „Large Test Corp" → `large-test-corp`. Für die E-Mail-Domäne. */
export function tenantSlug(name: string): string {
  const umlaute: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => umlaute[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "mandant";
}

/** `value_stream_owner` → `value-stream-owner`; Unterstriche taugen nicht in jeder Adresse. */
const roleSlug = (role: Role) => role.replace(/_/g, "-");

/**
 * Ein Passwort je Lauf, nicht je Konto: wer acht Testnutzer anlegt, will sich
 * **eines** merken. Zufällig statt fest, damit ein erzeugter Mandant nicht mit
 * einem im Repo stehenden Passwort offen im Netz steht.
 */
function generatePassword(): string {
  return `Test-${randomBytes(9).toString("base64url")}`;
}

export interface GenerateInput {
  /** Anzahl je Rolle. Fehlende Rollen zählen als 0. */
  counts: Partial<Record<Role, number>>;
}

/**
 * Legt die Konten an und weist ihnen im Zielmandanten ihre Rolle zu.
 *
 * **Die Scopes bleiben leer**, und das ist eine Aussage: `memberOrVacuous` liest
 * eine leere Liste als „alles in Reichweite". Ein Testnutzer soll den ganzen
 * Mandanten sehen; wer eine ART-Eingrenzung testen will, trägt sie in der
 * Rollenverwaltung nach.
 *
 * **Kein „Mein Bereich" hier.** Der entsteht wie bei jedem Nutzer beim ersten
 * Aufruf von `/start` (`ensurePersonalTenant`) — ihn vorwegzunehmen hiesse, den
 * Anmeldeweg anders zu testen als er ist.
 *
 * Fehlschläge einzelner Konten brechen den Lauf **nicht** ab: was steht, steht,
 * und die Fläche bekommt beides zu sehen. Ein halber Mandant ist brauchbarer als
 * gar keiner, solange er sich als halber zu erkennen gibt.
 */
export async function generateTestUsers(
  actor: Principal,
  tenantId: string,
  input: GenerateInput,
): Promise<ServiceOutcome<GenerateResult & { failed: string[] }>> {
  assertPlatformAdmin(actor);

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, kind: true },
  });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };
  if (tenant.kind === "personal") {
    return { ok: false, error: "In private Bereiche werden keine Testnutzer gelegt" };
  }

  const gewuenscht = TEST_USER_ROLES.flatMap((role) =>
    Array.from({ length: Math.max(0, Math.trunc(input.counts[role] ?? 0)) }, () => role),
  );
  if (gewuenscht.length === 0) return { ok: false, error: "Keine Testnutzer angefordert" };
  if (gewuenscht.length > MAX_TEST_USERS) {
    return { ok: false, error: `Höchstens ${MAX_TEST_USERS} Testnutzer je Lauf` };
  }
  if (input.counts[ROLES.PLATFORM_ADMIN]) {
    return { ok: false, error: "Plattform-Admins werden nicht als Testnutzer angelegt" };
  }

  const slug = tenantSlug(tenant.name);
  const password = generatePassword();
  const admin = createAdminClient();
  const users: GeneratedUser[] = [];
  const failed: string[] = [];

  // Laufende Nummer **je Rolle**, damit `rte-1` und `rte-2` entstehen und nicht
  // `rte-1` und `rte-4`.
  const zaehler = new Map<Role, number>();

  for (const role of gewuenscht) {
    let n = (zaehler.get(role) ?? 0) + 1;
    let angelegt: { id: string; email: string } | null = null;

    // Eine Adresse kann schon vergeben sein — etwa weil derselbe Mandantenname
    // zweimal existiert (`Tenant.name` hat kein `@unique`). Dann hochzaehlen
    // statt scheitern.
    for (let versuch = 0; versuch < 20 && !angelegt; versuch++, n++) {
      const email = `${roleSlug(role)}-${n}@${slug}.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (!error && data.user) {
        angelegt = { id: data.user.id, email };
      } else if (!/already been registered|already exists/i.test(error?.message ?? "")) {
        failed.push(`${email}: ${error?.message ?? "unbekannter Fehler"}`);
        break;
      }
    }
    zaehler.set(role, n);
    if (!angelegt) continue;

    await db.userRoleAssignment.create({
      data: {
        userId: angelegt.id,
        tenantId,
        role,
        valueStreamIds: [],
        artIds: [],
        teamIds: [],
      },
    });
    users.push({ userId: angelegt.id, email: angelegt.email, role });
  }

  if (users.length > 0) {
    await emitAuditEvent(db, {
      tenantId: tenantId as TenantId,
      actorId: actor.id,
      action: "user.role.assigned",
      resourceType: "user_role_assignment",
      resourceId: tenantId,
      changes: {
        testUsers: { before: null, after: users.map((u) => `${u.role}:${u.email}`).join(", ") },
      },
    });
  }

  return { ok: true, users, password, failed };
}
