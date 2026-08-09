import { describe, it, expect } from "vitest";
import {
  prorateArtBudgetToPi,
  computeCapacity,
  computeDemand,
  utilizationBand,
  combineBands,
} from "@/modules/drumbeat/domain/pi-capacity";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("prorateArtBudgetToPi — Halbjahres-Pot anteilig auf das PI", () => {
  const pi = { startDate: utc("2026-01-01"), endDate: utc("2026-04-01") };
  // PI covers Jan 1 → Apr 1 = 90 days; H1'26 (Jan 1 → Jul 1) = 181 days.
  // 800k × (90 / 181) ≈ 397.79k
  it("prorates a single half-year cell by day overlap", () => {
    const v = prorateArtBudgetToPi(pi, { "2026-H1": 800_000 });
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo((800_000 * 90) / 181, 0);
  });

  it("returns null when no matching half-year key exists", () => {
    expect(prorateArtBudgetToPi(pi, { "2027-H1": 999_999 })).toBeNull();
    expect(prorateArtBudgetToPi(pi, {})).toBeNull();
  });

  it("sums across a PI that straddles two half-years", () => {
    // Apr 1 → Sep 30 = 182 days; H1 share = 91 days (Apr–Jun), H2 share = 91 days (Jul–Sep).
    const straddling = { startDate: utc("2026-04-01"), endDate: utc("2026-09-30") };
    const v = prorateArtBudgetToPi(straddling, { "2026-H1": 600_000, "2026-H2": 1_000_000 });
    const expected = (600_000 * 91) / 181 + (1_000_000 * 91) / 184; // H2 = Jul–Dec = 184 days
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo(expected, 0);
  });
});

describe("computeCapacity — override beats prorated", () => {
  const pi = {
    id: "pi-1",
    startDate: utc("2026-01-01"),
    endDate: utc("2026-04-01"),
    capacityJobSize: null,
    capacityAmount: null,
  };

  it("uses the override € when set, source = 'override'", () => {
    const c = computeCapacity({ ...pi, capacityAmount: 250_000 }, { "2026-H1": 800_000 });
    expect(c.capacityAmount).toBe(250_000);
    expect(c.capacityAmountSource).toBe("override");
  });

  it("prorates from the ART budget when no override", () => {
    const c = computeCapacity(pi, { "2026-H1": 800_000 });
    expect(c.capacityAmount).toBeCloseTo((800_000 * 90) / 181, 0);
    expect(c.capacityAmountSource).toBe("prorated");
  });

  it("returns null amount + null source when no override and no matching budget", () => {
    const c = computeCapacity(pi, null);
    expect(c.capacityAmount).toBeNull();
    expect(c.capacityAmountSource).toBeNull();
  });

  it("carries the Job-Size override through unchanged", () => {
    const c = computeCapacity({ ...pi, capacityJobSize: 50 }, null);
    expect(c.capacityJobSize).toBe(50);
  });
});

describe("computeDemand", () => {
  it("sums Job-Size for features on the matching PI; ignores null and other PIs", () => {
    const d = computeDemand(
      [
        { piId: "pi-1", wsjfJobSize: 8 },
        { piId: "pi-1", wsjfJobSize: 5 },
        { piId: "pi-1", wsjfJobSize: null },
        { piId: "pi-2", wsjfJobSize: 20 },
        { piId: null, wsjfJobSize: 13 },
      ],
      "pi-1",
      null,
    );
    expect(d.jobSizeSum).toBe(13);
    expect(d.featureCount).toBe(3); // 3 rows on pi-1 (including the null Job-Size one)
    expect(d.amountSum).toBeNull();
  });

  it("converts to € when costPerJobSizePoint is set", () => {
    const d = computeDemand(
      [
        { piId: "pi-1", wsjfJobSize: 10 },
        { piId: "pi-1", wsjfJobSize: 5 },
      ],
      "pi-1",
      8_000,
    );
    expect(d.jobSizeSum).toBe(15);
    expect(d.amountSum).toBe(120_000);
  });
});

describe("utilizationBand — Ampel-Schwellen 80% / 100%", () => {
  it("ok at ≤ 80%, warn in (80%, 100%], over > 100%", () => {
    expect(utilizationBand(80, 100)).toBe("ok");
    expect(utilizationBand(81, 100)).toBe("warn");
    expect(utilizationBand(100, 100)).toBe("warn");
    expect(utilizationBand(101, 100)).toBe("over");
  });

  it("is ok when capacity is null/zero (no constraint to compare against)", () => {
    expect(utilizationBand(999, null)).toBe("ok");
    expect(utilizationBand(999, 0)).toBe("ok");
  });
});

describe("combineBands — der schlechtere zählt", () => {
  it("picks the worst of two bands", () => {
    expect(combineBands("ok", "warn")).toBe("warn");
    expect(combineBands("warn", "over")).toBe("over");
    expect(combineBands("over", "ok")).toBe("over");
    expect(combineBands("ok", "ok")).toBe("ok");
  });
});
