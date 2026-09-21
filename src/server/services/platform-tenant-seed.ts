import { ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import type { Principal } from "@/server/auth/principal";
import { platformDb, assertPlatformAdmin } from "@/server/auth/platform";
import { wipeTenantData } from "@/server/services/tenant-teardown";
import type { ServiceOutcome } from "@/server/services/platform-tenant";
import type { GeneratedUser } from "@/server/services/platform-test-users";
import { uidFor } from "../../../prisma/seed-ids";
import { fillSeedUsers, type SeedUserHandle } from "../../../prisma/seed-context";
import { seedProfileDef, type SeedProfile } from "../../../prisma/seed-profiles";

/**
 * **Einen Mandanten mit einem der Seed-Datensätze füllen — aus der Anwendung
 * heraus, nicht von der Kommandozeile.**
 *
 * Möglich ist das erst, seit die Seeder ihren Mandanten, ihre Id-Regel und ihren
 * Prisma-Client als Parameter bekommen (`prisma/seed-context.ts`) und die
 * Kommandozeilen-Hälfte in eigenen `*.cli.ts`-Dateien liegt. Ein Riegel hält
 * das fest: `prisma/__tests__/seed-profiles-importierbar.test.ts`.
 *
 * **Der Namensraum ist die Mandanten-Id.** `uid("vs:digital-banking")` ist immer
 * dieselbe UUID — ohne Namensraum liesse sich derselbe Datensatz genau **einmal**
 * anlegen, der zweite Mandant scheiterte am Primärschlüssel. Die
 * Kommandozeile benutzt weiterhin den leeren Namensraum und behält damit ihre
 * angestammten Ids.
 */

/**
 * Welche Rolle welchen Griff im Datensatz besetzt.
 *
 * Die Seeder kennen Personen als Griffe (`rte`, `vso`, `owner`), nicht als
 * Rollen — dieselbe Person taucht im Datensatz an mehreren Stellen auf. Diese
 * Tabelle übersetzt; was keine Besetzung findet, fällt auf den Mandanten-Admin
 * zurück (`fillSeedUsers`).
 */
const HANDLE_ROLLE: Record<SeedUserHandle, Role> = {
  admin: ROLES.TENANT_ADMIN,
  portfolio: ROLES.PORTFOLIO_MANAGER,
  // Der VMO ist im Rollenmodell seit der Zusammenlegung ebenfalls
  // Portfolio-Management — im Datensatz bleibt er eine eigene Figur.
  vmo: ROLES.PORTFOLIO_MANAGER,
  transformation: ROLES.PORTFOLIO_MANAGER,
  rte: ROLES.RTE,
  owner: ROLES.EPIC_OWNER,
  fo: ROLES.FEATURE_OWNER,
  viewer: ROLES.VIEWER,
  vso: ROLES.VALUE_STREAM_OWNER,
};

/**
 * Besetzt die Griffe aus den erzeugten Testnutzern.
 *
 * **Reihum, nicht alle auf denselben:** wer zwei RTEs anlegt, soll sie im
 * Datensatz auch an zwei Stellen wiederfinden. Griffe derselben Rolle bekommen
 * deshalb der Reihe nach verschiedene Personen, solange welche da sind.
 */
export function besetzeGriffe(
  users: readonly GeneratedUser[],
  fallback: string,
): ReturnType<typeof fillSeedUsers> {
  const jeRolle = new Map<Role, string[]>();
  for (const u of users) {
    jeRolle.set(u.role, [...(jeRolle.get(u.role) ?? []), u.userId]);
  }
  const verbraucht = new Map<Role, number>();
  const partial: Partial<Record<SeedUserHandle, string>> = {};

  for (const [handle, rolle] of Object.entries(HANDLE_ROLLE) as [SeedUserHandle, Role][]) {
    const kandidaten = jeRolle.get(rolle);
    if (!kandidaten || kandidaten.length === 0) continue;
    const i = verbraucht.get(rolle) ?? 0;
    partial[handle] = kandidaten[i % kandidaten.length]!;
    verbraucht.set(rolle, i + 1);
  }
  return fillSeedUsers(partial, fallback);
}

export interface SeedTenantInput {
  profile: SeedProfile;
  /** Die frisch erzeugten Testnutzer, falls welche angelegt wurden. */
  users?: readonly GeneratedUser[];
  /** Vorher räumen — für „Mandant zurücksetzen". Beim Anlegen unnötig. */
  wipeFirst?: boolean;
}

/**
 * Füllt einen bestehenden Mandanten.
 *
 * **Ohne Transaktion, und das ist Absicht:** der grosse Datensatz schreibt
 * hunderte Vorhaben; eine Transaktion darüber hielte minutenlang Sperren auf
 * Tabellen, in denen andere Mandanten arbeiten. Die Seeder sind idempotent —
 * ein abgebrochener Lauf lässt sich wiederholen.
 */
export async function seedTenant(
  actor: Principal,
  tenantId: string,
  input: SeedTenantInput,
): Promise<ServiceOutcome<{ profile: SeedProfile }>> {
  assertPlatformAdmin(actor);

  const def = seedProfileDef(input.profile);
  if (!def.run) return { ok: true, profile: input.profile };

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, kind: true },
  });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };
  if (tenant.kind === "personal") {
    return { ok: false, error: "Private Bereiche werden nicht befüllt" };
  }

  // Ersatzperson für unbesetzte Griffe: der Mandanten-Admin. Der Plattform-Admin
  // wäre die schlechtere Wahl — er gehört dem Mandanten nicht an, und sein Name
  // stünde dann als Autor an Vorhaben, mit denen er nichts zu tun hat.
  const admin = await db.userRoleAssignment.findFirst({
    where: { tenantId, role: ROLES.TENANT_ADMIN },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  const fallback = admin?.userId ?? actor.id;

  if (input.wipeFirst) await wipeTenantData(db, tenantId);

  await def.run({
    db,
    tenantId,
    uid: uidFor(tenantId),
    users: besetzeGriffe(input.users ?? [], fallback),
  });

  return { ok: true, profile: input.profile };
}

/**
 * **Mandant zurücksetzen:** räumen und neu säen, ohne ihn zu löschen.
 *
 * Fällt aus {@link seedTenant} und `wipeTenantData` fast von selbst ab und ist
 * der Griff, den man beim Testen am häufigsten braucht — einen frischen Stand,
 * ohne Konten, Rollen und die Mandanten-Id neu zu vergeben.
 *
 * Der abgetippte Name wird **hier** geprüft, nicht nur im Browser: das Räumen
 * ist so endgültig wie das Löschen, nur dass der Mandant stehenbleibt. Die
 * Rollenzuweisungen bleiben (`includeMembers` aus) — sonst verlöre jeder seinen
 * Zugang zu einem Mandanten, der gleich wieder gefüllt wird.
 */
export async function resetTenant(
  actor: Principal,
  tenantId: string,
  input: { confirmName: string; profile: SeedProfile },
): Promise<ServiceOutcome<{ profile: SeedProfile }>> {
  assertPlatformAdmin(actor);

  const db = platformDb(actor.id);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, kind: true },
  });
  if (!tenant) return { ok: false, error: "Tenant nicht gefunden" };
  if (tenant.kind === "personal") {
    return { ok: false, error: "Private Bereiche werden nicht zurückgesetzt" };
  }
  if (input.confirmName.trim() !== tenant.name) {
    return { ok: false, error: "Der eingegebene Name stimmt nicht mit dem Mandanten überein" };
  }

  // Auch ohne Datensatz raeumen: „zuruecksetzen auf leer" ist ein gueltiger Wunsch.
  if (input.profile === "none") {
    await wipeTenantData(db, tenantId);
    return { ok: true, profile: "none" };
  }
  return seedTenant(actor, tenantId, { profile: input.profile, wipeFirst: true });
}
