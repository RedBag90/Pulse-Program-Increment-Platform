import { describe, it, expect } from "vitest";
import type { Edge } from "@xyflow/react";
import { mergeOptimisticEdges } from "@/modules/drumbeat/features/cockpit/lib/optimistic-edges";

/**
 * **Der Befund, für den es diese Funktion gibt.**
 *
 * Ein Drag-Connect im Epic-Netzplan meldete „Abhängigkeit angelegt", zeigte
 * die Kante — und liess sie nach gut einer Sekunde wieder verschwinden. Die
 * eine Ursache war der Leseweg, der noch am Drumbeat-Modul hing; die andere
 * ist hier: der Effekt **ersetzte** den lokalen Stand durch den Server-Stand,
 * und der kann von vor dem Schreiben stammen. `onConnect` refresht selbst,
 * `useBreakdownRealtime` 600 ms später noch einmal — es gibt keine Reihenfolge,
 * auf die man sich verlassen könnte.
 */

const edge = (id: string, source: string, target: string, type?: string): Edge => ({
  id,
  source,
  target,
  ...(type === undefined ? {} : { data: { type } }),
});

describe("mergeOptimisticEdges", () => {
  it("hält eine tmp-Kante, die der Server noch nicht kennt", () => {
    const merged = mergeOptimisticEdges(
      [edge("d-1", "f1", "f2", "blocks")],
      [edge("d-1", "f1", "f2", "blocks"), edge("tmp-f2-f3-17", "f2", "f3", "depends_on")],
    );

    expect(merged.map((e) => e.id)).toEqual(["d-1", "tmp-f2-f3-17"]);
  });

  it("lässt sie fallen, sobald dieselbe Kante vom Server kommt", () => {
    // Der Server vergibt eine eigene Kennung — erkannt wird sie am Paar und am
    // Typ, nicht an der Id.
    const merged = mergeOptimisticEdges(
      [edge("d-1", "f1", "f2", "blocks"), edge("d-2", "f2", "f3", "depends_on")],
      [edge("d-1", "f1", "f2", "blocks"), edge("tmp-f2-f3-17", "f2", "f3", "depends_on")],
    );

    expect(merged.map((e) => e.id)).toEqual(["d-1", "d-2"]);
  });

  it("unterscheidet zwei Kanten desselben Paares nach ihrem Typ", () => {
    // `@@unique([fromId, toId, type])` lässt beide nebeneinander zu.
    const merged = mergeOptimisticEdges(
      [edge("d-1", "f1", "f2", "blocks")],
      [edge("d-1", "f1", "f2", "blocks"), edge("tmp-f1-f2-17", "f1", "f2", "relates_to")],
    );

    expect(merged.map((e) => e.id)).toEqual(["d-1", "tmp-f1-f2-17"]);
  });

  it("gibt den Server-Stand unverändert zurück, wenn nichts schwebt", () => {
    const fromServer = [edge("d-1", "f1", "f2", "blocks")];

    // Identität, nicht nur Gleichheit: `baseGraph.edges` ist ein Memo, und ein
    // neues Array bei jedem Lauf triebe ReactFlow in unnötige Neuberechnungen.
    expect(mergeOptimisticEdges(fromServer, [edge("d-9", "f8", "f9")])).toBe(fromServer);
  });

  it("räumt eine gelöschte Kante weg — nur tmp- ist geschützt", () => {
    const merged = mergeOptimisticEdges([], [edge("d-1", "f1", "f2", "blocks")]);

    expect(merged).toEqual([]);
  });
});
