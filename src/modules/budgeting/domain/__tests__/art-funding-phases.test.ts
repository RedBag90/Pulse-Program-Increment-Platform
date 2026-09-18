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

  it("beginnt beim ART-Rahmen und sperrt alles dahinter", () => {
    expect(keys(base)).toEqual([
      "budget:current",
      "pb_list:blocked",
      "award:blocked",
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
    expect(keys(f)).toEqual(["budget:done", "pb_list:done", "award:done", "distribute:current"]);
    // Der Sprung führt an **die aufgeklappte Zeile** dieses ARTs, nicht mehr
    // auf eine eigene Seite.
    expect(artFundingPhases(f)[3]!.href).toBe("/budgeting/value-streams/vs1?tab=betrieb&art=a1");
  });

  /**
   * **Derselbe Schritt, zwei Handelnde.** Der einzige Grund, warum das
   * Zusammenlegen von „Aufteilen" und „Verteilen" überhaupt heikel war: die
   * Leiste beantwortet „auf wen warte ich", und die Antwort wechselt mitten im
   * Schritt. Solange der Zuspruch nicht aufgeteilt ist, wartet man auf den
   * Wertstrom; danach auf das ART.
   */
  it("lässt den Handelnden innerhalb des letzten Schritts wandern", () => {
    const f = {
      ...base,
      hasBudgetItem: true,
      roundId: "r1",
      onPbList: true,
      awarded: true,
      arts: [{ artId: "a1", total: 100, distributed: 0 }],
      focusArtId: "a1",
    };
    const vorher = artFundingPhases({ ...f, splitDone: false })[3]!;
    expect(vorher.actor).toBe("value_stream");
    expect(vorher.label).toBe("Aufteilen und verteilen");
    expect(vorher.state).toBe("current");

    const nachher = artFundingPhases({ ...f, splitDone: true })[3]!;
    expect(nachher.actor).toBe("art");
    expect(nachher.label).toBe("Verteilen");
    expect(nachher.state).toBe("current");
  });

  /**
   * Aufgeteilt, aber noch nicht verteilt: **nicht erledigt.** Vor dem
   * Zusammenlegen sagte das der eigene Schritt „Aufteilen: erledigt"; jetzt
   * müsste ein `done`, das nur am Aufteilen hängt, den halben Schritt als
   * fertig ausgeben.
   */
  it("nennt den Schritt erst fertig, wenn auch verteilt ist", () => {
    const f = {
      ...base,
      hasBudgetItem: true,
      roundId: "r1",
      onPbList: true,
      awarded: true,
      splitDone: true,
      arts: [{ artId: "a1", total: 100, distributed: 40 }],
      focusArtId: "a1",
    };
    expect(artFundingPhases(f)[3]!.state).toBe("current");
    expect(
      artFundingPhases({ ...f, arts: [{ artId: "a1", total: 100, distributed: 100 }] })[3]!.state,
    ).toBe("done");
  });

  it("fasst den letzten Schritt auf der Wertstrom-Sicht zusammen", () => {
    // Ohne `focusArtId`: keine Zeile aufgeklappt. Der letzte Schritt fasst dann
    // alle ARTs zusammen und springt in den Reiter, wo die Zeilen stehen.
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
    expect(phases[3]!.detail).toBe("1 von 2");
    expect(phases[3]!.href).toBe("/budgeting/value-streams/vs1?tab=betrieb");
    expect(phases[3]!.state).toBe("current");
  });

  it("trägt je Schritt, wer handelt", () => {
    expect(artFundingPhases(base).map((p) => p.actor)).toEqual([
      "value_stream",
      "period",
      "period",
      // Noch nichts aufgeteilt — also wartet man auf den Wertstrom.
      "value_stream",
    ]);
  });
});

describe("fundingSummary", () => {
  it("nennt Nummer und Namen des aktuellen Schritts", () => {
    expect(fundingSummary(artFundingPhases(base))).toBe("Schritt 1 · ART-Rahmen");
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
