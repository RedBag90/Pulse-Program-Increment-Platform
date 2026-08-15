import { describe, it, expect } from "vitest";
import {
  resolveTour,
  openSteps,
  nextOpenStep,
  stepIndex,
  onboardingNotices,
  type TourContext,
  type RoleOnboardingState,
  type Notice,
} from "../role-tour";
import { ROLE_PLAYBOOKS, type DataRequirement } from "../role-playbook";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { MODULE_KEYS, applyModulePrerequisites, type ModuleKey } from "@/modules/core/kernel/domain/modules";
import { DEFAULT_PRACTICES, type PracticeFlags } from "@/modules/core/kernel/domain/operating-model";
import { POLICIES, type Action } from "@/server/auth/policies";

/** Alle Capabilities, die eine Rolle laut Registry hat (Admin-Bypass wie authorize()). */
function capabilitiesOf(role: string): Set<Action> {
  const all = Object.keys(POLICIES) as Action[];
  if (role === ROLES.PLATFORM_ADMIN || role === ROLES.TENANT_ADMIN) return new Set(all);
  return new Set(all.filter((a) => (POLICIES[a] ?? []).some((g) => g.roles.includes(role as never))));
}

/** Standard: alles da — Tests, die den Leerzustand prüfen, überschreiben gezielt. */
const ALL_DATA: DataRequirement[] = [
  "valueStream",
  "art",
  "epic",
  "feature",
  "pi",
  "risk",
  "goal",
];

function ctx(over: Partial<TourContext> = {}): TourContext {
  return {
    enabledModules: MODULE_KEYS,
    practices: DEFAULT_PRACTICES,
    allowedCapabilities: new Set(Object.keys(POLICIES) as Action[]),
    availableData: new Set(ALL_DATA),
    ...over,
  };
}

/** Kontext eines Tenants, der nur die angegebenen Module gebucht hat. */
function tenantWith(modules: ModuleKey[], role: string, practices: PracticeFlags = DEFAULT_PRACTICES) {
  return ctx({
    enabledModules: applyModulePrerequisites(modules),
    practices,
    allowedCapabilities: capabilitiesOf(role),
  });
}

const RTE = ROLES.RTE;
const FEATURE_OWNER = ROLES.FEATURE_OWNER;
const VIEWER = ROLES.VIEWER;

/** Genau eine Notice erwarten und sie typsicher herausgeben. */
function only(notices: Notice[]): Notice {
  expect(notices).toHaveLength(1);
  return notices[0] as Notice;
}

/** Wie `only`, aber auf `new_scope` verengt (macht `modules` zugreifbar). */
function onlyScope(notices: Notice[]): Extract<Notice, { kind: "new_scope" }> {
  const n = only(notices);
  expect(n.kind).toBe("new_scope");
  return n as Extract<Notice, { kind: "new_scope" }>;
}

/** Schritt an Position `i` — Tests dürfen davon ausgehen, dass es ihn gibt. */
function stepAt(tour: ReturnType<typeof resolveTour>, i: number) {
  const s = tour.steps[i];
  if (!s) throw new Error(`Tour hat keinen Schritt an Position ${i}`);
  return s;
}

describe("resolveTour — Filterung", () => {
  it("volles Entitlement: die Tour bleibt vollständig", () => {
    const tour = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([...MODULE_KEYS], RTE));
    expect(tour.total).toBe(ROLE_PLAYBOOKS[RTE].steps.length);
    expect(tour.total).toBeGreaterThan(0);
  });

  it("abgeschaltetes Modul entfernt genau dessen Schritte", () => {
    const withDrumbeat = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith(["work", "drumbeat"], RTE));
    const withoutDrumbeat = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith(["work"], RTE));
    expect(withoutDrumbeat.total).toBeLessThan(withDrumbeat.total);
    // Kein verbleibender Schritt zeigt noch auf eine Drumbeat-Fläche.
    for (const s of withoutDrumbeat.steps) {
      expect(["/timelines", "/umsetzung", "/dependencies", "/impediments"]).not.toContain(s.route);
    }
  });

  it("abgeschaltete Practice entfernt ihre Schritte", () => {
    const off: PracticeFlags = { ...DEFAULT_PRACTICES, wsjf: false };
    const on = resolveTour(ROLE_PLAYBOOKS[FEATURE_OWNER], tenantWith([...MODULE_KEYS], FEATURE_OWNER));
    const noWsjf = resolveTour(
      ROLE_PLAYBOOKS[FEATURE_OWNER],
      tenantWith([...MODULE_KEYS], FEATURE_OWNER, off),
    );
    expect(noWsjf.total).toBe(on.total - 1);
    expect(noWsjf.steps.map((s) => s.key)).not.toContain("feature_owner.wsjf");
  });

  it("fehlende Capability entfernt den Schritt", () => {
    const full = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([...MODULE_KEYS], RTE));
    const stripped = resolveTour(
      ROLE_PLAYBOOKS[RTE],
      ctx({
        allowedCapabilities: new Set(
          [...capabilitiesOf(RTE)].filter((a) => a !== "impediment.resolve"),
        ),
      }),
    );
    expect(stripped.total).toBe(full.total - 1);
    expect(stripped.steps.map((s) => s.key)).not.toContain("rte.impediments");
  });

  it("auch die Prosa wird gefiltert — nicht nur die Schritte", () => {
    const full = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([...MODULE_KEYS], RTE));
    const coreOnly = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([], RTE));
    expect(coreOnly.responsibilities.length).toBeLessThan(full.responsibilities.length);
    // Die Übergabe „…plant er die Umsetzung im ART" hängt an Drumbeat.
    expect(coreOnly.handoffs.length).toBeLessThan(full.handoffs.length);
  });

  it("die Mission überlebt jede Filterung", () => {
    const coreOnly = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([], RTE));
    expect(coreOnly.mission).toBe(ROLE_PLAYBOOKS[RTE].mission);
  });

  it("Leer-Fall: feature_owner in einem reinen Core-Tenant hat keine Schritte", () => {
    const tour = resolveTour(ROLE_PLAYBOOKS[FEATURE_OWNER], tenantWith([], FEATURE_OWNER));
    expect(tour.steps).toEqual([]);
    expect(tour.total).toBe(0);
    expect(tour.mission).not.toBe("");
  });

  it("die Reihenfolge bleibt die des Playbooks (Nummerierung ist lückenlos)", () => {
    const tour = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith(["work"], RTE));
    const original = ROLE_PLAYBOOKS[RTE].steps.map((s) => s.key);
    const kept = tour.steps.map((s) => s.key);
    expect(kept).toEqual(original.filter((k) => kept.includes(k)));
    kept.forEach((k, i) => expect(stepIndex(tour, k)).toBe(i));
  });
});

describe("resolveTour — Datenachse", () => {
  it("leerer Workspace: Schritte mit `requires` fallen weg", () => {
    const full = resolveTour(ROLE_PLAYBOOKS[RTE], ctx({ allowedCapabilities: capabilitiesOf(RTE) }));
    const empty = resolveTour(
      ROLE_PLAYBOOKS[RTE],
      ctx({ allowedCapabilities: capabilitiesOf(RTE), availableData: new Set() }),
    );
    expect(empty.total).toBeLessThan(full.total);
    expect(empty.steps.every((s) => !s.requires)).toBe(true);
  });

  it("die Nummerierung bleibt lückenlos, wenn Schritte wegfallen", () => {
    const empty = resolveTour(
      ROLE_PLAYBOOKS[RTE],
      ctx({ allowedCapabilities: capabilitiesOf(RTE), availableData: new Set() }),
    );
    empty.steps.forEach((s, i) => expect(stepIndex(empty, s.key)).toBe(i));
  });

  it("Bestand kommt dazu ⇒ genau die datengebundenen Schritte werden nachgereicht", () => {
    // Der eigentliche Zweck der Achse: die Tour wächst mit dem Workspace, statt
    // Erklärungen zu Dingen zu zeigen, die es noch gar nicht gibt.
    const noData = ctx({ allowedCapabilities: capabilitiesOf(RTE), availableData: new Set() });
    const seen = resolveTour(ROLE_PLAYBOOKS[RTE], noData).steps.map((s) => s.key);

    const withData = ctx({ allowedCapabilities: capabilitiesOf(RTE) });
    const n = onlyScope(
      onboardingNotices(
        [RTE],
        [{ role: RTE, acknowledgedAt: new Date("2026-08-14T00:00:00Z"), seenStepKeys: seen }],
        withData,
      ),
    );
    expect(n.open.length).toBeGreaterThan(0);
    expect(n.open.every((s) => Boolean(s.requires))).toBe(true);
  });
});

describe("openSteps / nextOpenStep", () => {
  const tour = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([...MODULE_KEYS], RTE));

  it("nichts gesehen ⇒ alles offen", () => {
    expect(openSteps(tour, [])).toHaveLength(tour.total);
    expect(nextOpenStep(tour, [])?.key).toBe(stepAt(tour, 0).key);
  });

  it("alles gesehen ⇒ nichts offen", () => {
    const all = tour.steps.map((s) => s.key);
    expect(openSteps(tour, all)).toEqual([]);
    expect(nextOpenStep(tour, all)).toBeNull();
  });

  it("Wiedereinstieg ist der erste offene Schritt, nicht der nächste nach dem letzten", () => {
    // Mittleren Schritt übersprungen: der Wiedereinstieg holt ihn nach.
    const seen = tour.steps.filter((_, i) => i !== 1).map((s) => s.key);
    expect(nextOpenStep(tour, seen)?.key).toBe(stepAt(tour, 1).key);
  });

  it("unbekannte Keys (Schritt umbenannt/entfernt) stören nicht", () => {
    expect(openSteps(tour, ["gibt.es.nicht"])).toHaveLength(tour.total);
  });
});

describe("onboardingNotices — Erstkontakt", () => {
  it("frisch zugewiesene Rolle ⇒ new_role mit allen Schritten", () => {
    const n = only(onboardingNotices([RTE], [], tenantWith([...MODULE_KEYS], RTE)));
    expect(n.kind).toBe("new_role");
    expect(n.open).toHaveLength(n.tour.total);
  });

  it("new_role erscheint auch, wenn nach dem Filtern nichts übrig bleibt", () => {
    // Sonst erführe der Nutzer nie, dass er die Rolle überhaupt hat.
    const n = only(onboardingNotices([FEATURE_OWNER], [], tenantWith([], FEATURE_OWNER)));
    expect(n.kind).toBe("new_role");
    expect(n.tour.total).toBe(0);
  });

  it("quittiert und alles gesehen ⇒ kein Fenster mehr", () => {
    const c = tenantWith([...MODULE_KEYS], RTE);
    const tour = resolveTour(ROLE_PLAYBOOKS[RTE], c);
    const state: RoleOnboardingState = {
      role: RTE,
      acknowledgedAt: new Date("2026-08-14T00:00:00Z"),
      seenStepKeys: tour.steps.map((s) => s.key),
    };
    expect(onboardingNotices([RTE], [state], c)).toEqual([]);
  });

  it("nicht zugewiesene Rollen liefern nichts, auch mit vorhandener Zeile", () => {
    const state: RoleOnboardingState = { role: RTE, acknowledgedAt: null, seenStepKeys: [] };
    expect(onboardingNotices([], [state], ctx())).toEqual([]);
  });

  it("Mehrfachrollen kommen in ALL_ROLES-Reihenfolge (deterministische Queue)", () => {
    const notices = onboardingNotices([VIEWER, RTE], [], ctx());
    expect(notices.map((n) => n.role)).toEqual([RTE, VIEWER]);
  });
});

describe("onboardingNotices — nachträglich freigeschaltete Module", () => {
  const acked = (seen: string[]): RoleOnboardingState => ({
    role: RTE,
    acknowledgedAt: new Date("2026-08-14T00:00:00Z"),
    seenStepKeys: seen,
  });

  /** Tour vollständig durchlaufen in einem Tenant ohne Drumbeat. */
  function seenInWorkOnlyTenant(): string[] {
    return resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith(["work"], RTE)).steps.map((s) => s.key);
  }

  it("Drumbeat kommt dazu ⇒ new_scope mit genau den neuen Schritten", () => {
    const n = onlyScope(
      onboardingNotices([RTE], [acked(seenInWorkOnlyTenant())], tenantWith(["work", "drumbeat"], RTE)),
    );
    expect(n.open.length).toBeGreaterThan(0);
    // Alle neuen Schritte gehören zu Drumbeat …
    expect(n.modules).toEqual(["drumbeat"]);
    // … und keiner davon war vorher schon sichtbar.
    const before = new Set(seenInWorkOnlyTenant());
    expect(n.open.every((s) => !before.has(s.key))).toBe(true);
  });

  it("Modul wieder abgeschaltet ⇒ kein Hinweis (die Schritte verschwinden lautlos)", () => {
    const notices = onboardingNotices([RTE], [acked(seenInWorkOnlyTenant())], tenantWith(["work"], RTE));
    expect(notices).toEqual([]);
  });

  it("Modul erneut eingeschaltet, Schritte längst gesehen ⇒ immer noch kein Hinweis", () => {
    const seenAll = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith(["work", "drumbeat"], RTE)).steps.map(
      (s) => s.key,
    );
    const off = onboardingNotices([RTE], [acked(seenAll)], tenantWith(["work"], RTE));
    const onAgain = onboardingNotices([RTE], [acked(seenAll)], tenantWith(["work", "drumbeat"], RTE));
    expect(off).toEqual([]);
    expect(onAgain).toEqual([]);
  });

  it("Prerequisite-Kette: drumbeat zieht work nach, ohne Work-Schritte doppelt als neu zu melden", () => {
    // Ausgangslage: reiner Core-Tenant, Tour dort vollständig gesehen.
    const seenCore = resolveTour(ROLE_PLAYBOOKS[RTE], tenantWith([], RTE)).steps.map((s) => s.key);
    const n = onlyScope(onboardingNotices([RTE], [acked(seenCore)], tenantWith(["drumbeat"], RTE)));
    // Jeder gemeldete Schritt ist wirklich neu — keine Dubletten aus der Kette.
    expect(new Set(n.open.map((s) => s.key)).size).toBe(n.open.length);
    expect(n.open.every((s) => !seenCore.includes(s.key))).toBe(true);
  });

  it("eine nachgezogene Practice erzeugt denselben new_scope-Hinweis", () => {
    const withoutWsjf: PracticeFlags = { ...DEFAULT_PRACTICES, wsjf: false };
    const seen = resolveTour(
      ROLE_PLAYBOOKS[FEATURE_OWNER],
      tenantWith([...MODULE_KEYS], FEATURE_OWNER, withoutWsjf),
    ).steps.map((s) => s.key);

    const n = onlyScope(
      onboardingNotices(
        [FEATURE_OWNER],
        [{ role: FEATURE_OWNER, acknowledgedAt: new Date("2026-08-14T00:00:00Z"), seenStepKeys: seen }],
        tenantWith([...MODULE_KEYS], FEATURE_OWNER, DEFAULT_PRACTICES),
      ),
    );
    expect(n.open.map((s) => s.key)).toEqual(["feature_owner.wsjf"]);
  });

  it("eine nachträglich gewährte Capability erzeugt ebenfalls einen Hinweis", () => {
    const reduced = new Set([...capabilitiesOf(RTE)].filter((a) => a !== "dependency.link"));
    const seen = resolveTour(
      ROLE_PLAYBOOKS[RTE],
      ctx({ allowedCapabilities: reduced }),
    ).steps.map((s) => s.key);

    const n = onlyScope(
      onboardingNotices(
        [RTE],
        [{ role: RTE, acknowledgedAt: new Date("2026-08-14T00:00:00Z"), seenStepKeys: seen }],
        ctx({ allowedCapabilities: capabilitiesOf(RTE) }),
      ),
    );
    expect(n.open.map((s) => s.key)).toEqual(["rte.dependencies"]);
  });
});
