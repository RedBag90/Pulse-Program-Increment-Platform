import { describe, it, expect } from "vitest";
import { buildStructurePageModel } from "@/server/views/structure-page";

const vsRow = (over: {
  id: string;
  name: string;
  vmoId?: string | null;
  financeApproverId?: string | null;
  arts?: ReturnType<typeof artRow>[];
}) => ({
  id: over.id,
  name: over.name,
  vmoId: over.vmoId ?? null,
  financeApproverId: over.financeApproverId ?? null,
  arts: over.arts ?? [],
});

const artRow = (over: {
  id: string;
  name: string;
  rteId?: string | null;
  piCadenceWeeks?: number;
  teams?: ReturnType<typeof teamRow>[];
  piCount?: number;
}) => ({
  id: over.id,
  name: over.name,
  piCadenceWeeks: over.piCadenceWeeks ?? 10,
  rteId: over.rteId ?? null,
  _count: { pis: over.piCount ?? 0 },
  teams: over.teams ?? [],
});

const teamRow = (over: {
  id: string;
  name: string;
  scrumMasterId?: string | null;
  productOwnerId?: string | null;
  sprintCount?: number;
}) => ({
  id: over.id,
  name: over.name,
  headcount: 5,
  targetVelocity: 20,
  teamType: "stream_aligned",
  scrumMasterId: over.scrumMasterId ?? null,
  productOwnerId: over.productOwnerId ?? null,
  _count: { sprints: over.sprintCount ?? 0 },
});

describe("buildStructurePageModel", () => {
  it("flattens the VS -> ART -> Team tree into depth-indented rows", () => {
    const m = buildStructurePageModel({
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          vmoId: "u-vmo",
          arts: [
            artRow({
              id: "art1",
              name: "Mobile ART",
              rteId: "u-rte",
              teams: [
                teamRow({ id: "t1", name: "Atlas", scrumMasterId: "u-sm", productOwnerId: "u-po" }),
              ],
            }),
          ],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: { "u-vmo": "VMO", "u-rte": "RTE", "u-sm": "SM", "u-po": "PO" },
      budgetTotals: {},
    });
    const rows = m.rows;
    expect(rows.map((r) => [r.kind, r.depth, r.label])).toEqual([
      ["vs", 0, "Retail"],
      ["art", 1, "Mobile ART"],
      ["team", 2, "Atlas"],
    ]);
    expect(rows[1]!.parentId).toBe("vs1");
    expect(rows[2]!.parentId).toBe("art1");
  });

  it("emits gap signals for missing VMO / RTE / Scrum Master", () => {
    const m = buildStructurePageModel({
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail", // no vmoId, no financeApproverId
          arts: [
            artRow({
              id: "art1",
              name: "Mobile",
              // no rteId
              teams: [teamRow({ id: "t1", name: "Atlas" })], // no SM, no PO
            }),
          ],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: {},
      budgetTotals: {},
    });
    expect(m.rows[0]!.gaps).toContain("Kein:e VMO");
    expect(m.rows[0]!.gaps).toContain("Kein:e Finance-Approver:in");
    expect(m.rows[1]!.gaps).toContain("Kein:e RTE");
    expect(m.rows[2]!.gaps).toContain("Kein:e Scrum Master:in");
    expect(m.rows[2]!.gaps).toContain("Kein:e PO");
  });

  it("resolves person labels via the userLabels map", () => {
    const m = buildStructurePageModel({
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          vmoId: "u1",
          financeApproverId: "u2",
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: { u1: "Alice", u2: "Bob" },
      budgetTotals: {},
    });
    const vs = m.vs.get("vs1")!;
    expect(vs.vmoLabel).toBe("Alice");
    expect(vs.financeApproverLabel).toBe("Bob");
  });

  it("includes timeline rows alongside VS rows at depth 0", () => {
    const m = buildStructurePageModel({
      tree: [vsRow({ id: "vs1", name: "Retail" })],
      timeline: {
        timelines: [
          {
            id: "tl1",
            name: "Standard 10w",
            cadenceWeeks: 10,
            programIncrements: [],
            arts: [],
          },
        ],
        unassignedArts: [],
      },
      userLabels: {},
      budgetTotals: {},
    });
    const timelineRow = m.rows.find((r) => r.kind === "timeline");
    expect(timelineRow).toBeDefined();
    expect(timelineRow!.depth).toBe(0);
    expect(timelineRow!.label).toBe("Standard 10w");
  });

  it("links ART -> Timeline via the subscription list", () => {
    const m = buildStructurePageModel({
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          arts: [artRow({ id: "art1", name: "Mobile" })],
        }),
      ],
      timeline: {
        timelines: [
          {
            id: "tl1",
            name: "Standard 10w",
            cadenceWeeks: 10,
            programIncrements: [],
            arts: [{ id: "art1", name: "Mobile", valueStream: { id: "vs1", name: "Retail" } }],
          },
        ],
        unassignedArts: [],
      },
      userLabels: {},
      budgetTotals: {},
    });
    const art = m.art.get("art1")!;
    expect(art.timelineId).toBe("tl1");
    expect(art.timelineName).toBe("Standard 10w");
  });

  it("counts entities by kind for filter chips", () => {
    const m = buildStructurePageModel({
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          arts: [
            artRow({ id: "art1", name: "Mobile", teams: [teamRow({ id: "t1", name: "Atlas" })] }),
            artRow({ id: "art2", name: "Web" }),
          ],
        }),
        vsRow({ id: "vs2", name: "Payments" }),
      ],
      timeline: {
        timelines: [
          { id: "tl1", name: "Standard", cadenceWeeks: 10, programIncrements: [], arts: [] },
        ],
        unassignedArts: [],
      },
      userLabels: {},
      budgetTotals: {},
    });
    expect(m.kindCounts).toEqual({ vs: 2, art: 2, team: 1, timeline: 1 });
  });
});
