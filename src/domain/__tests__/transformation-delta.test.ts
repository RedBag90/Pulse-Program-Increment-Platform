import { describe, it, expect } from "vitest";
import { ragTier } from "@/domain/transformation-delta";

describe("ragTier", () => {
  it("classifies values into red / amber / green bands", () => {
    expect(ragTier(0)).toBe("red");
    expect(ragTier(0.29)).toBe("red");
    expect(ragTier(0.3)).toBe("amber");
    expect(ragTier(0.69)).toBe("amber");
    expect(ragTier(0.7)).toBe("green");
    expect(ragTier(1)).toBe("green");
  });

  it("returns `done` regardless of value when achieved is true", () => {
    expect(ragTier(0, true)).toBe("done");
    expect(ragTier(1, true)).toBe("done");
  });
});
