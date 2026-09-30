import { describe, it, expect } from "vitest";
import { tapAction } from "@/modules/core/kernel/domain/tap-focus";

describe("tapAction — Tippen hebt hervor, zweites Tippen öffnet", () => {
  it("Touch: erstes Tippen hebt hervor", () => {
    expect(tapAction(true, null, "a")).toBe("focus");
  });
  it("Touch: Tippen auf das hervorgehobene öffnet", () => {
    expect(tapAction(true, "a", "a")).toBe("open");
  });
  it("Touch: Tippen auf ein anderes wechselt die Hervorhebung", () => {
    expect(tapAction(true, "a", "b")).toBe("focus");
  });
  it("Maus: öffnet sofort", () => {
    expect(tapAction(false, null, "a")).toBe("open");
    expect(tapAction(false, "b", "a")).toBe("open");
  });
});
