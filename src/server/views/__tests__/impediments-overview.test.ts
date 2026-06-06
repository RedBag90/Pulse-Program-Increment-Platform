import { describe, it, expect } from "vitest";
import { buildImpedimentsOverviewModel } from "@/server/views/impediments-overview";

const imp = (
  over: Partial<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    roamStatus: string;
    severity: string;
    raisedBy: string | null;
    artId: string;
    piId: string | null;
    createdAt: Date;
    resolution: string | null;
    resolvedAt: Date | null;
  }> = {},
) => ({
  id: "imp-1",
  title: "Test impediment",
  description: null,
  status: "open",
  roamStatus: "open",
  severity: "medium",
  raisedBy: "user-1",
  artId: "art-banking",
  piId: "pi-q2",
  createdAt: new Date("2026-05-01T00:00:00Z"),
  resolution: null,
  resolvedAt: null,
  ...over,
});

const arts = [
  { id: "art-banking", name: "Banking Core" },
  { id: "art-payments", name: "Payments" },
];

const pis = [
  { id: "pi-q1", name: "2026-Q1" },
  { id: "pi-q2", name: "2026-Q2" },
];

const now = new Date("2026-06-06T00:00:00Z");

describe("buildImpedimentsOverviewModel", () => {
  it("emits every ROAM-status slot in the funnel, even when empty", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ roamStatus: "open" }), imp({ id: "i2", roamStatus: "mitigated" })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.roamFunnelCounts).toEqual({
      open: 1,
      resolved: 0,
      owned: 0,
      accepted: 0,
      mitigated: 1,
    });
  });

  it("normalises an unknown roamStatus to 'open'", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ roamStatus: "garbage" })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.roamStatus).toBe("open");
  });

  it("joins ART + PI labels via id, and shows '—' when ART is missing", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ artId: "art-unknown" })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.art).toEqual({ id: "", name: "—" });
  });

  it("computes daysOpen relative to `now`", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ createdAt: new Date("2026-05-22T00:00:00Z") })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.daysOpen).toBe(15);
    expect(m.rows[0]!.isOverdue).toBe(true);
  });

  it("flags isCritical when severity = critical and not when below", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ severity: "critical" }), imp({ id: "i2", severity: "high" })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.isCritical).toBe(true);
    expect(m.rows[1]!.isCritical).toBe(false);
  });

  it("filters ART + PI options to ones that carry impediments", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [imp({ artId: "art-banking", piId: "pi-q2" })],
      arts,
      pis,
      userLabels: {},
      now,
    });
    expect(m.artOptions.map((a) => a.id)).toEqual(["art-banking"]);
    expect(m.piOptions.map((p) => p.id)).toEqual(["pi-q2"]);
  });

  it("dedupes owners and resolves their labels", () => {
    const m = buildImpedimentsOverviewModel({
      impediments: [
        imp({ id: "a", raisedBy: "user-1" }),
        imp({ id: "b", raisedBy: "user-2" }),
        imp({ id: "c", raisedBy: "user-1" }),
      ],
      arts,
      pis,
      userLabels: { "user-1": "Anna", "user-2": "Bob" },
      now,
    });
    expect(m.ownerOptions).toEqual([
      { id: "user-1", label: "Anna" },
      { id: "user-2", label: "Bob" },
    ]);
  });
});
