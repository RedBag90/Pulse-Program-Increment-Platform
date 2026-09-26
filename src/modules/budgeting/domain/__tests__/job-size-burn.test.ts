import { describe, it, expect } from "vitest";
import {
  BURN_BAND,
  jobSizeBurn,
  streamBurn,
  halfYearWindow,
} from "@/modules/budgeting/domain/job-size-burn";

/**
 * **Plan gegen Ist in Job Size** — erwartet = Budget ÷ Satz, linear über das
 * Halbjahr; Ist = fertige Features bis heute; ±20 % Band.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
// H2 2026: 1. Juli bis 1. Januar — 184 Tage. Heute: genau die Hälfte.
const HALB = d("2026-10-01");

describe("jobSizeBurn", () => {
  it("erwartet = zugeteiltes Budget ÷ Satz", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 300_000,
      rate: 3_000,
      completions: [],
      today: HALB,
    });
    expect(b.expected).toBe(100);
    expect(b.start).toEqual(d("2026-07-01"));
    expect(b.end).toEqual(d("2027-01-01"));
  });

  it("der Plan wächst linear — zur Hälfte des Halbjahrs die Hälfte", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 300_000,
      rate: 3_000,
      completions: [],
      today: HALB,
    });
    // 1.7. bis 1.10. sind 92 von 184 Tagen.
    expect(b.planToday).toBeCloseTo(50);
  });

  it("das Ist zählt nur fertige Features im Halbjahr und bis heute, als Stufen", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 300_000,
      rate: 3_000,
      completions: [
        { at: d("2026-08-15"), jobSize: 8 },
        { at: d("2026-07-10"), jobSize: 5 },
        { at: d("2026-06-30"), jobSize: 13 }, // Vorhalbjahr
        { at: d("2026-11-01"), jobSize: 20 }, // nach heute
        { at: d("2026-08-15"), jobSize: 3 }, // derselbe Tag: eine Stufe
      ],
      today: HALB,
    });
    expect(b.actualToday).toBe(16);
    expect(b.actual.map((p) => [p.at.toISOString().slice(0, 10), p.cumulative])).toEqual([
      ["2026-07-01", 0],
      ["2026-07-10", 5],
      ["2026-08-15", 16],
      ["2026-10-01", 16],
    ]);
  });

  it(`das Band: ±${BURN_BAND * 100} % um den Plan von heute`, () => {
    const mit = (js: number) =>
      jobSizeBurn({
        window: halfYearWindow("2026-H2"),
        allocated: 300_000,
        rate: 3_000,
        completions: [{ at: d("2026-09-01"), jobSize: js }],
        today: HALB,
      });
    // Plan heute = 50.
    expect(mit(45).withinBand).toBe(true);
    expect(mit(35).withinBand).toBe(false);
    expect(mit(35).deviation).toBeCloseTo(-0.3);
    expect(mit(65).withinBand).toBe(false);
    expect(mit(65).deviation).toBeCloseTo(0.3);
  });

  it("mit Satz, aber ohne Budget: kein Plan, eigener Grund", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 0,
      rate: 3_000,
      completions: [{ at: d("2026-09-01"), jobSize: 7 }],
      today: HALB,
    });
    expect(b.reason).toBe("noBudget");
    expect(b.expected).toBeNull();
    expect(b.actualToday).toBe(7);
  });

  it("ohne Satz kein Plan und kein Band — das Ist bleibt", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 300_000,
      rate: null,
      completions: [{ at: d("2026-09-01"), jobSize: 8 }],
      today: HALB,
    });
    expect(b.expected).toBeNull();
    expect(b.planToday).toBeNull();
    expect(b.withinBand).toBeNull();
    expect(b.actualToday).toBe(8);
  });

  it("ein Halbjahr in der Zukunft: Plan ja, Ist leer, kein Vergleich", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2027-H1"),
      allocated: 300_000,
      rate: 3_000,
      completions: [],
      today: HALB,
    });
    expect(b.expected).toBe(100);
    expect(b.planToday).toBe(0);
    expect(b.deviation).toBeNull();
    expect(b.actual).toEqual([{ at: d("2027-01-01"), cumulative: 0 }]);
  });

  it("ein vergangenes Halbjahr: Ist bis zum Ende, Plan ganz", () => {
    const b = jobSizeBurn({
      window: halfYearWindow("2026-H1"),
      allocated: 300_000,
      rate: 3_000,
      completions: [{ at: d("2026-03-01"), jobSize: 90 }],
      today: HALB,
    });
    expect(b.planToday).toBe(100);
    expect(b.actual.at(-1)).toEqual({ at: d("2026-07-01"), cumulative: 90 });
    expect(b.withinBand).toBe(true);
  });
});

describe("streamBurn — der Wertstrom", () => {
  const art = (allocated: number, rate: number | null, js: number) => {
    const completions = [{ at: d("2026-09-01"), jobSize: js }];
    return {
      burn: jobSizeBurn({
        window: halfYearWindow("2026-H2"),
        allocated,
        rate,
        completions,
        today: HALB,
      }),
      completions,
    };
  };

  it("Plan = Σ erwartet der ARTs mit Satz, jede mit ihrem Satz; Ist dieselben ARTs", () => {
    const s = streamBurn(halfYearWindow("2026-H2"), HALB, [
      art(300_000, 3_000, 40), // erwartet 100
      art(100_000, 1_000, 30), // erwartet 100
      art(500_000, null, 99), // ohne Satz: weder Plan noch Ist
    ]);
    expect(s.expected).toBe(200);
    expect(s.actualToday).toBe(70);
    expect(s.planToday).toBeCloseTo(100);
  });

  it('kein ART mit Satz: kein Plan, Grund „kein Satz"', () => {
    const s = streamBurn(halfYearWindow("2026-H2"), HALB, [art(500_000, null, 10)]);
    expect(s.expected).toBeNull();
    expect(s.reason).toBe("noRate");
  });

  it('Satz, aber nichts zugeteilt: kein Plan, Grund „kein Budget" — das Ist bleibt', () => {
    const s = streamBurn(halfYearWindow("2026-H2"), HALB, [art(0, 3_000, 7)]);
    expect(s.expected).toBeNull();
    expect(s.reason).toBe("noBudget");
    expect(s.actualToday).toBe(7);
  });
});

describe("jobSizeBurn — das Fenster ist die Budget-Kachel", () => {
  // Eine Kachel wie im Bestand: 06.07. bis einschliesslich 31.12.
  const kachel = {
    cycleKey: "2026-H2",
    start: d("2026-07-06"),
    end: d("2027-01-01"),
    extended: false,
  };

  it("Plan linear über die Daten der Kachel, nicht über das Kalender-Halbjahr", () => {
    const b = jobSizeBurn({
      window: kachel,
      allocated: 300_000,
      rate: 3_000,
      completions: [],
      today: d("2026-07-06"),
    });
    expect(b.planToday).toBe(0);
    expect(b.start).toEqual(d("2026-07-06"));
  });

  it("Features vor dem Kachel-Start zählen nicht — auch wenn sie im Kalender-Halbjahr liegen", () => {
    const b = jobSizeBurn({
      window: kachel,
      allocated: 300_000,
      rate: 3_000,
      completions: [
        { at: d("2026-07-02"), jobSize: 13 }, // Kalender-H2, aber vor der Kachel
        { at: d("2026-08-01"), jobSize: 5 },
      ],
      today: HALB,
    });
    expect(b.actualToday).toBe(5);
    expect(b.cycleKey).toBe("2026-H2");
  });

  it("eine fortgeltende Kachel trägt das weiter", () => {
    const b = jobSizeBurn({
      window: { ...kachel, extended: true },
      allocated: 300_000,
      rate: 3_000,
      completions: [],
      today: d("2027-01-05"),
    });
    expect(b.extended).toBe(true);
    expect(b.planToday).toBe(100);
  });
});
