import { describe, it, expect } from "vitest";
import {
  buildPeriodsGallery,
  type PeriodRoundInput,
} from "@/modules/budgeting/server/views/periods-gallery";

const NOW = new Date("2026-03-01T00:00:00.000Z");

function round(p: Partial<PeriodRoundInput> & { id: string }): PeriodRoundInput {
  return {
    cycleKey: "2026-H1",
    status: "draft",
    poolTotal: 1000,
    startDate: null,
    endDate: null,
    submissionDeadline: null,
    participantCount: 0,
    groupCount: 0,
    submittedCount: 0,
    reserveAmount: 0,
    candidateCount: 0,
    staffedGroupCount: 0,
    hasRevision: false,
    ...p,
  };
}

describe("buildPeriodsGallery", () => {
  const from = (start: string, end: string) => ({
    startDate: new Date(`${start}T00:00:00.000Z`),
    endDate: new Date(`${end}T00:00:00.000Z`),
  });

  it("trennt nach **Geltung**, nicht nach Prozess-Status", () => {
    // Vorher stand hier `past = status === "closed"` — eine Kachel wanderte
    // also genau dann ins Archiv, wenn sie fertig ausgearbeitet war und zu
    // gelten begann. „abgelaufen" ist eine Aussage über die Zeit, nicht über
    // den Fortschritt der Vorbereitung.
    const m = buildPeriodsGallery(
      [
        round({ id: "gilt", status: "closed", ...from("2026-01-01", "2026-06-30") }),
        round({ id: "vorbei", status: "closed", ...from("2025-01-01", "2025-06-30") }),
        round({ id: "arbeit", status: "running", ...from("2026-07-01", "2026-12-31") }),
      ],
      true,
      NOW,
    );
    expect(m.focus.map((t) => t.id).sort()).toEqual(["arbeit", "gilt"]);
    expect(m.past.map((t) => t.id)).toEqual(["vorbei"]);
    expect(m.canManage).toBe(true);
  });

  it("nennt die geltende Kachel `active` — nicht die, an der gearbeitet wird", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "gilt", status: "closed", ...from("2026-01-01", "2026-06-30") }),
        round({ id: "arbeit", status: "running", ...from("2026-07-01", "2026-12-31") }),
      ],
      true,
      NOW,
    );
    expect(m.active!.id).toBe("gilt");
    expect(m.active!.validity).toBe("applied");
    expect(m.focus.find((t) => t.id === "arbeit")!.validity).toBe("in_preparation");
  });

  it("markiert eine abgelaufene Kachel, die mangels Nachfolger weitergilt", () => {
    const m = buildPeriodsGallery(
      [round({ id: "alt", status: "closed", ...from("2025-01-01", "2025-12-31") })],
      true,
      NOW,
    );
    expect(m.active!.id).toBe("alt");
    expect(m.active!.extended).toBe(true);
    expect(m.active!.validityLabelKey).toBe("budgeting.periodValidity.applied");
  });

  it("listet nur abgeschlossene Kacheln mit offener Reserve als übertragbar", () => {
    const m = buildPeriodsGallery(
      [
        round({
          id: "a",
          status: "closed",
          cycleKey: "2026-H1",
          reserveAmount: 150_000,
          ...from("2025-01-01", "2025-06-30"),
        }),
        round({
          id: "b",
          status: "closed",
          cycleKey: "2026-H2",
          reserveAmount: 0,
          ...from("2025-07-01", "2025-12-31"),
        }),
        round({ id: "c", status: "running", cycleKey: "2027-H1", reserveAmount: 999 }),
      ],
      true,
      NOW,
    );
    expect(m.carriableReserves).toEqual([
      {
        cycleKey: "2026-H1",
        label: "H1 2026",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        amount: 150_000,
      },
    ]);
  });

  it("markiert Zukunfts-Zeiträume als upcoming", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "future", status: "running", startDate: new Date("2026-07-01T00:00:00.000Z") }),
        round({
          id: "current",
          status: "running",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      false,
      NOW,
    );
    const byId = new Map(m.focus.map((t) => [t.id, t]));
    expect(byId.get("future")!.upcoming).toBe(true);
    expect(byId.get("current")!.upcoming).toBe(false);
  });

  it("sortiert nach Start-Termin, späteste zuerst", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "early", startDate: new Date("2026-01-01T00:00:00.000Z") }),
        round({ id: "late", startDate: new Date("2026-07-01T00:00:00.000Z") }),
      ],
      true,
      NOW,
    );
    expect(m.focus.map((t) => t.id)).toEqual(["late", "early"]);
  });

  it("Abgabe-Kennzahlen wandern in die Kachel", () => {
    const m = buildPeriodsGallery(
      [
        round({
          id: "a",
          status: "running",
          groupCount: 4,
          submittedCount: 2,
          participantCount: 12,
        }),
      ],
      true,
      NOW,
    );
    expect(m.focus[0]).toMatchObject({ groupCount: 4, submittedCount: 2, participantCount: 12 });
  });
});

describe("buildPeriodsGallery — Phase je Kachel", () => {
  it("benennt die laufende Phase statt nur des Status", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "neu" }),
        round({
          id: "verteilt",
          status: "running",
          groupCount: 2,
          staffedGroupCount: 2,
          submittedCount: 1,
        }),
      ],
      true,
      NOW,
    );
    const byId = Object.fromEntries(m.focus.map((t) => [t.id, t.phase]));
    expect(byId["neu"]).toBe("Phase 1 · Rahmen");
    expect(byId["verteilt"]).toBe("Phase 5 · Verteilen");
  });

  it("eine eingefrorene Kachel ist abgeschlossen", () => {
    const m = buildPeriodsGallery(
      [
        round({
          id: "fertig",
          status: "closed",
          poolTotal: 1000,
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-06-30"),
          candidateCount: 3,
          groupCount: 2,
          staffedGroupCount: 2,
          submittedCount: 2,
          hasRevision: true,
        }),
        // Ohne Nachfolger gälte „fertig" weiter, weil heute in keine Kachel
        // fällt — erst diese hier macht sie wirklich abgelaufen.
        round({
          id: "gilt",
          cycleKey: "2026-H1",
          status: "closed",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-06-30T00:00:00.000Z"),
        }),
      ],
      true,
      NOW,
    );
    // Der Zeitraum ist vorbei — die Kachel steht im Archiv, ihre Phase ist fertig.
    expect(m.past[0]!.phase).toBe("abgeschlossen");
    expect(m.past[0]!.validity).toBe("expired");
  });
});

/**
 * **Im Entwurf zählen die Run-the-Business-Zeilen mit, die beim Start entstehen.**
 *
 * `_count.candidates` zählt gespeicherte Kandidaten — und RtB materialisiert
 * erst beim Start. Eine Kachel mit „0 Epics · 1 RtB" stand darum in der Galerie
 * auf Phase 2, während ihr Setup-Reiter den Start längst erlaubte: zwei
 * Flächen, dieselbe Kachel, zwei Aussagen.
 *
 * Geprüft wird der **Builder** mit der Zahl, die der Loader ihm reicht — die
 * Zusammensetzung selbst (`draft ? _count + Vorschau : _count`) ist eine Zeile
 * in `loadPeriodsGallery`.
 */
describe("Kachel mit ausschließlich Run-the-Business", () => {
  const draft = (over: Partial<PeriodRoundInput>) =>
    round({
      id: "r",
      status: "draft",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      staffedGroupCount: 1,
      groupCount: 1,
      ...over,
    });

  const phase = (r: PeriodRoundInput) => buildPeriodsGallery([r], true, NOW).focus[0]!.phase;

  it("steht auf Phase 4, wenn die Vorschau-Zeile mitzählt", () => {
    // 0 Epics + 1 RtB-Vorschau — genau das, was der Loader im Entwurf addiert.
    expect(phase(draft({ candidateCount: 1 }))).toBe("Phase 4 · Runde starten");
  });

  it("bleibt auf der PB-Liste, wenn wirklich nichts darauf steht", () => {
    expect(phase(draft({ candidateCount: 0 }))).toBe("Phase 2 · PB-Liste");
  });
});
