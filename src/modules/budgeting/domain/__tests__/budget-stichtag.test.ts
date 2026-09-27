import { describe, it, expect } from "vitest";
import { budgetStichtag, type StichtagPeriod } from "@/modules/budgeting/domain/budget-stichtag";

/**
 * **Der Budget-Stichtag** — eine Antwort auf „welche Kachel gilt", und was
 * daraus folgt: das Halbjahr der Flächen, die Auswahl, das Verteilfenster.
 */

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const at = (s: string) => new Date(`${s}T12:00:00.000Z`);

const kachel = (
  id: string,
  cycleKey: string,
  status: string,
  start: string | null,
  end: string | null,
): StichtagPeriod => ({
  id,
  cycleKey,
  status,
  startDate: start ? D(start) : null,
  endDate: end ? D(end) : null,
});

// Wie im Bestand: Kacheln mit eigenen Daten und Lücken dazwischen.
const H1 = kachel("h1", "2026-H1", "closed", "2026-01-06", "2026-07-03");
const H2 = kachel("h2", "2026-H2", "closed", "2026-07-10", "2027-01-08");
const H2_OFFEN = { ...H2, status: "running" };

describe("budgetStichtag — welche Kachel gilt", () => {
  it("eine finalisierte Kachel, die den Tag abdeckt, gilt", () => {
    const s = budgetStichtag([H1, H2], at("2026-09-01"));
    expect(s.applied).toMatchObject({ id: "h2", cycleKey: "2026-H2", extended: false });
    expect(s.focusKey).toBe("2026-H2");
  });

  it("das Fenster reicht bis einschliesslich zum Endtag", () => {
    const s = budgetStichtag([H1], at("2026-03-01"));
    expect(s.applied?.start).toEqual(D("2026-01-06"));
    expect(s.applied?.end).toEqual(D("2026-07-04"));
  });

  it("in der Lücke gilt die zuletzt abgelaufene fort", () => {
    const s = budgetStichtag([H1, H2], at("2026-07-06"));
    expect(s.applied).toMatchObject({ id: "h1", extended: true });
    expect(s.focusKey).toBe("2026-H1");
  });

  it("liegt der Tag in einer unfertigen Kachel, gilt keine — der Kalender steht ein", () => {
    const s = budgetStichtag([H1, H2_OFFEN], at("2026-09-01"));
    expect(s.applied).toBeNull();
    expect(s.focusKey).toBe("2026-H2");
  });

  it("ohne Kacheln gilt keine", () => {
    const s = budgetStichtag([], at("2026-09-01"));
    expect(s.applied).toBeNull();
    expect(s.focusKey).toBe("2026-H2");
  });

  it("bei Überlappung gilt die mit dem späteren Start", () => {
    const spaet = kachel("spaet", "2026-H2", "closed", "2026-08-01", "2026-12-31");
    const s = budgetStichtag([H2, spaet], at("2026-09-01"));
    expect(s.applied?.id).toBe("spaet");
  });
});

describe("budgetStichtag — offene Halbjahre", () => {
  const april = budgetStichtag([], at("2026-04-15"));

  it("das laufende und das nächste Halbjahr sind offen", () => {
    expect(april.distributionClosedReason("2026-H1")).toBeNull();
    expect(april.distributionClosedReason("2026-H2")).toBeNull();
  });

  // Die Historie speist Kostenkurve und eingefrorenen Budget-Plan.
  it("vergangene Halbjahre sind gesperrt", () => {
    expect(april.distributionClosedReason("2025-H2")).toContain("Vergangene Halbjahre");
  });

  it("das übernächste Halbjahr ist noch nicht dran", () => {
    expect(april.distributionClosedReason("2027-H1")).toContain("übernächsten");
  });

  it("ein unbekannter Schlüssel wird abgelehnt", () => {
    expect(april.distributionClosedReason("Unsinn")).toContain("Unbekanntes");
  });

  /*
   * Die fortgeltende Kachel war bis September 2026 gesperrt: das Geld galt,
   * verteilen durfte man es nicht mehr. Jetzt ist sie offen, solange sie gilt.
   */
  it("eine fortgeltende Kachel aus dem Vorhalbjahr bleibt offen", () => {
    const ende = kachel("alt", "2026-H1", "closed", "2026-01-06", "2026-06-30");
    const s = budgetStichtag([ende], at("2026-07-06"));
    expect(s.applied?.extended).toBe(true);
    expect(s.distributionClosedReason("2026-H1")).toBeNull();
    expect(s.openKeys).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
  });

  it("über den Jahreswechsel hinweg", () => {
    const dez = budgetStichtag([], at("2026-12-01"));
    expect(dez.distributionClosedReason("2026-H2")).toBeNull();
    expect(dez.distributionClosedReason("2027-H1")).toBeNull();
    expect(dez.distributionClosedReason("2026-H1")).toContain("Vergangene");
  });
});

describe("budgetStichtag — welches Halbjahr eine Anfrage meint", () => {
  it("ohne Wahl die geltende Kachel", () => {
    const ende = kachel("alt", "2026-H1", "closed", "2026-01-06", "2026-06-30");
    expect(budgetStichtag([ende], at("2026-07-06")).resolveCycle(undefined).cycleKey).toBe(
      "2026-H1",
    );
  });

  it("nimmt einen offenen Wert an", () => {
    expect(budgetStichtag([], at("2026-08-15")).resolveCycle("2027-H1").cycleKey).toBe("2027-H1");
  });

  it("fällt stumm auf den Stichtag zurück", () => {
    // Ein Halbjahr aus einer URL ist keine Fehlermeldung wert.
    const s = budgetStichtag([], at("2026-08-15"));
    for (const raw of [undefined, null, "", "Unsinn", "2020-H1", "2030-H2"]) {
      expect(s.resolveCycle(raw).cycleKey).toBe("2026-H2");
    }
  });

  it("liefert die Auswahl für den Umschalter mit", () => {
    const { options } = budgetStichtag([], at("2026-08-15")).resolveCycle(undefined);
    expect(options.map((o) => o.key)).toEqual(["2026-H2", "2027-H1"]);
    expect(options[0]?.label).toBeTruthy();
  });
});
