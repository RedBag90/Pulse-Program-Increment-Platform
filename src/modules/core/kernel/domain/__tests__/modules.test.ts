import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MODULE_KEYS,
  MODULES,
  CORE_SEGMENTS,
  moduleForPath,
  moduleForAction,
  enabledModulesOrDefault,
  applyModulePrerequisites,
  firstEnabledHome,
  PERSONAL_DEFAULT_MODULES,
} from "@/modules/core/kernel/domain/modules";
// Laufzeit-Quelle aller Actions: die `Action`-Union ist ein Typ, `POLICIES` ist
// ihr `Record` — die Keys sind damit die vollständige Liste zur Laufzeit.
import { POLICIES, type Action } from "@/server/auth/policies";

describe("moduleForPath", () => {
  it("mappt Segmente auf die 4 Module (mit und ohne Locale-Präfix)", () => {
    expect(moduleForPath("/de/ziele")).toBe("core");
    expect(moduleForPath("/value-streams/123")).toBe("core");
    expect(moduleForPath("/de/admin/users")).toBe("core");
    expect(moduleForPath("/en/portfolio/epics/123")).toBe("work");
    expect(moduleForPath("/de/reporting/portfolio-health")).toBe("work");
    expect(moduleForPath("/de/umsetzung")).toBe("drumbeat");
    expect(moduleForPath("/roadmap/portfolio")).toBe("drumbeat");
    expect(moduleForPath("/budgeting/budget-plan")).toBe("budgeting");
    expect(moduleForPath("/de/issues")).toBe("risks");
  });

  it("core-Segmente + Root sind immer verfügbar", () => {
    expect(moduleForPath("/de/start")).toBe("core");
    expect(moduleForPath("/my-tasks")).toBe("core");
    expect(moduleForPath("/de/my-approvals")).toBe("core");
    expect(moduleForPath("/de")).toBe("core");
    expect(moduleForPath("/")).toBe("core");
  });

  it("unbekannte Segmente ⇒ null (fail-closed)", () => {
    expect(moduleForPath("/de/definitely-not-registered")).toBeNull();
  });

  it("VOLLSTÄNDIGKEIT: jedes Dashboard-Segment ist registriert oder core", () => {
    const dir = join(process.cwd(), "src/app/[locale]/(dashboard)");
    const segments = readdirSync(dir).filter((e) => {
      // Next.js behandelt `_`-präfixierte Ordner als private (keine Route) —
      // z. B. `_components` (Composition-Root-UI wie das Create-Menü).
      if (e.startsWith("_")) return false;
      try {
        return statSync(join(dir, e)).isDirectory();
      } catch {
        return false;
      }
    });
    const unregistered = segments.filter((s) => moduleForPath(`/de/${s}`) === null);
    expect(unregistered).toEqual([]);
  });

  it("GEGENRICHTUNG: jedes registrierte Segment hat auch ein Verzeichnis", () => {
    // Die Vorwärts-Richtung oben fängt neue Routen ohne Registrierung. Diese
    // hier fängt das Gegenteil: ein Rückbau, der die Route löscht und den
    // Registry-Eintrag stehen lässt (so überlebte `core.segments: "team"` den
    // Team-Rückbau). Ein solcher Eintrag behauptet Fachlichkeit, die es nicht
    // mehr gibt — und lässt einen Deep-Link ins Leere durch den Route-Guard.
    const dir = join(process.cwd(), "src/app/[locale]/(dashboard)");
    const registered = [...CORE_SEGMENTS, ...MODULE_KEYS.flatMap((k) => MODULES[k].segments)];
    const orphaned = registered.filter((s) => {
      try {
        return !statSync(join(dir, s)).isDirectory();
      } catch {
        return true;
      }
    });
    expect(orphaned).toEqual([]);
  });
});

describe("moduleForAction", () => {
  it("exakte Namen und Dot-Präfixe", () => {
    expect(moduleForAction("target.manage")).toBe("core");
    expect(moduleForAction("goal.custom_field.manage")).toBe("core");
    expect(moduleForAction("kpi.bind")).toBe("core");
    expect(moduleForAction("value_stream.create")).toBe("core");
    expect(moduleForAction("timeline.manage")).toBe("drumbeat");
    expect(moduleForAction("pi_standard.manage")).toBe("drumbeat");
    expect(moduleForAction("tenant.users.manage")).toBe("core");
    expect(moduleForAction("admin.audit-log.read")).toBe("core");
    expect(moduleForAction("epic.hypothesis.decide")).toBe("work");
    expect(moduleForAction("feature.wsjf.set")).toBe("work");
    expect(moduleForAction("pi.demo.manage")).toBe("drumbeat");
    expect(moduleForAction("dependency.link")).toBe("drumbeat");
    expect(moduleForAction("impediment.raise")).toBe("drumbeat");
    expect(moduleForAction("budget_plan.revision.capture")).toBe("budgeting");
    expect(moduleForAction("art_budget.manage")).toBe("budgeting");
    expect(moduleForAction("risk.suggest")).toBe("risks");
    expect(moduleForAction("risk.settings.manage")).toBe("risks");
  });

  it("Präfix-Grenzen: art. (core) ≠ art_budget. (budgeting), pi. ≠ pi_standard. (beide drumbeat)", () => {
    expect(moduleForAction("art.create")).toBe("core");
    expect(moduleForAction("art_budget.manage")).toBe("budgeting");
    expect(moduleForAction("pi.create")).toBe("drumbeat");
    expect(moduleForAction("pi_standard.manage")).toBe("drumbeat");
  });

  it("tenant.create ist ungegated (Platform-API)", () => {
    expect(moduleForAction("tenant.create")).toBeNull();
  });

  it("VOLLSTÄNDIGKEIT: jede Action der Registry hat ein Modul (nur Platform ist ungegated)", () => {
    // Der Header von modules.ts hält fest, dass ausschließlich `tenant.create`
    // und die Platform-API ohne Modul-Zuordnung bleiben. Ohne diesen Test bleibt
    // eine vergessene Zuordnung stumm — `moduleForAction` liefert dann `null`,
    // und das Action-Gate lässt die Aktion in JEDEM Tenant durch.
    const UNGATED = new Set(["tenant.create", "platform.tenants.manage", "platform.users.manage"]);
    const unmapped = (Object.keys(POLICIES) as Action[])
      .filter((a) => !UNGATED.has(a))
      .filter((a) => moduleForAction(a) === null);
    expect(unmapped).toEqual([]);
  });

  it("KEINE LEICHEN: jeder Action-Matcher trifft mindestens eine echte Action", () => {
    // Gegenrichtung: bleibt beim Rückbau eines Features ein Matcher stehen
    // (wie `team.` / `pi_objective.` nach dem Team-Rückbau), zeigt die Registry
    // eine Fachlichkeit an, die es nicht mehr gibt.
    const actions = Object.keys(POLICIES) as Action[];
    const dead = MODULE_KEYS.flatMap((k) =>
      MODULES[k].actions
        .filter((m) =>
          actions.every((a) => (m.endsWith(".") ? !a.startsWith(m) : a !== m)),
        )
        .map((m) => `${k}: ${m}`),
    );
    expect(dead).toEqual([]);
  });
});

describe("applyModulePrerequisites", () => {
  it("core ist immer dabei", () => {
    expect(applyModulePrerequisites([])).toEqual(["core"]);
    expect(applyModulePrerequisites(["work"])).toEqual(["core", "work"]);
  });

  it("drumbeat/budgeting ziehen work (und core) nach", () => {
    expect(applyModulePrerequisites(["drumbeat"])).toEqual(["core", "work", "drumbeat"]);
    expect(applyModulePrerequisites(["budgeting"])).toEqual(["core", "work", "budgeting"]);
    expect(applyModulePrerequisites(["drumbeat", "budgeting"])).toEqual([
      "core",
      "work",
      "drumbeat",
      "budgeting",
    ]);
  });

  it("risks zieht work (und core) nach", () => {
    expect(applyModulePrerequisites(["risks"])).toEqual(["core", "work", "risks"]);
  });
});

describe("enabledModulesOrDefault", () => {
  it("personal ohne Liste ⇒ Free-Set (nur core)", () => {
    expect(enabledModulesOrDefault({ kind: "personal", enabledModules: [] })).toEqual(
      PERSONAL_DEFAULT_MODULES,
    );
  });

  it("organization ohne Liste ⇒ alle Module", () => {
    expect(enabledModulesOrDefault({ kind: "organization", enabledModules: [] })).toEqual(
      MODULE_KEYS,
    );
  });

  it("explizite Liste gewinnt; unbekannte Keys gefiltert; Prerequisites erzwungen", () => {
    expect(
      enabledModulesOrDefault({ kind: "organization", enabledModules: ["work", "bogus"] }),
    ).toEqual(["core", "work"]);
    expect(enabledModulesOrDefault({ kind: "organization", enabledModules: ["drumbeat"] })).toEqual(
      ["core", "work", "drumbeat"],
    );
  });
});

describe("firstEnabledHome", () => {
  it("liefert das Home des ersten freigeschalteten Moduls (Registry-Reihenfolge)", () => {
    expect(firstEnabledHome(["core"])).toBe("/ziele");
    expect(firstEnabledHome(["core", "work", "drumbeat"])).toBe("/ziele"); // core zuerst
    expect(firstEnabledHome(["work"])).toBe("/portfolio"); // rohe Liste ohne core
    expect(firstEnabledHome([])).toBe("/my-tasks"); // nichts frei ⇒ Core-Inbox
  });
});

describe("Registry-Konsistenz", () => {
  it("kein Segment doppelt (Module untereinander + core)", () => {
    const all = [...CORE_SEGMENTS, ...MODULE_KEYS.flatMap((k) => MODULES[k].segments)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("Prerequisite-Kette schließt (kein oberes Modul ohne work; alles zieht core)", () => {
    for (const k of MODULE_KEYS) {
      const resolved = applyModulePrerequisites([k]);
      expect(resolved).toContain("core");
      if (k === "drumbeat" || k === "budgeting" || k === "risks")
        expect(resolved).toContain("work");
    }
  });
});
