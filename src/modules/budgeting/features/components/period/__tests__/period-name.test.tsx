import { describe, it, expect } from "vitest";
import { periodName } from "@/modules/budgeting/features/components/period/period-name";

/**
 * **Die Kachel heisst nach ihrem Zeitraum, nicht nach dem Halbjahr ihres
 * Starts.**
 *
 * Eine Kachel vom 01.10.2026 bis 31.03.2027 stand als „H2 2026" da — der
 * `cycleKey` kommt aus dem Halbjahr des Starts, der Zeitraum ist frei, und die
 * Vorgabe beim Anlegen ist „Start + 6 Monate". Beides deckt sich nur, wenn
 * eine Kachel am 1. Januar oder 1. Juli beginnt. Auf derselben Kachel stand
 * zwei Zeilen tiefer der wirkliche Zeitraum: sie widersprach sich selbst.
 */

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("periodName", () => {
  it("nennt den Zeitraum, auch wenn er zwei Halbjahre berührt", () => {
    expect(periodName(D("2026-10-01"), D("2027-03-31"), "H2 2026", "de")).toBe(
      "01.10.2026 – 31.03.2027",
    );
  });

  it("tut dasselbe, wenn Zeitraum und Halbjahr zusammenfallen", () => {
    // Kein Sonderfall: auch die saubere Kachel heisst nach ihren Daten. Zwei
    // Benennungsregeln nebeneinander wären wieder zwei Wahrheiten.
    expect(periodName(D("2026-07-01"), D("2026-12-31"), "H2 2026", "de")).toBe(
      "01.07.2026 – 31.12.2026",
    );
  });

  it("folgt der Sprache des Lesers", () => {
    // Der alte Helfer in der Kachel hatte `de-DE` fest verdrahtet — auf einer
    // `/en/`-Route stand deshalb ein deutsches Datumsformat.
    expect(periodName(D("2026-10-01"), D("2027-03-31"), "H2 2026", "en")).not.toBe(
      periodName(D("2026-10-01"), D("2027-03-31"), "H2 2026", "de"),
    );
  });

  it("fällt ohne Zeitraum auf das Halbjahr zurück", () => {
    // Die Spalten sind nullbar — Altbestand aus der Zeit vor dem Kachel-Modell.
    // Wer keine Daten hat, lässt sich nur über seinen Schlüssel benennen.
    expect(periodName(null, D("2027-03-31"), "H2 2026")).toBe("H2 2026");
    expect(periodName(D("2026-10-01"), null, "H2 2026")).toBe("H2 2026");
    expect(periodName(null, null, "H2 2026")).toBe("H2 2026");
  });
});
