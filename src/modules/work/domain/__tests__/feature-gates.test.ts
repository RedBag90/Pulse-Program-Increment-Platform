import { describe, it, expect } from "vitest";
import {
  budgetDecided,
  featurePlanningBlockedKey,
  featureStartBlockedKey,
} from "@/modules/work/domain/feature-gates";
import {
  BUDGET_DECISION_GATE,
  GATES_AFTER_BUDGET_DECISION,
  STAGE_GATES,
} from "@/modules/work/domain/stage-gate";

/**
 * **Zwei Tore, eine Schwelle.**
 *
 * Einplanen und Starten hängen beide an der Investitionsentscheidung: erst ab
 * L3 „Budget alloziert" gibt es an einem Epic etwas zu planen und zu tun.
 *
 * Das Start-Tor gab es schon; das **Planungs**-Tor ist neu. Vorher lautete die
 * Start-Meldung sogar „bitte erst einplanen" — einplanen war die
 * Voraussetzung des Starts und selbst ungeregelt, also standen Features unter
 * L3 in der Planungsübersicht und liessen sich terminieren.
 */

describe("budgetDecided", () => {
  it("gilt ab L3 und darüber", () => {
    expect(budgetDecided(BUDGET_DECISION_GATE)).toBe(true);
    for (const g of GATES_AFTER_BUDGET_DECISION) expect(budgetDecided(g)).toBe(true);
  });

  it("gilt darunter nicht", () => {
    for (const g of STAGE_GATES.filter(
      (g) => STAGE_GATES.indexOf(g) < STAGE_GATES.indexOf(BUDGET_DECISION_GATE),
    )) {
      expect(budgetDecided(g), g).toBe(false);
    }
  });

  it("deckt die Leiter vollständig ab — keine Stufe fällt durch", () => {
    // Der Riegel gegen die zweite Definition: hier stand eine eigene Liste
    // `["L3","L4","L5"]` neben `BUDGET_DECISION_GATE`. Zwei Listen, die
    // dasselbe meinen, laufen irgendwann auseinander.
    const dafuer = STAGE_GATES.filter((g) => budgetDecided(g));
    expect(dafuer).toEqual([BUDGET_DECISION_GATE, ...GATES_AFTER_BUDGET_DECISION]);
  });

  it("behandelt Unbekanntes und Fehlendes als „nicht entschieden“", () => {
    // Ein gelöschtes oder unlesbares Epic blockiert, statt durchzuwinken.
    expect(budgetDecided(null)).toBe(false);
    expect(budgetDecided("L9")).toBe(false);
    expect(budgetDecided("")).toBe(false);
  });
});

describe("featurePlanningBlockedKey", () => {
  it("lässt ein Feature ab L3 einplanen", () => {
    for (const gate of ["L3", "L4", "L5"]) {
      expect(featurePlanningBlockedKey({ parentId: "e1", parentStageGate: gate })).toBeNull();
    }
  });

  it("sperrt es darunter", () => {
    for (const gate of ["L0", "L1", "L2"]) {
      expect(featurePlanningBlockedKey({ parentId: "e1", parentStageGate: gate })).toBe(
        "work.errors.epicNotBudgetDecided",
      );
    }
  });

  it("lässt ein eigenständiges Feature durch", () => {
    // Ohne Epic gibt es kein Portfolio-Tor, auf das man warten könnte: das Tor
    // prüft eine Finanzierungsentscheidung, die hier niemand trifft.
    expect(featurePlanningBlockedKey({ parentId: null, parentStageGate: null })).toBeNull();
  });

  it("sperrt, wenn das Epic nicht gefunden wurde", () => {
    expect(featurePlanningBlockedKey({ parentId: "e1", parentStageGate: null })).toBe(
      "work.errors.epicNotBudgetDecided",
    );
  });
});

describe("featureStartBlockedKey", () => {
  it("verlangt zuerst einen Termin", () => {
    // Der Schritt, der dem Start unmittelbar vorausgeht — er wird zuerst
    // gemeldet, auch wenn das Epic ohnehin zu früh stünde.
    expect(featureStartBlockedKey({ piId: null, parentId: "e1", parentStageGate: "L4" })).toBe(
      "work.errors.featureNotScheduled",
    );
    expect(featureStartBlockedKey({ piId: null, parentId: "e1", parentStageGate: "L1" })).toBe(
      "work.errors.featureNotScheduled",
    );
  });

  it("verlangt danach das Budget des Epics", () => {
    expect(featureStartBlockedKey({ piId: "pi1", parentId: "e1", parentStageGate: "L2" })).toBe(
      "work.errors.epicNotImplementing",
    );
  });

  it("lässt ein terminiertes Feature ab L3 starten", () => {
    for (const gate of ["L3", "L4", "L5"]) {
      expect(
        featureStartBlockedKey({ piId: "pi1", parentId: "e1", parentStageGate: gate }),
      ).toBeNull();
    }
  });

  it("lässt ein terminiertes eigenständiges Feature starten", () => {
    expect(
      featureStartBlockedKey({ piId: "pi1", parentId: null, parentStageGate: null }),
    ).toBeNull();
  });

  it("gibt Schlüssel zurück, keine Sätze", () => {
    // Sie reisen als `reason` eines DomainError bis in die Oberfläche; dort
    // wird übersetzt (ADR-0024, Regel 2). Vorher standen hier deutsche Sätze,
    // und der Wächter darüber sah sie nicht, weil sie über eine Variable
    // liefen statt als Literal in `reason:` zu stehen.
    const gruende = [
      featureStartBlockedKey({ piId: null, parentId: null, parentStageGate: null }),
      featureStartBlockedKey({ piId: "pi1", parentId: "e1", parentStageGate: "L0" }),
      featurePlanningBlockedKey({ parentId: "e1", parentStageGate: "L0" }),
    ];
    for (const g of gruende) expect(g).toMatch(/^work\.errors\.[a-zA-Z]+$/);
  });
});
