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
  firstEnabledHome,
  PERSONAL_DEFAULT_MODULES,
} from "@/domain/modules";

describe("moduleForPath", () => {
  it("mappt Segmente auf Module (mit und ohne Locale-Präfix)", () => {
    expect(moduleForPath("/de/ziele")).toBe("ziele");
    expect(moduleForPath("/strategy/foo")).toBe("ziele");
    expect(moduleForPath("/en/portfolio/epics/123")).toBe("portfolio");
    expect(moduleForPath("/de/umsetzung")).toBe("program");
    expect(moduleForPath("/controlling/budget-plan")).toBe("controlling");
    expect(moduleForPath("/de/admin/users")).toBe("admin");
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
    expect(moduleForAction("target.manage")).toBe("ziele");
    expect(moduleForAction("goal.custom_field.manage")).toBe("ziele");
    expect(moduleForAction("kpi.bind")).toBe("ziele");
    expect(moduleForAction("epic.hypothesis.decide")).toBe("portfolio");
    expect(moduleForAction("pi.demo.manage")).toBe("program");
    expect(moduleForAction("feature.wsjf.set")).toBe("program");
    expect(moduleForAction("budget_plan.revision.capture")).toBe("controlling");
    expect(moduleForAction("art_budget.manage")).toBe("controlling");
    expect(moduleForAction("timeline.manage")).toBe("structure");
    expect(moduleForAction("pi_standard.manage")).toBe("structure");
    expect(moduleForAction("tenant.users.manage")).toBe("admin");
    expect(moduleForAction("admin.audit-log.read")).toBe("admin");
  });

  it("Präfix-Grenzen: art. trifft nicht art_budget., pi. nicht pi_objective.", () => {
    expect(moduleForAction("art.create")).toBe("program");
    expect(moduleForAction("art_budget.manage")).toBe("controlling");
    expect(moduleForAction("pi.create")).toBe("program");
    expect(moduleForAction("pi_objective.update")).toBe("program");
    expect(moduleForAction("pi_standard.manage")).toBe("structure");
  });

  it("tenant.create ist ungegated (Platform-API)", () => {
    expect(moduleForAction("tenant.create")).toBeNull();
  });
});

describe("enabledModulesOrDefault", () => {
  it("personal ohne Liste ⇒ Free-Set (nur ziele)", () => {
    expect(enabledModulesOrDefault({ kind: "personal", enabledModules: [] })).toEqual(
      PERSONAL_DEFAULT_MODULES,
    );
  });

  it("organization ohne Liste ⇒ alle Module", () => {
    expect(enabledModulesOrDefault({ kind: "organization", enabledModules: [] })).toEqual(
      MODULE_KEYS,
    );
  });

  it("explizite Liste gewinnt; unbekannte Keys werden gefiltert", () => {
    expect(
      enabledModulesOrDefault({ kind: "organization", enabledModules: ["ziele", "bogus"] }),
    ).toEqual(["ziele"]);
  });
});

describe("firstEnabledHome", () => {
  it("liefert das Home des ersten freigeschalteten Moduls", () => {
    expect(firstEnabledHome(["ziele"])).toBe("/ziele");
    expect(firstEnabledHome(["portfolio", "ziele"])).toBe("/ziele"); // Registry-Reihenfolge
    expect(firstEnabledHome([])).toBe("/my-tasks"); // nichts frei ⇒ Core-Inbox
  });
});

describe("Registry-Konsistenz", () => {
  it("kein Segment doppelt (Module untereinander + core)", () => {
    const all = [...CORE_SEGMENTS, ...MODULE_KEYS.flatMap((k) => MODULES[k].segments)];
    expect(new Set(all).size).toBe(all.length);
  });
});
