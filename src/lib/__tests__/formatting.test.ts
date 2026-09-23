import { describe, it, expect } from "vitest";
import { formatScaledEUR, formatPercent, formatEUR, formatDate, formatPp } from "@/lib/formatting";

describe("formatScaledEUR — Einheit folgt der Größenordnung", () => {
  it("formatiert Millionen mit Komma + einer Nachkommastelle", () => {
    expect(formatScaledEUR(24_600_000)).toBe("24,6 Mio €");
    expect(formatScaledEUR(142_000_000)).toBe("142,0 Mio €");
  });

  it("wechselt ab 1 Mrd auf Mrd", () => {
    expect(formatScaledEUR(1_300_000_000)).toBe("1,3 Mrd €");
  });

  it("schreibt unter 1 Mio in T€ — der Grund für die Ablösung", () => {
    // 49.000 € standen als „0,0 Mio €" im Horizont-Trichter: der
    // wertstromübergreifende Betrieb der Produktion, sichtbar auf der
    // Wertstrom-Seite, unsichtbar im Bild.
    expect(formatScaledEUR(49_000)).toBe("49 T€");
    expect(formatScaledEUR(400_000)).toBe("400 T€");
    expect(formatScaledEUR(1_000)).toBe("1 T€");
  });

  it("unterscheidet Beträge, die in Mio zusammenfielen", () => {
    // Beide waren „0,1 Mio €", obwohl 25 % dazwischen liegen.
    expect(formatScaledEUR(96_000)).not.toBe(formatScaledEUR(120_000));
  });

  it("bleibt unter 1.000 € bei ganzen Euro", () => {
    // `formatEUR` übernimmt hier — und Intl setzt vor das € ein **geschütztes**
    // Leerzeichen (U+00A0). Der Test schreibt es aus, statt es zu übersehen.
    expect(formatScaledEUR(840)).toBe("840\u00a0€");
    expect(formatScaledEUR(0)).toBe("0\u00a0€");
  });

  it("stuft an der Mio-Grenze sichtbar — gewollt, nicht zufällig", () => {
    expect(formatScaledEUR(999_500)).toBe("1.000 T€");
    expect(formatScaledEUR(1_000_000)).toBe("1,0 Mio €");
  });

  it("behandelt Negativwerte (Verlustbeiträge im Wasserfall)", () => {
    expect(formatScaledEUR(-11_400_000)).toBe("-11,4 Mio €");
    expect(formatScaledEUR(-49_000)).toBe("-49 T€");
  });
});

describe("formatPercent — 0..1 → ganzzahliges Prozent", () => {
  it("rundet und hängt ` %` an", () => {
    expect(formatPercent(0.876)).toBe("88 %");
    expect(formatPercent(0.5)).toBe("50 %");
    expect(formatPercent(1)).toBe("100 %");
    expect(formatPercent(0)).toBe("0 %");
  });
});

/**
 * **Die Umschaltung endete bisher an der Zahl.**
 *
 * Wer auf `/en/` wechselte, bekam englische Navigation — und weiterhin
 * `05.06.2026` und `12.345 €`. Seit September 2026 nehmen die Formatierer einen
 * Locale. Die Vorgabe bleibt vorerst Deutsch, damit die 125 bestehenden Aufrufe
 * nicht am selben Tag brechen; diese Tests halten fest, dass **beide** Wege
 * funktionieren.
 */
/**
 * `Intl` setzt vor das Währungszeichen ein **geschütztes** Leerzeichen (U+00A0).
 * Im Test ist es von einem gewöhnlichen nicht zu unterscheiden und führt zu
 * Meldungen der Art „expected '12.345 €' to be '12.345 €'". Hier wird es
 * eingeebnet, damit die Zusicherung lesbar bleibt.
 */
const norm = (s: string) => s.replace(/\u00A0/g, " ");

describe("Formatierung folgt der Sprache", () => {
  it("setzt Geld nach Landesart", () => {
    expect(norm(formatEUR(12_345, "de"))).toBe("12.345 €");
    expect(norm(formatEUR(12_345, "en"))).toBe("€12,345");
  });

  it("setzt Datum nach Landesart", () => {
    const tag = new Date("2026-06-05T12:00:00.000Z");
    expect(formatDate(tag, "date", "de")).toBe("05.06.2026");
    expect(formatDate(tag, "date", "en")).toBe("05/06/2026");
  });

  it("übersetzt die Grössenordnungs-Einheiten", () => {
    // „Mio" ist kein internationales Kürzel — auf Englisch liest es niemand.
    expect(formatScaledEUR(24_600_000, "de")).toBe("24,6 Mio €");
    expect(formatScaledEUR(24_600_000, "en")).toBe("24.6 M €");
    expect(formatScaledEUR(1_300_000_000, "en")).toBe("1.3 bn €");
  });

  it("kennt das Leerzeichen vor dem Prozentzeichen als Sprachkonvention", () => {
    expect(formatPercent(0.876, "de")).toBe("88 %");
    expect(formatPercent(0.876, "en")).toBe("88%");
    expect(formatPp(0.085, "de")).toBe("+8,5 pp");
    expect(formatPp(0.085, "en")).toBe("+8.5pp");
  });

  it("bleibt ohne Angabe bei Deutsch — die Übergangsvorgabe", () => {
    // Fällt diese Vorgabe zum Abschluss der Umstellung weg, zeigt der Compiler
    // jeden Aufruf, der seinen Locale noch nicht durchreicht.
    expect(formatEUR(12_345)).toBe(formatEUR(12_345, "de"));
    expect(formatPercent(0.5)).toBe("50 %");
  });
});
