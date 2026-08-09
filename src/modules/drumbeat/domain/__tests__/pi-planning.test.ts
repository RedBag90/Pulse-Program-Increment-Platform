import { describe, it, expect } from "vitest";
import { validateDateRange, validatePiDates } from "@/modules/drumbeat/domain/pi-planning";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";

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
