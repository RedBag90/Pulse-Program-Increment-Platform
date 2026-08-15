import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { POLICIES, type Action } from "@/server/auth/policies";
import { ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import type { PracticeFlags } from "@/modules/core/kernel/domain/operating-model";
import {
  onboardingNotices,
  resolveTour,
  type Notice,
  type ResolvedTour,
  type RoleOnboardingState,
  type TourContext,
} from "@/modules/onboarding/domain/role-tour";
import {
  ROLE_PLAYBOOKS,
  type DataRequirement,
} from "@/modules/onboarding/domain/role-playbook";
import { listRoleOnboarding } from "@/modules/onboarding/server/services/role-onboarding";

/**
 * Page-Model des Rollen-Onboardings: unreiner Loader + reiner Builder. Der
 * Builder ist `onboardingNotices` — hier passiert nur das Einsammeln der drei
 * Achsen (Entitlement, Practice, Capability) und der gespeicherte Stand.
 *
 * Läuft im Dashboard-Layout, also auf jedem Seitenaufruf: genau eine zusätzliche
 * Query auf dem Index `[tenantId, userId]`.
 */

/** Alle Actions der Registry — die `Action`-Union als Laufzeitliste. */
const ALL_ACTIONS = Object.keys(POLICIES) as Action[];

/** Kein Bestand geprüft — gilt als „nichts vorhanden" (fail-closed). */
const EMPTY_DATA: ReadonlySet<DataRequirement> = new Set();

/**
 * Welche Capabilities hat dieser Principal tatsächlich? Ohne Ressource, also
 * die grobe Achse: Scope-Prüfungen (`value_stream` & Co.) laufen erst am
 * Service-Seam (ADR-0002) und können hier gar nicht entschieden werden. Für die
 * Frage „ist diese Fläche für dich überhaupt relevant?" ist das die richtige
 * Auflösung — ein Wertstrom-Verantwortlicher soll den Schritt sehen, auch wenn
 * er ihn nur in seinem eigenen Wertstrom ausführen darf.
 */
function capabilitiesOf(principal: Principal): ReadonlySet<Action> {
  return new Set(ALL_ACTIONS.filter((a) => hasCapability(principal, a)));
}

/** Eine Existenzprüfung je Bestandsart. `findFirst` stoppt beim ersten Treffer. */
function probeFor(db: PrismaClient, tenantId: string, what: DataRequirement) {
  const exists = { select: { id: true } } as const;
  switch (what) {
    case "valueStream":
      return db.valueStream.findFirst({ where: { tenantId }, ...exists });
    case "art":
      return db.art.findFirst({ where: { tenantId }, ...exists });
    case "epic":
      return db.initiative.findFirst({ where: { tenantId, level: 0 }, ...exists });
    case "feature":
      return db.initiative.findFirst({ where: { tenantId, level: 1 }, ...exists });
    case "pi":
      return db.programIncrement.findFirst({ where: { tenantId }, ...exists });
    case "risk":
      return db.issue.findFirst({ where: { tenantId }, ...exists });
    case "goal":
      return db.objective.findFirst({ where: { tenantId }, ...exists });
  }
}

/**
 * Prüft **nur die tatsächlich benötigten** Bestandsarten, und zwar
 * **nacheinander**.
 *
 * Beides ist Absicht und teuer erkauft: `createPrismaClient` verpackt jede
 * einzelne Operation in eine eigene Transaktion (um die RLS-Claims zu setzen).
 * Ein `Promise.all` über sieben Prüfungen belegt damit sieben Verbindungen
 * gleichzeitig — auf jeder Navigation, weil das Modell im Dashboard-Layout
 * hängt. Bei einem Pool-Limit von 25 reicht das, um den Pool leerlaufen zu
 * lassen. Sequenziell belegt es genau eine, und typischerweise sind nur zwei
 * bis vier Arten überhaupt gefragt.
 */
async function loadAvailableData(
  db: PrismaClient,
  tenantId: string,
  needed: ReadonlySet<DataRequirement>,
): Promise<ReadonlySet<DataRequirement>> {
  const found = new Set<DataRequirement>();
  for (const what of needed) {
    if (await probeFor(db, tenantId, what)) found.add(what);
  }
  return found;
}

/**
 * Welche Bestandsarten fragt dieser Principal überhaupt ab? Nur die, die an
 * einem noch ungesehenen Schritt seiner Rollen hängen. Nach abgeschlossener
 * Tour ist die Menge leer und es wird gar nicht erst abgefragt.
 */
function neededRequirements(
  roles: readonly Role[],
  states: readonly RoleOnboardingState[],
): ReadonlySet<DataRequirement> {
  const seenByRole = new Map(states.map((s) => [s.role, new Set(s.seenStepKeys)]));
  const needed = new Set<DataRequirement>();
  for (const role of roles) {
    const seen = seenByRole.get(role);
    for (const step of ROLE_PLAYBOOKS[role].steps) {
      if (step.requires && !seen?.has(step.key)) needed.add(step.requires);
    }
  }
  return needed;
}

/** Alle Bestandsarten — die Nachschlage-Seite zeigt bewusst das volle Bild. */
const ALL_REQUIREMENTS: ReadonlySet<DataRequirement> = new Set<DataRequirement>([
  "valueStream",
  "art",
  "epic",
  "feature",
  "pi",
  "risk",
  "goal",
]);

export interface RoleOnboardingModel {
  notices: Notice[];
}

/** Die Rollen des Principal, auf bekannte Enum-Werte gefiltert (DB hält Strings). */
function assignedRoles(principal: Principal): Role[] {
  return ALL_ROLES.filter((r) => principal.roles.includes(r));
}

export async function buildRoleOnboardingModel(
  db: PrismaClient,
  principal: Principal,
  practices: PracticeFlags,
): Promise<RoleOnboardingModel> {
  const roles = assignedRoles(principal);
  if (roles.length === 0) return { notices: [] };

  const states = await listRoleOnboarding(db, principal.tenantId, principal.id);
  const needed = neededRequirements(roles, states);
  const availableData =
    needed.size > 0 ? await loadAvailableData(db, principal.tenantId, needed) : EMPTY_DATA;
  const ctx: TourContext = {
    enabledModules: principal.enabledModules,
    practices,
    allowedCapabilities: capabilitiesOf(principal),
    availableData,
  };
  return { notices: onboardingNotices(roles, states, ctx) };
}

/**
 * Wie `buildRoleOnboardingModel`, aber ohne Rücksicht auf den gespeicherten
 * Stand: liefert für jede Rolle das aufgelöste Playbook. Grundlage der
 * Nachschlage-Seite `/meine-rolle`, wo auch längst gesehene Schritte
 * (abgehakt) sichtbar bleiben sollen.
 */
export interface RolePlaybookEntry {
  role: Role;
  tour: ResolvedTour;
  seenStepKeys: readonly string[];
}

export async function buildRolePlaybookModel(
  db: PrismaClient,
  principal: Principal,
  practices: PracticeFlags,
): Promise<{ entries: RolePlaybookEntry[] }> {
  const roles = assignedRoles(principal);
  const states = await listRoleOnboarding(db, principal.tenantId, principal.id);
  const byRole = new Map(states.map((s) => [s.role, s]));
  // Die Nachschlage-Seite zeigt bewusst alles, was in diesem Workspace möglich
  // ist — dort wird der Bestand immer geprüft, nicht nur bei offenen Schritten.
  const ctx: TourContext = {
    enabledModules: principal.enabledModules,
    practices,
    allowedCapabilities: capabilitiesOf(principal),
    availableData: await loadAvailableData(db, principal.tenantId, ALL_REQUIREMENTS),
  };

  return {
    entries: roles.map((role) => ({
      role,
      tour: resolveTour(ROLE_PLAYBOOKS[role], ctx),
      seenStepKeys: byRole.get(role)?.seenStepKeys ?? [],
    })),
  };
}
