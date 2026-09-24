import { describe, it, expect } from "vitest";
import {
  periodValidity,
  appliedPeriod,
  timeframeEditability,
  timeframeEditDeniedReason,
  PERIOD_VALIDITY_KEYS,
  type PeriodFacts,
} from "@/modules/budgeting/domain/period-validity";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const at = (s: string) => new Date(`${s}T12:00:00.000Z`);

const tile = (
  id: string,
  status: string,
  start: string | null,
  end: string | null,
): PeriodFacts => ({
  id,
  status,
  startDate: start ? D(start) : null,
  endDate: end ? D(end) : null,
});

describe("periodValidity", () => {
  const done = (start: string, end: string) => tile("t", "closed", start, end);

  /*
   * Seit September 2026 nennt die Tabelle Schlüssel, keine Wörter. Dass es zu
   * jedem in beiden Sprachen einen Text gibt, sichert der Paritätstest in
   * `src/i18n`; hier zählt, dass die drei Zustände je einen eigenen tragen.
   */
  it("nennt die drei Zustände mit je einem eigenen Schlüssel", () => {
    expect(PERIOD_VALIDITY_KEYS.in_preparation).toBe("budgeting.periodValidity.inPreparation");
    expect(PERIOD_VALIDITY_KEYS.applied).toBe("budgeting.periodValidity.applied");
    expect(PERIOD_VALIDITY_KEYS.expired).toBe("budgeting.periodValidity.expired");
  });

  it("gilt zwischen Start und Ende", () => {
    expect(periodValidity(done("2026-07-05", "2026-12-30"), at("2026-09-06"))).toBe("applied");
  });

  it("zählt den ersten und den letzten Tag mit", () => {
    const t = done("2026-07-05", "2026-12-30");
    expect(periodValidity(t, D("2026-07-05"))).toBe("applied");
    expect(periodValidity(t, at("2026-12-30"))).toBe("applied");
    expect(periodValidity(t, D("2026-12-31"))).toBe("expired");
    expect(periodValidity(t, at("2026-07-04"))).toBe("in_preparation");
  });

  it("ist vor dem Start noch in Ausarbeitung, obwohl fertig", () => {
    // Fertig ausgearbeitet, aber noch nicht dran — sie läuft parallel zur
    // geltenden Kachel, genau wie im Prozess vorgesehen.
    expect(periodValidity(done("2027-01-05", "2027-07-02"), at("2026-09-06"))).toBe(
      "in_preparation",
    );
  });

  it("bleibt in Ausarbeitung, solange nicht finalisiert ist — auch mitten im Zeitraum", () => {
    // Ein halbfertiger Rahmen setzt keine Grenzen.
    for (const status of ["draft", "running", "decided"]) {
      expect(periodValidity(tile("t", status, "2026-07-05", "2026-12-30"), at("2026-09-06"))).toBe(
        "in_preparation",
      );
    }
  });

  it("bleibt in Ausarbeitung ohne Zeitraum", () => {
    expect(periodValidity(tile("t", "closed", null, null), at("2026-09-06"))).toBe(
      "in_preparation",
    );
  });
});

describe("appliedPeriod — was gilt heute", () => {
  /** Der gemessene Bestand aus Large Test Corp. */
  const LARGE: PeriodFacts[] = [
    tile("2026-H1", "closed", "2026-01-05", "2026-07-02"),
    tile("2026-H2", "closed", "2026-07-05", "2026-12-30"),
    tile("2027-H1", "running", "2027-01-05", "2027-07-02"),
    tile("2027-H2", "draft", "2027-07-05", "2027-12-30"),
  ];

  it("liefert die Kachel, die heute abdeckt — nicht die, an der gearbeitet wird", () => {
    // Die Regression: `activeCycleFromRounds` lieferte hier 2027-H1, weil sie
    // `running` ist. Deren Zeitraum beginnt erst in vier Monaten.
    const a = appliedPeriod(LARGE, at("2026-09-06"))!;
    expect(a.period.id).toBe("2026-H2");
    expect(a.extended).toBe(false);
  });

  it("lässt in der Lücke die vorige weitergelten — sichtbar markiert", () => {
    // Zwischen je zwei Kacheln klaffen 3–10 Tage. Ohne diese Regel verschwänden
    // dort sämtliche Zahlen.
    const a = appliedPeriod(LARGE, at("2027-01-02"))!;
    expect(a.period.id).toBe("2026-H2");
    expect(a.extended).toBe(true);
  });

  it("gilt nicht, wenn der Tag in einer unfertigen Kachel liegt", () => {
    // 2027-H1 ist `running` — ihr Zeitraum läuft, aber die Verteilung steht nicht.
    expect(appliedPeriod(LARGE, at("2027-03-01"))).toBeNull();
  });

  it("gilt nicht, wenn es überhaupt nichts Finalisiertes gibt", () => {
    expect(
      appliedPeriod([tile("a", "running", "2026-01-01", "2026-12-31")], at("2026-06-01")),
    ).toBeNull();
    expect(appliedPeriod([], at("2026-06-01"))).toBeNull();
  });

  it("nimmt bei Überschneidung die mit dem späteren Start — und meldet die andere", () => {
    const a = appliedPeriod(
      [
        tile("alt", "closed", "2026-01-01", "2026-12-31"),
        tile("neu", "closed", "2026-06-01", "2026-12-31"),
      ],
      at("2026-09-06"),
    )!;
    expect(a.period.id).toBe("neu");
    expect(a.overlapping.map((p) => p.id)).toEqual(["alt"]);
  });

  it("nimmt in der Lücke die zuletzt abgelaufene, nicht irgendeine", () => {
    const a = appliedPeriod(
      [
        tile("2024", "closed", "2024-01-01", "2024-12-30"),
        tile("2025", "closed", "2025-01-01", "2025-12-30"),
      ],
      at("2025-12-31"),
    )!;
    expect(a.period.id).toBe("2025");
    expect(a.extended).toBe(true);
  });
});

describe("Der Zeitraum einer geltenden Kachel", () => {
  it("erlaubt in der Ausarbeitung alles", () => {
    expect(timeframeEditability("in_preparation")).toEqual({ start: true, end: "free" });
  });

  it("friert den Start ein und lässt das Ende nur nach hinten", () => {
    expect(timeframeEditability("applied")).toEqual({ start: false, end: "extend" });
  });

  it("lässt eine abgelaufene Kachel in Ruhe", () => {
    expect(timeframeEditability("expired")).toEqual({ start: false, end: false });
  });

  const current = { startDate: D("2026-07-05"), endDate: D("2026-12-30") };

  it("lässt das Verlängern zu", () => {
    expect(
      timeframeEditDeniedReason({
        validity: "applied",
        current,
        next: { startDate: D("2026-07-05"), endDate: D("2027-03-31") },
      }),
    ).toBeNull();
  });

  it("weist das Vorziehen des Endes ab — mit Grund", () => {
    const reason = timeframeEditDeniedReason({
      validity: "applied",
      current,
      next: { startDate: D("2026-07-05"), endDate: D("2026-10-01") },
    });
    expect(reason).toContain("verlängern");
  });

  it("weist das Verschieben des Starts ab — mit Grund", () => {
    const reason = timeframeEditDeniedReason({
      validity: "applied",
      current,
      next: { startDate: D("2026-08-01"), endDate: D("2026-12-30") },
    });
    expect(reason).toContain("Start");
  });

  it("lässt eine Kachel in Ausarbeitung frei verschieben", () => {
    expect(
      timeframeEditDeniedReason({
        validity: "in_preparation",
        current,
        next: { startDate: D("2026-08-01"), endDate: D("2026-11-01") },
      }),
    ).toBeNull();
  });

  it("weist jede Änderung an einer abgelaufenen Kachel ab", () => {
    expect(
      timeframeEditDeniedReason({
        validity: "expired",
        current,
        next: { startDate: D("2026-07-05"), endDate: D("2027-12-30") },
      }),
    ).toContain("abgelaufen");
  });
});
