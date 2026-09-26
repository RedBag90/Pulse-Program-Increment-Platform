import { describe, it, expect } from "vitest";
import { foldValueStreamChange } from "@/modules/budgeting/server/services/value-stream-change-budget";

/**
 * **Veränderungsgeld je Wertstrom** — Portfolio-Epics der Kachel plus der
 * ART-Rahmen seiner ARTs, aufgeteilt wie die Gruppe „Veränderung" der
 * ART-Budget-Übersicht.
 */

const streams = [
  { id: "vs1", name: "Niederlassung Hamburg" },
  { id: "vs2", name: "Zentrale" },
  { id: "vs3", name: "Ohne Geld" },
];
const arts = [
  { id: "a1", valueStreamId: "vs1" },
  { id: "a2", valueStreamId: "vs1" },
  { id: "a3", valueStreamId: "vs2" },
];
const rahmen = (artId: string, epics: number, eigen: number, offen: number) => ({
  artId,
  distributedToEpics: epics,
  distributedToOwnWork: eigen,
  remaining: offen,
});

describe("foldValueStreamChange", () => {
  it("Portfolio je Wertstrom, ART-Rahmen Σ über seine ARTs", () => {
    const r = foldValueStreamChange({
      streams,
      arts,
      portfolioFinals: [
        { valueStreamId: "vs1", amount: 60_000 },
        { valueStreamId: "vs1", amount: 40_000 },
      ],
      frames: [rahmen("a1", 20_000, 5_000, 10_000), rahmen("a2", 0, 0, 15_000)],
    });
    expect(r).toEqual([
      {
        valueStreamId: "vs1",
        name: "Niederlassung Hamburg",
        portfolio: 100_000,
        toEpics: 20_000,
        toOwnWork: 5_000,
        open: 25_000,
      },
    ]);
  });

  it("ein Wertstrom nur mit ART-Rahmen erscheint; einer ohne Geld nicht", () => {
    const r = foldValueStreamChange({
      streams,
      arts,
      portfolioFinals: [],
      frames: [rahmen("a3", 0, 0, 30_000)],
    });
    expect(r.map((x) => x.valueStreamId)).toEqual(["vs2"]);
    expect(r[0]).toMatchObject({ portfolio: 0, open: 30_000 });
  });

  it("ein negativer Rest bleibt negativ — ein gekürzter Rahmen wird nicht versteckt", () => {
    const r = foldValueStreamChange({
      streams,
      arts,
      portfolioFinals: [],
      frames: [rahmen("a3", 50_000, 0, -10_000)],
    });
    expect(r[0]!.open).toBe(-10_000);
  });
});
