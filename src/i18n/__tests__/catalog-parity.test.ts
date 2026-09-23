import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

/**
 * **Beide Kataloge tragen dieselben Schlüssel.**
 *
 * Fehlt einer, wirft `next-intl` zur Laufzeit nicht — es rendert den Schlüssel
 * als Text oder greift auf die Vorgabesprache zurück. Auf einer Seite, die
 * niemand gerade ansieht, fällt das nie auf; entdeckt wird es vom Kunden.
 *
 * Dieser Test ist die einzige Zusicherung, die eine wachsende Übersetzung am
 * Leben hält: ab hier kann ein Katalog nicht mehr hinter dem anderen
 * zurückbleiben, ohne dass der Lauf rot wird.
 */

type Json = Record<string, unknown>;

/** Alle Blatt-Pfade eines verschachtelten Katalogs, punktgetrennt und sortiert. */
function leafKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj)
    .flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value !== null && typeof value === "object" && !Array.isArray(value)
        ? leafKeys(value as Json, path)
        : [path];
    })
    .sort();
}

const deKeys = leafKeys(de as Json);
const enKeys = leafKeys(en as Json);

describe("Katalog-Parität", () => {
  it("führt genau die Sprachen, die das Routing kennt", () => {
    // Ein Katalog ohne Route wäre tote Übersetzungsarbeit, eine Route ohne
    // Katalog ein Ladefehler beim ersten Aufruf.
    expect([...routing.locales].sort()).toEqual(["de", "en"]);
  });

  it("kennt in beiden Sprachen dieselben Schlüssel", () => {
    const nurDe = deKeys.filter((k) => !enKeys.includes(k));
    const nurEn = enKeys.filter((k) => !deKeys.includes(k));

    expect(nurDe, `nur in de.json: ${nurDe.join(", ")}`).toEqual([]);
    expect(nurEn, `nur in en.json: ${nurEn.join(", ")}`).toEqual([]);
  });

  it("lässt keinen Schlüssel leer", () => {
    // Ein leerer Wert ist schlimmer als ein fehlender: er rendert als nichts,
    // und die Fläche sieht kaputt aus statt unübersetzt.
    for (const [name, katalog] of [
      ["de", de],
      ["en", en],
    ] as const) {
      const leer = leafKeys(katalog as Json).filter((path) => {
        const wert = path.split(".").reduce<unknown>((acc, teil) => (acc as Json)?.[teil], katalog);
        return typeof wert !== "string" || wert.trim() === "";
      });
      expect(leer, `${name}.json ohne Text: ${leer.join(", ")}`).toEqual([]);
    }
  });
});
