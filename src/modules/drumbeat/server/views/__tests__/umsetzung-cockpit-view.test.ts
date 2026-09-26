import { describe, it, expect } from "vitest";
import {
  pickCurrentPiIndex,
  takePiWindow,
  resolveAnchorIndex,
  buildCockpitModel,
  type CockpitRows,
  type CockpitFeatureRow,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

const D = (s: string) => new Date(s);

describe("resolveAnchorIndex", () => {
  const pi = (start: string, status: string) => ({
    startDate: D(start),
    endDate: D(start),
    status,
  });

  it("returns the index of the active PI regardless of dates", () => {
    const pis = [
      pi("2026-01-01", "completed"),
      pi("2026-04-01", "active"),
      pi("2026-07-01", "planned"),
    ];
    expect(resolveAnchorIndex(pis, D("2027-01-01").getTime())).toBe(1);
  });

  it("falls back to the clock-derived current PI when none is active", () => {
    const pis = [pi("2026-01-01", "completed"), pi("2026-07-01", "planned")];
    // now inside the second PI's month → nearest future/containing = index 1
    expect(resolveAnchorIndex(pis, D("2026-07-01").getTime())).toBe(
      pickCurrentPiIndex(pis, D("2026-07-01").getTime()),
    );
  });

  it("returns -1 for an empty list (via the fallback)", () => {
    expect(resolveAnchorIndex([], D("2026-05-15").getTime())).toBe(-1);
  });
});

const NO_PERMS = {
  canUpdate: false,
  canSetDelivery: false,
  canCreate: false,
  canLinkDependency: false,
  canAdvance: false,
  canStart: false,
  canDelete: false,
  canEditPi: false,
  canScoreWsjf: false,
};

const EMPTY_FILTERS = { status: [], ownerIds: [], epicIds: [], hasBlocker: false, q: "" };

/** Minimal CockpitRows with everything empty; override per test. */
function rows(partial: Partial<CockpitRows>): CockpitRows {
  return {
    arts: [],
    activePis: [],
    activeFeatureCounts: [],
    selectedArtId: null,
    allPis: [],
    featureRows: [],
    depRows: [],
    hiddenBelowL3: 0,
    graphPositions: {},
    jobSizeByPi: {},
    permissions: NO_PERMS,
    view: "board",
    filters: EMPTY_FILTERS,
    userLabels: {},
    now: D("2026-05-15").getTime(),
    windowOffset: 0,
    selectedPiId: null,
    ...partial,
  };
}

function featureRow(partial: Partial<CockpitFeatureRow> & { id: string }): CockpitFeatureRow {
  return {
    title: partial.id,
    status: "approved",
    piId: null,
    primarySolution: null,
    artId: "art-1",
    parentId: null,
    ownerId: null,
    wsjfComputed: null,
    wsjfJobSize: null,
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    featureType: null,
    art: { id: "art-1", name: "ART 1" },
    parent: null,
    dependenciesIn: [],
    dependenciesOut: [],
    pi: null,
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
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: null,
            valueStream: null,
          },
        ],
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
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: "tl-1",
            valueStream: null,
          },
        ],
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
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: null,
            valueStream: null,
          },
        ],
        activePis: [], // nothing resolves
        activeFeatureCounts: [{ artId: "art-1", piId: "pi-x", count: 9 }],
      }),
    );
    expect(model.availableArts[0]!.activeFeatureCount).toBe(0);
  });
});

describe("buildCockpitModel — current-PI strip windowing", () => {
  const allPis = [
    {
      id: "q1",
      name: "26-Q1",
      startDate: D("2026-01-01"),
      endDate: D("2026-03-31"),
      status: "completed",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q2",
      name: "26-Q2",
      startDate: D("2026-04-01"),
      endDate: D("2026-06-30"),
      status: "active",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q3",
      name: "26-Q3",
      startDate: D("2026-07-01"),
      endDate: D("2026-09-30"),
      status: "planning",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q4",
      name: "26-Q4",
      startDate: D("2026-10-01"),
      endDate: D("2026-12-31"),
      status: "planning",
      capacity: null,
      delivered: 0,
    },
  ];

  it("windows around the current PI and flags isCurrent by id (not array identity)", () => {
    const model = buildCockpitModel(
      rows({
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: "tl-1",
            valueStream: null,
          },
        ],
        selectedArtId: "art-1",
        allPis,
        // Die Kachel-Zahl entsteht aus den Features selbst — nicht mehr aus
        // einer eigenen, ungefilterten Abfrage.
        featureRows: [
          featureRow({ id: "f1", piId: "q2" }),
          featureRow({ id: "f2", piId: "q2" }),
          featureRow({ id: "f3", piId: "q2" }),
        ],
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

describe("buildCockpitModel — selected-PI governance scope", () => {
  const allPis = [
    {
      id: "q1",
      name: "26-Q1",
      startDate: D("2026-01-01"),
      endDate: D("2026-03-31"),
      status: "completed",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q2",
      name: "26-Q2",
      startDate: D("2026-04-01"),
      endDate: D("2026-06-30"),
      status: "active",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q3",
      name: "26-Q3",
      startDate: D("2026-07-01"),
      endDate: D("2026-09-30"),
      status: "planned",
      capacity: null,
      delivered: 0,
    },
  ];
  const base = {
    arts: [
      { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: "tl-1", valueStream: null },
    ],
    selectedArtId: "art-1",
    allPis,
    featureRows: Array.from({ length: 5 }, (_, i) => featureRow({ id: `f${i}`, piId: "q2" })),
    now: D("2026-05-15").getTime(),
  };

  it("defaults the selected PI to the active PI when ?pi is absent", () => {
    const model = buildCockpitModel(rows({ ...base, selectedPiId: null }));
    expect(model.selectedPiId).toBe("q2");
    expect(model.selectedPi?.id).toBe("q2");
    expect(model.selectedPi?.featureCount).toBe(5);
  });

  it("honors a valid ?pi over the active default", () => {
    const model = buildCockpitModel(rows({ ...base, selectedPiId: "q3" }));
    expect(model.selectedPiId).toBe("q3");
    expect(model.selectedPi?.id).toBe("q3");
  });

  it("falls back to the active PI when ?pi is not in this timeline", () => {
    const model = buildCockpitModel(rows({ ...base, selectedPiId: "does-not-exist" }));
    expect(model.selectedPiId).toBe("q2");
  });

  /**
   * Gemeldet: nach einem ART-Wechsel fehlte die Kontext-Leiste (Kapazität,
   * Ziel), bis man ein PI anklickte. Der Wechsel leert `?pi=`, und das ART
   * hatte kein PI im Status `active` — nur eines, das nach Datum „jetzt" ist.
   */
  it("ohne aktives PI und ohne ?pi: das „jetzt“-PI laut Datum", () => {
    const ohneAktives = allPis.map((p) =>
      p.status === "active" ? { ...p, status: "planned" } : p,
    );
    const model = buildCockpitModel(rows({ ...base, allPis: ohneAktives, selectedPiId: null }));
    // now = 2026-05-15 liegt in q2 (April–Juni).
    expect(model.selectedPiId).toBe("q2");
    expect(model.selectedPi?.id).toBe("q2");
  });

  it("ohne aktives PI: ein ?pi aus fremder Taktung fällt ebenso auf das „jetzt“-PI", () => {
    const ohneAktives = allPis.map((p) =>
      p.status === "active" ? { ...p, status: "planned" } : p,
    );
    const model = buildCockpitModel(rows({ ...base, allPis: ohneAktives, selectedPiId: "fremd" }));
    expect(model.selectedPiId).toBe("q2");
  });

  it("has no selected PI without a selected ART", () => {
    const model = buildCockpitModel(rows({ selectedArtId: null, allPis, selectedPiId: "q2" }));
    expect(model.selectedPi).toBeNull();
    expect(model.selectedPiId).toBeNull();
  });
});

describe("buildCockpitModel — blocker detection", () => {
  it("flags a feature with an open blocking predecessor", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: null,
            valueStream: null,
          },
        ],
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              {
                id: "d1",
                type: "blocks",
                from: { id: "up", title: "Upstream", status: "in_progress", pi: null },
              },
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
        arts: [
          {
            id: "art-1",
            name: "ART 1",
            valueStreamId: "vs-1",
            timelineId: null,
            valueStream: null,
          },
        ],
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              {
                id: "d1",
                type: "blocks",
                from: { id: "up", title: "Upstream", status: "completed", pi: null },
              },
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
      arts: [
        { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
      ],
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
  const baseArts = [
    { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
  ];

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
            type: "blocks",
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

/**
 * **Der PI-Scope.** `?pi=` sah aus wie ein Selektor — Ring, `aria-pressed`, im
 * eigenen Docstring so genannt — und filterte nichts. Die Spec begründete das
 * damit, dass das Board schon nach PIs gespalten ist; für Tabelle, Fahrplan und
 * Netz trug das Argument nie.
 */
describe("buildCockpitModel — der PI-Scope grenzt ein, außer im Board", () => {
  const allPis = [
    {
      id: "q1",
      name: "PI 1",
      startDate: D("2026-01-01"),
      endDate: D("2026-03-31"),
      status: "completed",
      capacity: null,
      delivered: 0,
    },
    {
      id: "q2",
      name: "PI 2",
      startDate: D("2026-04-01"),
      endDate: D("2026-06-30"),
      status: "active",
      capacity: null,
      delivered: 0,
    },
  ];
  const base = {
    arts: [
      { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: "tl-1", valueStream: null },
    ],
    selectedArtId: "art-1",
    allPis,
    featureRows: [
      featureRow({ id: "a", piId: "q1" }),
      featureRow({ id: "b", piId: "q2" }),
      featureRow({ id: "c", pi: null }),
    ],
    now: D("2026-05-15").getTime(),
  };

  it("das Board behält alle Features — die PIs sind dort die Spalten", () => {
    const model = buildCockpitModel(rows({ ...base, view: "board", selectedPiId: "q1" }));
    expect(model.features.map((f) => f.id).sort()).toEqual(["a", "b", "c"]);
  });

  for (const view of ["table", "roadmap"] as const) {
    it(`die Sicht „${view}" zeigt nur die Features der gewählten PI`, () => {
      const model = buildCockpitModel(rows({ ...base, view, selectedPiId: "q1" }));
      expect(model.features.map((f) => f.id)).toEqual(["a"]);
    });
  }

  /**
   * **Das Netz ist die Ausnahme.** Eine Abhängigkeit ist ihrem Wesen nach etwas
   * zwischen Zeiträumen — gemessen überquert die Mehrheit eine PI-Grenze. Eine
   * Netzsicht auf ein einzelnes PI kann genau das weder zeigen noch anlegen.
   * Diese Zusicherung steht gegen den Rückfall.
   */
  it("die Sicht \u201enetwork\u201c zeigt das ganze Fenster plus Backlog", () => {
    const model = buildCockpitModel(rows({ ...base, view: "network", selectedPiId: "q1" }));
    expect(model.features.map((f) => f.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("das Netz lässt weg, was außerhalb des Fensters liegt", () => {
    const model = buildCockpitModel(
      rows({
        ...base,
        view: "network",
        selectedPiId: "q1",
        featureRows: [...base.featureRows, featureRow({ id: "weit-weg", piId: "q99" })],
      }),
    );
    expect(model.features.map((f) => f.id)).not.toContain("weit-weg");
  });

  it("ohne jedes PI bleibt alles stehen", () => {
    // Ohne PI gibt es keinen Scope. Ohne *aktives* PI dagegen gilt seit
    // September 2026 das „jetzt"-PI laut Datum — siehe den Block zum
    // gewählten PI.
    const model = buildCockpitModel(
      rows({ ...base, allPis: [], view: "table", selectedPiId: null }),
    );
    expect(model.selectedPiId).toBeNull();
    expect(model.features).toHaveLength(3);
  });

  it("ohne aktives PI grenzt die Tabelle auf das „jetzt“-PI ein — wie mit aktivem", () => {
    const model = buildCockpitModel(
      rows({
        ...base,
        allPis: allPis.map((p) => ({ ...p, status: "planned" })),
        view: "table",
        selectedPiId: null,
      }),
    );
    expect(model.features.map((f) => f.id)).toEqual(["b"]);
  });
});

/**
 * **Die Zähler und die Zellen sagen dasselbe.** Vorher zählte eine eigene
 * `groupBy`-Abfrage ohne jeden Filter: neben einer gefilterten Liste stand eine
 * ungefilterte Zahl, und niemand konnte sehen, warum sie nicht zusammenpassten.
 */
describe("buildCockpitModel — die Kachel-Zahl folgt den Filtern", () => {
  const allPis = [
    {
      id: "q1",
      name: "PI 1",
      startDate: D("2026-01-01"),
      endDate: D("2026-03-31"),
      status: "active",
      capacity: null,
      delivered: 0,
    },
  ];
  const base = {
    arts: [
      { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: "tl-1", valueStream: null },
    ],
    selectedArtId: "art-1",
    allPis,
    now: D("2026-02-15").getTime(),
  };

  it("zählt, was der Filter übrig lässt", () => {
    const featureRows = [
      featureRow({ id: "a", piId: "q1", status: "approved" }),
      featureRow({ id: "b", piId: "q1", status: "approved" }),
      featureRow({ id: "c", piId: "q1", status: "completed" }),
    ];
    const ohne = buildCockpitModel(rows({ ...base, featureRows }));
    expect(ohne.piStrip[0]?.featureCount).toBe(3);

    // Derselbe Bestand, aber der Loader hat schon auf `approved` eingegrenzt.
    const mit = buildCockpitModel(
      rows({
        ...base,
        featureRows: featureRows.filter((f) => f.status === "approved"),
        filters: { ...EMPTY_FILTERS, status: ["approved"] },
      }),
    );
    expect(mit.piStrip[0]?.featureCount).toBe(2);
  });

  it("die Kontext-Leiste zählt wie die Kachel", () => {
    const model = buildCockpitModel(
      rows({ ...base, featureRows: [featureRow({ id: "a", piId: "q1" })] }),
    );
    expect(model.selectedPi?.featureCount).toBe(model.piStrip[0]?.featureCount);
  });

  /**
   * **Der Nenner steht, der Zähler wandert — mit Absicht.**
   *
   * Die Job-Size-Summe ist der Zähler der Überbuchung. Bis September 2026
   * lief sie über dieselbe Schleife wie die Kachelzahl: ein Status-Filter,
   * und das rote „158 / 79" verschwand. Jetzt kommt sie aus dem Loader über
   * die ungefilterte planbare Menge — und der Builder darf sie nicht aus den
   * gefilterten Zeilen neu rechnen.
   */
  it("lässt die Job-Size-Summe stehen, wenn der Filter die Zeilen kürzt", () => {
    const featureRows = [
      featureRow({ id: "a", piId: "q1", status: "approved", wsjfJobSize: 8 }),
      featureRow({ id: "b", piId: "q1", status: "completed", wsjfJobSize: 13 }),
    ];
    const jobSizeByPi = { q1: 21 };

    const ohne = buildCockpitModel(rows({ ...base, featureRows, jobSizeByPi }));
    const mit = buildCockpitModel(
      rows({
        ...base,
        featureRows: featureRows.filter((f) => f.status === "approved"),
        filters: { ...EMPTY_FILTERS, status: ["approved"] },
        jobSizeByPi,
      }),
    );

    expect(mit.piStrip[0]?.featureCount).toBe(1);
    expect(ohne.piStrip[0]?.featureCount).toBe(2);
    // Die Summe folgt dem Loader, nicht dem Filter.
    expect(mit.piStrip[0]?.plannedJobSize).toBe(21);
    expect(mit.piStrip[0]?.plannedJobSize).toBe(ohne.piStrip[0]?.plannedJobSize);
  });

  it("nimmt die Summe nicht aus den Zeilen — sonst wäre der Filter der Nenner", () => {
    // Zeilen sagen 8, der Loader sagt 21: der Loader gilt.
    const model = buildCockpitModel(
      rows({
        ...base,
        featureRows: [featureRow({ id: "a", piId: "q1", wsjfJobSize: 8 })],
        jobSizeByPi: { q1: 21 },
      }),
    );
    expect(model.piStrip[0]?.plannedJobSize).toBe(21);
    expect(model.selectedPi?.plannedJobSize).toBe(21);
  });
});

/**
 * **Die Solution hängt am Epic, nicht am Feature.** Auf der Karte steht sie
 * trotzdem: im Betrieb muss man sehen, zu welchem Produkt die Arbeit gehört.
 * Gemessen tragen 40 % der Features ein Epic **ohne** Primär-Solution — das
 * darf nicht als leerer Platzhalter durchschlagen.
 */
describe("buildCockpitModel — die Solution des Epics", () => {
  const base = {
    arts: [
      { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: "tl-1", valueStream: null },
    ],
    selectedArtId: "art-1",
  };

  it("reicht den Namen der Primär-Solution an das Feature durch", () => {
    const model = buildCockpitModel(
      rows({
        ...base,
        featureRows: [
          featureRow({
            id: "f1",
            parentId: "e1",
            parent: { id: "e1", title: "Mein Epic", primarySolution: { name: "Logistik Betrieb" } },
          }),
        ],
      }),
    );
    expect(model.features[0]?.parentTitle).toBe("Mein Epic");
    expect(model.features[0]?.solutionName).toBe("Logistik Betrieb");
  });

  it("liefert null, wenn das Epic keine Primär-Solution trägt", () => {
    const model = buildCockpitModel(
      rows({
        ...base,
        featureRows: [
          featureRow({
            id: "f1",
            parentId: "e1",
            parent: { id: "e1", title: "Mein Epic", primarySolution: null },
          }),
        ],
      }),
    );
    expect(model.features[0]?.solutionName).toBeNull();
  });

  it("liefert null, wenn das Feature gar kein Epic hat", () => {
    const model = buildCockpitModel(rows({ ...base, featureRows: [featureRow({ id: "f1" })] }));
    expect(model.features[0]?.solutionName).toBeNull();
  });
});

describe("buildCockpitModel — Job-Size-Ziel aus der Formel", () => {
  const pi = (
    id: string,
    start: string,
    status: string,
    capacity: number | null,
    delivered: number,
  ) => ({
    id,
    name: id,
    startDate: D(start),
    endDate: D(start),
    status,
    capacity,
    delivered,
  });
  const base = {
    arts: [
      { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: "tl-1", valueStream: null },
    ],
    selectedArtId: "art-1",
    featureRows: [],
    now: D("2026-08-15").getTime(),
  };

  it("rechnet das Ziel des gewählten PI aus Kapazität und Lieferung der Vorgänger", () => {
    const allPis = [
      pi("q1", "2026-01-01", "completed", 10, 100), // Quote 10
      pi("q2", "2026-04-01", "completed", 10, 140), // Quote 14
      pi("q3", "2026-07-01", "active", 20, 0),
    ];
    const model = buildCockpitModel(rows({ ...base, allPis, selectedPiId: "q3" }));
    // Ø 12 × 20 × 0,8 = 192
    expect(model.selectedPi?.jobSizeTarget).toMatchObject({ target: 192, reason: "ok" });
    expect(model.selectedPi?.jobSizeTarget?.basis.map((b) => b.piId)).toEqual(["q2", "q1"]);
    expect(model.selectedPi?.capacity).toBe(20);
  });

  it("ein abgeschlossenes PI trägt seine eigene Quote", () => {
    const allPis = [
      pi("q1", "2026-01-01", "completed", 8, 96),
      pi("q2", "2026-07-01", "active", 8, 0),
    ];
    const model = buildCockpitModel(rows({ ...base, allPis, selectedPiId: "q1" }));
    expect(model.selectedPi?.deliveredPerCapacity).toBe(12);
    // Es selbst hat keinen Vorgänger — also kein Ziel, aber mit Grund.
    expect(model.selectedPi?.jobSizeTarget?.reason).toBe("noHistory");
  });

  it("ohne Kapazität im gewählten PI: kein Ziel, Grund noCapacity", () => {
    const allPis = [
      pi("q1", "2026-01-01", "completed", 10, 100),
      pi("q2", "2026-07-01", "active", null, 0),
    ];
    const model = buildCockpitModel(rows({ ...base, allPis, selectedPiId: "q2" }));
    expect(model.selectedPi?.jobSizeTarget).toMatchObject({ target: null, reason: "noCapacity" });
  });
});

describe("buildCockpitModel — Blocker aus eingehenden blocks-Kanten", () => {
  const arts = [
    { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
  ];

  it("eine eingehende blocks-Kante blockiert — mit Link-Ziel", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              {
                id: "d1",
                type: "blocks",
                from: { id: "vor", title: "Vorgänger", status: "approved", pi: null },
              },
            ],
          }),
        ],
      }),
    );
    expect(model.features[0]!.hasBlocker).toBe(true);
    expect(model.features[0]!.blockers).toEqual([
      { id: "vor", title: "Vorgänger", state: "blocking" },
    ]);
  });

  it("nennt alle offenen Blocker, nicht nur den ersten", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesIn: [
              {
                id: "d1",
                type: "blocks",
                from: { id: "b", title: "B", status: "blocked", pi: null },
              },
              {
                id: "d2",
                type: "blocks",
                from: { id: "a", title: "A", status: "in_progress", pi: null },
              },
              {
                id: "d3",
                type: "blocks",
                from: { id: "c", title: "C", status: "completed", pi: null },
              },
            ],
          }),
        ],
      }),
    );
    expect(model.features[0]!.blockers.map((b) => [b.id, b.state])).toEqual([
      ["a", "blocking"],
      ["b", "blocking"],
      ["c", "done"],
    ]);
  });

  it("eine ausgehende blocks-Kante macht die Kachel nicht blockiert — sie blockiert andere", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        filters: { ...EMPTY_FILTERS, hasBlocker: true },
        featureRows: [
          featureRow({
            id: "f1",
            dependenciesOut: [
              {
                id: "d1",
                type: "blocks",
                to: { id: "x", title: "X", status: "approved", pi: null },
              },
            ],
          }),
        ],
      }),
    );
    expect(model.features).toEqual([]);
  });
});

describe("buildCockpitModel — eingeplante Vorgänger blockieren nicht", () => {
  const arts = [
    { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
  ];
  const PI1 = { id: "q1", startDate: D("2026-01-01") };
  const PI2 = { id: "q2", startDate: D("2026-04-01") };
  const PI3 = { id: "q3", startDate: D("2026-07-01") };
  const vor = (id: string, pi: typeof PI1 | null, status = "approved") => ({
    id,
    title: id,
    status,
    pi,
  });

  it("der Fall „Feature 5“: Vorgänger in PI 1, Kachel in PI 2 — nicht blockiert", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({
            id: "f5",
            piId: "q2",
            pi: PI2,
            dependenciesIn: [
              { id: "d1", type: "blocks", from: vor("f6", PI1) },
              { id: "d2", type: "blocks", from: vor("f8", PI1) },
            ],
          }),
        ],
      }),
    );
    const f = model.features[0]!;
    expect(f.blockers.map((b) => b.state)).toEqual(["earlierPi", "earlierPi"]);
    expect(f.hasBlocker).toBe(false);
  });

  it("selbes PI blockiert nicht, späteres PI und Backlog schon", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({
            id: "f1",
            piId: "q2",
            pi: PI2,
            dependenciesIn: [
              { id: "d1", type: "blocks", from: vor("gleich", PI2) },
              { id: "d2", type: "blocks", from: vor("spaeter", PI3) },
              { id: "d3", type: "blocks", from: vor("backlog", null) },
            ],
          }),
        ],
      }),
    );
    const f = model.features[0]!;
    expect(f.blockers.map((b) => [b.id, b.state])).toEqual([
      ["backlog", "blocking"],
      ["spaeter", "blocking"],
      ["gleich", "samePi"],
    ]);
    expect(f.hasBlocker).toBe(true);
  });

  it("der Filter „hat Blocker“ lässt eine Kachel mit nur eingeplanten Vorgängern weg", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        filters: { ...EMPTY_FILTERS, hasBlocker: true },
        featureRows: [
          featureRow({
            id: "f1",
            piId: "q2",
            pi: PI2,
            dependenciesIn: [
              { id: "d1", type: "blocks", from: vor("a", PI1) },
              { id: "d2", type: "blocks", from: vor("b", PI2) },
            ],
          }),
        ],
      }),
    );
    expect(model.features).toEqual([]);
  });
});

describe("buildCockpitModel — Feature-Typ", () => {
  const arts = [
    { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
  ];
  it("reicht bekannte Typen durch und macht unbekannte zu null", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({ id: "a", featureType: "enabler" }),
          featureRow({ id: "b", featureType: "irgendwas" }),
        ],
      }),
    );
    const typ = Object.fromEntries(model.features.map((f) => [f.id, f.featureType]));
    expect(typ).toEqual({ a: "enabler", b: null });
  });
});

describe("buildCockpitModel — wen die Kachel aufhält", () => {
  const arts = [
    { id: "art-1", name: "ART 1", valueStreamId: "vs-1", timelineId: null, valueStream: null },
  ];
  const PI1 = { id: "q1", startDate: D("2026-01-01") };
  const PI2 = { id: "q2", startDate: D("2026-04-01") };

  it("ausgehende blocks-Kanten sind Nachfolger — keine Blocker", () => {
    const model = buildCockpitModel(
      rows({
        selectedArtId: "art-1",
        arts,
        featureRows: [
          featureRow({
            id: "x",
            piId: "q1",
            pi: PI1,
            dependenciesOut: [
              {
                id: "d1",
                type: "blocks",
                to: { id: "y", title: "Y", status: "approved", pi: PI2 },
              },
              {
                id: "d2",
                type: "blocks",
                to: { id: "z", title: "Z", status: "approved", pi: null },
              },
            ],
          }),
        ],
      }),
    );
    const x = model.features[0]!;
    expect(x.blockers).toEqual([]);
    expect(x.hasBlocker).toBe(false);
    // Y liegt nach X → aus Y-Sicht ein Blocker im früheren PI; Z im Backlog
    // ist durch X blockiert.
    expect(x.successors.map((s) => [s.id, s.state])).toEqual([
      ["z", "blocking"],
      ["y", "earlierPi"],
    ]);
  });
});
