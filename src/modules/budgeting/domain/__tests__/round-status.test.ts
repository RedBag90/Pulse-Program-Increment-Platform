import { describe, it, expect } from "vitest";
import {
  canTransitionRound,
  roundEditability,
  ROUND_TRANSITIONS,
} from "@/modules/budgeting/domain/round-status";

describe("canTransitionRound", () => {
  it("erlaubt die Vorwärtsschritte", () => {
    expect(canTransitionRound("draft", "running")).toBe(true);
    expect(canTransitionRound("running", "decided")).toBe(true);
    expect(canTransitionRound("decided", "closed")).toBe(true);
  });

  it("verbietet Sprünge, Rückschritte und Ausgänge aus closed", () => {
    expect(canTransitionRound("draft", "decided")).toBe(false);
    expect(canTransitionRound("running", "draft")).toBe(false);
    expect(canTransitionRound("closed", "decided")).toBe(false);
    expect(canTransitionRound("draft", "draft")).toBe(false);
  });

  it("closed ist terminal", () => {
    expect(ROUND_TRANSITIONS.closed).toEqual([]);
  });
});

describe("roundEditability", () => {
  it("draft: nur Rahmen editierbar", () => {
    expect(roundEditability("draft")).toEqual({ frame: true, capture: false, decide: false });
  });
  it("running: nur Erfassung", () => {
    expect(roundEditability("running")).toEqual({ frame: false, capture: true, decide: false });
  });
  it("decided: nur Entscheidung", () => {
    expect(roundEditability("decided")).toEqual({ frame: false, capture: false, decide: true });
  });
  it("closed: nichts editierbar", () => {
    expect(roundEditability("closed")).toEqual({ frame: false, capture: false, decide: false });
  });
});
