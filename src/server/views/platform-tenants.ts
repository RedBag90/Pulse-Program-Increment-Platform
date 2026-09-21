import type { PrismaClient } from "@/generated/prisma";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { resolveUserEmails } from "@/server/services/user-directory";

/**
 * Loader für den Plattform-Tenants-Tab (cross-tenant, read-only). Läuft über den
 * `platformDb` (tenantId ""), die Filter werden EXPLIZIT gesetzt — RLS ist
 * Owner-Bypass, das App-Gating (`requirePlatformAdmin` im Layout) ist der
 * Wächter. Reine Aufbereitung; keine Mutation.
 */

export interface PlatformTenantRow {
  id: string;
  name: string;
  /** "organization" | "personal". */
  kind: string;
  /** "active" | "suspended" | "archived". */
  status: string;
  region: string;
  enabledModules: string[];
  memberCount: number;
  createdAt: string;
  /** Epics und Features getrennt — die Grösse eines Mandanten in einem Blick. */
  epicCount: number;
  featureCount: number;
  objectiveCount: number;
  /** Jüngstes Audit-Ereignis (ISO-Datum) oder `null`, wenn nie etwas passiert ist. */
  lastActivity: string | null;
}

/**
 * Alle Organisationen — **und nur die**.
 *
 * Bis September 2026 gab es hier einen Schalter `includePersonal`, der die
 * privaten Bereiche aller Nutzer einblendete, samt Mitgliederliste und
 * E-Mail-Adressen. Von dort führte ein Knopf („Mitglied hinzufügen") in jeden
 * fremden Privatbereich hinein. Ein privater Bereich ist kein
 * Verwaltungsobjekt: er taucht auf dieser Fläche nicht mehr auf.
 *
 * **Und er kommt auch nicht zurück.** Wer wissen will, wie viel Ballast sich
 * angesammelt hat, bekommt die Zahl über {@link personalWorkspaceSummary} —
 * ohne Namen, ohne Mitglieder, ohne Weg hinein.
 *
 * **Die Grössen** (Epics, Features, Ziele, letzte Aktivität) kamen im September
 * 2026 dazu: ohne sie lässt sich nicht entscheiden, welcher Testmandant weg
 * kann. Drei zusätzliche Abfragen statt einer je Zeile.
 */
export async function listAllTenants(db: PrismaClient): Promise<PlatformTenantRow[]> {
  const [rows, initiativen, ziele, aktivitaet] = await Promise.all([
    db.tenant.findMany({
      where: { kind: "organization" },
      select: {
        id: true,
        name: true,
        kind: true,
        status: true,
        region: true,
        enabledModules: true,
        createdAt: true,
        _count: { select: { userRoleAssignments: true } },
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    // Je Mandant **und Ebene** — 70 Vorhaben sagen wenig, 20 Epics mit 50
    // Features sagen etwas. `deletedAt: null`, sonst zählen Papierkörbe mit.
    db.initiative.groupBy({ by: ["tenantId", "level"], where: { deletedAt: null }, _count: true }),
    db.objective.groupBy({ by: ["tenantId"], _count: true }),
    db.auditEvent.groupBy({ by: ["tenantId"], _max: { occurredAt: true } }),
  ]);

  const proEbene = new Map<string, number>();
  for (const g of initiativen) proEbene.set(`${g.tenantId}|${g.level}`, g._count);
  const zieleJe = new Map(ziele.map((g) => [g.tenantId, g._count]));
  const zuletzt = new Map(aktivitaet.map((g) => [g.tenantId, g._max.occurredAt]));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    status: t.status,
    region: t.region,
    enabledModules: t.enabledModules,
    memberCount: t._count.userRoleAssignments,
    createdAt: t.createdAt.toISOString().slice(0, 10),
    epicCount: proEbene.get(`${t.id}|0`) ?? 0,
    featureCount: proEbene.get(`${t.id}|1`) ?? 0,
    objectiveCount: zieleJe.get(t.id) ?? 0,
    lastActivity: zuletzt.get(t.id)?.toISOString().slice(0, 10) ?? null,
  }));
}

export interface PersonalWorkspaceSummary {
  total: number;
  /** Ohne Ziele, Themes, Vorhaben und KPIs — Kandidaten fürs Aufräumen. */
  empty: number;
}

/**
 * **Wie viele private Bereiche es gibt und wie viele davon leer sind — mehr nicht.**
 *
 * Jeder Nutzer bekommt beim ersten `/start` einen (`ensurePersonalTenant`);
 * gemessen am 2026-09-21 waren das 23 Stück, 21 davon vollständig leer. Das ist
 * die Zahl, die man fürs Aufräumen braucht.
 *
 * **Bewusst ohne Namen und ohne Mitglieder.** Genau das stand hier bis September
 * 2026 und war ein Weg in fremde Privatbereiche. Eine Zahl ist kein Weg.
 *
 * Nicht leer heisst **nicht** „darf nicht weg" — es heisst „nicht ungefragt".
 * Der Aufräum-Lauf entscheidet das, nicht diese Sicht.
 */
export async function personalWorkspaceSummary(
  db: PrismaClient,
): Promise<PersonalWorkspaceSummary> {
  const [total, mitInhalt] = await Promise.all([
    db.tenant.count({ where: { kind: "personal" } }),
    db.tenant.count({
      where: {
        kind: "personal",
        OR: [
          { objectives: { some: {} } },
          { strategicThemes: { some: {} } },
          { initiatives: { some: { deletedAt: null } } },
          { kpis: { some: {} } },
        ],
      },
    }),
  ]);
  return { total, empty: total - mitInhalt };
}

export interface PlatformTenantMember {
  assignmentId: string;
  userId: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

export interface PlatformTenantDetail {
  id: string;
  name: string;
  kind: string;
  status: string;
  region: string;
  enabledModules: string[];
  createdAt: string;
  members: PlatformTenantMember[];
}

/** Detail eines Tenants inkl. Mitglieder (E-Mails aus Supabase Auth aufgelöst). */
export async function loadTenantDetail(
  db: PrismaClient,
  tenantId: string,
): Promise<PlatformTenantDetail | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      region: true,
      enabledModules: true,
      createdAt: true,
      userRoleAssignments: {
        select: { id: true, userId: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  // Ein privater Bereich sieht von hier aus wie „nicht vorhanden". Ohne das
  // bliebe der Detail-Aufruf über eine bekannte Id offen, auch nachdem die
  // Liste ihn nicht mehr zeigt.
  if (!tenant || tenant.kind === "personal") return null;

  const emails = await resolveUserEmails(tenant.userRoleAssignments.map((a) => a.userId));
  return {
    id: tenant.id,
    name: tenant.name,
    kind: tenant.kind,
    status: tenant.status,
    region: tenant.region,
    enabledModules: tenant.enabledModules,
    createdAt: tenant.createdAt.toISOString().slice(0, 10),
    members: tenant.userRoleAssignments.map((a) => ({
      assignmentId: a.id,
      userId: a.userId,
      email: emails[a.userId] ?? null,
      role: a.role as Role,
      createdAt: a.createdAt.toISOString().slice(0, 10),
    })),
  };
}
