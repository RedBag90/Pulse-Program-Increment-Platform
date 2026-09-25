import { describe, it, expect } from "vitest";
import { crossings, hopsFor, polylineOf, withHops } from "@/modules/drumbeat/domain/edge-hops";

/**
 * **Kreuzungen brauchen einen Indikator; Überlagerungen sind verboten.**
 *
 * Die Überlagerung löst die Anschluss-Verteilung (`graph-handles.ts`). Was
 * bleibt, sind echte Kreuzungen — und ohne Zeichen daran ist eine Kreuzung von
 * einer Verzweigung nicht zu unterscheiden.
 *
 * Die Geometrie hier ist bewusst **geliehen**, nicht nachgebaut: zerlegt wird
 * das `d`, das ReactFlow ohnehin zeichnet. Ein eigener Routing-Algorithmus
 * sähe morgen anders aus als das Bild, und die Bögen sässen daneben.
 */

describe("polylineOf", () => {
  it("liest M und L", () => {
    expect(polylineOf("M 0,0 L 10,0 L 10,10")).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("nimmt bei einer gerundeten Ecke den Kontrollpunkt mit", () => {
    // `Q cx cy x y` — der Kontrollpunkt **ist** die Ecke, die die Rundung
    // abschneidet; für die Frage „schneiden sich zwei Linien" ist er der
    // richtige Punkt.
    expect(polylineOf("M 0,0 L 10,0 Q 20,0 20,10 L 20,20")).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
    ]);
  });

  it("gibt bei Unbekanntem lieber nichts zurück", () => {
    // Lieber keine Brücke als eine falsche: der Aufrufer zeichnet dann die
    // unveränderte Linie.
    expect(polylineOf("M 0,0 C 1,1 2,2 3,3")).toEqual([]);
    expect(polylineOf("")).toEqual([]);
  });
});

describe("crossings", () => {
  const waagerecht = [
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  ];
  const senkrecht = [
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ];

  it("findet den Schnittpunkt zweier sich kreuzender Linien", () => {
    expect(crossings(waagerecht, senkrecht)).toEqual([{ x: 50, y: 50 }]);
  });

  it("findet bei parallelen keinen", () => {
    const zweite = [
      { x: 0, y: 70 },
      { x: 100, y: 70 },
    ];
    expect(crossings(waagerecht, zweite)).toEqual([]);
  });

  it("zählt eine Berührung am Ende **nicht** als Kreuzung", () => {
    // Zwei Kanten, die an demselben Knoten andocken, treffen sich dort. Das ist
    // eine gemeinsame Quelle, keine Kreuzung — ein Bogen darüber wäre falsch.
    const a = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ];
    const b = [
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    expect(crossings(a, b)).toEqual([]);
  });

  it("meldet denselben Punkt nur einmal", () => {
    const mehrfach = [
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
    ];
    expect(crossings(waagerecht, mehrfach)).toHaveLength(1);
  });
});

describe("hopsFor", () => {
  const waagerecht = [
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  ];
  const senkrecht = [
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ];

  it("lässt die waagerechte über die senkrechte hüpfen — nicht umgekehrt", () => {
    // Die Schaltplan-Konvention, und im LR-Layout sitzt der Bogen damit dort,
    // wo das Auge ohnehin entlangliest.
    expect(hopsFor("w", waagerecht, [{ id: "s", points: senkrecht }])).toEqual([{ x: 50, y: 50 }]);
    expect(hopsFor("s", senkrecht, [{ id: "w", points: waagerecht }])).toEqual([]);
  });

  it("hüpft nicht über sich selbst", () => {
    expect(hopsFor("w", waagerecht, [{ id: "w", points: waagerecht }])).toEqual([]);
  });

  it("entscheidet bei gleicher Richtung nach der Id — damit es stabil bleibt", () => {
    const schraeg1 = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const schraeg2 = [
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ];
    const a = hopsFor("a", schraeg1, [{ id: "b", points: schraeg2 }]);
    const b = hopsFor("b", schraeg2, [{ id: "a", points: schraeg1 }]);

    // Genau eine der beiden hüpft, und zwar immer dieselbe.
    expect(a.length + b.length).toBe(1);
    expect(a).toHaveLength(1);
  });
});

describe("withHops", () => {
  const gerade = "M 0,50 L 100,50";

  it("gibt den Pfad unverändert zurück, wenn es nichts zu überqueren gibt", () => {
    expect(withHops(gerade, [])).toBe(gerade);
  });

  it("setzt an der Kreuzung einen Bogen und lässt den Rest stehen", () => {
    const d = withHops(gerade, [{ x: 50, y: 50 }], 5);

    expect(d).toContain("A 5,5");
    // Die Linie beginnt und endet, wo sie vorher begann und endete.
    expect(d.startsWith("M 0,50")).toBe(true);
    expect(d.endsWith("L 100,50")).toBe(true);
    // Vor und nach dem Bogen je ein gerades Stück.
    expect(d).toContain("L 45,50");
    expect(d).toContain("A 5,5 0 0 1 55,50");
  });

  it("übergeht einen Punkt, der auf keiner Strecke liegt", () => {
    expect(withHops(gerade, [{ x: 50, y: 999 }], 5)).toContain("L 100,50");
    expect(withHops(gerade, [{ x: 50, y: 999 }], 5)).not.toContain("A ");
  });

  it("setzt mehrere Bögen in Laufrichtung", () => {
    const d = withHops(
      "M 0,50 L 100,50",
      [
        { x: 70, y: 50 },
        { x: 30, y: 50 },
      ],
      5,
    );

    expect(d.indexOf("25,50")).toBeLessThan(d.indexOf("65,50"));
  });
});
