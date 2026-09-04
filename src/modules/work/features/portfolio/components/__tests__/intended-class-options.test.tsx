import { describe, it, expect } from "vitest";
import { intendedClassOptions } from "@/modules/work/features/portfolio/components/intended-class-options";
import { formatEUR } from "@/lib/formatting";

describe("intendedClassOptions", () => {
  it("bleibt ohne Schwelle bei den schlichten Namen", () => {
    // Der Ladezustand: lieber keine Zahl als eine falsche.
    expect(intendedClassOptions(null).map((o) => o.label)).toEqual(["Portfolio-Epic", "ART-Epic"]);
  });

  it("hängt das Limit an, formatiert wie überall sonst", () => {
    // Die Erwartung kommt aus demselben Formatierer, den auch Badge und
    // Abweichungs-Dialog benutzen — sonst hinge der Test an Feinheiten der
    // Locale (de-DE setzt ein geschütztes Leerzeichen vor das €).
    const limit = formatEUR(100_000);
    const labels = intendedClassOptions(100_000).map((o) => o.label);
    expect(labels[0]).toBe(`Portfolio-Epic — über ${limit}`);
    expect(labels[1]).toBe(`ART-Epic — bis ${limit}`);
    expect(limit).toContain("100.000");
  });

  it("ordnet den Randfall der ART-Seite zu", () => {
    // Dieselbe Aussage, die `epic-class.test.ts` für die Rechenregel festhält:
    // genau auf dem Limit ist es ein ART-Epic. Deshalb „bis", nicht „unter",
    // und „über", nicht „ab".
    const [portfolio, art] = intendedClassOptions(150_000);
    expect(portfolio!.label).toContain("über");
    expect(portfolio!.label).not.toContain("ab ");
    expect(art!.label).toContain("bis");
    expect(art!.label).not.toContain("unter");
  });

  it("behält die Werte, die das Formular absendet", () => {
    expect(intendedClassOptions(1).map((o) => o.value)).toEqual(["portfolio", "art"]);
    expect(intendedClassOptions(null).map((o) => o.value)).toEqual(["portfolio", "art"]);
  });
});
