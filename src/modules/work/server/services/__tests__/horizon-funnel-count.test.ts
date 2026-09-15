import { describe, it, expect } from "vitest";
import {
  countDeliveryLoad,
  funnelCode,
  type CountableEpic,
} from "@/modules/work/server/services/horizon-funnel";

/**
 * **Wie groß ein Produkt ohne Budget-Modul erscheint.**
 *
 * Bis dahin trug allein das Geld die Größe; ohne Modul war es überall null und
 * jedes Produkt schrumpfte auf denselben leeren Umriss. Jetzt zählen die Epics
 * im Lieferfenster L3.2–L4.2 — und die Ränder dieses Fensters sind die
 * eigentliche Entscheidung.
 */
const epic = (over: Partial<CountableEpic> = {}): CountableEpic => ({
  primarySolutionId: "s1",
  stageGate: "L4",
  approvedAt: null,
  implementationCompletedAt: null,
  ...over,
});

describe("countDeliveryLoad", () => {
  it("zählt je Produkt, was gerade läuft", () => {
    const m = countDeliveryLoad([epic(), epic(), epic({ primarySolutionId: "s2" })]);
    expect(m.get("s1")).toBe(2);
    expect(m.get("s2")).toBe(1);
  });

  it("zählt L3.2 mit — der Budget-Beschluss ist die untere Grenze", () => {
    // L3.2 = `stage_gate` L3 **plus** der Abnahme-Stempel der Investition.
    const m = countDeliveryLoad([epic({ stageGate: "L3", approvedAt: new Date() })]);
    expect(m.get("s1")).toBe(1);
  });

  it("zählt L3.1 nicht — ein freigegebener Business Case ist noch kein Beschluss", () => {
    const m = countDeliveryLoad([epic({ stageGate: "L3", approvedAt: null })]);
    expect(m.has("s1")).toBe(false);
  });

  it("zählt L4.2 noch mit, L5 nicht mehr", () => {
    const fertig = epic({ stageGate: "L4", implementationCompletedAt: new Date() });
    expect(countDeliveryLoad([fertig]).get("s1")).toBe(1);
    expect(countDeliveryLoad([epic({ stageGate: "L5" })]).has("s1")).toBe(false);
  });

  it("zählt frühe Reifegrade nicht — sonst wüchse ein Produkt an Ideen", () => {
    for (const gate of ["L0", "L1", "L2"]) {
      expect(countDeliveryLoad([epic({ stageGate: gate })]).has("s1"), gate).toBe(false);
    }
  });

  it("übergeht Epics ohne Produkt — sie sind eigene Punkte, keine Größe", () => {
    expect(countDeliveryLoad([epic({ primarySolutionId: null })]).size).toBe(0);
  });

  it("gibt für ein Produkt ohne laufende Epics keinen Eintrag", () => {
    expect(countDeliveryLoad([]).get("s1")).toBeUndefined();
  });
});

describe("funnelCode", () => {
  it("stellt die Initialen des Wertstroms voran und kürzt den Namen nicht", () => {
    expect(funnelCode("Customer Experience Core", "Customer Experience")).toBe("CE · Core");
  });

  it("kommt ohne Wertstrom aus", () => {
    expect(funnelCode("Core", null)).toBe("Core");
  });
});
