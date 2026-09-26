import { describe, it, expect } from "vitest";
import {
  countDeliveryLoad,
  funnelCode,
  inDeliveryWindow,
  type CountableEpic,
} from "@/modules/work/server/services/horizon-funnel";

/**
 * **Wie groß ein Produkt ohne Budget-Modul erscheint.**
 *
 * Bis dahin trug allein das Geld die Größe; ohne Modul war es überall null und
 * jedes Produkt schrumpfte auf denselben leeren Umriss. Jetzt zählen die Epics
 * im Lieferfenster L3–L4.2 — und die Ränder dieses Fensters sind die
 * eigentliche Entscheidung.
 */
const epic = (over: Partial<CountableEpic> = {}): CountableEpic => ({
  primarySolutionId: "s1",
  stageGate: "L4",
  selectedForAnalyzingAt: null,
  implementationCompletedAt: null,
  ...over,
});

describe("countDeliveryLoad", () => {
  it("zählt je Produkt, was gerade läuft", () => {
    const m = countDeliveryLoad([epic(), epic(), epic({ primarySolutionId: "s2" })]);
    expect(m.get("s1")).toBe(2);
    expect(m.get("s2")).toBe(1);
  });

  it("zählt L3 mit — der Budget-Beschluss ist die untere Grenze", () => {
    // Seit dem Neuschnitt ist „Budget alloziert" ein eigener Reifegrad; der
    // Stempel `approvedAt` muss dafuer nicht mehr befragt werden.
    const m = countDeliveryLoad([epic({ stageGate: "L3" })]);
    expect(m.get("s1")).toBe(1);
  });

  it("zählt L2 nicht — ein freigegebener Business Case ist noch kein Beschluss", () => {
    const m = countDeliveryLoad([epic({ stageGate: "L2" })]);
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

/**
 * **Eine Regel für Produkte und Epic-Punkte.**
 *
 * Ein Epic ohne Produkt erschien mit Budget-Modul, sobald Geld darauf lag —
 * also schon ab L2 und auch noch auf L5 —, während die Größe eines Produkts
 * nur L3–L4.2 zählte. Jetzt entscheidet für beide dasselbe Fenster.
 */
describe("inDeliveryWindow", () => {
  it("lässt L2 draussen — ein freigegebener Business Case ist noch kein Beschluss", () => {
    expect(inDeliveryWindow(epic({ stageGate: "L2" }))).toBe(false);
  });

  it("nimmt L3 bis L4.2 auf", () => {
    expect(inDeliveryWindow(epic({ stageGate: "L3" }))).toBe(true);
    expect(inDeliveryWindow(epic({ stageGate: "L4" }))).toBe(true);
    expect(
      inDeliveryWindow(
        epic({ stageGate: "L4", implementationCompletedAt: new Date("2026-09-01") }),
      ),
    ).toBe(true);
  });

  it("lässt L5 draussen — dort wird nichts mehr geliefert", () => {
    expect(inDeliveryWindow(epic({ stageGate: "L5" }))).toBe(false);
  });

  it("ist dieselbe Grenze wie die Produktgröße", () => {
    const epics = ["L0", "L1", "L2", "L3", "L4", "L5"].map((g) => epic({ stageGate: g }));
    expect(countDeliveryLoad(epics).get("s1")).toBe(epics.filter(inDeliveryWindow).length);
  });
});
