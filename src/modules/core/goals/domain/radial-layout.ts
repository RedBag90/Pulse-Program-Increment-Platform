/**
 * **Die Ziele als Rad** — wo jeder Knoten des Netzplans liegt.
 *
 * Die Strategie steht in der Mitte (0, 0), die Oberziele bilden den ersten
 * Ring, jede weitere Ebene den nächsten. Kinder teilen den Sektor ihres
 * Elternteils — so entstehen Fächer, und ein Ast bleibt beisammen.
 *
 * **Sektoren nach Blattzahl — oben mit Deckel.** Größere Teiläste bekommen
 * mehr Winkel, sonst würden sie unnötig eng. Ganz oben allein nach Blattzahl
 * verteilt, bekam aber ein großer Ast neben zwei eingeklappten 9/11 der Runde:
 * seine Kinder liefen einmal um die Mitte herum, und die Kanten kreuzten sie.
 * Deshalb bekommt kein Oberziel mehr als `MAX_AST_WINKEL` (120°, bei nur zwei
 * Oberzielen die Hälfte); was darüber liegt, geht an die übrigen
 * (`gedeckelteAnteile`). So bleibt jeder Ast ein Fächer auf seiner Seite.
 * Streng gleiche Stücke waren die erste Wahl, machten das Rad bei vielen
 * Oberzielen aber riesig: vier Kreise in 36° zwingen den Ring weit nach
 * außen.
 *
 * **Warum die Ringe mitwachsen.** Ein fester Abstand je Ebene legt bei vielen
 * Zielen die Kreise übereinander. Stattdessen rückt ein Ring so weit nach
 * außen, bis die zwei engsten Nachbarn darauf `KNOTEN_PLATZ` auseinander
 * liegen. Weil jeder Knoten mindestens den Sektor eines Blatts hat, geht das
 * immer auf.
 *
 * Rein, kein I/O. Generisch über `{ id, children }`, damit der Test ohne
 * vollständige `GoalNode`s auskommt.
 */

/**
 * Mindestabstand zweier Ringe (Flow-Pixel). Ein Knoten ist mit Name, Werten
 * und (umgebrochenen) Badges gut 150 px hoch — der nächste Ring muss darunter
 * Platz haben, sonst berührt das Schild den Kreis des Kinds.
 */
export const RING_ABSTAND = 210;
/**
 * Mindestabstand zweier Knotenmitten auf demselben Ring. Etwas mehr als die
 * Knotenbreite (190 px, Name und Badges werden darauf begrenzt): liegen zwei
 * Nachbarn unten oder oben im Rad nebeneinander, dürfen sich ihre Namen nicht
 * berühren.
 */
export const KNOTEN_PLATZ = 200;

interface TreeNode {
  id: string;
  children: readonly TreeNode[];
}

export interface RadialPlacement {
  id: string;
  /** Eltern-Id; `null` = Oberziel, hängt an der Mitte. */
  parentId: string | null;
  /** 1 = erster Ring (Oberziele). */
  depth: number;
  /** Winkel in Bogenmaß; 0 = rechts, −π/2 = oben. */
  angle: number;
  x: number;
  y: number;
  /** Index des Oberziels, zu dessen Ast der Knoten gehört (für die Astfarbe). */
  branch: number;
}

export interface RadialLayout {
  nodes: RadialPlacement[];
  /** Radius je Ebene; Index 0 = Ring 1. */
  ringRadii: number[];
}

/** Größter Winkel eines Oberziel-Asts (sofern die Zahl der Oberziele es zulässt). */
export const MAX_AST_WINKEL = (2 * Math.PI) / 3;

/**
 * Anteile proportional zu `gewichte`, keiner über `deckel` („Wasserstand"):
 * wer darüber läge, wird festgesetzt, der Rest neu unter den übrigen verteilt,
 * bis keiner mehr übersteht. Summe = `gesamt`.
 */
export function gedeckelteAnteile(gewichte: readonly number[], gesamt: number, deckel: number) {
  const anteile: (number | null)[] = gewichte.map(() => null);
  for (;;) {
    const offen = gewichte.map((_, i) => i).filter((i) => anteile[i] == null);
    const rest = gesamt - anteile.reduce<number>((s, a) => s + (a ?? 0), 0);
    const summe = offen.reduce((s, i) => s + gewichte[i]!, 0);
    const ueber = offen.filter((i) => (rest * gewichte[i]!) / summe > deckel + 1e-9);
    if (ueber.length === 0 || ueber.length === offen.length) {
      for (const i of offen) anteile[i] = (rest * gewichte[i]!) / summe;
      return anteile as number[];
    }
    for (const i of ueber) anteile[i] = deckel;
  }
}

/** Start oben, damit das erste Oberziel nicht rechts „auf drei Uhr" liegt. */
const START = -Math.PI / 2;

export function radialLayout(
  forest: readonly TreeNode[],
  collapsed: ReadonlySet<string> = new Set(),
): RadialLayout {
  const kinder = (n: TreeNode) => (collapsed.has(n.id) ? [] : n.children);
  const blaetter = new Map<string, number>();
  const zaehle = (n: TreeNode): number => {
    const k = kinder(n);
    const b = k.length === 0 ? 1 : k.reduce((s, c) => s + zaehle(c), 0);
    blaetter.set(n.id, b);
    return b;
  };
  const gesamt = forest.reduce((s, n) => s + zaehle(n), 0);
  if (gesamt === 0) return { nodes: [], ringRadii: [] };

  // 1. Winkel: nach Blattzahl (oben gedeckelt); Knoten
  //    jeweils in der Sektormitte.
  const winkel: Omit<RadialPlacement, "x" | "y">[] = [];
  const lege = (
    liste: readonly TreeNode[],
    von: number,
    breite: number,
    parentId: string | null,
    depth: number,
    branch: number | null,
  ) => {
    const gewichte = liste.map((n) => blaetter.get(n.id)!);
    const anteile =
      depth === 1
        ? gedeckelteAnteile(
            gewichte,
            breite,
            Math.max(MAX_AST_WINKEL, breite / Math.max(1, liste.length)),
          )
        : gewichte.map((g) => (breite * g) / gewichte.reduce((s, x) => s + x, 0));
    let a = von;
    liste.forEach((n, i) => {
      const anteil = anteile[i]!;
      const ast = branch ?? i;
      winkel.push({ id: n.id, parentId, depth, angle: a + anteil / 2, branch: ast });
      lege(kinder(n), a, anteil, n.id, depth + 1, ast);
      a += anteil;
    });
  };
  lege(forest, START, 2 * Math.PI, null, 1, null);

  // 2. Radien: je Ebene so weit außen, dass die engsten Nachbarn Platz haben.
  const tiefe = Math.max(...winkel.map((n) => n.depth));
  const ringRadii: number[] = [];
  for (let d = 1; d <= tiefe; d++) {
    const a = winkel
      .filter((n) => n.depth === d)
      .map((n) => n.angle)
      .sort((x, y) => x - y);
    let engste = Infinity;
    for (let i = 0; i < a.length; i++) {
      const naechster = i + 1 < a.length ? a[i + 1]! : a[0]! + 2 * Math.PI;
      if (a.length > 1) engste = Math.min(engste, naechster - a[i]!);
    }
    // Sehne, nicht Bogen: zwei Nachbarn im Winkel θ liegen 2r·sin(θ/2) auseinander.
    const noetig = Number.isFinite(engste)
      ? KNOTEN_PLATZ / (2 * Math.sin(Math.min(engste, Math.PI) / 2))
      : 0;
    const innen = d > 1 ? ringRadii[d - 2]! + RING_ABSTAND : RING_ABSTAND;
    ringRadii.push(Math.max(innen, noetig));
  }

  const nodes = winkel.map((n) => {
    const r = ringRadii[n.depth - 1]!;
    return { ...n, x: r * Math.cos(n.angle), y: r * Math.sin(n.angle) };
  });
  return { nodes, ringRadii };
}

/**
 * **Wer steht in der Mitte?** Gibt es genau ein Oberziel, entfällt die Mitte
 * „Strategie": das Ziel selbst rückt in die Mitte, seine Unterziele bilden die
 * Ringe. Ein Knoten „Strategie" über einem einzigen Ziel sagte nichts, was das
 * Ziel nicht schon sagt, und kostete einen ganzen Ring.
 *
 * `center = null` = mehrere (oder keine) Oberziele; die Ringe sind der Wald.
 */
export function radialRoot<T extends TreeNode>(
  forest: readonly T[],
  collapsed: ReadonlySet<string> = new Set(),
): { center: T | null; rings: readonly T[] } {
  if (forest.length !== 1) return { center: null, rings: forest };
  const center = forest[0]!;
  return {
    center,
    rings: collapsed.has(center.id) ? [] : (center.children as readonly T[]),
  };
}

/**
 * **Der Baum eines Ziels** für die Hervorhebung: alle Vorfahren bis zur Mitte,
 * das Ziel selbst und alle Nachfahren. Geschwister und fremde Äste gehören
 * nicht dazu.
 */
export function goalLineage(
  placements: readonly { id: string; parentId: string | null }[],
  id: string,
): Set<string> {
  const eltern = new Map(placements.map((p) => [p.id, p.parentId]));
  const kinder = new Map<string, string[]>();
  for (const p of placements) {
    if (p.parentId == null) continue;
    const liste = kinder.get(p.parentId) ?? [];
    liste.push(p.id);
    kinder.set(p.parentId, liste);
  }
  const linie = new Set<string>();
  if (!eltern.has(id)) return linie;
  for (let a: string | null | undefined = id; a != null; a = eltern.get(a)) linie.add(a);
  const offen = [...(kinder.get(id) ?? [])];
  while (offen.length) {
    const k = offen.pop()!;
    linie.add(k);
    offen.push(...(kinder.get(k) ?? []));
  }
  return linie;
}
