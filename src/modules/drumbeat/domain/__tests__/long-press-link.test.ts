import { describe, it, expect } from "vitest";
import { nearerEnd, resolveDrop } from "@/modules/drumbeat/domain/long-press-link";

/** **Touch-Verbindungen, reine Hälfte** — welches Ende, was das Loslassen bedeutet. */
describe("nearerEnd", () => {
  it("greift das Ende, das dem Finger näher liegt", () => {
    expect(nearerEnd({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe("from");
    expect(nearerEnd({ x: 90, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe("to");
  });

  it("bei Gleichstand das Ziel", () => {
    expect(nearerEnd({ x: 50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe("to");
  });
});

describe("resolveDrop", () => {
  it("neue Abhängigkeit auf ein anderes Feature", () => {
    expect(resolveDrop({ kind: "create", fromId: "a" }, "b")).toEqual({
      kind: "create",
      fromId: "a",
      toId: "b",
    });
  });

  it("kein Ziel oder auf sich selbst: nichts", () => {
    expect(resolveDrop({ kind: "create", fromId: "a" }, null)).toBeNull();
    expect(resolveDrop({ kind: "create", fromId: "a" }, "a")).toBeNull();
  });

  const kante = { kind: "relink" as const, depId: "d", fromId: "a", toId: "b" };

  it("Ziel versetzen", () => {
    expect(resolveDrop({ ...kante, end: "to" }, "c")).toEqual({
      kind: "relink",
      depId: "d",
      newFromId: "a",
      newToId: "c",
    });
  });

  it("Quelle versetzen", () => {
    expect(resolveDrop({ ...kante, end: "from" }, "c")).toEqual({
      kind: "relink",
      depId: "d",
      newFromId: "c",
      newToId: "b",
    });
  });

  it("unverändert oder auf das feste Ende: nichts", () => {
    expect(resolveDrop({ ...kante, end: "to" }, "b")).toBeNull();
    expect(resolveDrop({ ...kante, end: "to" }, "a")).toBeNull();
    expect(resolveDrop({ ...kante, end: "from" }, "b")).toBeNull();
  });
});
