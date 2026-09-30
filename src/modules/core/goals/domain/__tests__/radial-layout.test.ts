import { describe, it, expect } from "vitest";
import {
  gedeckelteAnteile,
  goalLineage,
  radialLayout,
  radialRoot,
  KNOTEN_PLATZ,
  RING_ABSTAND,
} from "@/modules/core/goals/domain/radial-layout";

interface N {
  id: string;
  children: N[];
}
const n = (id: string, children: N[] = []): N => ({ id, children });

/** A ─ A1, A2 · B ─ B1 ─ B1a · C */
const forest: N[] = [n("A", [n("A1"), n("A2")]), n("B", [n("B1", [n("B1a")])]), n("C")];

const byId = (l: ReturnType<typeof radialLayout>) => new Map(l.nodes.map((p) => [p.id, p]));
const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe("radialLayout", () => {
  it("ein leerer Wald ergibt nur die Mitte", () => {
    expect(radialLayout([])).toEqual({ nodes: [], ringRadii: [] });
  });

  it("Oberziele liegen auf Ring 1, Unterziele weiter außen", () => {
    const l = radialLayout(forest);
    const p = byId(l);
    for (const id of ["A", "B", "C"]) {
      expect(p.get(id)!.depth).toBe(1);
      expect(radius(p.get(id)!)).toBeCloseTo(l.ringRadii[0]!);
    }
    expect(radius(p.get("A1")!)).toBeCloseTo(l.ringRadii[1]!);
    expect(radius(p.get("B1a")!)).toBeCloseTo(l.ringRadii[2]!);
    expect(l.ringRadii[1]! - l.ringRadii[0]!).toBeGreaterThanOrEqual(RING_ABSTAND);
  });

  it("verteilt nach Blattzahl und beginnt oben", () => {
    // 2/1/1/1/1/1 Blätter: niemand über 120° → reine Blatt-Gewichtung.
    const sechs = [n("A", [n("A1"), n("A2")]), ...["B", "C", "D", "E", "F"].map((x) => n(x))];
    const p = byId(radialLayout(sechs));
    const stueck = (2 * Math.PI) / 7;
    expect(p.get("A")!.angle).toBeCloseTo(-Math.PI / 2 + stueck);
    expect(p.get("C")!.angle - p.get("B")!.angle).toBeCloseTo(stueck);
  });

  it("hält einen großen Ast in seinem Tortenstück (9 / 1 / 1)", () => {
    const gross = n(
      "G",
      Array.from({ length: 9 }, (_, i) => n(`G${i}`)),
    );
    const l = radialLayout([gross, n("H"), n("I")]);
    const p = byId(l);
    expect(p.get("H")!.angle - p.get("G")!.angle).toBeCloseTo((2 * Math.PI) / 3);
    const von = -Math.PI / 2;
    const bis = von + (2 * Math.PI) / 3;
    for (let i = 0; i < 9; i++) {
      const a = p.get(`G${i}`)!.angle;
      expect(a).toBeGreaterThan(von);
      expect(a).toBeLessThan(bis);
    }
    // Eng im Stück → der Ring rückt nach außen, statt Kreise zu stapeln.
    expect(l.ringRadii[1]! - l.ringRadii[0]!).toBeGreaterThan(RING_ABSTAND);
  });

  it("innerhalb eines Asts bekommt der größere Teilast mehr Winkel", () => {
    // X ─ X1 (3 Blätter), X2 (1 Blatt)
    const x = n("X", [n("X1", [n("a"), n("b"), n("c")]), n("X2")]);
    const p = byId(radialLayout([x]));
    const sektorX1 = p.get("c")!.angle - p.get("a")!.angle;
    expect(sektorX1).toBeGreaterThan(0);
    expect(p.get("X2")!.angle - p.get("X1")!.angle).toBeGreaterThan(0);
    // X1 liegt mittig in 3/4 der Runde, X2 mittig im letzten Viertel.
    expect(p.get("X1")!.angle).toBeCloseTo(-Math.PI / 2 + (3 / 4) * Math.PI);
  });

  it("Kinder liegen im Sektor des Elternteils", () => {
    const p = byId(radialLayout(forest));
    // A-Sektor: −π/2 .. π/2
    for (const id of ["A1", "A2"]) {
      expect(p.get(id)!.angle).toBeGreaterThan(-Math.PI / 2);
      expect(p.get(id)!.angle).toBeLessThan(Math.PI / 2);
    }
    // Einzelkind liegt auf der Linie des Elternteils.
    expect(p.get("B1")!.angle).toBeCloseTo(p.get("B")!.angle);
  });

  it("vererbt den Ast des Oberziels", () => {
    const p = byId(radialLayout(forest));
    expect([p.get("A1")!.branch, p.get("B1a")!.branch, p.get("C")!.branch]).toEqual([0, 1, 2]);
    expect(p.get("B1a")!.parentId).toBe("B1");
    expect(p.get("A")!.parentId).toBeNull();
  });

  it("lässt eingeklappte Teilbäume weg", () => {
    const l = radialLayout(forest, new Set(["B"]));
    const ids = l.nodes.map((p) => p.id);
    expect(ids).not.toContain("B1");
    expect(ids).not.toContain("B1a");
    expect(l.ringRadii).toHaveLength(2);
  });

  it("hält auf jedem Ring mindestens KNOTEN_PLATZ zwischen Nachbarn", () => {
    const viele = Array.from({ length: 6 }, (_, i) =>
      n(
        `T${i}`,
        Array.from({ length: 5 }, (_, j) => n(`T${i}-${j}`)),
      ),
    );
    const l = radialLayout(viele);
    for (let d = 1; d <= 2; d++) {
      const ring = l.nodes.filter((p) => p.depth === d);
      for (let i = 0; i < ring.length; i++) {
        for (let j = i + 1; j < ring.length; j++) {
          const a = ring[i]!;
          const b = ring[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(KNOTEN_PLATZ * 0.99);
        }
      }
    }
  });
});

describe("radialRoot", () => {
  it("ein Oberziel rückt in die Mitte, seine Kinder bilden die Ringe", () => {
    const einziges = n("A", [n("A1"), n("A2")]);
    const r = radialRoot([einziges]);
    expect(r.center?.id).toBe("A");
    expect(r.rings.map((x) => x.id)).toEqual(["A1", "A2"]);
  });

  it("eingeklappt steht das Ziel allein in der Mitte", () => {
    const r = radialRoot([n("A", [n("A1")])], new Set(["A"]));
    expect(r.center?.id).toBe("A");
    expect(r.rings).toEqual([]);
  });

  it("mehrere oder keine Oberziele: Mitte bleibt die Strategie", () => {
    expect(radialRoot(forest).center).toBeNull();
    expect(radialRoot(forest).rings).toBe(forest);
    expect(radialRoot([]).center).toBeNull();
  });
});

describe("goalLineage", () => {
  const plätze = radialLayout(forest).nodes;

  it("enthält Vorfahren, das Ziel und alle Nachfahren", () => {
    expect([...goalLineage(plätze, "B1")].sort()).toEqual(["B", "B1", "B1a"]);
    expect([...goalLineage(plätze, "A")].sort()).toEqual(["A", "A1", "A2"]);
  });

  it("lässt Geschwister und fremde Äste weg", () => {
    const linie = goalLineage(plätze, "A1");
    expect([...linie].sort()).toEqual(["A", "A1"]);
  });

  it("unbekannte Id ergibt eine leere Menge", () => {
    expect(goalLineage(plätze, "X").size).toBe(0);
  });
});

describe("gedeckelteAnteile", () => {
  it("setzt Überstehende auf den Deckel und verteilt den Rest", () => {
    expect(gedeckelteAnteile([9, 1, 1], 360, 120)).toEqual([120, 120, 120]);
    // 9 → 270 > 200 → gedeckelt; 160 Rest im Verhältnis 1:2.
    const a = gedeckelteAnteile([9, 1, 2], 360, 200);
    expect(a[0]).toBe(200);
    expect(a[1]! + a[2]!).toBeCloseTo(160);
    expect(a[2]! / a[1]!).toBeCloseTo(2);
  });

  it("ohne Überstand bleibt es proportional", () => {
    expect(gedeckelteAnteile([1, 1, 2], 360, 200)).toEqual([90, 90, 180]);
  });
});
