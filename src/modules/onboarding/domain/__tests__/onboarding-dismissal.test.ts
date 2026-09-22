import { describe, it, expect } from "vitest";
import {
  parseDismissedSteps,
  withDismissed,
  withoutRole,
  NO_DISMISSED_STEPS,
} from "@/modules/onboarding/domain/onboarding-dismissal";

/**
 * **Der Merker, den es vorher nicht gab.**
 *
 * „Nicht jetzt" setzte lokalen React-State — nach jedem Seitenaufbau war die
 * Ablehnung weg. Hier steht die Form, in der sie jetzt überlebt.
 */

describe("parseDismissedSteps", () => {
  it("macht aus allem etwas, mit dem sich filtern lässt", () => {
    // Kein Wurf, kein `null`: die Entscheidung läuft im Dashboard-Layout, auf
    // jeder Navigation. Ein kaputter Merker darf dort nichts umwerfen.
    expect(parseDismissedSteps(null)).toEqual(NO_DISMISSED_STEPS);
    expect(parseDismissedSteps("kaputt")).toEqual(NO_DISMISSED_STEPS);
    expect(parseDismissedSteps(["auch kaputt"])).toEqual(NO_DISMISSED_STEPS);
    expect(parseDismissedSteps({ vmo: "keine Liste" })).toEqual(NO_DISMISSED_STEPS);
  });

  it("liest, was dasteht, und wirft heraus, was keine Form hat", () => {
    expect(parseDismissedSteps({ vmo: ["a", 7, "b", null] })).toEqual({ vmo: ["a", "b"] });
  });

  it("prüft die Form, nicht das Vokabular", () => {
    // Eine Rolle kann verschwinden, ein Schritt umbenannt werden. Beides ist
    // harmlos: hier wird nur gefiltert, und ein Schlüssel, den es nicht mehr
    // gibt, filtert nichts. Ihn zu verwerfen hiesse, eine Entscheidung
    // wegzuwerfen, sobald jemand eine Konstante umbenennt.
    expect(parseDismissedSteps({ "rolle-von-gestern": ["schritt-von-gestern"] })).toEqual({
      "rolle-von-gestern": ["schritt-von-gestern"],
    });
  });
});

describe("withDismissed", () => {
  it("merkt sich Schritte je Rolle", () => {
    expect(withDismissed({}, "vmo", ["a", "b"])).toEqual({ vmo: ["a", "b"] });
  });

  it("legt nach, statt zu ersetzen", () => {
    // Wer heute die eine Hälfte einer Tour abbricht und morgen die andere
    // wegklickt, hat beides abgelehnt — nicht nur das Letzte.
    expect(withDismissed({ vmo: ["a"] }, "vmo", ["b"])).toEqual({ vmo: ["a", "b"] });
  });

  it("zählt einen Schritt nur einmal", () => {
    expect(withDismissed({ vmo: ["a"] }, "vmo", ["a", "b"])).toEqual({ vmo: ["a", "b"] });
  });

  it("lässt andere Rollen unberührt", () => {
    expect(withDismissed({ vmo: ["a"] }, "rte", ["x"])).toEqual({ vmo: ["a"], rte: ["x"] });
  });

  it("ändert bei leerer Liste nichts", () => {
    const vorher = { vmo: ["a"] };
    expect(withDismissed(vorher, "vmo", [])).toBe(vorher);
  });
});

describe("withoutRole", () => {
  it("verwirft die Ablehnungen einer Rolle", () => {
    // Der Gegenzug zu „Tour erneut starten". Ohne ihn wäre eine Ablehnung
    // unumkehrbar und der Knopf eine leere Zusage.
    expect(withoutRole({ vmo: ["a"], rte: ["x"] }, "vmo")).toEqual({ rte: ["x"] });
  });

  it("gibt unverändert zurück, wenn es nichts zu verwerfen gibt", () => {
    const vorher = { rte: ["x"] };
    expect(withoutRole(vorher, "vmo")).toBe(vorher);
  });
});
