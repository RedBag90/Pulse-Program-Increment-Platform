import { describe, it, expect } from "vitest";
import { buildPlanningModel } from "@/server/views/pi-planning";

describe("buildPlanningModel", () => {
  it("flattens the sprint count and maps features (Decimal→number, epic title)", () => {
    const { pis, features } = buildPlanningModel(
      [
        {
          id: "p1",
          name: "PI 1",
          status: "active",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-31"),
          _count: { sprints: 5 },
        },
      ],
      [
        {
          id: "f1",
          title: "F1",
          status: "in_progress",
          wsjfComputed: 3.5,
          parent: { title: "Epic A" },
          piId: "p1",
        },
        { id: "f2", title: "F2", status: "todo", wsjfComputed: null, parent: null, piId: null },
      ],
    );
    expect(pis[0]).toEqual({
      id: "p1",
      name: "PI 1",
      status: "active",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      sprintCount: 5,
    });
    expect(features[0]).toEqual({
      id: "f1",
      title: "F1",
      status: "in_progress",
      wsjf: 3.5,
      epicTitle: "Epic A",
      piId: "p1",
    });
    expect(features[1]).toMatchObject({ wsjf: 0, epicTitle: null, piId: null });
  });
});
