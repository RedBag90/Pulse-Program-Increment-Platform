import { describe, it, expect } from "vitest";
import {
  evaluateClosure,
  canTransition,
  PI_TRANSITIONS,
  type PiClosureSnapshot,
} from "@/modules/drumbeat/domain/pi-lifecycle";

const READY: PiClosureSnapshot = {
  openUnroamedIssues: 0,
  systemDemoAt: new Date("2026-06-01T00:00:00Z"),
  inspectAdaptAt: new Date("2026-06-02T00:00:00Z"),
  retrospectiveNotes: "Ging gut.",
};

describe("evaluateClosure", () => {
  it("returns [] when everything is in place", () => {
    expect(evaluateClosure(READY)).toEqual([]);
  });

  it("flags open un-ROAMed Issues with the count", () => {
    expect(evaluateClosure({ ...READY, openUnroamedIssues: 3 })).toEqual([
      "3 offene Issue(s) ohne ROAM",
    ]);
  });

  it("flags a missing System-Demo date", () => {
    expect(evaluateClosure({ ...READY, systemDemoAt: null })).toEqual(["System-Demo-Termin fehlt"]);
  });

  it("flags a missing Inspect & Adapt date", () => {
    expect(evaluateClosure({ ...READY, inspectAdaptAt: null })).toEqual([
      "Inspect & Adapt-Termin fehlt",
    ]);
  });

  it("flags missing retrospective notes (null and whitespace-only)", () => {
    expect(evaluateClosure({ ...READY, retrospectiveNotes: null })).toEqual([
      "Retrospektive-Notizen fehlen",
    ]);
    expect(evaluateClosure({ ...READY, retrospectiveNotes: "   " })).toEqual([
      "Retrospektive-Notizen fehlen",
    ]);
  });

  it("collects every reason at once, in order", () => {
    expect(
      evaluateClosure({
        openUnroamedIssues: 2,
        systemDemoAt: null,
        inspectAdaptAt: null,
        retrospectiveNotes: "",
      }),
    ).toEqual([
      "2 offene Issue(s) ohne ROAM",
      "System-Demo-Termin fehlt",
      "Inspect & Adapt-Termin fehlt",
      "Retrospektive-Notizen fehlen",
    ]);
  });
});

describe("canTransition", () => {
  it("permits the forward lifecycle steps", () => {
    expect(canTransition("planned", "active")).toBe(true);
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("rejects skips, regressions, self-loops, and exits from the terminal state", () => {
    expect(canTransition("planned", "completed")).toBe(false);
    expect(canTransition("active", "planned")).toBe(false);
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("completed", "planned")).toBe(false);
    expect(canTransition("planned", "planned")).toBe(false);
    expect(canTransition("active", "active")).toBe(false);
  });

  it("completed is terminal in the transition table", () => {
    expect(PI_TRANSITIONS.completed).toEqual([]);
  });
});
