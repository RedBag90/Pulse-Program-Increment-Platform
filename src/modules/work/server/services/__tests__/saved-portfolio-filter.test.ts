import { describe, it, expect } from "vitest";
import { parseSavedFilterCriteria } from "@/modules/work/server/services/saved-portfolio-filter";
import { parseFilterCriteria } from "@/server/services/saved-filter";

/**
 * Der tolerante Parser der Filter-Kriterien: die Datenbank hält sie als
 * untypisierten JSON-Blob, also muss das Lesen defensiv sein.
 *
 * **Korrektur am vorigen Docstring:** dort stand, die DB-Pfade des Dienstes
 * seien „covered by the integration suite (requires DATABASE_URL_TEST)". Eine
 * solche Datei gibt es nicht. Ungeprüft bleiben damit weiterhin das Upsert per
 * Name, das Zurücksetzen des alten Standards und der Besitz-Check beim Löschen.
 */
describe("parseSavedFilterCriteria", () => {
  it("reads the string arrays from a well-formed blob", () => {
    expect(
      parseSavedFilterCriteria({
        vs: ["a", "b"],
        gate: ["L3"],
        status: ["blocked"],
        owner: ["u1"],
        cls: ["art"],
      }),
    ).toEqual({
      vs: ["a", "b"],
      gate: ["L3"],
      status: ["blocked"],
      owner: ["u1"],
      cls: ["art"],
    });
  });

  // `cls` kam später dazu — vor der Facette gespeicherte Filter dürfen dadurch
  // nicht ungültig werden.
  it("liest einen vor der Klassen-Facette gespeicherten Filter unverändert", () => {
    expect(
      parseSavedFilterCriteria({ vs: ["a"], gate: [], status: [], owner: ["u1"] }),
    ).toMatchObject({ vs: ["a"], owner: ["u1"], cls: [] });
  });

  it("defaults missing keys to empty arrays", () => {
    expect(parseSavedFilterCriteria({ vs: ["a"] })).toEqual({
      vs: ["a"],
      gate: [],
      status: [],
      owner: [],
      cls: [],
    });
  });

  it("is tolerant of null, non-objects and non-string entries", () => {
    const empty = { vs: [], gate: [], status: [], owner: [], cls: [] };
    expect(parseSavedFilterCriteria(null)).toEqual(empty);
    expect(parseSavedFilterCriteria("nope")).toEqual(empty);
    expect(parseSavedFilterCriteria({ vs: ["ok", 1, null, "x"], gate: "notArray" })).toEqual({
      ...empty,
      vs: ["ok", "x"],
    });
  });
});

/**
 * Der Parser ist seit dem Auslösen generisch: die Schlüssel kommen von aussen
 * (`parseFilterCriteria(json, keys)`). Das hier ist die Zusicherung, dass die
 * Verallgemeinerung trägt — mit einer **anderen** Schlüsselmenge, naemlich der
 * der Ziele-Flaeche.
 */
describe("parseFilterCriteria — dieselbe Toleranz, andere Schluessel", () => {
  const GOAL_KEYS = ["period", "vs", "art", "status"] as const;

  it("liest die Facetten einer anderen Flaeche", () => {
    expect(
      parseFilterCriteria(
        { period: ["2026-Q4"], vs: ["v1"], art: [], status: ["at_risk"] },
        GOAL_KEYS,
      ),
    ).toEqual({ period: ["2026-Q4"], vs: ["v1"], art: [], status: ["at_risk"] });
  });

  it("liest fehlende Schluessel als leere Menge", () => {
    expect(parseFilterCriteria({ period: ["2026"] }, GOAL_KEYS)).toEqual({
      period: ["2026"],
      vs: [],
      art: [],
      status: [],
    });
  });

  /** Fremde Schluessel im Blob gehen niemanden etwas an. */
  it("nimmt nur die gefragten Schluessel auf", () => {
    expect(parseFilterCriteria({ period: ["2026"], gate: ["L3"] }, GOAL_KEYS)).toEqual({
      period: ["2026"],
      vs: [],
      art: [],
      status: [],
    });
  });

  it("verwirft Nicht-Arrays und Nicht-Strings", () => {
    expect(parseFilterCriteria({ period: "2026", vs: [1, "v1", null] }, GOAL_KEYS)).toEqual({
      period: [],
      vs: ["v1"],
      art: [],
      status: [],
    });
  });
});
