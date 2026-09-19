import { describe, it, expect } from "vitest";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";

/**
 * Das Modell der **Kadenz-Fläche**. Es baute bis September 2026 über einen
 * `mode`-Schalter auch den Organisations-Baum; der ist entfallen und wird von
 * `structure-overview.ts` abgelöst — samt seiner Tests.
 */
const tl = (over: {
  id: string;
  name: string;
  pis?: number;
  arts?: { id: string; name: string; vs?: string }[];
}) => ({
  id: over.id,
  name: over.name,
  programIncrements: Array.from({ length: over.pis ?? 0 }, (_, i) => ({
    id: `${over.id}-pi${i}`,
    name: `PI ${i + 1}`,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-03-01"),
    status: "planned",
  })),
  arts: (over.arts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    valueStream: { id: "vs1", name: a.vs ?? "Retail" },
  })),
});

describe("buildStructurePageModel — die Kadenz-Fläche", () => {
  it("macht aus jeder Timeline eine Zeile auf oberster Ebene", () => {
    const m = buildStructurePageModel({
      timeline: {
        timelines: [
          tl({ id: "tl1", name: "Standard 10w", pis: 6, arts: [{ id: "a1", name: "Mobile" }] }),
          tl({ id: "tl2", name: "Werks-Kadenz", pis: 4 }),
        ],
        unassignedArts: [],
      },
    });

    expect(m.rows.map((r) => [r.kind, r.depth, r.label, r.subtitle])).toEqual([
      ["timeline", 0, "Standard 10w", "6 PIs · 1 ARTs"],
      ["timeline", 0, "Werks-Kadenz", "4 PIs · 0 ARTs"],
    ]);
    expect(m.kindCounts).toEqual({ vs: 0, art: 0, timeline: 2, solution: 0 });
  });

  it("legt das Detail je Timeline ab — PIs als ISO-Tag, ARTs mit ihrem Wertstrom", () => {
    const m = buildStructurePageModel({
      timeline: {
        timelines: [
          tl({ id: "tl1", name: "Standard", pis: 1, arts: [{ id: "a1", name: "Mobile" }] }),
        ],
        unassignedArts: [],
      },
    });
    const detail = m.timeline.get("tl1")!;
    expect(detail.pis).toEqual([
      {
        id: "tl1-pi0",
        name: "PI 1",
        startDate: "2026-01-01",
        endDate: "2026-03-01",
        status: "planned",
      },
    ]);
    expect(detail.subscribedArts).toEqual([
      { id: "a1", name: "Mobile", valueStreamName: "Retail" },
    ]);
  });

  /**
   * Die ARTs ohne Kadenz hängen an **jedem** Timeline-Detail: dort werden sie
   * zum Zuordnen angeboten. Ein ART, das nirgends auftaucht, wäre nicht mehr
   * eintragbar.
   */
  it("bietet die ARTs ohne Kadenz an jedem Detail zum Zuordnen an", () => {
    const m = buildStructurePageModel({
      timeline: {
        timelines: [tl({ id: "tl1", name: "A" }), tl({ id: "tl2", name: "B" })],
        unassignedArts: [
          { id: "a9", name: "Heimatlos", valueStream: { id: "vs1", name: "Retail" } },
        ],
      },
    });
    const erwartet = [{ id: "a9", name: "Heimatlos", valueStreamName: "Retail" }];
    expect(m.unassignedArts).toEqual(erwartet);
    expect(m.timeline.get("tl1")!.unassignedArts).toEqual(erwartet);
    expect(m.timeline.get("tl2")!.unassignedArts).toEqual(erwartet);
  });
});
