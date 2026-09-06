import { describe, it, expect } from "vitest";
import {
  epicHorizon,
  resolveEpicHorizon,
  horizonEditDeniedReason,
} from "@/modules/work/domain/epic-horizon";

const LBC = new Date("2026-07-01T00:00:00Z");

const facts = (over: Partial<Parameters<typeof epicHorizon>[0]> = {}) => ({
  investmentHorizon: null,
  solutionHorizon: null,
  businessCaseApprovedAt: null,
  ...over,
});

describe("epicHorizon — explizit schlägt abgeleitet", () => {
  it("nimmt den Wert der Primär-Solution, solange am Epic nichts steht", () => {
    expect(epicHorizon(facts({ solutionHorizon: "h2" }))).toEqual({
      horizon: "h2",
      source: "solution",
      frozen: false,
    });
  });

  it("nimmt den Wert am Epic, auch wenn eine Solution etwas anderes sagt", () => {
    // Genau das ist der Sinn: ein einmal gesetzter Wert löst sich von der
    // Solution — sonst schriebe ein Solution-Wechsel die Geschichte um.
    expect(epicHorizon(facts({ investmentHorizon: "h3", solutionHorizon: "h1" }))).toEqual({
      horizon: "h3",
      source: "epic",
      frozen: false,
    });
  });

  it("hat ohne beides keinen Horizont", () => {
    expect(epicHorizon(facts())).toEqual({ horizon: null, source: "none", frozen: false });
  });

  it("ignoriert einen unbekannten Wert in der Spalte und faellt zurueck", () => {
    // Lieber die Solution als ein Fantasie-Horizont: die Spalte ist ein freier
    // String, und drei Alt-Zeilen zeigen, dass dort Unsinn stehen kann.
    expect(epicHorizon(facts({ investmentHorizon: "h9", solutionHorizon: "h1" }))).toEqual({
      horizon: "h1",
      source: "solution",
      frozen: false,
    });
  });

  it("ist ohne Solution genau der Fall, fuer den das Feld existiert", () => {
    expect(epicHorizon(facts({ investmentHorizon: "h1" })).horizon).toBe("h1");
  });
});

describe("epicHorizon — das Einfrieren", () => {
  it("friert erst mit der Business-Case-Freigabe ein", () => {
    const before = facts({ investmentHorizon: "h2" });
    expect(epicHorizon(before).frozen).toBe(false);
    expect(epicHorizon({ ...before, businessCaseApprovedAt: LBC }).frozen).toBe(true);
  });

  it("friert einen bloss abgeleiteten Horizont nicht ein", () => {
    // Ohne eigenen Wert gibt es nichts einzufrieren — das Epic folgt weiter
    // seiner Solution. Genau so laufen die 103 bereits freigegebenen Epics.
    expect(epicHorizon(facts({ solutionHorizon: "h1", businessCaseApprovedAt: LBC }))).toEqual({
      horizon: "h1",
      source: "solution",
      frozen: false,
    });
  });

  it("friert nichts ein, wo gar kein Horizont steht", () => {
    // Die Freigabe verlangt keinen Horizont; ein Epic darf ohne durchgehen.
    expect(epicHorizon(facts({ businessCaseApprovedAt: LBC }))).toEqual({
      horizon: null,
      source: "none",
      frozen: false,
    });
  });
});

describe("resolveEpicHorizon", () => {
  it("liefert genau den Wert der Aufloesung", () => {
    expect(resolveEpicHorizon(facts({ solutionHorizon: "h3" }))).toBe("h3");
    expect(resolveEpicHorizon(facts())).toBeNull();
  });
});

describe("horizonEditDeniedReason", () => {
  const may = { frozen: false, mayEditEpic: true, mayOverride: false };

  it("laesst den Autor seinen Horizont setzen, solange nichts eingefroren ist", () => {
    expect(horizonEditDeniedReason(may)).toBeNull();
  });

  it("weist ab, wer das Epic gar nicht bearbeiten darf", () => {
    expect(horizonEditDeniedReason({ ...may, mayEditEpic: false })).toContain("epic.update");
  });

  it("weist nach dem Einfrieren ab — mit dem Grund, nicht bloss mit nein", () => {
    const reason = horizonEditDeniedReason({ ...may, frozen: true });
    expect(reason).toContain("eingefroren");
    expect(reason).toContain("epic.portfolio_override");
  });

  it("laesst das Portfolio-Management auch den eingefrorenen Wert bewegen", () => {
    expect(
      horizonEditDeniedReason({ frozen: true, mayEditEpic: true, mayOverride: true }),
    ).toBeNull();
  });

  it("nennt die Bearbeitung zuerst — sie ist die grundlegendere Huerde", () => {
    // Ein Übersteuerungsrecht ersetzt das Schreibrecht am Epic nicht; wer gar
    // nicht bearbeiten darf, soll das hören und nicht „ist eingefroren".
    expect(
      horizonEditDeniedReason({ frozen: true, mayEditEpic: false, mayOverride: true }),
    ).toContain("epic.update");
  });
});
