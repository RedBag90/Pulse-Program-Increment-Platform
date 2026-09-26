import { describe, it, expect } from "vitest";
import {
  PRACTICES,
  DEFAULT_PRACTICES,
  OPERATING_MODEL_TEMPLATE_DEFS,
  effectivePractices,
} from "@/modules/core/kernel/domain/operating-model";

describe("effectivePractices", () => {
  it("returns all-on when no model is defined (backward compatible)", () => {
    expect(effectivePractices(null)).toEqual(DEFAULT_PRACTICES);
    expect(effectivePractices(undefined)).toEqual(DEFAULT_PRACTICES);
  });

  it("treats a missing flag as on, an explicit false as off", () => {
    const flags = effectivePractices({ portfolioLevel: false });
    expect(flags.portfolioLevel).toBe(false);
    expect(flags.programLevel).toBe(true); // not specified → on
  });
});

describe("operating-model templates", () => {
  it("team_level turns every practice off", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.team_level;
    expect(PRACTICES.every((p) => practices[p] === false)).toBe(true);
  });

  it("essential_safe enables the program level but not portfolio governance", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.essential_safe;
    expect(practices.programLevel).toBe(true);
    expect(practices.portfolioLevel).toBe(false);
    expect(practices.stageGates).toBe(false);
    expect(practices.multiPartyApproval).toBe(false);
  });

  it("portfolio_safe enables every practice", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.portfolio_safe;
    expect(PRACTICES.every((p) => practices[p] === true)).toBe(true);
  });
});

/**
 * **Der Standard von `artEpics`, festgenagelt.**
 *
 * Er stand bis September 2026 auf `false` — als einzige Practice, mit
 * schriftlicher Begründung. Dass er gedreht wurde, ist eine Entscheidung und
 * keine Unachtsamkeit; deshalb steht sie ab hier als Test da und nicht nur als
 * Kommentar. Wer sie zurückdreht, tut es sehenden Auges.
 *
 * Der Grund: vor L2 kann die Einordnung gar kein Geld umleiten (`classifyEpic`
 * liefert dort `null`, und alle Budgeting-Weichen vergleichen gegen diesen
 * Wert), gebraucht wird sie aber genau dort — als Erwartung, bevor die Kosten
 * stehen.
 */
describe("artEpics", () => {
  it("ist ohne Zielbild an", () => {
    expect(effectivePractices(null).artEpics).toBe(true);
    expect(DEFAULT_PRACTICES.artEpics).toBe(true);
  });

  it("bleibt aus, wo ein Zielbild es ausdrücklich abschaltet", () => {
    // Eine gespeicherte Mandanten-Entscheidung schlägt den Standard. `art_epics`
    // ist NOT NULL, eine Zeile trägt also immer einen echten Wert.
    expect(effectivePractices({ artEpics: false }).artEpics).toBe(false);
  });
});
