import { describe, it, expect } from "vitest";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";

const vsRow = (over: {
  id: string;
  name: string;
  vmoId?: string | null;
  financeApproverId?: string | null;
  arts?: ReturnType<typeof artRow>[];
  solutions?: ReturnType<typeof solRow>[];
}) => ({
  id: over.id,
  name: over.name,
  description: null,
  vmoId: over.vmoId ?? null,
  financeApproverId: over.financeApproverId ?? null,
  arts: over.arts ?? [],
  solutions: over.solutions ?? [],
});

const solRow = (over: { id: string; name: string; horizon?: string; artId?: string | null }) => ({
  id: over.id,
  name: over.name,
  horizon: over.horizon ?? "h1",
  artId: over.artId ?? null,
});

const artRow = (over: { id: string; name: string; rteId?: string | null; piCount?: number }) => ({
  id: over.id,
  name: over.name,
  description: null,
  rteId: over.rteId ?? null,
  _count: { pis: over.piCount ?? 0 },
});

describe("buildStructurePageModel", () => {
  // Der Baum endet seit dem Team-Rückbau (fd8164a) bei der ART — die Plattform
  // bleibt auf Wertstrom + ART.
  it("flattens the VS -> ART tree into depth-indented rows", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          vmoId: "u-vmo",
          arts: [artRow({ id: "art1", name: "Mobile ART", rteId: "u-rte" })],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: { "u-vmo": "VMO", "u-rte": "RTE" },
    });
    const rows = m.rows;
    expect(rows.map((r) => [r.kind, r.depth, r.label])).toEqual([
      ["vs", 0, "Retail"],
      ["art", 1, "Mobile ART"],
    ]);
    expect(rows[1]!.parentId).toBe("vs1");
  });

  it("emits gap signals for missing Portfolio Manager / Finance-Approver / RTE", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail", // no vmoId, no financeApproverId
          arts: [
            artRow({
              id: "art1",
              name: "Mobile",
              // no rteId
            }),
          ],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: {},
    });
    expect(m.rows[0]!.gaps).toContain("Kein:e Portfolio Manager");
    expect(m.rows[0]!.gaps).toContain("Kein:e Finance-Approver:in");
    expect(m.rows[1]!.gaps).toContain("Kein:e RTE");
  });

  it("resolves person labels via the userLabels map", () => {
    const m = buildStructurePageModel({
      mode: "structure",
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
    });
    const vs = m.vs.get("vs1")!;
    expect(vs.vmoLabel).toBe("Alice");
    expect(vs.financeApproverLabel).toBe("Bob");
  });

  it("structure-mode: timeline-rows tauchen NICHT in der liste auf", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [vsRow({ id: "vs1", name: "Retail" })],
      timeline: {
        timelines: [{ id: "tl1", name: "Standard 10w", programIncrements: [], arts: [] }],
        unassignedArts: [],
      },
      userLabels: {},
    });
    expect(m.rows.find((r) => r.kind === "timeline")).toBeUndefined();
    expect(m.kindCounts.timeline).toBe(0);
  });

  it("timelines-mode: timeline-rows in der liste, KEINE vs/art-rows", () => {
    const m = buildStructurePageModel({
      mode: "timelines",
      tree: [vsRow({ id: "vs1", name: "Retail", arts: [artRow({ id: "art1", name: "Mobile" })] })],
      timeline: {
        timelines: [{ id: "tl1", name: "Standard 10w", programIncrements: [], arts: [] }],
        unassignedArts: [],
      },
      userLabels: {},
    });
    const timelineRow = m.rows.find((r) => r.kind === "timeline");
    expect(timelineRow).toBeDefined();
    expect(timelineRow!.depth).toBe(0);
    expect(timelineRow!.label).toBe("Standard 10w");
    expect(m.rows.find((r) => r.kind === "vs")).toBeUndefined();
    expect(m.rows.find((r) => r.kind === "art")).toBeUndefined();
  });

  it("links ART -> Timeline via the subscription list", () => {
    const m = buildStructurePageModel({
      mode: "structure",
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
            programIncrements: [],
            arts: [{ id: "art1", name: "Mobile", valueStream: { id: "vs1", name: "Retail" } }],
          },
        ],
        unassignedArts: [],
      },
      userLabels: {},
    });
    const art = m.art.get("art1")!;
    expect(art.timelineId).toBe("tl1");
    expect(art.timelineName).toBe("Standard 10w");
  });

  it("counts entities by kind for filter chips", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [
        vsRow({
          id: "vs1",
          name: "Retail",
          arts: [artRow({ id: "art1", name: "Mobile" }), artRow({ id: "art2", name: "Web" })],
        }),
        vsRow({ id: "vs2", name: "Payments" }),
      ],
      timeline: {
        timelines: [{ id: "tl1", name: "Standard", programIncrements: [], arts: [] }],
        unassignedArts: [],
      },
      userLabels: {},
    });
    // structure-mode zaehlt nur vs/art; timeline-count = 0
    expect(m.kindCounts).toEqual({ vs: 2, art: 2, timeline: 0, solution: 0 });
  });
});

/**
 * Die dritte Ebene. Solutions tragen immer einen Wertstrom, aber nur optional
 * einen ART — beide Fälle müssen im Baum einen Platz haben, sonst ist eine
 * Solution über den Baum nicht erreichbar.
 */
describe("buildStructurePageModel — Solutions als dritte Ebene", () => {
  it("hängt eine Solution unter ihren ART, eine ohne ART unter den Wertstrom", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [
        vsRow({
          id: "vs1",
          name: "Produktion",
          arts: [artRow({ id: "art1", name: "OEE" })],
          solutions: [
            solRow({ id: "s1", name: "Produktion Betrieb", artId: "art1" }),
            solRow({ id: "s2", name: "Produktion Pilot", horizon: "h3" }),
          ],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: {},
    });

    expect(m.rows.map((r) => [r.kind, r.label, r.depth, r.parentId])).toEqual([
      ["vs", "Produktion", 0, null],
      ["art", "OEE", 1, "vs1"],
      ["solution", "Produktion Betrieb", 2, "art1"],
      ["solution", "Produktion Pilot", 1, "vs1"],
    ]);
    expect(m.kindCounts.solution).toBe(2);
  });

  it("beschriftet die Solution-Zeile mit ihrem Horizont", () => {
    const m = buildStructurePageModel({
      mode: "structure",
      tree: [
        vsRow({
          id: "vs1",
          name: "Produktion",
          solutions: [solRow({ id: "s1", name: "Pilot", horizon: "h3" })],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: {},
    });
    expect(m.rows.at(-1)?.subtitle).toBe("H3 · R&D");
  });

  // Die Kadenz-Fläche teilt sich das Modell — dort haben Solutions nichts zu suchen.
  it("zeigt im Timelines-Modus keine Solutions", () => {
    const m = buildStructurePageModel({
      mode: "timelines",
      tree: [
        vsRow({
          id: "vs1",
          name: "Produktion",
          solutions: [solRow({ id: "s1", name: "Betrieb" })],
        }),
      ],
      timeline: { timelines: [], unassignedArts: [] },
      userLabels: {},
    });
    expect(m.rows.filter((r) => r.kind === "solution")).toEqual([]);
  });
});
