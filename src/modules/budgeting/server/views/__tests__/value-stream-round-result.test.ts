import { describe, it, expect } from "vitest";
import { buildValueStreamRoundResult } from "@/modules/budgeting/server/views/value-stream-round-result";
import type { CandidateRead } from "@/modules/budgeting/server/services/budget-reads";

/**
 * Der Falter des Kachel-Ergebnisses. Die drei Lagen sind der Kern: eine Fläche,
 * die erst spricht, wenn die Kachel durch ist, sieht genauso aus wie eine ohne
 * Kachel — und der Unterschied ist für den Wertstrom-Owner der ganze Punkt.
 */

const kandidat = (over: Partial<CandidateRead> = {}): CandidateRead => ({
  id: "c1",
  kind: "epic",
  epicId: "e1",
  artId: null,
  valueStreamId: "vs1",
  rtbItemId: null,
  title: "Epic",
  ask: 100,
  finalAmount: 80,
  roundId: "r1",
  cycleKey: "2026-H2",
  roundStatus: "closed",
  ...over,
});

const namen = (id: string) => ({ a1: "Materials", a2: "Plant" })[id] ?? id;

describe("buildValueStreamRoundResult", () => {
  it("meldet „keine Kachel“, wenn nichts vorliegt", () => {
    const r = buildValueStreamRoundResult("2026-H2", [], namen);
    expect(r.state).toBe("none");
    expect(r.roundId).toBeNull();
  });

  /** Die laufende Kachel nennt trotzdem den Antrag — sonst wäre die Karte leer. */
  it("meldet die laufende Kachel samt Antragssumme, aber ohne Zeilen", () => {
    const r = buildValueStreamRoundResult(
      "2026-H2",
      [kandidat({ roundStatus: "open", finalAmount: null, ask: 250 })],
      namen,
    );
    expect(r.state).toBe("running");
    expect(r.askTotal).toBe(250);
    expect(r.total).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.roundId).toBe("r1");
  });

  it("gliedert die abgeschlossene Kachel in Betrieb, ARTs und Epics ohne ART", () => {
    const r = buildValueStreamRoundResult(
      "2026-H2",
      [
        kandidat({ id: "1", kind: "rtb", epicId: null, rtbItemId: "i1", ask: 60, finalAmount: 50 }),
        kandidat({ id: "2", artId: "a1", ask: 100, finalAmount: 100 }),
        kandidat({ id: "3", artId: "a1", ask: 100, finalAmount: 20 }),
        kandidat({ id: "4", ask: 40, finalAmount: 30 }),
      ],
      namen,
    );
    expect(r.state).toBe("closed");
    // Absteigend nach Zuspruch — die grösste Zeile führt.
    expect(r.rows.map((x) => [x.label, x.ask, x.amount])).toEqual([
      ["Materials", 200, 120],
      ["Betrieb und ART-Rahmen", 60, 50],
      ["Epics ohne ART", 40, 30],
    ]);
    expect(r.total).toBe(200);
    expect(r.askTotal).toBe(300);
  });

  it("rechnet die Anteile auf Σ dieser Kachel", () => {
    const r = buildValueStreamRoundResult(
      "2026-H2",
      [
        kandidat({ id: "1", artId: "a1", finalAmount: 75 }),
        kandidat({ id: "2", artId: "a2", finalAmount: 25 }),
      ],
      namen,
    );
    expect(r.rows.map((x) => Math.round(x.share * 100))).toEqual([75, 25]);
  });

  /**
   * Eine festgeschriebene Kachel, die einer Zeile **nichts** gegeben hat: die
   * Zeile bleibt stehen. Sie wegzulassen hiesse, den abgelehnten Antrag
   * verschwinden zu lassen.
   */
  it("behält eine Zeile, die leer ausgegangen ist", () => {
    const r = buildValueStreamRoundResult(
      "2026-H2",
      [kandidat({ artId: "a1", ask: 90, finalAmount: 0 })],
      namen,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.amount).toBe(0);
    expect(r.rows[0]?.share).toBe(0);
  });
});
