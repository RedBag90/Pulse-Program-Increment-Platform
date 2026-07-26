import { describe, it, expect } from "vitest";
import { formatMioEUR, formatPercent } from "@/lib/formatting";

describe("formatMioEUR — deutscher Kompakt-Euro", () => {
  it("formatiert Millionen mit Komma + einer Nachkommastelle", () => {
    expect(formatMioEUR(24_600_000)).toBe("24,6 Mio €");
    expect(formatMioEUR(142_000_000)).toBe("142,0 Mio €");
    expect(formatMioEUR(400_000)).toBe("0,4 Mio €");
  });

  it("wechselt ab 1 Mrd auf Mrd", () => {
    expect(formatMioEUR(1_300_000_000)).toBe("1,3 Mrd €");
  });

  it("behandelt Negativwerte (Verlustbeiträge im Wasserfall)", () => {
    expect(formatMioEUR(-11_400_000)).toBe("-11,4 Mio €");
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
