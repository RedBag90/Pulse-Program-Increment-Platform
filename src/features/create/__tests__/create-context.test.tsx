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
    expect(parseCreateContext("/structure/art/art-1")).toEqual({ artId: "art-1" });
    expect(parseCreateContext("/structure/art/art-1/features")).toEqual({ artId: "art-1" });
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

  it("deep-links a feature create into the ART's cockpit when an ART context is present", () => {
    expect(entry("feature").resolveHref({ artId: "art-1" })).toBe(
      "/umsetzung?art=art-1&view=table",
    );
  });

  it("falls back to the cockpit when there is no ART context", () => {
    expect(entry("feature").resolveHref({})).toBe("/umsetzung");
  });

  it("makes the Epic create reachable from anywhere", () => {
    expect(entry("epic").resolveHref({})).toBe("/portfolio/epics?create=epic");
  });

  it("exposes an in-place Ziel create under the Strategie group", () => {
    const goal = entry("goal");
    expect(goal.group).toBe("strategy");
    expect(goal.inPlace).toBe(true);
    expect(goal.resolveHref({})).toBe("/ziele?entity=goal&new=1");
  });
});
