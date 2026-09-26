import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import {
  slotOf,
  useEdgePaths,
} from "@/modules/drumbeat/features/cockpit/components/network-shared";
import { polylineOf } from "@/modules/drumbeat/domain/edge-hops";

/**
 * **Die Geometrie der Klammer, als Zahl.**
 *
 * Eine Kante zwischen zwei Knoten derselben Bahn lief rechts heraus, um den
 * Knoten herum und links wieder hinein: der Linienzug reichte bis
 * `x = -32`, also 32 px **links über die Bahn hinaus**, und sein
 * waagerechtes Stück lief mitten durch den Knoten dazwischen. Als Klammer
 * bleibt sie rechts neben der Bahn.
 */

const W = 200;
const H = 64;
const knoten = (id: string, x: number, y: number): Node => ({ id, position: { x, y }, data: {} });
const kante = (over: Partial<Edge> & { id: string; source: string; target: string }): Edge => over;

function pfad(nodes: Node[], edges: Edge[]) {
  const { result } = renderHook(() => useEdgePaths(nodes, edges, { width: W, height: H }));
  return result.current;
}

describe("useEdgePaths — die Klammer", () => {
  const nodes = [knoten("a", 0, 56), knoten("b", 0, 180), knoten("c", 0, 304)];

  it("läuft nie links aus der Bahn heraus", () => {
    const d = pfad(nodes, [
      kante({ id: "e", source: "a", target: "b", sourceHandle: "s2", targetHandle: "tr2" }),
    ]).get("e")!;
    const punkte = polylineOf(d);
    expect(punkte.length).toBeGreaterThan(1);
    // Alles rechts der Knotenkante — nichts bei x < 0, nichts durch die Bahn.
    for (const p of punkte) expect(p.x).toBeGreaterThanOrEqual(W);
  });

  it("endet an der rechten Kante des Ziels", () => {
    const d = pfad(nodes, [
      kante({ id: "e", source: "a", target: "b", sourceHandle: "s2", targetHandle: "tr2" }),
    ]).get("e")!;
    const punkte = polylineOf(d);
    expect(punkte[punkte.length - 1]!.x).toBe(W);
  });

  it("greift bei grösserer Tiefe weiter in die Gasse", () => {
    const innen = pfad(nodes, [
      kante({
        id: "e",
        source: "a",
        target: "b",
        sourceHandle: "s2",
        targetHandle: "tr2",
        data: { bracketDepth: 0 },
      }),
    ]).get("e")!;
    const aussen = pfad(nodes, [
      kante({
        id: "e",
        source: "a",
        target: "c",
        sourceHandle: "s2",
        targetHandle: "tr2",
        data: { bracketDepth: 2 },
      }),
    ]).get("e")!;
    const maxX = (d: string) => Math.max(...polylineOf(d).map((p) => p.x));
    expect(maxX(aussen)).toBeGreaterThan(maxX(innen));
  });

  it("zeichnet eine gewöhnliche Kante weiterhin von rechts nach links", () => {
    // Der alte Fall bleibt unberührt: Ziel links, Pfad endet bei ziel.x.
    const d = pfad(
      [knoten("a", 0, 56), knoten("b", 400, 56)],
      [kante({ id: "e", source: "a", target: "b", sourceHandle: "s2", targetHandle: "t2" })],
    ).get("e")!;
    const punkte = polylineOf(d);
    expect(punkte[punkte.length - 1]!.x).toBe(400);
  });
});

describe("slotOf", () => {
  it("liest die Nummer hinter jedem Präfix", () => {
    expect(slotOf("s3")).toBe(3);
    expect(slotOf("t0")).toBe(0);
    expect(slotOf("tr4")).toBe(4);
  });

  it("landet ohne Anschluss in der Mitte — die Zusage, die vorher nicht hielt", () => {
    // `Number("")` ist 0, und `isFinite(0)` ist wahr: eine Kante ohne
    // Anschluss (die optimistische `tmp-`-Kante) sass bei 10 % statt 50 %.
    expect(slotOf(null)).toBe(2);
    expect(slotOf(undefined)).toBe(2);
    expect(slotOf("")).toBe(2);
    expect(slotOf("s")).toBe(2);
  });
});
