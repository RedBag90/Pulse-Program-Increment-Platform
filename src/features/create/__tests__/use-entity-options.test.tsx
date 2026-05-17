import { describe, it, expect } from "vitest";
import { optionsEndpoint } from "@/features/create/use-entity-options";

describe("optionsEndpoint", () => {
  it("returns tenant-wide endpoints with no parameters", () => {
    expect(optionsEndpoint("valueStream")).toBe("/api/v1/value-streams");
    expect(optionsEndpoint("art")).toBe("/api/v1/arts");
    expect(optionsEndpoint("epic")).toBe("/api/v1/initiatives");
  });

  it("returns a parameterised endpoint when the cascading id is present", () => {
    expect(optionsEndpoint("feature", { artId: "art-1" })).toBe("/api/v1/features?artId=art-1");
    expect(optionsEndpoint("pi", { artId: "art-1" })).toBe("/api/v1/pis?artId=art-1");
    expect(optionsEndpoint("team", { artId: "art-1" })).toBe("/api/v1/teams?artId=art-1");
    expect(optionsEndpoint("story", { featureId: "f-1" })).toBe("/api/v1/stories?featureId=f-1");
  });

  it("returns null when a cascading id is still missing", () => {
    expect(optionsEndpoint("feature")).toBeNull();
    expect(optionsEndpoint("pi")).toBeNull();
    expect(optionsEndpoint("team", {})).toBeNull();
    expect(optionsEndpoint("story")).toBeNull();
    expect(optionsEndpoint("story", { artId: "art-1" })).toBeNull();
  });
});
