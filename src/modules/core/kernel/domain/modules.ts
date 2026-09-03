/**
 * Modul-Registry — die Entitlement-Achse des Freemium-Modells (eine Quelle für
 * Nav-Filter, Route-Guard und Action-Gate). Ein **Modul** ist ein verkaufbarer
 * Funktionsblock; ein Tenant darf nur die Module in `Tenant.enabledModules`
 * nutzen (leer = kind-Default). Orthogonal zu den Operating-Model-Practices
 * (was der Tenant davon *fahren will*) und zu RBAC (wer *innerhalb* eines
 * Moduls was darf): effektiv sichtbar = Entitlement ∧ Practice ∧ Capability.
 *
 * Geschichtete Ziel-Taxonomie (siehe `docs/concepts/module-architecture.md`,
 * ADR-0013): **core** (Kernel + Ziele + Org-Struktur, immer verfügbare
 * Free-Basis) ← **work** ← { **drumbeat**, **budgeting** }. Prerequisite:
 * drumbeat/budgeting nur mit work; work immer auf core.
 *
 * Fail-closed-Regeln:
 *  - Ein Dashboard-Segment, das hier nicht registriert ist, ist gesperrt —
 *    neue Segmente müssen registriert werden (Vollständigkeits-Test erzwingt das).
 *  - `CORE_SEGMENTS` (start / my-tasks / my-approvals) sind immer verfügbar.
 *  - Actions ohne Modul-Zuordnung (nur `tenant.create`, Platform-API) bleiben
 *    ungegated — alles andere mappt auf ein Modul.
 */

export const MODULE_KEYS = ["core", "work", "drumbeat", "budgeting", "risks"] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDef {
  label: string;
  /** Erste URL-Segmente (locale-los), die zu diesem Modul gehören. */
  segments: readonly string[];
  /** Action-Matcher: exakter Name oder Dot-Präfix (endet auf "."). */
  actions: readonly string[];
  /** Redirect-/Einstiegsziel des Moduls. */
  home: string;
}

/**
 * Immer verfügbare Segmente (kein Entitlement): Einstieg + persönliche Inbox +
 * das eigene Rollen-Playbook. `meine-rolle` gehört bewusst hierher und nicht in
 * ein eigenes Modul: die Erklärung der Anwendung darf nie fail-closed weggeleitet
 * werden, und im persönlichen Free-Tenant wäre ein Entitlement-Key per Default
 * aus — siehe ADR-0017.
 */
export const CORE_SEGMENTS: readonly string[] = [
  "start",
  "my-tasks",
  "my-approvals",
  "meine-rolle",
];

/**
 * Modul-Prerequisites (= erlaubte Aktivierungs-/Import-Richtung, ADR-0013):
 * ein oberes Modul benötigt seine Voraussetzungen. `core` ist always-on und
 * damit implizite Voraussetzung von allem.
 */
export const MODULE_PREREQUISITES: Record<ModuleKey, readonly ModuleKey[]> = {
  core: [],
  work: [],
  drumbeat: ["work"],
  budgeting: ["work"],
  risks: ["work"],
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  core: {
    label: "Core & Ziele",
    // Kernel + Ziele/OKR + Org-Struktur (VS/ART) + Setup/Struktur + Admin.
    // `team` ist mit dem Team-Rückbau (fd8164a) entfallen — Plattform bleibt auf
    // Wertstrom + ART.
    segments: ["ziele", "structure", "setup", "transformation", "admin"],
    actions: [
      "target.manage",
      "goal.",
      "kpi.bind",
      "value_stream.",
      "art.",
      "tenant.users.manage",
      "integration.manage",
      "role.capability.manage",
      // Selbstbedienung auf der eigenen Onboarding-Zeile. Liegt bei `core`, weil
      // das Onboarding kein Entitlement-Modul ist und in jedem Tenant laufen
      // muss (ADR-0017) — die Invariante „jede Action hat ein Modul" bleibt so
      // trotzdem erfüllt.
      "role.onboarding.manage",
      "admin.",
    ],
    home: "/ziele",
  },
  work: {
    label: "Work",
    // Epic-Definition/Doku/Freigabe + Feature-Breakdown + Portfolio + Reporting.
    segments: ["portfolio", "feature", "reporting"],
    // `portfolio_filter.manage` sind die persönlich gespeicherten Filter der
    // Portfolio-Übersicht — ohne Work gibt es die Fläche nicht.
    //
    // `solution.` war bis zum Struktur-Umbau **keinem** Modul zugeordnet — die
    // Vollständigkeits-Invariante unten war deswegen dauerhaft rot. Solutions
    // sind Work: sie tragen den Grow-Anteil aus den Primär-Epics.
    actions: ["epic.", "feature.", "solution.", "portfolio_filter.manage"],
    home: "/portfolio",
  },
  drumbeat: {
    label: "Drumbeat",
    // Detailliertes Planen/Ausführen: Cockpit, PI-Planung, Dependencies, Roadmap.
    // Die PI-Kadenz (Timelines/PI-Standards) liegt seit dem Struktur-Umbau unter
    // `/structure/timelines` und wird über `PATH_OVERRIDES` gegated — sie ist
    // deshalb kein eigenes Einstiegssegment mehr.
    segments: ["umsetzung", "implementation", "pi", "pi-planning", "dependencies", "roadmap"],
    actions: ["pi.", "dependency.", "impediment.", "timeline.manage", "pi_standard.manage"],
    home: "/umsetzung",
  },
  budgeting: {
    label: "Budgeting",
    segments: ["budgeting"],
    actions: ["budget.", "budget_plan.", "art_budget.", "rtb_item."],
    home: "/budgeting",
  },
  risks: {
    label: "Risks",
    // Tenant-weites Issue-Register (Risks + Impediments vereint) mit ROAM +
    // Feature/Epic-Verknüpfung (Sibling von Drumbeat/Budgeting, benötigt Work).
    // Siehe docs/concepts/risk-management-module.md.
    segments: ["issues"],
    actions: ["risk."],
    home: "/issues",
  },
};

/** Free-Set eines persönlichen Tenants: nur die Core-Basis (inkl. Ziele). */
export const PERSONAL_DEFAULT_MODULES: readonly ModuleKey[] = ["core"];

const SEGMENT_TO_MODULE: ReadonlyMap<string, ModuleKey> = new Map(
  (Object.entries(MODULES) as [ModuleKey, ModuleDef][]).flatMap(([key, def]) =>
    def.segments.map((s) => [s, key] as const),
  ),
);

/**
 * Unterpfade, die **nicht** dem Modul ihres ersten Segments folgen.
 *
 * Der Bereich `/structure` ist `core` — der Baum aus Wertströmen und ARTs muss
 * in jedem Mandanten erreichbar sein. Zwei Flächen darin gehören aber oberen
 * Modulen: die Solutions-Verwaltung zu **Work**, die PI-Kadenz zu **Drumbeat**.
 * Ohne diese Ausnahmen ließe der Route-Guard sie in jedem Mandanten durch —
 * eine stille Entitlement-Lücke, die man erst bemerkt, wenn jemand eine Fläche
 * bedient, für die er nicht bezahlt.
 *
 * Bewusst eine kurze, explizite Liste statt einer Regel: die Ausnahmen sind
 * wenige und sollen einzeln sichtbar bleiben.
 */
const PATH_OVERRIDES: ReadonlyArray<readonly [prefix: string, module: ModuleKey]> = [
  ["/structure/solutions", "work"],
  ["/structure/solution", "work"],
  ["/structure/timelines", "drumbeat"],
];

/** Locale-Präfix („/de/…") abstreifen; Eingabe darf mit oder ohne kommen. */
function stripLocale(path: string): string {
  const m = /^\/[a-z]{2}(\/|$)/i.exec(path);
  return m ? path.slice(3) : path;
}

/**
 * Modul eines Pfads: `"core"` für die immer verfügbaren `CORE_SEGMENTS`, ein
 * `ModuleKey` für registrierte, `null` für unbekannte Segmente (fail-closed —
 * der Route-Guard behandelt `null` wie „nicht freigeschaltet"). `core`-Modul-
 * Segmente liefern ebenfalls `"core"` (der Key ist gleichlautend).
 */
export function moduleForPath(path: string): ModuleKey | "core" | null {
  const rest = stripLocale(path);
  // Vor der Segment-Regel: sonst gewönne `/structure` → core.
  const override = PATH_OVERRIDES.find(
    ([prefix]) => rest === prefix || rest.startsWith(`${prefix}/`),
  );
  if (override) return override[1];

  const seg = rest.split("/").filter(Boolean)[0];
  if (!seg) return "core"; // Root → /start-Dispatch
  if (CORE_SEGMENTS.includes(seg)) return "core";
  return SEGMENT_TO_MODULE.get(seg) ?? null;
}

/** Modul einer Action (exakt oder Dot-Präfix); `null` = ungegated (tenant.create). */
export function moduleForAction(action: string): ModuleKey | null {
  for (const [key, def] of Object.entries(MODULES) as [ModuleKey, ModuleDef][]) {
    for (const matcher of def.actions) {
      if (matcher.endsWith(".") ? action.startsWith(matcher) : action === matcher) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Erzwingt die Prerequisite-Kette auf einem Modul-Set: `core` ist immer dabei;
 * wer `drumbeat`/`budgeting` hat, bekommt `work` dazu. Ergebnis in
 * `MODULE_KEYS`-Reihenfolge, dedupliziert. Auto-Fulfill (ADR-0013) — nie ein
 * oberes Modul ohne seine Voraussetzung.
 */
export function applyModulePrerequisites(keys: readonly ModuleKey[]): readonly ModuleKey[] {
  const set = new Set<ModuleKey>(keys);
  set.add("core");
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of set) {
      for (const pre of MODULE_PREREQUISITES[k]) {
        if (!set.has(pre)) {
          set.add(pre);
          changed = true;
        }
      }
    }
  }
  return MODULE_KEYS.filter((k) => set.has(k));
}

/**
 * Effektives Entitlement-Set eines Tenants: gespeicherte Liste (auf bekannte
 * Keys gefiltert) oder kind-Default — personal → Free-Set, organization → alle.
 * In beiden Fällen wird die Prerequisite-Kette erzwungen.
 */
export function enabledModulesOrDefault(tenant: {
  kind: string;
  enabledModules: readonly string[];
}): readonly ModuleKey[] {
  const known = tenant.enabledModules.filter((m): m is ModuleKey =>
    (MODULE_KEYS as readonly string[]).includes(m),
  );
  const base =
    known.length > 0 ? known : tenant.kind === "personal" ? PERSONAL_DEFAULT_MODULES : MODULE_KEYS;
  return applyModulePrerequisites(base);
}

/** Einstiegsroute des ersten freigeschalteten Moduls (Redirect-Ziel des Guards). */
export function firstEnabledHome(enabled: readonly ModuleKey[]): string {
  const first = MODULE_KEYS.find((k) => enabled.includes(k));
  return first ? MODULES[first].home : "/my-tasks";
}
