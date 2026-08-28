import { describe, it, expect } from "vitest";
import {
  evaluateClosure,
  canTransition,
  nextPiFromCadence,
  PI_TRANSITIONS,
  validateDateRange,
  validatePiDates,
  type PiClosureSnapshot,
} from "@/modules/drumbeat/domain/pi-rules";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";

const D = (s: string) => new Date(s);

describe("nextPiFromCadence", () => {
  it("erzeugt ein kontiguierliches PI gleicher Dauer mit Name PI n+1", () => {
    const pis = [
      { name: "PI 1", startDate: D("2026-01-05"), endDate: D("2026-03-01") },
      { name: "PI 2", startDate: D("2026-03-02"), endDate: D("2026-04-26") },
    ];
    const next = nextPiFromCadence(pis);
    expect(next).not.toBeNull();
    expect(next!.name).toBe("PI 3");
    // Start = letztes Ende + 1 Tag
    expect(next!.startDate.toISOString().slice(0, 10)).toBe("2026-04-27");
    // gleiche Dauer wie das letzte PI (55 Tage)
    const dur = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86_400_000;
    expect(dur(next!.startDate, next!.endDate)).toBe(dur(D("2026-03-02"), D("2026-04-26")));
  });

  it("nummeriert nach der höchsten vorhandenen PI-Nummer, nicht nach der Anzahl", () => {
    const pis = [{ name: "PI 5", startDate: D("2026-01-01"), endDate: D("2026-02-01") }];
    expect(nextPiFromCadence(pis)!.name).toBe("PI 6");
  });

  it("null bei leerer Liste", () => {
    expect(nextPiFromCadence([])).toBeNull();
  });
});

const READY: PiClosureSnapshot = {
  openUnroamedIssues: 0,
  systemDemoAt: new Date("2026-06-01T00:00:00Z"),
  inspectAdaptAt: new Date("2026-06-02T00:00:00Z"),
  retrospectiveNotes: "Ging gut.",
};

describe("evaluateClosure", () => {
  it("ready=true with no reasons when everything is in place", () => {
    expect(evaluateClosure(READY)).toEqual({ ready: true, reasons: [] });
  });

  it("flags open un-ROAMed Issues with the count", () => {
    const r = evaluateClosure({ ...READY, openUnroamedIssues: 3 });
    expect(r.ready).toBe(false);
    expect(r.reasons).toEqual(["3 offene Issue(s) ohne ROAM"]);
  });

  it("flags a missing System-Demo date", () => {
    expect(evaluateClosure({ ...READY, systemDemoAt: null }).reasons).toEqual([
      "System-Demo-Termin fehlt",
    ]);
  });

  it("flags a missing Inspect & Adapt date", () => {
    expect(evaluateClosure({ ...READY, inspectAdaptAt: null }).reasons).toEqual([
      "Inspect & Adapt-Termin fehlt",
    ]);
  });

  it("flags missing retrospective notes (null and whitespace-only)", () => {
    expect(evaluateClosure({ ...READY, retrospectiveNotes: null }).reasons).toEqual([
      "Retrospektive-Notizen fehlen",
    ]);
    expect(evaluateClosure({ ...READY, retrospectiveNotes: "   " }).reasons).toEqual([
      "Retrospektive-Notizen fehlen",
    ]);
  });

  it("collects every reason at once, in order", () => {
    const r = evaluateClosure({
      openUnroamedIssues: 2,
      systemDemoAt: null,
      inspectAdaptAt: null,
      retrospectiveNotes: "",
    });
    expect(r.ready).toBe(false);
    expect(r.reasons).toEqual([
      "2 offene Issue(s) ohne ROAM",
      "System-Demo-Termin fehlt",
      "Inspect & Adapt-Termin fehlt",
      "Retrospektive-Notizen fehlen",
    ]);
  });
});

describe("canTransition", () => {
  it("permits the forward lifecycle steps", () => {
    expect(canTransition("planned", "active")).toBe(true);
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("rejects skips, regressions, self-loops, and exits from the terminal state", () => {
    expect(canTransition("planned", "completed")).toBe(false);
    expect(canTransition("active", "planned")).toBe(false);
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("completed", "planned")).toBe(false);
    expect(canTransition("planned", "planned")).toBe(false);
    expect(canTransition("active", "active")).toBe(false);
  });

  it("completed is terminal in the transition table", () => {
    expect(PI_TRANSITIONS.completed).toEqual([]);
  });
});

const NOW = new Date("2026-06-21T00:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("validateDateRange", () => {
  it("akzeptiert start < end", () => {
    expect(isOk(validateDateRange(day("2026-06-01"), day("2026-08-10")))).toBe(true);
  });
  it("verbietet end <= start", () => {
    expect(isErr(validateDateRange(day("2026-06-01"), day("2026-06-01")))).toBe(true);
    expect(isErr(validateDateRange(day("2026-06-02"), day("2026-06-01")))).toBe(true);
  });
});

describe("validatePiDates", () => {
  it("akzeptiert ein PI in der Zukunft", () => {
    const r = validatePiDates({
      start: day("2026-07-01"),
      end: day("2026-09-10"),
      otherPis: [],
      now: NOW,
    });
    expect(isOk(r)).toBe(true);
  });

  it("verbietet Ueberlapp mit anderem PI", () => {
    const r = validatePiDates({
      start: day("2026-07-01"),
      end: day("2026-09-10"),
      otherPis: [
        { id: "p1", name: "PI-A", startDate: day("2026-08-01"), endDate: day("2026-10-01") },
      ],
      now: NOW,
    });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("conflict");
  });

  it("exkludiert das eigene PI beim Update", () => {
    const r = validatePiDates({
      id: "p1",
      start: day("2026-08-15"),
      end: day("2026-10-25"),
      otherPis: [
        { id: "p1", name: "PI-A", startDate: day("2026-08-01"), endDate: day("2026-10-01") },
      ],
      now: NOW,
    });
    expect(isOk(r)).toBe(true);
  });

  it("verbietet Start > 30 Tage in der Vergangenheit", () => {
    const r = validatePiDates({
      start: day("2026-05-01"),
      end: day("2026-07-15"),
      otherPis: [],
      now: NOW,
    });
    expect(isErr(r)).toBe(true);
  });

  it("akzeptiert Start innerhalb der letzten 30 Tage", () => {
    const r = validatePiDates({
      start: day("2026-06-01"),
      end: day("2026-08-15"),
      otherPis: [],
      now: NOW,
    });
    expect(isOk(r)).toBe(true);
  });

  it("verbietet doppelten PI-Namen in derselben Timeline", () => {
    const r = validatePiDates({
      name: "PI-A",
      start: day("2026-11-01"),
      end: day("2027-01-15"),
      otherPis: [
        { id: "p1", name: "PI-A", startDate: day("2026-08-01"), endDate: day("2026-10-01") },
      ],
      now: NOW,
    });
    expect(isErr(r)).toBe(true);
  });
});
