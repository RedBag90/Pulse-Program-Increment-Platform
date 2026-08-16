import { describe, it, expect } from "vitest";
import {
  pickCurrentPiIndex,
  takePiWindow,
  buildCockpitModel,
  type CockpitRows,
  type CockpitFeatureRow,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

const D = (s: string) => new Date(s);

const NO_PERMS = {
  canUpdate: false,
  canSetDelivery: false,
  canCreate: false,
  canLinkDependency: false,
};

const EMPTY_FILTERS = { status: [], ownerIds: [], epicIds: [], hasBlocker: false };

/** Minimal CockpitRows with everything empty; override per test. */
function rows(partial: Partial<CockpitRows>): CockpitRows {
  return {
    arts: [],
    activePis: [],
    activeFeatureCounts: [],
    selectedArtId: null,
    allPis: [],
    windowCounts: [],
    featureRows: [],
    depRows: [],
    permissions: NO_PERMS,
    view: "board",
    filters: EMPTY_FILTERS,
    userLabels: {},
    now: D("2026-05-15").getTime(),
    ...partial,
  };
}

function featureRow(partial: Partial<CockpitFeatureRow> & { id: string }): CockpitFeatureRow {
  return {
    title: partial.id,
    status: "approved",
    piId: null,
    artId: "art-1",
    parentId: null,
    ownerId: null,
    wsjfComputed: null,
    art: { id: "art-1", name: "ART 1" },
    parent: null,
    dependenciesIn: [],
    ...partial,
  };
}

describe("pickCurrentPiIndex", () => {
  const pis = [
    { startDate: D("2026-01-01"), endDate: D("2026-03-31") }, // PI 26-Q1
    { startDate: D("2026-04-01"), endDate: D("2026-06-30") }, // PI 26-Q2
    { startDate: D("2026-07-01"), endDate: D("2026-09-30") }, // PI 26-Q3
    { startDate: D("2026-10-01"), endDate: D("2026-12-31") }, // PI 26-Q4
  ];

  it("picks the PI whose window contains `now`", () => {
    expect(pickCurrentPiIndex(pis, D("2026-05-15").getTime())).toBe(1);
  });

  it("picks the next future PI when `now` is between two", () => {
    // Eine kleine Luecke ohne PI ist im echten Tenant unwahrscheinlich, der
    // Fallback ist trotzdem die naechste Zukunft.
    const withGap = [
      { startDate: D("2026-01-01"), endDate: D("2026-03-31") },
      { startDate: D("2026-07-01"), endDate: D("2026-09-30") },
    ];
    expect(pickCurrentPiIndex(withGap, D("2026-05-15").getTime())).toBe(1);
  });

  it("picks the last past PI when `now` is after everything", () => {
    expect(pickCurrentPiIndex(pis, D("2027-06-01").getTime())).toBe(3);
  });

  it("returns -1 for an empty list", () => {
    expect(pickCurrentPiIndex([], D("2026-05-15").getTime())).toBe(-1);
  });
});

describe("takePiWindow", () => {
  // Fenster-Konvention (Entscheidung #10): aktueller + 1 vor + 3 nach = 5 PIs.
  const allPis = ["A", "B", "C", "D", "E", "F", "G", "H"];

  it("returns full 5-PI window when current is mid-list", () => {
    // current = index 4 ("E") → start=3 ("D"), end=4+4=8 → D..H
    expect(takePiWindow(allPis, 4)).toEqual(["D", "E", "F", "G", "H"]);
  });

  it("clamps left when current is near the start", () => {
    // current = 0 → start=0, end=0+4=4 → A..D (nur 4 statt 5)
    expect(takePiWindow(allPis, 0)).toEqual(["A", "B", "C", "D"]);
  });

  it("clamps right when current is near the end", () => {
    // current = 7 (last) → start=6, end=min(8, 11)=8 → G..H
    expect(takePiWindow(allPis, 7)).toEqual(["G", "H"]);
  });

  it("returns [] when there is no current PI", () => {
    expect(takePiWindow(allPis, -1)).toEqual([]);
  });
});

describe("buildCockpitModel — active-PI fallback (availableArts counts)", () => {
  it("counts via a direct ART-scoped active PI", () => {
    const model = buildCockpitModel(
      rows({
        arts: [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }],
        activePis: [{ id: "pi-direct", artId: "art-1", timelineId: null }],
        activeFeatureCounts: [{ artId: "art-1", piId: "pi-direct", count: 4 }],
      }),
    );
    expect(model.availableArts).toHaveLength(1);
    expect(model.availableArts[0]!.activeFeatureCount).toBe(4);
  });

  it("falls back to the timeline's active PI when the ART has no direct PI", () => {
    const model = buildCockpitModel(
      rows({
        arts: [{ id: "art-1", name: "ART 1", timelineId: "tl-1", valueStream: null }],
        // No PI with artId === art-1 — only a timeline-scoped active PI.
        activePis: [{ id: "pi-tl", artId: null, timelineId: "tl-1" }],
        activeFeatureCounts: [{ artId: "art-1", piId: "pi-tl", count: 7 }],
      }),
    );
    expect(model.availableArts[0]!.activeFeatureCount).toBe(7);
  });

  it("gives an ART with no resolvable active PI a zero count", () => {
    const model = buildCockpitModel(
      rows({
        arts: [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }],
        activePis: [], // nothing resolves
        activeFeatureCounts: [{ artId: "art-1", piId: "pi-x", count: 9 }],
      }),
    );
    expect(model.availableArts[0]!.activeFeatureCount).toBe(0);
  });
});

describe("buildCockpitModel — current-PI strip windowing", () => {
  const allPis = [
    { id: "q1", name: "26-Q1", startDate: D("2026-01-01"), endDate: D("2026-03-31"), status: "completed" },
    { id: "q2", name: "26-Q2", startDate: D("2026-04-01"), endDate: D("2026-06-30"), status: "active" },
    { id: "q3", name: "26-Q3", startDate: D("2026-07-01"), endDate: D("2026-09-30"), status: "planning" },
    { id: "q4", name: "26-Q4", startDate: D("2026-10-01"), endDate: D("2026-12-31"), status: "planning" },
  ];

  it("windows around the current PI and flags isCurrent by id (not array identity)", () => {
    const model = buildCockpitModel(
      rows({
        arts: [{ id: "art-1", name: "ART 1", timelineId: "tl-1", valueStream: null }],
        selectedArtId: "art-1",
        allPis,
        windowCounts: [{ piId: "q2", count: 3 }],
        now: D("2026-05-15").getTime(), // inside q2
      }),
    );
    // current + 1 before + up to 3 after → q1..q4
    expect(model.piStrip.map((p) => p.id)).toEqual(["q1", "q2", "q3", "q4"]);
    const current = model.piStrip.find((p) => p.isCurrent);
    expect(current?.id).toBe("q2");
    expect(current?.featureCount).toBe(3);
    // exactly one current
    expect(model.piStrip.filter((p) => p.isCurrent)).toHaveLength(1);
    // allPiWindows mirrors every PI regardless of the strip window
    expect(model.allPiWindows.map((w) => w.id)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("emits an empty strip when there is no selected ART", () => {
    const model = buildCockpitModel(rows({ selectedArtId: null, allPis }));
    expect(model.piStrip).toEqual([]);
  });
});

describe("buildCockpitModel — blocker detection", () => {
  it("flags a feature with an open blocking predecessor", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }],
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              { id: "d1", from: { id: "up", title: "Upstream", status: "in_progress" } },
            ],
          }),
        ],
      }),
    );
    expect(model.features[0]!.hasBlocker).toBe(true);
    expect(model.features[0]!.blockerHint).toBe("Upstream");
  });

  it("does not flag when the blocking predecessor is completed", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }],
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              { id: "d1", from: { id: "up", title: "Upstream", status: "completed" } },
            ],
          }),
        ],
      }),
    );
    expect(model.features[0]!.hasBlocker).toBe(false);
    expect(model.features[0]!.blockerHint).toBeNull();
  });
});

describe("buildCockpitModel — owner label resolution", () => {
  const withOwner = (partial: Parameters<typeof rows>[0]) =>
    rows({
      selectedArtId: "art-1",
      arts: [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }],
      ...partial,
    });

  it("resolves the feature owner's label from userLabels", () => {
    const model = buildCockpitModel(
      withOwner({
        featureRows: [featureRow({ id: "f1", ownerId: "u1" })],
        userLabels: { u1: "anna.k@x.dev" },
      }),
    );
    expect(model.features[0]!.ownerName).toBe("anna.k@x.dev");
  });

  it("is null for an unowned feature or an unknown owner id", () => {
    const noOwner = buildCockpitModel(
      withOwner({ featureRows: [featureRow({ id: "f1", ownerId: null })], userLabels: {} }),
    );
    expect(noOwner.features[0]!.ownerName).toBeNull();

    const unknown = buildCockpitModel(
      withOwner({ featureRows: [featureRow({ id: "f1", ownerId: "ghost" })], userLabels: {} }),
    );
    expect(unknown.features[0]!.ownerName).toBeNull();
  });
});

describe("buildCockpitModel — off-scope dependency classification", () => {
  const baseArts = [{ id: "art-1", name: "ART 1", timelineId: null, valueStream: null }];

  it("classifies an off-scope predecessor (from side) with its label", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: baseArts,
        featureRows: [featureRow({ id: "in" })], // only "in" is in scope
        depRows: [
          {
            id: "e1",
            fromId: "ghost",
            toId: "in",
            type: "blocks",
            from: { id: "ghost", title: "Ghost Predecessor" },
            to: { id: "in", title: "in" },
          },
        ],
      }),
    );
    expect(model.dependencies).toHaveLength(1);
    expect(model.dependencies[0]!.offScopeRole).toBe("from");
    expect(model.dependencies[0]!.offScopeLabel).toBe("Ghost Predecessor");
  });

  it("classifies an off-scope successor (to side) with its label", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: baseArts,
        featureRows: [featureRow({ id: "in" })],
        depRows: [
          {
            id: "e2",
            fromId: "in",
            toId: "ghost",
            type: "blocks",
            from: { id: "in", title: "in" },
            to: { id: "ghost", title: "Ghost Successor" },
          },
        ],
      }),
    );
    expect(model.dependencies[0]!.offScopeRole).toBe("to");
    expect(model.dependencies[0]!.offScopeLabel).toBe("Ghost Successor");
  });

  it("keeps a fully in-scope edge with no off-scope role and drops both-off-scope edges", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: baseArts,
        featureRows: [featureRow({ id: "a" }), featureRow({ id: "b" })],
        depRows: [
          {
            id: "in-scope",
            fromId: "a",
            toId: "b",
            type: "depends_on",
            from: { id: "a", title: "a" },
            to: { id: "b", title: "b" },
          },
          {
            id: "both-out",
            fromId: "x",
            toId: "y",
            type: "blocks",
            from: { id: "x", title: "x" },
            to: { id: "y", title: "y" },
          },
        ],
      }),
    );
    expect(model.dependencies.map((d) => d.id)).toEqual(["in-scope"]);
    expect(model.dependencies[0]!.offScopeRole).toBeNull();
    expect(model.dependencies[0]!.offScopeLabel).toBeNull();
  });
});
