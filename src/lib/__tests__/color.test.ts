import { describe, it, expect } from "vitest";
import { mixHex, lighten, darken } from "@/lib/color";

describe("mixHex — Tönungen statt Deckkraft", () => {
  it("liefert an den Enden genau die Ausgangsfarben", () => {
    expect(mixHex("#ea580c", "#ffffff", 0)).toBe("#ea580c");
    expect(mixHex("#ea580c", "#ffffff", 1)).toBe("#ffffff");
  });

  it("mischt in der Mitte kanalweise", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 0.5)).toBe("#800080");
  });

  it("klemmt t auf 0..1, statt über die Farbe hinauszuschießen", () => {
    expect(mixHex("#123456", "#ffffff", -2)).toBe("#123456");
    expect(mixHex("#123456", "#ffffff", 5)).toBe("#ffffff");
  });

  it("versteht die Kurzform und das fehlende Rautezeichen", () => {
    expect(mixHex("#fff", "#fff", 0)).toBe("#ffffff");
    expect(mixHex("ea580c", "#ea580c", 1)).toBe("#ea580c");
  });

  it("ergibt bei einem unlesbaren Wert Schwarz, statt zu werfen", () => {
    // Ein Zeichenfehler im Farbwert soll auffallen, nicht die Zeichnung
    // abstürzen lassen.
    expect(mixHex("nicht-hex", "#000000", 0)).toBe("#000000");
  });

  it("füllt einstellige Kanäle auf zwei Stellen auf", () => {
    // Ohne padStart entstünde `#f0f0f` — eine Farbe, die keine ist.
    expect(mixHex("#0f0f0f", "#0f0f0f", 0.5)).toBe("#0f0f0f");
  });
});

describe("lighten / darken — die beiden Richtungen, die die Zeichnung braucht", () => {
  it("hellt gegen Weiß und dunkelt gegen Schwarz", () => {
    const base = "#ea580c";
    expect(lighten(base, 0.5)).toBe(mixHex(base, "#ffffff", 0.5));
    expect(darken(base, 0.3)).toBe(mixHex(base, "#000000", 0.3));
  });

  it("lässt den Ton bei 0 unangetastet", () => {
    expect(lighten("#0d9488", 0)).toBe("#0d9488");
    expect(darken("#0d9488", 0)).toBe("#0d9488");
  });
});
