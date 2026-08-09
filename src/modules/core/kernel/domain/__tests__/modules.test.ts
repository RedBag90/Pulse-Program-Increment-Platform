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

describe("moduleForPath", () => {
  it("mappt Segmente auf die 4 Module (mit und ohne Locale-Präfix)", () => {
    expect(moduleForPath("/de/ziele")).toBe("core");
    expect(moduleForPath("/value-streams/123")).toBe("core");
    expect(moduleForPath("/de/admin/users")).toBe("core");
    expect(moduleForPath("/en/portfolio/epics/123")).toBe("work");
    expect(moduleForPath("/de/reporting/portfolio-health")).toBe("work");
    expect(moduleForPath("/de/umsetzung")).toBe("drumbeat");
    expect(moduleForPath("/roadmap/portfolio")).toBe("drumbeat");
    expect(moduleForPath("/controlling/budget-plan")).toBe("budgeting");
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
  });

  it("Präfix-Grenzen: art. (core) ≠ art_budget. (budgeting), pi. ≠ pi_standard. (beide drumbeat)", () => {
    expect(moduleForAction("art.create")).toBe("core");
    expect(moduleForAction("art_budget.manage")).toBe("budgeting");
    expect(moduleForAction("pi.create")).toBe("drumbeat");
    expect(moduleForAction("pi_objective.update")).toBe("drumbeat");
    expect(moduleForAction("pi_standard.manage")).toBe("drumbeat");
  });

  it("tenant.create ist ungegated (Platform-API)", () => {
    expect(moduleForAction("tenant.create")).toBeNull();
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
      if (k === "drumbeat" || k === "budgeting") expect(resolved).toContain("work");
    }
  });
});
