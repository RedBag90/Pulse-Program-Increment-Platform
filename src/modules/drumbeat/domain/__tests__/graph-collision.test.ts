import { describe, it, expect } from "vitest";
import {
  resolveCollisions,
  type PlacementGeometry,
  type PlacementInput,
} from "@/modules/drumbeat/domain/graph-collision";

/**
 * **Der gemeldete Fall:** ein Feature wird angelegt und landet auf einem
 * bestehenden.
 *
 * Die Ursache war kein Rechenfehler, sondern eine fehlende Frage. Der Netzplan
 * führte zwei Koordinatensysteme — dagres Anordnung und die von Hand gezogenen
 * Positionen —, und keines wusste vom anderen. Eine gespeicherte Position
 * schlug die berechnete bedingungslos; ein neuer Knoten bekam die rohe
 * dagre-Koordinate aus einem Graphen, in dem die gezogenen Knoten noch in
 * ihren Auto-Slots sassen.
 */

const G: PlacementGeometry = { width: 220, height: 80, gap: 24 };

const knoten = (id: string, x: number, y: number, pinned = false): PlacementInput => ({
  id,
  position: { x, y },
  pinned,
});

describe("resolveCollisions", () => {
  it("lässt in Ruhe, was sich nicht schneidet", () => {
    const out = resolveCollisions([knoten("a", 0, 0), knoten("b", 400, 0)], G);

    expect(out.get("a")).toEqual({ x: 0, y: 0 });
    expect(out.get("b")).toEqual({ x: 400, y: 0 });
  });

  it("schiebt den zweiten nach unten, wenn beide auf derselben Stelle liegen", () => {
    const out = resolveCollisions([knoten("a", 100, 100), knoten("b", 100, 100)], G);

    expect(out.get("a")).toEqual({ x: 100, y: 100 });
    // Nach **unten**, nicht zur Seite: die x-Achse ist im LR-Layout die
    // Reihenfolge der Abhängigkeiten. Ein Ausweichen nach rechts behauptete
    // eine Abhängigkeit, die es nicht gibt.
    expect(out.get("b")).toEqual({ x: 100, y: 100 + G.height + G.gap });
  });

  it("**bewegt einen gepinnten Knoten nie** — der neue weicht aus", () => {
    // Genau der gemeldete Fall: ein von Hand gezogener Knoten, und ein neu
    // angelegtes Feature, das dagre auf denselben Fleck legt.
    const out = resolveCollisions([knoten("neu", 300, 200), knoten("gezogen", 300, 200, true)], G);

    expect(out.get("gezogen")).toEqual({ x: 300, y: 200 });
    expect(out.get("neu")?.y).toBeGreaterThan(200);
    expect(out.get("neu")?.x).toBe(300);
  });

  it("weicht so lange aus, bis wirklich frei ist", () => {
    // Drei auf einem Fleck: der dritte muss an zwei belegten Boxen vorbei.
    const out = resolveCollisions([knoten("a", 0, 0), knoten("b", 0, 0), knoten("c", 0, 0)], G);

    const ys = ["a", "b", "c"].map((id) => out.get(id)!.y);
    expect(ys).toEqual([0, 104, 208]);
  });

  it("zählt auch die Luft dazwischen als belegt", () => {
    // 80 hoch, 24 Luft: bei 90 Abstand ueberlappen die Boxen zwar nicht, sie
    // kleben aber aneinander — das ist der Fall, den `gap` verhindert.
    const out = resolveCollisions([knoten("a", 0, 0), knoten("b", 0, 90)], G);

    expect(out.get("b")?.y).toBe(194);
  });

  it("lässt zwei gepinnte in Ruhe, auch wenn sie sich überlappen", () => {
    // Das hat ein Mensch so gewollt; die Entzerrung raeumt ihm nicht hinterher.
    const out = resolveCollisions([knoten("a", 50, 50, true), knoten("b", 60, 60, true)], G);

    expect(out.get("a")).toEqual({ x: 50, y: 50 });
    expect(out.get("b")).toEqual({ x: 60, y: 60 });
  });

  it("gibt für jeden Knoten genau eine Position zurück", () => {
    const out = resolveCollisions([knoten("a", 0, 0), knoten("b", 0, 0)], G);

    expect(out.size).toBe(2);
  });
});
