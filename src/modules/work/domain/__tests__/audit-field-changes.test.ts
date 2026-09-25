import { describe, it, expect } from "vitest";
import {
  fieldChanges,
  EPIC_FIELD_KEYS,
  type FieldChangeContext,
} from "@/modules/work/domain/audit-field-changes";
import { catalogTranslate } from "@/test/helpers/catalog";

/**
 * **Die Aufstellung lag die ganze Zeit da.**
 *
 * `recordedUpdate` schreibt zu jeder Änderung Feld, Vorher und Nachher nach
 * `auditEvent.changes`; `listInitiativeHistory` lädt die Zeilen ohne `select`,
 * also samt dieser Karte. Eine Zeile vor der Anzeige zog der View **ein**
 * Feld heraus (den Gate-Kommentar) und warf den Rest weg — auf dem Bildschirm
 * standen neun gleichlautende Zeilen „Angaben im Overview geändert".
 */

const ctx: FieldChangeContext = {
  nameOf: (id) => (id === "vs-1" ? "Niederlassung Hamburg" : null),
  enumKey: (field, value) =>
    field === "epicType" && value === "enabler" ? "work.epicType.enabler" : null,
  formatDay: (iso) => iso.slice(0, 10),
};

describe("fieldChanges", () => {
  it("macht aus einer Aufzählung einen Schlüssel, aus einer Id einen Namen", () => {
    const zeilen = fieldChanges(
      {
        epicType: { before: null, after: "enabler" },
        valueStreamId: { before: null, after: "vs-1" },
      },
      ctx,
    );

    expect(zeilen).toEqual([
      {
        field: "epicType",
        labelKey: "work.auditField.epicType",
        from: null,
        to: { kind: "key", key: "work.epicType.enabler" },
      },
      {
        field: "valueStreamId",
        labelKey: "work.auditField.valueStreamId",
        from: null,
        to: { kind: "text", text: "Niederlassung Hamburg" },
      },
    ]);
  });

  it("zeigt bei einer Id ohne bekannten Namen **keinen** Wert", () => {
    // Eine UUID auf dem Bildschirm wäre derselbe Fehler wie ein roher
    // Katalog-Schlüssel, nur mit anderen Zeichen. Alte Einträge zeigen auf
    // Wertströme, in denen das Epic längst nicht mehr liegt.
    const [zeile] = fieldChanges({ artId: { before: "art-alt", after: "art-neu" } }, ctx);

    expect(zeile?.labelKey).toBe("work.auditField.artId");
    expect(zeile?.from).toBeNull();
    expect(zeile?.to).toBeNull();
  });

  it("nennt bei Freitext nur das Feld, nicht den Absatz", () => {
    const zeilen = fieldChanges(
      {
        title: { before: "Alt", after: "Neu" },
        description: { before: "", after: "Ein langer Absatz …" },
      },
      ctx,
    );

    expect(zeilen.map((z) => [z.labelKey, z.from, z.to])).toEqual([
      ["work.auditField.title", null, null],
      ["work.auditField.description", null, null],
    ]);
  });

  it("übersetzt Ja/Nein statt `true` zu zeigen", () => {
    const [zeile] = fieldChanges({ needsSteeringAttention: { before: false, after: true } }, ctx);

    expect(zeile?.from).toEqual({ kind: "key", key: "common.nein" });
    expect(zeile?.to).toEqual({ kind: "key", key: "common.ja" });
  });

  it("formatiert ein Datum, statt den Zeitstempel zu zeigen", () => {
    const [zeile] = fieldChanges(
      { plannedEndAt: { before: null, after: "2027-03-31T00:00:00.000Z" } },
      ctx,
    );

    expect(zeile?.to).toEqual({ kind: "text", text: "2027-03-31" });
  });

  it("lässt ein unbekanntes Feld weg, statt den Spaltennamen zu zeigen", () => {
    expect(fieldChanges({ irgendeineSpalte: { before: 1, after: 2 } }, ctx)).toEqual([]);
  });

  it("verträgt fehlende und unpassende Aufstellungen", () => {
    expect(fieldChanges(null, ctx)).toEqual([]);
    expect(fieldChanges("kaputt", ctx)).toEqual([]);
    expect(fieldChanges({ epicType: "kein Paar" }, ctx)).toEqual([]);
  });

  /**
   * Der Katalog muss jeden dieser Schlüssel kennen — `catalogTranslate` wirft,
   * wenn einer fehlt. Das ist die Prüfung, die bei `RTB_INTERVAL_KEYS` gefehlt
   * hat, nur diesmal von Anfang an.
   */
  it("hat für jedes Feld einen Eintrag in beiden Sprachen", () => {
    for (const locale of ["de", "en"] as const) {
      const t = catalogTranslate(locale);
      const woerter = Object.values(EPIC_FIELD_KEYS).map((k) => t(k));

      expect(new Set(woerter).size, `${locale}: ${woerter.join(" · ")}`).toBe(woerter.length);
    }
  });
});
