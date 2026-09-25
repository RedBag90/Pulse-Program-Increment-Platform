/**
 * **Leitungsbrücken: wo zwei Kanten sich kreuzen, hüpft eine über die andere.**
 *
 * Dass Kanten sich kreuzen, lässt sich in einem Abhängigkeitsgraphen nicht
 * vermeiden. Dass man es **sieht**, schon: ohne Indikator ist eine Kreuzung von
 * einer Verzweigung nicht zu unterscheiden, und genau das war die Beschwerde.
 *
 * **Diese Datei baut ReactFlows Linienführung nicht nach.** Das wäre die
 * naheliegende Falle — ein eigener Algorithmus sähe morgen anders aus als das,
 * was tatsächlich gemalt wird, und die Bögen sässen daneben. Stattdessen wird
 * das `d` zerlegt, das `getSmoothStepPath` ohnehin liefert: `M`, `L` und `Q`,
 * mehr ist darin nicht. Der Linienzug ist damit **dieselbe** Geometrie, die
 * gezeichnet wird, und kann nicht auseinanderdriften.
 *
 * Rein: keine Bibliothek, kein React, kein DOM.
 */

export interface Point {
  x: number;
  y: number;
}

/** Wie weit ein Bogen zur Seite ausgreift. */
export const HOP_RADIUS = 5;

/**
 * Das `d` einer Smoothstep-Kante als Linienzug.
 *
 * Die gerundeten Ecken (`Q`) werden über ihren **Kontrollpunkt** genommen: das
 * ist die Ecke, die die Rundung abschneidet, und für die Frage „schneiden sich
 * zwei Linien" der richtige Punkt. Ein Fehler von wenigen Pixeln am Bogenrand
 * ist hier bedeutungslos — die Kreuzungen liegen auf den geraden Stücken.
 *
 * Unbekannte Befehle brechen die Zerlegung ab und liefern `[]`; der Aufrufer
 * zeichnet dann die unveränderte Linie. Lieber keine Brücke als eine falsche.
 */
export function polylineOf(d: string): Point[] {
  // Erst prüfen, **dann** zerlegen: ein `C` oder `A` im Pfad hiesse, dass die
  // Linienführung anders ist als angenommen, und ein Linienzug daraus wäre
  // geraten. Ohne diese Zeile schluckte die Zerlegung den unbekannten Befehl
  // stillschweigend und lieferte einen halben Pfad.
  if (/[^MLQ\d\s,.\-]/.test(d)) return [];
  const punkte: Point[] = [];
  const token = d.match(/[MLQ][^MLQ]*/g);
  if (token == null) return [];

  for (const t of token) {
    const befehl = t[0];
    const zahlen = (t.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (befehl === "M" || befehl === "L") {
      if (zahlen.length < 2) return [];
      punkte.push({ x: zahlen[0]!, y: zahlen[1]! });
    } else {
      // Q cx cy x y — der Kontrollpunkt ist die Ecke, der Endpunkt die
      // Fortsetzung dahinter.
      if (zahlen.length < 4) return [];
      punkte.push({ x: zahlen[0]!, y: zahlen[1]! });
      punkte.push({ x: zahlen[2]!, y: zahlen[3]! });
    }
  }
  return punkte;
}

const EPS = 0.5;

/** Schnittpunkt zweier Strecken — `null`, wenn sie sich nicht echt kreuzen. */
function segmentCrossing(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  const nenner = ax * by - ay * bx;
  // Parallel oder deckungsgleich: keine Kreuzung. Deckungsgleiche Kanten sind
  // ein anderes Problem, und das löst die Anschluss-Verteilung.
  if (Math.abs(nenner) < 1e-6) return null;

  const t = ((b1.x - a1.x) * by - (b1.y - a1.y) * bx) / nenner;
  const u = ((b1.x - a1.x) * ay - (b1.y - a1.y) * ax) / nenner;
  // Echt auf beiden Strecken. **Nicht** strenger: eine Kreuzung darf genau auf
  // einer Ecke des anderen Linienzugs liegen — Smoothstep-Pfade bestehen aus
  // lauter Ecken, und ein zu strenger Rand liesse jede zweite Kreuzung
  // unmarkiert. Was an den **Enden** liegt, filtert `crossings`.
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: a1.x + t * ax, y: a1.y + t * ay };
}

/**
 * Wie nah an einem Anschluss eine Kreuzung nicht mehr als solche zählt.
 *
 * Zwei Kanten, die an demselben Knoten andocken, treffen sich dort — das ist
 * eine gemeinsame Quelle, keine Kreuzung, und ein Bogen darüber wäre falsch.
 */
const ENDE_ABSTAND = 8;

const nahAmEnde = (p: Point, linie: readonly Point[]): boolean => {
  const erster = linie[0];
  const letzter = linie[linie.length - 1];
  return (
    (erster != null && Math.hypot(p.x - erster.x, p.y - erster.y) < ENDE_ABSTAND) ||
    (letzter != null && Math.hypot(p.x - letzter.x, p.y - letzter.y) < ENDE_ABSTAND)
  );
};

/** Alle echten Kreuzungen zweier Linienzüge. */
export function crossings(a: readonly Point[], b: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const p = segmentCrossing(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!);
      if (p == null) continue;
      if (nahAmEnde(p, a) || nahAmEnde(p, b)) continue;
      if (!out.some((q) => Math.abs(q.x - p.x) < EPS && Math.abs(q.y - p.y) < EPS)) out.push(p);
    }
  }
  return out;
}

/** Läuft die Strecke, auf der `p` liegt, eher waagerecht? */
function istWaagerecht(punkte: readonly Point[], p: Point): boolean {
  for (let i = 0; i + 1 < punkte.length; i++) {
    const a = punkte[i]!;
    const b = punkte[i + 1]!;
    const minX = Math.min(a.x, b.x) - EPS;
    const maxX = Math.max(a.x, b.x) + EPS;
    const minY = Math.min(a.y, b.y) - EPS;
    const maxY = Math.max(a.y, b.y) + EPS;
    if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
      return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    }
  }
  return true;
}

/**
 * **Wer hüpft?** Die waagerechte Kante über die senkrechte — die
 * Schaltplan-Konvention, und im `LR`-Layout die häufigere Führung, also sitzen
 * die Bögen dort, wo das Auge ohnehin entlangliest.
 *
 * Laufen beide gleich, ist es keine Kreuzung, sondern eine Überlagerung; die
 * verhindert die Anschluss-Verteilung. Für den Rest entscheidet die Id, damit
 * dasselbe Bild immer gleich aussieht.
 */
export function hopsFor(
  eigeneId: string,
  eigene: readonly Point[],
  andere: ReadonlyArray<{ id: string; points: readonly Point[] }>,
): Point[] {
  const out: Point[] = [];
  for (const other of andere) {
    if (other.id === eigeneId) continue;
    for (const p of crossings(eigene, other.points)) {
      const ichWaagerecht = istWaagerecht(eigene, p);
      const andererWaagerecht = istWaagerecht(other.points, p);
      const ichHuepfe = ichWaagerecht !== andererWaagerecht ? ichWaagerecht : eigeneId < other.id;
      if (ichHuepfe) out.push(p);
    }
  }
  return out;
}

/**
 * Setzt an den übergebenen Punkten Bögen in das `d` ein.
 *
 * Alles ausserhalb der Bögen bleibt **unverändert** — der Pfad ist derselbe,
 * er bekommt nur Brücken. Punkte, die auf keiner Strecke liegen, werden
 * übergangen.
 */
export function withHops(d: string, punkte: readonly Point[], radius = HOP_RADIUS): string {
  if (punkte.length === 0) return d;
  const linie = polylineOf(d);
  if (linie.length < 2) return d;

  const teile: string[] = [`M ${linie[0]!.x},${linie[0]!.y}`];
  for (let i = 0; i + 1 < linie.length; i++) {
    const a = linie[i]!;
    const b = linie[i + 1]!;
    const laenge = Math.hypot(b.x - a.x, b.y - a.y);
    if (laenge < 1e-6) continue;
    const ex = (b.x - a.x) / laenge;
    const ey = (b.y - a.y) / laenge;

    // Nur die Punkte dieser Strecke, in Laufrichtung sortiert.
    const auf = punkte
      .map((p) => ({ p, t: (p.x - a.x) * ex + (p.y - a.y) * ey }))
      .filter(({ p, t }) => {
        if (t <= radius || t >= laenge - radius) return false;
        const abstand = Math.abs((p.x - a.x) * -ey + (p.y - a.y) * ex);
        return abstand < EPS;
      })
      .sort((x, y) => x.t - y.t);

    for (const { t } of auf) {
      const vor = { x: a.x + (t - radius) * ex, y: a.y + (t - radius) * ey };
      const nach = { x: a.x + (t + radius) * ex, y: a.y + (t + radius) * ey };
      teile.push(`L ${vor.x},${vor.y}`);
      // `sweep-flag` 1: der Bogen greift immer zur selben Seite aus, damit
      // mehrere Brücken auf einer Linie gleich aussehen.
      teile.push(`A ${radius},${radius} 0 0 1 ${nach.x},${nach.y}`);
    }
    teile.push(`L ${b.x},${b.y}`);
  }
  return teile.join(" ");
}
