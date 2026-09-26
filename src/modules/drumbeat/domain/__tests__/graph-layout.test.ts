import { describe, it, expect } from "vitest";
import {
  swimlaneLayout,
  pointsBackwards,
  columnAt,
  piOfColumn,
} from "@/modules/drumbeat/domain/graph-layout";

describe("swimlaneLayout", () => {
  const pis = [
    { id: "pi1", name: "PI 1", startDate: "2026-01-01" },
    { id: "pi2", name: "PI 2", startDate: "2026-04-01" },
  ];
  // COL_WIDTH = 220 + 160 = 380 ; FIRST_ROW_Y = 56 ; row step = 96 + 60 = 156
  const colWidth = 380;
  const laneY = (idx: number) => 56 + idx * 156;

  const { headers, features, ghosts } = swimlaneLayout(
    [
      { id: "f1", piId: null }, // Backlog (col 0)
      { id: "f2", piId: "pi1" }, // col 1
      { id: "f3", piId: "pi2" }, // col 2
      { id: "f4", piId: "unknown" }, // unknown PI → Backlog fallback
    ],
    [{ id: "g1" }],
    pis,
  );

  it("emits one header per column: Backlog, PIs, Cross-Epic", () => {
    expect(headers.map((h) => h.label)).toEqual(["Backlog", "PI 1", "PI 2", "Cross-Epic"]);
    expect(headers.map((h) => h.x)).toEqual([0, colWidth, colWidth * 2, colWidth * 3]);
    expect(headers.every((h) => h.y === 0)).toBe(true);
  });

  it("buckets features into PI columns (unknown PI falls back to Backlog)", () => {
    const byId = new Map(features.map((f) => [f.id, f]));
    // Backlog column (0): f1 stacked above f4.
    expect(byId.get("f1")).toEqual({ id: "f1", x: 0, y: laneY(0) });
    expect(byId.get("f4")).toEqual({ id: "f4", x: 0, y: laneY(1) });
    // PI columns.
    expect(byId.get("f2")).toEqual({ id: "f2", x: colWidth, y: laneY(0) });
    expect(byId.get("f3")).toEqual({ id: "f3", x: colWidth * 2, y: laneY(0) });
  });

  it("places ghost nodes in the rightmost Cross-Epic column", () => {
    expect(ghosts).toEqual([{ id: "g1", x: colWidth * 3, y: laneY(0) }]);
  });
});

/**
 * Die Parametrisierung war nötig, weil das Cockpit-Netz dieselbe Mathematik mit
 * anderen Knoten braucht. Die Tests oben prüfen weiter die Breakdown-Geometrie —
 * dass sie **unverändert** grün bleiben, ist der Beleg, dass nichts verrutscht.
 */
describe("swimlaneLayout — eigene Maße", () => {
  const pis = [{ id: "p1", name: "PI 1", startDate: "2026-01-01" }];

  it("rechnet die Spaltenbreite aus der übergebenen Knotenbreite", () => {
    const { headers } = swimlaneLayout([], [], pis, { nodeWidth: 200 });
    // 200 + 160 Zwischenraum.
    expect(headers.map((h) => h.x)).toEqual([0, 360, 720]);
  });

  it("stapelt mit der übergebenen Knotenhöhe", () => {
    const { features } = swimlaneLayout(
      [
        { id: "f1", piId: "p1" },
        { id: "f2", piId: "p1" },
      ],
      [],
      pis,
      { nodeHeight: 64 },
    );
    // 56 Kopfhöhe + 0, dann + (64 + 60).
    expect(features.map((f) => f.y)).toEqual([56, 180]);
  });

  it("beschriftet die Sammelspalte, wie der Aufrufer es nennt", () => {
    const { headers } = swimlaneLayout([], [], pis, { externLabel: "Außerhalb des Fensters" });
    expect(headers.at(-1)?.label).toBe("Außerhalb des Fensters");
  });

  it("bleibt ohne Angaben beim Breakdown-Maß", () => {
    const { headers } = swimlaneLayout([], [], pis);
    expect(headers.map((h) => h.x)).toEqual([0, 380, 760]);
    expect(headers.at(-1)?.label).toBe("Cross-Epic");
  });
});

/**
 * **Der Befund aus dem Betrieb.** Eine Spalte war so hoch wie ihr vollstes PI;
 * 49 Features ergaben 6000 px. So hoch bekommt React Flow die Leinwand nicht
 * mehr auf den Schirm — es hat einen Zoom-Boden —, und wer zwei Knoten
 * verbinden will, sieht sie nie gleichzeitig. Die Spalte wächst deshalb in die
 * Breite, nicht mehr ins Endlose nach unten.
 */
describe("swimlaneLayout — Umbruch in Nebenkolonnen", () => {
  const pis = [
    { id: "p1", name: "PI 1", startDate: "2026-01-01" },
    { id: "p2", name: "PI 2", startDate: "2026-04-01" },
  ];
  const many = (n: number, piId: string) =>
    Array.from({ length: n }, (_, i) => ({ id: `${piId}-f${i}`, piId }));

  it("bricht eine volle Spalte um, statt weiter nach unten zu stapeln", () => {
    const { features } = swimlaneLayout(many(3, "p1"), [], pis, {
      nodeWidth: 200,
      nodeHeight: 64,
      maxRows: 2,
    });
    // Zwei Reihen, dann fängt rechts daneben eine neue Kolonne wieder oben an.
    expect(features.map((f) => [f.x, f.y])).toEqual([
      [360, 56],
      [360, 180],
      [600, 56],
    ]);
  });

  /** Sonst lägen die Knoten der nächsten Spalte auf den Nebenkolonnen dieser. */
  it("schiebt die folgenden Spalten um die zusätzliche Breite nach rechts", () => {
    const { headers } = swimlaneLayout(many(3, "p1"), [], pis, {
      nodeWidth: 200,
      nodeHeight: 64,
      maxRows: 2,
    });
    // Backlog bei 0; PI 1 ist zwei Kolonnen breit (200 + 40 + 200), danach 160
    // Zwischenraum; PI 2 und die Sammelspalte folgen einspaltig.
    expect(headers.map((h) => h.x)).toEqual([0, 360, 960, 1320]);
  });

  it("lässt eine Spalte unter der Grenze genau dort, wo sie war", () => {
    const eng = swimlaneLayout(many(2, "p1"), [], pis, {
      nodeWidth: 200,
      nodeHeight: 64,
      maxRows: 8,
    });
    const ohne = swimlaneLayout(many(2, "p1"), [], pis, { nodeWidth: 200, nodeHeight: 64 });
    expect(eng).toEqual(ohne);
  });

  it("bricht auch die Sammelspalte um", () => {
    const ghosts = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
    const { ghosts: out } = swimlaneLayout([], ghosts, pis, {
      nodeWidth: 200,
      nodeHeight: 64,
      maxRows: 2,
    });
    // Ohne Features sind die PI-Spalten einspaltig: 0 · 360 · 720, Sammelspalte 1080.
    expect(out.map((g) => [g.x, g.y])).toEqual([
      [1080, 56],
      [1080, 180],
      [1320, 56],
    ]);
  });
});

/**
 * Sobald die x-Achse die Zeit ist, hat eine Kante eine Richtung darin. Eine
 * rückwärts laufende ist ein Planungsfehler — und der soll auffallen, nicht
 * verborgen werden.
 */
describe("pointsBackwards", () => {
  const spalte: Record<string, number> = { backlog: 0, a: 1, b: 2, c: 3 };
  const columnOf = (id: string) => spalte[id] ?? null;

  it("nennt eine vorwärts laufende Kante nicht rückwärts", () => {
    expect(pointsBackwards({ fromId: "a", toId: "c" }, columnOf)).toBe(false);
  });

  it("erkennt die Kante aus einem späteren PI in ein früheres", () => {
    expect(pointsBackwards({ fromId: "c", toId: "a" }, columnOf)).toBe(true);
  });

  it("nennt eine Kante innerhalb derselben Spalte nicht rückwärts", () => {
    expect(pointsBackwards({ fromId: "a", toId: "a" }, columnOf)).toBe(false);
  });

  it("aus dem Backlog heraus läuft immer vorwärts", () => {
    expect(pointsBackwards({ fromId: "backlog", toId: "b" }, columnOf)).toBe(false);
  });

  /** Etwas Terminiertes, das auf etwas Unterminiertes wartet, ist fraglich. */
  it("in den Backlog hinein läuft rückwärts", () => {
    expect(pointsBackwards({ fromId: "b", toId: "backlog" }, columnOf)).toBe(true);
  });

  /** Über das, was man nicht sieht, wird nichts behauptet. */
  it("behauptet nichts über ein Ende außerhalb des Fensters", () => {
    expect(pointsBackwards({ fromId: "c", toId: "weit-weg" }, columnOf)).toBe(false);
    expect(pointsBackwards({ fromId: "weit-weg", toId: "a" }, columnOf)).toBe(false);
  });
});

/**
 * **Die Umkehrung: von der Koordinate zurück auf die Bahn.**
 *
 * Seit sich Features per Zug in ein anderes PI legen lassen, muss aus einer
 * x-Koordinate eine Spalte werden. Eine feste Schrittweite scheidet aus: eine
 * volle Spalte bricht in Nebenkolonnen und schiebt alles rechts davon weiter.
 */
describe("columnAt", () => {
  const lay = swimlaneLayout(
    [
      { id: "a", piId: null },
      { id: "b", piId: "p1" },
    ],
    [{ id: "g1" }],
    [
      { id: "p1", name: "PI 1", startDate: "2026-01-01" },
      { id: "p2", name: "PI 2", startDate: "2026-04-01" },
    ],
  );

  it("gibt die Bandkanten mit heraus", () => {
    // Ohne sie wäre die Umkehrung nicht zu haben — sie lagen vorher nur intern vor.
    expect(lay.bands).toEqual(lay.headers.map((h) => h.x));
  });

  it("trifft jede Spalte an ihrer linken Kante", () => {
    lay.bands.forEach((x, col) => expect(columnAt(x, lay.bands)).toBe(col));
  });

  it("trifft sie auch in der Mitte", () => {
    lay.bands.forEach((x, col) => expect(columnAt(x + lay.nodeWidth / 2, lay.bands)).toBe(col));
  });

  it("ordnet die Luft dazwischen der letzten begonnenen Spalte zu", () => {
    // Ein Knoten, der in der Lücke liegen bleibt, ist von links dorthin
    // gezogen worden. Die Geste zu verwerfen wäre unfreundlicher.
    const luecke = lay.bands[1]! + lay.nodeWidth + 20;
    expect(luecke).toBeLessThan(lay.bands[2]!);
    expect(columnAt(luecke, lay.bands)).toBe(1);
  });

  it("gibt links vom ersten Band nichts zurück", () => {
    expect(columnAt(lay.bands[0]! - 1, lay.bands)).toBeNull();
  });

  it("kommt mit einem leeren Layout zurecht", () => {
    expect(columnAt(0, [])).toBeNull();
  });
});

describe("piOfColumn", () => {
  const pis = [{ id: "p1" }, { id: "p2" }];

  it("macht aus Spalte 0 den Backlog", () => {
    // `null` ist ein **gültiges** Ziel: ein Feature aus einem PI zu nehmen ist
    // eine Planungsentscheidung wie jede andere.
    expect(piOfColumn(0, pis)).toBeNull();
  });

  it("macht aus den mittleren Spalten die PIs, in Reihenfolge", () => {
    expect(piOfColumn(1, pis)).toBe("p1");
    expect(piOfColumn(2, pis)).toBe("p2");
  });

  it("macht aus der Geisterspalte **kein** Ziel", () => {
    // `undefined`, nicht `null` — dorthin zu ziehen sagt nichts, und die
    // beiden dürfen nicht gleich aussehen.
    expect(piOfColumn(3, pis)).toBeUndefined();
    expect(piOfColumn(99, pis)).toBeUndefined();
  });
});
