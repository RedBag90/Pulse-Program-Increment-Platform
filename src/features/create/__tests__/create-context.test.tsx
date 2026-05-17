import { describe, it, expect } from "vitest";
import { parseCreateContext } from "@/features/create/create-context";
import { CREATE_REGISTRY } from "@/features/create/registry";

describe("parseCreateContext", () => {
  it("returns an empty context for top-level routes", () => {
    expect(parseCreateContext("/portfolio/epics")).toEqual({});
    expect(parseCreateContext("/")).toEqual({});
  });

  it("extracts epicId from an epic detail route", () => {
    expect(parseCreateContext("/portfolio/epics/abc-123")).toEqual({ epicId: "abc-123" });
  });

  it("extracts artId from an ART route and its nested pages", () => {
    expect(parseCreateContext("/art/art-1")).toEqual({ artId: "art-1" });
    expect(parseCreateContext("/art/art-1/features")).toEqual({ artId: "art-1" });
  });

  it("extracts piId and featureId", () => {
    expect(parseCreateContext("/pi/pi-9")).toEqual({ piId: "pi-9" });
    expect(parseCreateContext("/feature/feat-7")).toEqual({ featureId: "feat-7" });
  });
});

describe("CREATE_REGISTRY resolveHref", () => {
  function entry(key: string) {
    const e = CREATE_REGISTRY.find((x) => x.key === key);
    if (!e) throw new Error(`no registry entry: ${key}`);
    return e;
  }

  it("deep-links a feature create when an ART context is present", () => {
    expect(entry("feature").resolveHref({ artId: "art-1" })).toBe(
      "/art/art-1/features?create=feature",
    );
  });

  it("falls back to the ART list when there is no ART context", () => {
    expect(entry("feature").resolveHref({})).toBe("/art");
  });

  it("makes the Epic create reachable from anywhere", () => {
    expect(entry("epic").resolveHref({})).toBe("/portfolio/epics?create=epic");
  });

  it("deep-links a Story create from a feature context", () => {
    expect(entry("story").resolveHref({ featureId: "f1" })).toBe("/feature/f1?create=story");
  });

  it("routes KPI creation to the Epic's KPIs tab when an epic context exists", () => {
    expect(entry("kpi").resolveHref({ epicId: "e1" })).toBe("/portfolio/epics/e1?tab=kpis");
  });
});
