import { ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import {
  MODULE_KEYS,
  moduleForAction,
  moduleForPath,
  type ModuleKey,
} from "@/modules/core/kernel/domain/modules";
import type { PracticeFlags } from "@/modules/core/kernel/domain/operating-model";
import type { Action } from "@/server/auth/policies";
import {
  ROLE_PLAYBOOKS,
  type DataRequirement,
  type PlaybookClaim,
  type RolePlaybook,
  type TourStep,
} from "./role-playbook";

/**
 * Auflösung eines Playbooks gegen einen konkreten Workspace — der einzige Ort,
 * an dem entschieden wird, was ein Nutzer zu sehen bekommt.
 *
 * Zwei Regeln tragen alles:
 *
 * 1. **Sichtbar = Entitlement ∧ Practice ∧ Capability.** Was der Tenant nicht
 *    freigeschaltet hat, wird nicht gezeigt und nicht erwähnt — kein
 *    „das könntest du mit Modul Y", konsistent zur Nav-Entscheidung, gesperrte
 *    Module gar nicht erst anzuzeigen.
 * 2. **Fortschritt ist eine Schritt-Menge, kein Zeiger.** Dadurch fallen der
 *    Erstkontakt („alles offen") und die Nachrüstung eines Moduls („genau die
 *    neuen Schritte offen") aus derselben Rechnung. Ein abgeschaltetes Modul
 *    verschwindet lautlos; wird es wieder eingeschaltet, gibt es keinen zweiten
 *    Hinweis, weil die Schritte längst gesehen sind.
 *
 * Pure Funktionen, kein I/O, keine Zeitquelle.
 */

export interface TourContext {
  /** Freigeschaltete Module des Tenants (inkl. `core`). */
  enabledModules: readonly ModuleKey[];
  /** Aktive Practices des Target Operating Models. */
  practices: PracticeFlags;
  /**
   * Capabilities, die der Principal tatsächlich hat. Der Aufrufer füllt das aus
   * `hasCapability(...)`, damit diese Datei pure bleibt und nichts über die
   * Policy-Registry wissen muss.
   */
  allowedCapabilities: ReadonlySet<Action>;
  /**
   * Bestand, den es im Workspace wirklich gibt. Vierte Achse neben Entitlement,
   * Practice und Capability — nötig, weil viele Flächen im Leerzustand ihren
   * Inhalt komplett durch einen Empty-State ersetzen und ein Anker dorthin ins
   * Leere zeigen würde.
   *
   * Bewusst hier statt im Browser: ein clientseitig übersprungener Schritt bliebe
   * „ungesehen" und käme direkt nach der Tour als „neue Aufgaben" zurück. So
   * dagegen fällt er sauber aus der Auflösung — und taucht später von selbst auf,
   * sobald der Bestand existiert.
   */
  availableData: ReadonlySet<DataRequirement>;
}

/** Ein Playbook, reduziert auf das, was in diesem Workspace tatsächlich gilt. */
export interface ResolvedTour {
  role: Role;
  mission: string;
  responsibilities: readonly string[];
  handoffs: readonly string[];
  steps: readonly TourStep[];
  /** = `steps.length`; als Feld, damit die UI „Schritt n von m" nicht nachrechnet. */
  total: number;
}

export type Notice =
  | { kind: "new_role"; role: Role; tour: ResolvedTour; open: readonly TourStep[] }
  | {
      kind: "new_scope";
      role: Role;
      tour: ResolvedTour;
      open: readonly TourStep[];
      /** Module, die die neuen Schritte mitbringen — für die Überschrift des Hinweises. */
      modules: readonly ModuleKey[];
    };

/** Gespeicherter Stand einer Rolle (Ausschnitt aus `RoleOnboarding`). */
export interface RoleOnboardingState {
  role: string;
  acknowledgedAt: Date | null;
  seenStepKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

/**
 * Reiner Pfad ohne Query. `moduleForPath` erwartet ein Segment und würde bei
 * `/umsetzung?view=table` sonst `null` liefern — der Schritt fiele lautlos aus
 * der Tour, obwohl das Modul freigeschaltet ist.
 */
export function routePath(route: string): string {
  return route.split("?")[0] ?? route;
}

/** `core` gilt immer (always-on); `null` ist fail-closed. */
function moduleEnabled(m: ModuleKey | "core" | null, enabled: readonly ModuleKey[]): boolean {
  if (m === null) return false;
  if (m === "core") return true;
  return enabled.includes(m);
}

/**
 * Eine Capability allein reicht nicht: `principal.capabilities` kommt aus
 * Rolle × Policy und weiß nichts vom Entitlement. Ein RTE hat `pi.create` auch
 * in einem Tenant ohne Drumbeat — dort blockt erst das Modul-Gate. Genau das
 * bilden wir hier nach, statt jedes Bullet von Hand mit `module` zu annotieren:
 * so kann der Inhalt gar nicht erst aus dem Tritt geraten.
 */
function capabilityUsable(action: Action, ctx: TourContext): boolean {
  if (!ctx.allowedCapabilities.has(action)) return false;
  const m = moduleForAction(action);
  // `null` = ungegated (tenant.create / Platform-API) — kein Entitlement nötig.
  return m === null || moduleEnabled(m, ctx.enabledModules);
}

function stepAllowed(step: TourStep, ctx: TourContext): boolean {
  if (!moduleEnabled(moduleForPath(routePath(step.route)), ctx.enabledModules)) return false;
  if (step.practice && !ctx.practices[step.practice]) return false;
  if (step.capability && !capabilityUsable(step.capability, ctx)) return false;
  if (step.requires && !ctx.availableData.has(step.requires)) return false;
  return true;
}

function claimAllowed(claim: PlaybookClaim, ctx: TourContext): boolean {
  if (claim.module && !moduleEnabled(claim.module, ctx.enabledModules)) return false;
  if (claim.practice && !ctx.practices[claim.practice]) return false;
  if (claim.capability && !capabilityUsable(claim.capability, ctx)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Auflösung
// ---------------------------------------------------------------------------

/**
 * Filtert Schritte **und** Prosa gegen den Workspace. `steps` darf leer sein —
 * etwa `feature_owner` in einem Tenant, der nur `core` freigeschaltet hat. Die
 * `mission` überlebt immer; sie ist bewusst modulneutral formuliert.
 */
export function resolveTour(playbook: RolePlaybook, ctx: TourContext): ResolvedTour {
  const steps = playbook.steps.filter((s) => stepAllowed(s, ctx));
  return {
    role: playbook.role,
    mission: playbook.mission,
    responsibilities: playbook.responsibilities.filter((c) => claimAllowed(c, ctx)).map((c) => c.text),
    handoffs: playbook.handoffs.filter((c) => claimAllowed(c, ctx)).map((c) => c.text),
    steps,
    total: steps.length,
  };
}

/** Noch nicht gesehene Schritte, in Playbook-Reihenfolge. */
export function openSteps(
  tour: ResolvedTour,
  seenStepKeys: readonly string[],
): readonly TourStep[] {
  const seen = new Set(seenStepKeys);
  return tour.steps.filter((s) => !seen.has(s.key));
}

/** 0-basierter Index eines Schritts, `-1` wenn er (mehr) nicht Teil der Tour ist. */
export function stepIndex(tour: ResolvedTour, key: string): number {
  return tour.steps.findIndex((s) => s.key === key);
}

/** Wiedereinstiegspunkt: der erste offene Schritt, sonst `null`. */
export function nextOpenStep(
  tour: ResolvedTour,
  seenStepKeys: readonly string[],
): TourStep | null {
  return openSteps(tour, seenStepKeys)[0] ?? null;
}

/** Module, die die übergebenen Schritte mitbringen — ohne `core`, in Registry-Reihenfolge. */
function modulesOf(steps: readonly TourStep[]): readonly ModuleKey[] {
  const keys = new Set<ModuleKey>();
  for (const s of steps) {
    const m = moduleForPath(routePath(s.route));
    if (m !== null && m !== "core") keys.add(m);
  }
  return MODULE_KEYS.filter((k) => keys.has(k));
}

// ---------------------------------------------------------------------------
// Was der Nutzer zu sehen bekommt
// ---------------------------------------------------------------------------

/**
 * Die einzige Stelle, die entscheidet, ob und welches Fenster erscheint.
 *
 * - **`new_role`** — die Rolle ist noch nicht quittiert. Erscheint auch dann,
 *   wenn nach dem Filtern kein einziger Schritt übrig bleibt: der Nutzer soll
 *   trotzdem erfahren, welche Rolle er hat (der Dialog sagt dann ehrlich, dass
 *   in diesem Workspace nichts dazu freigeschaltet ist).
 * - **`new_scope`** — die Rolle ist längst quittiert, aber es sind Schritte
 *   dazugekommen, weil ein Modul, eine Practice oder eine Capability
 *   nachgezogen wurde.
 *
 * Rollen ohne offene Schritte und ohne offene Quittung liefern nichts.
 * Sortiert nach `ALL_ROLES` → deterministische Reihenfolge bei Mehrfachrollen.
 */
export function onboardingNotices(
  assignedRoles: readonly Role[],
  states: readonly RoleOnboardingState[],
  ctx: TourContext,
): Notice[] {
  const byRole = new Map(states.map((s) => [s.role, s]));
  const assigned = new Set(assignedRoles);

  return ALL_ROLES.filter((r) => assigned.has(r)).flatMap<Notice>((role) => {
    const state = byRole.get(role);
    const tour = resolveTour(ROLE_PLAYBOOKS[role], ctx);
    const open = openSteps(tour, state?.seenStepKeys ?? []);

    if (!state?.acknowledgedAt) return [{ kind: "new_role", role, tour, open }];
    if (open.length === 0) return [];
    return [{ kind: "new_scope", role, tour, open, modules: modulesOf(open) }];
  });
}
