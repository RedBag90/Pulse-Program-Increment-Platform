import { describe, it, expect } from "vitest";
import {
  HANDLE_SLOTS,
  assignHandles,
  handleOffsetPercent,
  isBracketTarget,
  slotFor,
} from "@/modules/drumbeat/domain/graph-handles";

/**
 * **Der zweite gemeldete Befund:** Kanten liegen übereinander.
 *
 * Ein Knoten hatte genau einen Anschluss je Seite, und die Linie ist eine
 * reine Funktion ihrer Endpunkte — zwei Kanten mit denselben Endpunkten
 * erzeugten dasselbe `d`. Die Datenbank lässt drei Abhängigkeiten je Paar zu
 * (`@@unique([fromId, toId, type])`), der Fall war also eingebaut, nicht
 * exotisch.
 */

describe("slotFor", () => {
  it("setzt eine einzelne Kante in die Mitte", () => {
    // Der Normalfall soll aussehen wie vorher.
    expect(slotFor(0, 1)).toBe(2);
  });

  it("rückt zwei symmetrisch auseinander", () => {
    expect([slotFor(0, 2), slotFor(1, 2)]).toEqual([1, 3]);
  });

  it("nutzt bei dreien die Ränder mit", () => {
    expect([slotFor(0, 3), slotFor(1, 3), slotFor(2, 3)]).toEqual([0, 2, 4]);
  });

  it("bleibt auch bei mehr Kanten als Anschlüssen im Rahmen", () => {
    for (let i = 0; i < 12; i++) {
      const s = slotFor(i, 12);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(HANDLE_SLOTS);
    }
  });
});

describe("handleOffsetPercent", () => {
  it("verteilt die Anschlüsse über die Knotenhöhe, ohne die Ränder zu treffen", () => {
    const werte = Array.from({ length: HANDLE_SLOTS }, (_, i) => handleOffsetPercent(i));

    expect(werte[0]).toBeGreaterThan(0);
    expect(werte[HANDLE_SLOTS - 1]).toBeLessThan(100);
    expect(werte[Math.floor(HANDLE_SLOTS / 2)]).toBe(50);
  });
});

describe("assignHandles", () => {
  const kante = (id: string, source: string, target: string) => ({ id, source, target });

  it("gibt drei Abhängigkeiten desselben Paares drei verschiedene Anschlüsse", () => {
    // Genau der Fall aus der Datenbank: blocks + depends_on + relates_to
    // zwischen denselben zwei Features.
    const out = assignHandles([
      kante("e1", "a", "b"),
      kante("e2", "a", "b"),
      kante("e3", "a", "b"),
    ]);

    const quellen = ["e1", "e2", "e3"].map((id) => out.get(id)!.sourceHandle);
    const ziele = ["e1", "e2", "e3"].map((id) => out.get(id)!.targetHandle);

    expect(new Set(quellen).size).toBe(3);
    expect(new Set(ziele).size).toBe(3);
  });

  it("lässt eine einzelne Kante in der Mitte andocken", () => {
    const out = assignHandles([kante("e1", "a", "b")]);

    expect(out.get("e1")).toEqual({ sourceHandle: "s2", targetHandle: "t2" });
  });

  it("verteilt auch, wenn nur ein Ende sich teilt", () => {
    // Zwei Kanten aus demselben Knoten in verschiedene Ziele: die Quellen
    // müssen auseinander, die Ziele dürfen beide mittig sein.
    const out = assignHandles([kante("e1", "a", "b"), kante("e2", "a", "c")]);

    expect(out.get("e1")!.sourceHandle).not.toBe(out.get("e2")!.sourceHandle);
    expect(out.get("e1")!.targetHandle).toBe("t2");
    expect(out.get("e2")!.targetHandle).toBe("t2");
  });

  it("ist deterministisch — dieselbe Eingabe, dieselbe Zuordnung", () => {
    // Eine Anordnung, die sich bei jedem Laden ändert, ist schlimmer als eine,
    // die manchmal eng ist. Deshalb wird nach Kanten-Id sortiert, nicht nach
    // Eingabereihenfolge.
    const a = assignHandles([kante("e2", "a", "b"), kante("e1", "a", "b")]);
    const b = assignHandles([kante("e1", "a", "b"), kante("e2", "a", "b")]);

    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("gibt für jede Kante beide Enden zurück", () => {
    const out = assignHandles([kante("e1", "a", "b"), kante("e2", "b", "c")]);

    for (const id of ["e1", "e2"]) {
      expect(out.get(id)?.sourceHandle).toMatch(/^s\d$/);
      expect(out.get(id)?.targetHandle).toMatch(/^t\d$/);
    }
  });
});

/**
 * **Die Klammer: eine Kante in derselben Bahn kommt von rechts wieder herein.**
 *
 * Zwei Knoten derselben Bahn liegen übereinander. Rechts heraus und links
 * hinein hiess: um den Knoten herum, 264 px Umweg für 124 px Höhe, alle auf
 * denselben zwei Korridoren. Von rechts hinein wird die Kante zur Klammer
 * neben der Bahn.
 */
describe("assignHandles — Klammern", () => {
  it("gibt einer Kante derselben Bahn ein Ziel auf der rechten Seite", () => {
    const out = assignHandles([{ id: "e1", source: "a", target: "b", sameColumn: true, span: 1 }]);

    expect(isBracketTarget(out.get("e1")!.targetHandle)).toBe(true);
    expect(out.get("e1")!.targetHandle).toMatch(/^tr\d$/);
    // Die Quelle bleibt rechts — die Klammer beginnt, wo jede Kante beginnt.
    expect(out.get("e1")!.sourceHandle).toMatch(/^s\d$/);
  });

  it("lässt eine Kante in eine andere Bahn, wie sie war", () => {
    const out = assignHandles([{ id: "e1", source: "a", target: "b", sameColumn: false }]);

    expect(out.get("e1")!.targetHandle).toMatch(/^t\d$/);
    expect(out.get("e1")!.bracketDepth).toBeUndefined();
  });

  it("greift mit der Spannweite weiter aus — lange Klammern aussen, kurze innen", () => {
    const out = assignHandles([
      { id: "kurz", source: "a", target: "b", sameColumn: true, span: 1 },
      { id: "lang", source: "a", target: "d", sameColumn: true, span: 3 },
    ]);

    expect(out.get("kurz")!.bracketDepth).toBe(0);
    expect(out.get("lang")!.bracketDepth).toBe(2);
    expect(out.get("lang")!.bracketDepth!).toBeGreaterThan(out.get("kurz")!.bracketDepth!);
  });

  it("deckelt die Tiefe auf die Zahl der Anschlüsse", () => {
    const out = assignHandles([{ id: "e", source: "a", target: "z", sameColumn: true, span: 40 }]);
    expect(out.get("e")!.bracketDepth).toBe(HANDLE_SLOTS - 1);
  });

  it("nimmt ohne Spannweite die innerste Klammer", () => {
    const out = assignHandles([{ id: "e", source: "a", target: "b", sameColumn: true }]);
    expect(out.get("e")!.bracketDepth).toBe(0);
  });
});

describe("isBracketTarget", () => {
  it("erkennt nur die rechte Zielreihe", () => {
    expect(isBracketTarget("tr2")).toBe(true);
    expect(isBracketTarget("t2")).toBe(false);
    expect(isBracketTarget("s2")).toBe(false);
    expect(isBracketTarget(null)).toBe(false);
    expect(isBracketTarget(undefined)).toBe(false);
  });
});
