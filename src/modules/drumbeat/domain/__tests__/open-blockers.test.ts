import { describe, it, expect } from "vitest";
import {
  blockingOnly,
  classifyBlockers,
  classifySuccessors,
} from "@/modules/drumbeat/domain/open-blockers";

const PI = {
  p1: { id: "p1", startDate: new Date("2026-01-01") },
  p2: { id: "p2", startDate: new Date("2026-04-01") },
  p3: { id: "p3", startDate: new Date("2026-07-01") },
};
const b = (id: string, pi: keyof typeof PI | null, status = "in_progress") => ({
  id,
  title: `Feature ${id}`,
  status,
  pi: pi ? PI[pi] : null,
});
const state = (own: keyof typeof PI | null, blocker: ReturnType<typeof b>) =>
  classifyBlockers({ pi: own ? PI[own] : null, blocksIn: [blocker], dependsOnOut: [] })[0]!.state;

describe("classifyBlockers", () => {
  it("ein Vorgänger im früheren PI blockiert nicht — er ist vorher eingeplant", () => {
    expect(state("p2", b("a", "p1"))).toBe("earlierPi");
  });

  it("ein Vorgänger im selben PI blockiert nicht", () => {
    expect(state("p2", b("a", "p2"))).toBe("samePi");
  });

  it("ein Vorgänger im späteren PI blockiert", () => {
    expect(state("p2", b("a", "p3"))).toBe("blocking");
  });

  it("ein Vorgänger im Backlog blockiert", () => {
    expect(state("p2", b("a", null))).toBe("blocking");
  });

  it("ein Feature im Backlog ist durch jeden offenen Vorgänger blockiert", () => {
    expect(state(null, b("a", "p1"))).toBe("blocking");
    expect(state(null, b("a", null))).toBe("blocking");
  });

  it("erledigte Vorgänger halten nichts auf — auch aus einem späteren PI", () => {
    expect(state("p2", b("a", "p3", "completed"))).toBe("done");
    expect(state("p2", b("a", null, "cancelled"))).toBe("done");
  });

  it("beide Kantenarten, blockierende zuerst, und nur die zählen", () => {
    const r = classifyBlockers({
      pi: PI.p2,
      blocksIn: [b("a", "p2"), b("d", "p1", "completed")],
      dependsOnOut: [b("c", "p3"), b("e", "p1")],
    });
    expect(r.map((x) => [x.id, x.state])).toEqual([
      ["c", "blocking"],
      ["a", "samePi"],
      ["e", "earlierPi"],
      ["d", "done"],
    ]);
    expect(blockingOnly(r)).toHaveLength(1);
  });

  it("derselbe Vorgänger über beide Kanten steht einmal da; fehlende Endpunkte fallen weg", () => {
    const r = classifyBlockers({
      pi: PI.p2,
      blocksIn: [b("a", "p3"), null],
      dependsOnOut: [b("a", "p3")],
    });
    expect(r).toHaveLength(1);
  });
});

describe("classifySuccessors", () => {
  const nach = (own: keyof typeof PI | null, self: keyof typeof PI | null, status = "approved") =>
    classifySuccessors({
      self: { status, pi: self ? PI[self] : null },
      blocksOut: [b("n", own)],
      dependsOnIn: [],
    })[0]!.state;

  it("dieselbe Regel mit vertauschten Rollen — wie die Karte des Nachfolgers sie zeigt", () => {
    expect(nach("p2", "p1")).toBe("earlierPi");
    expect(nach("p2", "p2")).toBe("samePi");
    expect(nach("p1", "p2")).toBe("blocking");
    expect(nach("p2", null)).toBe("blocking");
    expect(nach(null, "p1")).toBe("blocking");
  });

  it("ist das Feature selbst erledigt, hält es niemanden mehr auf", () => {
    expect(nach("p1", "p3", "completed")).toBe("done");
  });

  it("stimmt mit classifyBlockers für dieselbe Kante überein", () => {
    // X (p1) blockiert Y (p2): aus Y-Sicht ist X ein Blocker im früheren PI.
    const ausSichtY = classifyBlockers({
      pi: PI.p2,
      blocksIn: [{ id: "x", title: "X", status: "approved", pi: PI.p1 }],
      dependsOnOut: [],
    })[0]!.state;
    const ausSichtX = classifySuccessors({
      self: { status: "approved", pi: PI.p1 },
      blocksOut: [],
      dependsOnIn: [{ id: "y", title: "Y", status: "approved", pi: PI.p2 }],
    })[0]!.state;
    expect(ausSichtX).toBe(ausSichtY);
  });
});
