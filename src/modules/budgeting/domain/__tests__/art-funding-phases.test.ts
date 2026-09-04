import { describe, it, expect } from "vitest";
import {
  artFundingPhases,
  fundingSummary,
  type FundingPhaseFacts,
} from "@/modules/budgeting/domain/art-funding-phases";

const base: FundingPhaseFacts = {
  valueStreamId: "vs1",
  cycleKey: "2026-H2",
  hasBudgetItem: false,
  roundId: null,
  onPbList: false,
  awarded: false,
  splitDone: false,
  arts: [],
};

const keys = (f: FundingPhaseFacts) => artFundingPhases(f).map((p) => `${p.key}:${p.state}`);

describe("artFundingPhases", () => {
  it("vergibt genau einen aktuellen Schritt", () => {
    for (const f of [
      base,
      { ...base, hasBudgetItem: true, roundId: "r1" },
      { ...base, hasBudgetItem: true, roundId: "r1", onPbList: true, awarded: true },
    ]) {
      expect(artFundingPhases(f).filter((p) => p.state === "current")).toHaveLength(1);
    }
  });

  it("beginnt beim ART-Epic-Budget und sperrt alles dahinter", () => {
    expect(keys(base)).toEqual([
      "budget:current",
      "pb_list:blocked",
      "award:blocked",
      "split:blocked",
      "distribute:blocked",
    ]);
  });

  it("nennt die fehlende Kachel als Grund — nicht das fehlende Budget", () => {
    const p = artFundingPhases({ ...base, hasBudgetItem: true });
    expect(p[1]!.blockedBy).toContain("keine Kachel");
    expect(p[1]!.href).toBeNull();
  });

  it("führt bis zum Verteilen, wenn der Zuspruch aufgeteilt ist", () => {
    const f = {
      ...base,
      hasBudgetItem: true,
      roundId: "r1",
      onPbList: true,
      awarded: true,
      splitDone: true,
      arts: [{ artId: "a1", total: 100, distributed: 0 }],
      focusArtId: "a1",
    };
    expect(keys(f)).toEqual([
      "budget:done",
      "pb_list:done",
      "award:done",
      "split:done",
      "distribute:current",
    ]);
    expect(artFundingPhases(f)[4]!.href).toBe("/budgeting/arts/a1?tab=verteilen");
  });

  it("fasst den letzten Schritt auf der Wertstrom-Sicht zusammen", () => {
    // Ohne `focusArtId`: die Wertstrom-Sicht. Schritt 5 gehört den ARTs.
    const phases = artFundingPhases({
      ...base,
      hasBudgetItem: true,
      roundId: "r1",
      onPbList: true,
      awarded: true,
      splitDone: true,
      arts: [
        { artId: "a1", total: 100, distributed: 100 },
        { artId: "a2", total: 80, distributed: 20 },
        { artId: "a3", total: 0, distributed: 0 },
      ],
    });
    // a3 hat kein Budget und zählt nicht mit.
    expect(phases[4]!.detail).toBe("1 von 2");
    expect(phases[4]!.href).toBe("/budgeting/arts?vs=vs1");
    expect(phases[4]!.state).toBe("current");
  });

  it("trägt je Schritt, wer handelt", () => {
    expect(artFundingPhases(base).map((p) => p.actor)).toEqual([
      "value_stream",
      "period",
      "period",
      "value_stream",
      "art",
    ]);
  });
});

describe("fundingSummary", () => {
  it("nennt Nummer und Namen des aktuellen Schritts", () => {
    expect(fundingSummary(artFundingPhases(base))).toBe("Schritt 1 · ART-Epic-Budget");
  });

  it("meldet den Abschluss, wenn nichts mehr offen ist", () => {
    const phases = artFundingPhases({
      ...base,
      hasBudgetItem: true,
      roundId: "r1",
      onPbList: true,
      awarded: true,
      splitDone: true,
      arts: [{ artId: "a1", total: 100, distributed: 100 }],
      focusArtId: "a1",
    });
    expect(fundingSummary(phases)).toBe("fertig");
  });
});
