import { describe, it, expect } from "vitest";
import {
  stackLabel,
  stackTooltipRows,
  type Stack,
} from "@/modules/work/features/portfolio/components/dashboard/stack-tooltip";

/**
 * Der Fall, der dieses Modul veranlasst hat: der Tooltip der Benefit Velocity
 * zeigte jedes Gate viermal — zweimal durch den Konfidenz-Split (budgetiert /
 * veranschlagt, beide gleich benannt) und noch einmal doppelt durch das
 * Forecast-Segment, das als eigene Bar mitlief.
 */
const stack = (id: string, title: string, confirmed: boolean): Stack => ({
  id,
  title,
  color: "#60a5fa",
  confirmed,
});

const L1 = stack("status:L1", "L1 · Detailing", true);
const L1est = stack("status:L1:est", "L1 · Detailing", false);

describe("stackLabel", () => {
  it("unterscheidet die veranschlagte Serie vom Namen her", () => {
    expect(stackLabel(L1)).toBe("L1 · Detailing");
    expect(stackLabel(L1est)).toBe("L1 · Detailing (veranschlagt)");
  });
});

describe("stackTooltipRows", () => {
  it("der Konfidenz-Split bleibt zwei Zeilen — aber unterscheidbare", () => {
    const rows = stackTooltipRows(
      [
        { dataKey: "status:L1", value: 100 },
        { dataKey: "status:L1:est", value: 40 },
      ],
      [L1, L1est],
    );
    expect(rows.map((r) => r.label)).toEqual(["L1 · Detailing", "L1 · Detailing (veranschlagt)"]);
  });

  it("das Forecast-Segment faltet in seine Serie statt eine eigene Zeile zu bilden", () => {
    const rows = stackTooltipRows(
      [
        { dataKey: "status:L1", value: 100 },
        { dataKey: "status:L1#up", value: 40 },
      ],
      [L1],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(140);
    expect(rows[0]!.forecast).toBe(40);
  });

  it("Serien ohne Beitrag fallen weg", () => {
    const rows = stackTooltipRows(
      [
        { dataKey: "status:L1", value: 0 },
        { dataKey: "status:L1:est", value: 40 },
      ],
      [L1, L1est],
    );
    expect(rows.map((r) => r.id)).toEqual(["status:L1:est"]);
  });

  it("eine Serie aus reinem Forecast bleibt drin", () => {
    const rows = stackTooltipRows(
      [
        { dataKey: "status:L1", value: 0 },
        { dataKey: "status:L1#up", value: 25 },
      ],
      [L1],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(25);
    expect(rows[0]!.forecast).toBe(25);
  });

  it("die stärkste Serie steht oben — der Betrag entscheidet, nicht das Vorzeichen", () => {
    const a = stack("e:a", "Epic A", true);
    const b = stack("e:b", "Epic B", true);
    const rows = stackTooltipRows(
      [
        { dataKey: "e:a", value: 10 },
        { dataKey: "e:b", value: -90 },
      ],
      [a, b],
    );
    expect(rows.map((r) => r.id)).toEqual(["e:b", "e:a"]);
  });

  it("das #pos/#neg-Paar des Cash-Flows faltet vorzeichenrichtig zu einer Zeile", () => {
    const rows = stackTooltipRows(
      [
        { dataKey: "status:L1#pos", value: 0 },
        { dataKey: "status:L1#neg", value: -350 },
      ],
      [L1],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(-350);
    // Nur `#up` ist Forecast — der negative Halbbalken ist es nicht.
    expect(rows[0]!.forecast).toBe(0);
  });

  it("ein Monat ganz ohne Beitrag ergibt keine Zeile", () => {
    expect(stackTooltipRows([{ dataKey: "status:L1", value: 0 }], [L1])).toEqual([]);
  });
});
