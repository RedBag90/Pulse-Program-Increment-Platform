import { describe, it, expect } from "vitest";
import {
  contentForGate,
  gateContentViolations,
  assertGateContent,
  type GateContent,
  type EpicContentFacts,
} from "../seed-gate-content";
import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";
import { mayHoldAllocation } from "@/modules/budgeting/domain/allocation-eligibility";

const KEYS = Object.keys(contentForGate("L5")) as (keyof GateContent)[];

const epic = (step: GateStep, has: EpicContentFacts["has"]): EpicContentFacts => ({
  id: `e-${step}`,
  title: `Epic auf ${step}`,
  step,
  has,
});

describe("contentForGate", () => {
  /**
   * Der Maßstab ist das Anlege-Formular: was `createEpicAction` entgegennimmt,
   * ist L0. Alles, was diese Tabelle kennt, ist per Definition *mehr* als das —
   * also darf auf L0 nichts davon erlaubt sein.
   */
  it("erlaubt auf L0 nichts über das Anlege-Formular hinaus", () => {
    const l0 = contentForGate("L0");
    for (const key of KEYS) {
      expect(l0[key], `${key} darf auf L0 nicht erlaubt sein`).toBe(false);
    }
  });

  it("erlaubt auf L1 genau Hypothese und Timeline — sonst nichts", () => {
    const l1 = contentForGate("L1");
    expect(l1.benefitHypothesis).toBe(true);
    expect(l1.timeline).toBe(true);

    const rest = KEYS.filter((k) => k !== "benefitHypothesis" && k !== "timeline");
    for (const key of rest) {
      expect(l1[key], `${key} darf auf L1 nicht erlaubt sein`).toBe(false);
    }
  });

  it("öffnet auf L2 die Arbeitsfläche — Business Case, KPIs, Features", () => {
    const l2 = contentForGate("L2");
    expect(l2.businessCase).toBe(true);
    expect(l2.kpis).toBe(true);
    expect(l2.features).toBe(true);
    expect(l2.costToMvp).toBe(true);
    // Geld kommt erst mit der Business-Case-Freigabe.
    expect(l2.budget).toBe(false);
  });

  it("gibt Budget erst ab L3.1 frei", () => {
    expect(contentForGate("L3.2").budget).toBe(true);
    expect(contentForGate("L3.1").budget).toBe(true);
    expect(contentForGate("L2").budget).toBe(false);
  });

  /**
   * Ohne diese Zusicherung könnte ein späterer Schritt weniger erlauben als ein
   * früherer — dann gäbe es Inhalt, der unterwegs wieder verschwinden müsste.
   */
  it("ist monoton: kein Feld verschwindet auf dem Weg nach oben", () => {
    for (let i = 1; i < GATE_STEPS.length; i++) {
      const prev = contentForGate(GATE_STEPS[i - 1]!);
      const next = contentForGate(GATE_STEPS[i]!);
      for (const key of KEYS) {
        if (prev[key]) {
          expect(next[key], `${key} fällt von ${GATE_STEPS[i - 1]} nach ${GATE_STEPS[i]} weg`).toBe(
            true,
          );
        }
      }
    }
  });

  /**
   * Die Budget-Schwelle gehört dem Budgeting-Modul. Zwei Fassungen derselben
   * Zahl laufen auseinander — deshalb wird sie abgeleitet, nicht wiederholt.
   */
  it("leitet die Budget-Schwelle aus mayHoldAllocation ab", () => {
    for (const step of GATE_STEPS) {
      expect(contentForGate(step).budget, `Budget auf ${step}`).toBe(mayHoldAllocation(step));
    }
  });
});

describe("gateContentViolations", () => {
  it("schweigt bei sauberen Daten", () => {
    expect(
      gateContentViolations([
        epic("L0", {}),
        epic("L1", { benefitHypothesis: true, timeline: true }),
        epic("L2", { benefitHypothesis: true, timeline: true, kpis: true, features: true }),
        epic("L4", { benefitHypothesis: true, timeline: true, budget: true, kpis: true }),
      ]),
    ).toEqual([]);
  });

  it("findet die Timeline im Funnel — der Fehler, wegen dem es diese Datei gibt", () => {
    const v = gateContentViolations([epic("L0", { timeline: true })]);
    expect(v).toHaveLength(1);
    expect(v[0]!.field).toBe("timeline");
    expect(v[0]!.reason).toContain("erst ab L1");
  });

  it("findet KPIs auf L1 und Budget auf L2", () => {
    const v = gateContentViolations([epic("L1", { kpis: true }), epic("L2", { budget: true })]);
    expect(v.map((x) => x.field)).toEqual(["kpis", "budget"]);
  });

  it("meldet mehrere Verstöße desselben Epics einzeln", () => {
    const v = gateContentViolations([
      epic("L0", { timeline: true, kpis: true, features: true, budget: true }),
    ]);
    expect(v).toHaveLength(4);
  });
});

describe("assertGateContent", () => {
  it("lässt saubere Daten durch", () => {
    expect(() => assertGateContent([epic("L1", { benefitHypothesis: true })])).not.toThrow();
  });

  it("wirft mit Titel und Grund", () => {
    let message = "";
    try {
      assertGateContent([epic("L0", { kpis: true })]);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("Epic auf L0");
    expect(message).toContain("KPIs");
    expect(message).toContain("erst ab L2");
  });
});
