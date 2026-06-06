import { describe, it, expect } from "vitest";
import { buildImpedimentsListModel } from "@/server/views/impediments-list";

const now = new Date("2026-06-15T00:00:00Z");

const impediment = (
  over: Partial<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    severity: string;
    raisedBy: string | null;
    piId: string | null;
    sprintId: string | null;
    createdAt: Date;
    resolution: string | null;
    resolvedAt: Date | null;
  }>,
) => ({
  id: "i1",
  title: "Impediment 1",
  description: null,
  status: "open",
  severity: "medium",
  raisedBy: "u1",
  piId: null,
  sprintId: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  resolution: null,
  resolvedAt: null,
  ...over,
});

describe("buildImpedimentsListModel", () => {
  it("counts every status slot even when empty", () => {
    const m = buildImpedimentsListModel({
      impediments: [
        impediment({ id: "a", status: "open" }),
        impediment({ id: "b", status: "open" }),
        impediment({ id: "c", status: "escalated" }),
      ],
      pis: [],
      userLabels: {},
      now,
    });
    expect(m.funnelCounts).toEqual({ open: 2, escalated: 1, resolved: 0 });
  });

  it("computes daysOpen from createdAt to the now anchor", () => {
    const m = buildImpedimentsListModel({
      impediments: [impediment({ createdAt: new Date("2026-06-01T00:00:00Z") })],
      pis: [],
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.daysOpen).toBe(14);
  });

  it("flags overdue open impediments (daysOpen > 14)", () => {
    const m = buildImpedimentsListModel({
      impediments: [
        impediment({ id: "fresh", createdAt: new Date("2026-06-13T00:00:00Z") }),
        impediment({ id: "edge", createdAt: new Date("2026-06-01T00:00:00Z") }),
        impediment({ id: "overdue", createdAt: new Date("2026-05-15T00:00:00Z") }),
      ],
      pis: [],
      userLabels: {},
      now,
    });
    const flags = Object.fromEntries(m.rows.map((r) => [r.id, r.isOverdue]));
    expect(flags).toEqual({ fresh: false, edge: false, overdue: true });
  });

  it("derives daysSinceEscalation only for escalated rows", () => {
    const m = buildImpedimentsListModel({
      impediments: [
        impediment({ id: "open", status: "open" }),
        impediment({
          id: "esc",
          status: "escalated",
          createdAt: new Date("2026-06-10T00:00:00Z"),
        }),
      ],
      pis: [],
      userLabels: {},
      now,
    });
    expect(m.rows.find((r) => r.id === "open")!.daysSinceEscalation).toBeNull();
    expect(m.rows.find((r) => r.id === "esc")!.daysSinceEscalation).toBe(5);
  });

  it("emits distinct owner + severity options from the dataset", () => {
    const m = buildImpedimentsListModel({
      impediments: [
        impediment({ id: "a", raisedBy: "u1", severity: "critical" }),
        impediment({ id: "b", raisedBy: "u1", severity: "low" }),
        impediment({ id: "c", raisedBy: "u2", severity: "critical" }),
      ],
      pis: [],
      userLabels: { u1: "Alice", u2: "Bob" },
      now,
    });
    expect(m.ownerOptions.map((o) => o.id).sort()).toEqual(["u1", "u2"]);
    expect(m.severityOptions.sort()).toEqual(["critical", "low"]);
  });

  it("resolves piName from the pis lookup", () => {
    const m = buildImpedimentsListModel({
      impediments: [impediment({ piId: "pi1" })],
      pis: [{ id: "pi1", name: "PI 2026-Q2" }],
      userLabels: {},
      now,
    });
    expect(m.rows[0]!.piName).toBe("PI 2026-Q2");
  });
});
