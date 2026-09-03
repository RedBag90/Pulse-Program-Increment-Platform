import { describe, it, expect } from "vitest";
import {
  buildPeriodValueStreams,
  type CandidateFinal,
} from "@/modules/budgeting/server/views/period-valuestreams";

const vsName = (id: string | null) =>
  id === "vs1" ? "Payments" : id === "vs2" ? "Growth" : "Ohne Wertstrom";
const artName = (id: string | null) =>
  id === "a1" ? "Checkout" : id === "a2" ? "Wallet" : "ohne ART";

describe("buildPeriodValueStreams", () => {
  it("faltet Run (RtB) + Change (Epics nach ART) je Value Stream", () => {
    const cands: CandidateFinal[] = [
      { kind: "epic", finalAmount: 420000, valueStreamId: "vs1", artId: "a1" },
      { kind: "epic", finalAmount: 300000, valueStreamId: "vs1", artId: "a2" },
      { kind: "rtb", finalAmount: 180000, valueStreamId: "vs1", artId: null },
      { kind: "epic", finalAmount: 100000, valueStreamId: "vs2", artId: null },
    ];
    const m = buildPeriodValueStreams(cands, vsName, artName);

    const vs1 = m.rows.find((r) => r.valueStreamId === "vs1")!;
    expect(vs1.runTotal).toBe(180000);
    expect(vs1.changeTotal).toBe(720000);
    expect(vs1.total).toBe(900000);
    expect(vs1.arts.map((a) => a.total)).toEqual([420000, 300000]); // nach total sortiert

    const vs2 = m.rows.find((r) => r.valueStreamId === "vs2")!;
    expect(vs2.arts[0]!.artName).toBe("ohne ART");

    expect(m.grandTotal).toBe(1000000);
  });

  it("ignoriert Kandidaten mit finalAmount 0", () => {
    const m = buildPeriodValueStreams(
      [{ kind: "epic", finalAmount: 0, valueStreamId: "vs1", artId: "a1" }],
      vsName,
      artName,
    );
    expect(m.rows).toHaveLength(0);
    expect(m.grandTotal).toBe(0);
  });

  it("sortiert Value Streams nach Gesamtbudget absteigend", () => {
    const m = buildPeriodValueStreams(
      [
        { kind: "epic", finalAmount: 100, valueStreamId: "vs1", artId: null },
        { kind: "epic", finalAmount: 500, valueStreamId: "vs2", artId: null },
      ],
      vsName,
      artName,
    );
    expect(m.rows.map((r) => r.valueStreamId)).toEqual(["vs2", "vs1"]);
  });
});
