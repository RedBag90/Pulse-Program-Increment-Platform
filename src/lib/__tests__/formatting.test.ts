import { describe, it, expect } from "vitest";
import { formatScaledEUR, formatPercent } from "@/lib/formatting";

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
