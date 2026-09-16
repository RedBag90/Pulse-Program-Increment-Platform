import {
  HORIZONS,
  STATIONS,
  horizonOfStation,
  stationsOf,
  type Horizon,
  type Station,
} from "@/modules/work/domain/portfolio-guardrails";
import type { InvestmentMode } from "@/modules/core/org/domain/solution";

/**
 * Der **Horizont-Trichter**: welches Produkt steht in welchem Horizont, und wie
 * viel Geld bindet es dort.
 *
 * Zwei Aussagen, beide gemessen — und **nur** diese zwei:
 *
 *  - **Senkrecht steht das Geld.** Die Öffnung eines Horizonts ist streng
 *    proportional zur Summe genau der Symbole, die er trägt.
 *  - **Die Größe eines Symbols ist das Geld, das es bindet.** Fläche ∝ Geld,
 *    also Kantenlänge ∝ √Geld.
 *
 * **Waagerecht steht nichts.** Die Breite eines Bandes ist streng proportional
 * zur *Zahl* seiner Symbole und sagt über Geld nichts aus. Das ist keine
 * Nebensache: die naheliegende Regel „Breite = Platzbedarf" verletzt es
 * unbemerkt — ein reiches Band hat eine hohe Öffnung, stapelt seine Symbole in
 * *weniger* Spalten und würde dadurch **schmaler**. Die Breite kodierte dann das
 * Geld, nur invers.
 *
 * Rein, kein I/O, kein DOM — deshalb sind „nichts überlappt", „nichts liegt
 * außerhalb der Kurven" und „die Breite misst kein Geld" Tests und keine
 * Sichtprüfungen.
 *
 * Die Beschriftungsbreite wird **geschätzt** (Zeichenzahl × Faktor), nicht
 * gemessen: eine reine Funktion kann kein `getBBox()`. Die Schätzung ist eine
 * Obergrenze — sie nimmt Kästen zu breit an, nie zu schmal.
 */

/** Ein Produkt oder ein produktloses Epic, so weit die Zeichnung es kennt. */
export interface FunnelItem {
  id: string;
  /**
   * `"run"` = Betrieb, der keiner Solution zugerechnet ist. Weder Produkt noch
   * Epic — er fällt im Zyklus an und gehört in den Streifen, nicht in ein Band.
   */
  kind: "solution" | "epic" | "run";
  /** Voller Kurzname (z. B. „CE · Core"). Wird für die Zeichnung gekürzt. */
  code: string;
  /** Vollständiger Name fürs Tooltip und die Zielseite. */
  name: string;
  /** `null` = kein Horizont: das Symbol landet im Streifen darunter. */
  horizon: Horizon | null;
  /** Nur bei Solutions in H1 gesetzt — trennt H1.1 von H1.2. */
  mode: InvestmentMode | null;
  /** Investition: die Allokation des **laufenden Budget-Zyklus**. */
  invest: number;
  /** Betrieb: der Ask **einer** Halbjahres-Kachel. Bei Epics immer 0. */
  run: number;
  /**
   * Epics im Lieferfenster (L3.2–L4.2). Beim Produkt die Zahl seiner
   * Primär-Epics, beim produktlosen Epic `1`.
   *
   * Trägt die Zeichnung, wenn es **kein Geld gibt** (Budget-Modul aus): dann
   * misst die Größe eines Produkts, wie viel gerade an ihm gearbeitet wird.
   */
  count: number;
}

export interface PlacedItem extends FunnelItem {
  total: number;
  /** Der tatsächlich gezeichnete, ggf. gekürzte Code. */
  label: string;
  /** Halbe Kantenlänge des Würfels bzw. Bezugsmaß des Punktradius. */
  size: number;
  cx: number;
  cy: number;
  /** Der Kasten inklusive Beschriftung — die Größe, gegen die gepackt wurde. */
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Die Soll-Verteilung des Portfolio-Budgets über die **Stationen**, in Prozent
 * — die Guardrail „Investment by Horizon".
 *
 * Sie gilt für das gesamte Budget, Betriebskosten eingeschlossen; damit misst
 * sie dieselbe Größe wie die Öffnung des Trichters, und die beiden Linien sind
 * vergleichbar. Seit H1 in Investing und Extracting zerfällt, trägt jede
 * Station ihr eigenes Ziel.
 */
export type HorizonTargets = Record<Station, number>;

/** Eine Station innerhalb eines Bandes — H1 hat zwei, alle anderen eine. */
export interface FunnelStation {
  station: Station;
  x0: number;
  x1: number;
  money: number;
  half: number;
  minimal: boolean;
  enlarged: boolean;
}

export interface FunnelBand {
  horizon: Horizon;
  /**
   * Die Stationen dieses Bandes, jede mit **eigener** Öffnung. H1 führt zwei,
   * seit Investing und Extracting eigene Ziele tragen; die Silhouette wechselt
   * an ihrer Grenze die Höhe — gerundet, weil zwischen den beiden Plateaus
   * `stationGap` liegt.
   *
   * `x0`/`x1` sind deshalb die **Plateaugrenzen**, nicht die Slot-Grenzen: die
   * Lücke gehört keiner der beiden Stationen.
   */
  stations: FunnelStation[];
  /** Das **Plateau**: hier ist die Öffnung exakt `half`, und hier liegen Symbole. */
  x0: number;
  x1: number;
  money: number;
  /** Halbe Öffnung. */
  half: number;
  /** `true` = kein Geld; die Öffnung ist die Mindestgröße, nicht gemessen. */
  minimal: boolean;
  /**
   * `true` = die Öffnung musste über das Geld hinaus vergrößert werden, damit
   * das höchste Symbol hineinpasst. Wird an der Fläche benannt, damit die
   * Proportionalität nicht **still** bricht.
   */
  enlarged: boolean;
}

export interface FunnelLayout {
  bands: FunnelBand[];
  items: PlacedItem[];
  /** Symbole ohne Horizont — sie liegen im Streifen unter dem Trichter. */
  homeless: PlacedItem[];
  /**
   * Was sich nicht platzieren liess. **Muss leer sein**; das Feld existiert,
   * damit ein Verlust sichtbar wird statt still zu passieren.
   */
  dropped: FunnelItem[];
  /** Kontrollpunkte der Silhouette: `[x, halbeÖffnung]`, monoton in x. */
  profile: [number, number][];
  /**
   * Dieselben Kontrollpunkte für die **Soll-Verteilung** (Guardrail).
   * `null`, wenn keine Ziele übergeben wurden oder im Zyklus kein Geld liegt —
   * dann gibt es nichts zu vergleichen.
   */
  targetProfile: [number, number][] | null;
  /** Die natürliche Breite der Zeichnung; sie wird per `viewBox` gestaucht. */
  width: number;
  /**
   * Die **tatsächlich genutzte** halbe Öffnung — `g.maxHalf`, solange das Geld
   * allein entscheidet, mehr, sobald ein Band seinen Inhalt fassen muss.
   *
   * Die Fläche rechnete ihre Höhe früher aus `G.maxHalf` aus, also aus einer
   * Konstanten. Das ging, solange die Öffnung nie darüber hinauswuchs; seit ein
   * gedrängtes Band sie aufweitet, muss die Zeichnung ihre eigene Ausdehnung
   * berichten, statt sie sich abschätzen zu lassen.
   */
  maxHalf: number;
  /** Die Mittellinie — wandert nach unten, wenn die Öffnung über `g.mid` wächst. */
  mid: number;
  /**
   * Die Trennung **H1.1 | H1.2** — die Grenze zwischen den beiden Stationen,
   * samt dem Geld beider Hälften. `null`, solange H1 gar nichts trägt.
   *
   * Sie wird hier berichtet statt aus den Symbolen zurückgerechnet: die alte
   * Ableitung („zwischen der letzten Investing- und der ersten
   * Extracting-Kachel") verschwand, sobald eine der beiden Gruppen leer war —
   * und genau dann ist sie am aussagekräftigsten.
   */
  h1: { splitX: number; investing: number; extracting: number } | null;
  /** Die Zeichenzahl, auf die die Beschriftungen gekürzt wurden. */
  maxCodeLength: number;
  /** Kollidierende Kastenpaare. **Leer, sonst ist die Zeichnung falsch.** */
  collisions: string[];
}

export interface FunnelGeometry {
  /** Die Mittellinie des Trichters. */
  mid: number;
  /** Halbe Öffnung des reichsten Horizonts. */
  maxHalf: number;
  /** Mindest-Halböffnung eines Horizonts ohne Geld. */
  minHalf: number;
  /** Halbe Kantenlänge des teuersten Würfels. */
  maxSize: number;
  /** Symbolgröße ohne gebundenes Geld. */
  emptySize: number;
  /**
   * Die feste Kantenlänge eines Epic-Punkts im Zählmodus. Etwas größer als
   * `emptySize`, damit ein laufendes Epic nicht wie ein leeres Produkt aussieht.
   */
  epicDotSize: number;
  padding: number;
  gap: number;
  /** Höhe der zweizeiligen Beschriftung unter jedem Symbol. */
  labelHeight: number;
  /**
   * Geschätzte Zeichenbreite der Code-Zeile — **fett, in `LABEL_PX`**.
   *
   * Rund 0,58 em; bei 12 px also 7,0. Sie ist bewusst eine Obergrenze: die
   * Schätzung nimmt Kästen eher zu breit an als zu schmal und irrt damit auf
   * der Seite, auf der nichts kollidiert.
   */
  charWidth: number;
  /**
   * Luft über der weitesten Öffnung — dort stehen Bandname und Betrag.
   *
   * Im Entwurf ergab sie sich aus `mid − maxHalf` und war deshalb unsichtbar.
   * Seit die Öffnung wachsen kann, muss sie ausgeschrieben sein: sonst schiebt
   * sich die Kurve unter die Überschriften.
   */
  headroom: number;
  /** Breite eines Bandes ohne Symbole. */
  stubWidth: number;
  /**
   * Die Breite, auf die sich die Bänder verteilen.
   *
   * Sie ist eine **Eingabe**, seit die Bänder gleich breit sind: die Zeichnung
   * bekommt ihre Breite vorgegeben und regelt Gedränge senkrecht. Vorher fiel
   * die Breite aus dem Inhalt heraus — und trug damit die Symbolzahl.
   */
  targetWidth: number;
  /**
   * Die Lücke zwischen zwei Plateaus, in der die Kurve wandert. Sie gehört
   * **keinem** Band: so ist die Öffnung über jedem Symbol exakt die seines
   * Horizonts, und die Kurve bewegt sich genau dort, wo das Tor steht.
   */
  transition: number;
  /**
   * Dieselbe Lücke **innerhalb** eines Bandes, zwischen zwei Stationen — halb
   * so breit. Die Trennung H1.1 | H1.2 ist ein Übergang im selben Horizont und
   * soll als kleinerer Einschnitt lesen als ein Tor zwischen zwei Horizonten.
   *
   * Ohne sie stoßen die beiden Plateaus direkt aneinander; `halfAt` findet
   * dann zwei Kontrollpunkte mit demselben `x` und springt — die Silhouette
   * und die gestrichelte Ziel-Linie machten dort einen rechten Winkel statt
   * einer Rundung.
   */
  stationGap: number;
}

export const DEFAULT_GEOMETRY: FunnelGeometry = {
  mid: 236,
  maxHalf: 150,
  minHalf: 40,
  maxSize: 34,
  emptySize: 10,
  epicDotSize: 13,
  padding: 14,
  gap: 12,
  labelHeight: 26,
  charWidth: 7.0,
  headroom: 86,
  stubWidth: 64,
  targetWidth: 1100,
  transition: 48,
  stationGap: 24,
};

/** Die Kürzungsstufen, von der ausführlichsten zur knappsten. */
export const CODE_STEPS = [18, 12, 8] as const;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Halbe Öffnung an der Stelle `x`, interpoliert zwischen den Kontrollpunkten. */
export function halfAt(profile: readonly [number, number][], x: number): number {
  if (profile.length === 0) return 0;
  if (x <= profile[0]![0]) return profile[0]![1];
  for (let i = 0; i < profile.length - 1; i++) {
    const [xa, ha] = profile[i]!;
    const [xb, hb] = profile[i + 1]!;
    if (x <= xb) return xb === xa ? hb : ha + (hb - ha) * smoothstep((x - xa) / (xb - xa));
  }
  return profile[profile.length - 1]![1];
}

/**
 * Kürzt einen Code auf `max` Zeichen, mit Auslassungszeichen und **ohne
 * hängende Satzzeichen** — sonst entstehen Beschriftungen wie
 * `P · Ausschuss-/Scrap-Reduktion —`.
 */
export function clipCode(code: string, max: number): string {
  if (code.length <= max) return code;
  const cut = code.slice(0, Math.max(1, max - 1)).replace(/[\s\p{P}]+$/u, "");
  return `${cut}…`;
}

/**
 * **Was die Zeichnung misst.**
 *
 * `"money"` ist die Vorgabe und das gewachsene Verhalten: Fläche und Öffnung
 * folgen dem gebundenen Geld. `"count"` greift, wenn das Budget-Modul aus ist
 * — dann gibt es kein Geld, und ohne einen zweiten Maßstab zerfiele die Karte
 * zu lauter gleich großen leeren Umrissen.
 */
export type FunnelSizing = "money" | "count";

export interface FunnelOptions {
  sizing?: FunnelSizing;
}

const totalOf = (i: FunnelItem) => i.invest + i.run;

/**
 * Das Gewicht eines Symbols für **Öffnung und Reihenfolge**.
 *
 * Im Zählmodus wiegt ein Produkt so viel wie seine Epics und ein produktloses
 * Epic eins — die Öffnung misst dann „wie viele Vorhaben liegen in diesem
 * Horizont". Das ist etwas anderes als die **Größe** des Symbols: ein Epic
 * bleibt ein Punkt fester Größe, wiegt für die Öffnung aber mit.
 */
const weightOf = (i: FunnelItem, sizing: FunnelSizing): number =>
  sizing === "count" ? i.count : totalOf(i);

/**
 * Die Fünferleiter kommt aus der Domäne
 * (`work/domain/portfolio-guardrails.ts`) — sie ist keine Eigenschaft der
 * Zeichnung, seit die Guardrail eigene Ziele je Station trägt. Hier nur
 * weitergereicht, damit die vorhandenen Aufrufer nichts merken.
 */
export { STATIONS, stationsOf, type Station };

/**
 * Die Ernte ist eine Eigenschaft des **Produkts**. Ein Epic trägt keinen
 * `investmentMode` und zählt deshalb zu H1.1: Geld, das einem Epic zugeteilt
 * ist, ist eine Investition.
 */
const isExtracting = (i: FunnelItem) => i.mode === "extracting";

/** Die Reihenfolge in einer Station: nach Gewicht absteigend, dann stabil nach Id. */
function orderWithin(items: FunnelItem[], sizing: FunnelSizing): FunnelItem[] {
  return [...items].sort(
    (a, b) => weightOf(b, sizing) - weightOf(a, sizing) || a.id.localeCompare(b.id),
  );
}

interface Boxed {
  item: FunnelItem;
  label: string;
  size: number;
  w: number;
  h: number;
}

function boxOf(
  item: FunnelItem,
  maxTotal: number,
  maxCode: number,
  g: FunnelGeometry,
  sizing: FunnelSizing,
): Boxed {
  // Ohne Geld misst ein **Produkt** seine laufenden Epics. Ein **Epic** misst
  // gar nichts mehr: es ist ein Punkt fester Größe. „Ein Epic" ist keine
  // Menge, die sich mit einer anderen vergleichen ließe — jeder Versuch, es
  // doch zu skalieren, behauptete einen Unterschied, den es nicht gibt.
  if (sizing === "count" && item.kind === "epic") {
    return boxed(item, g.epicDotSize, maxCode, g);
  }
  const total = sizing === "count" ? item.count : totalOf(item);
  // Fläche ∝ Menge ⇒ Kantenlänge ∝ √Menge.
  const size =
    total <= 0
      ? g.emptySize
      : g.emptySize + (g.maxSize - g.emptySize) * Math.sqrt(total / maxTotal);
  return boxed(item, size, maxCode, g);
}

function boxed(item: FunnelItem, size: number, maxCode: number, g: FunnelGeometry): Boxed {
  const label = clipCode(item.code, maxCode);
  return {
    item,
    label,
    size,
    w: Math.max(2 * size, label.length * g.charWidth + 8),
    h: 2 * size + g.labelHeight,
  };
}

/**
 * Verteilt die Kästen auf so viele Spalten, wie die **Bandbreite** hergibt.
 *
 * Vorher lief es andersherum: eine Spalte wurde gefüllt, bis die Öffnung voll
 * war, dann rückte x weiter — die Spaltenzahl folgte dem Geld, die Bandbreite
 * der Spaltenzahl. Damit trug die waagerechte Achse die Symbolzahl, und ein
 * Band mit vielen kleinen Posten fraß die Zeichnung: gemessen 16 Symbole in H3
 * auf 73 % der Breite, während H1 mit dem **meisten** Geld 14 % bekam.
 *
 * Die Spaltenbreite ist die der breitesten Kiste — konservativ, dafür kann
 * nichts über den Bandrand hinausragen. Die Kästen werden **der Reihe nach** in
 * gleich große Blöcke geschnitten, nicht nach Höhe umsortiert: nur so bleibt in
 * H1 alles Investing links von allem Extracting, worauf sich `h1SplitX` stützt.
 */
function columnsInWidth(boxes: Boxed[], width: number, g: FunnelGeometry): Boxed[][] {
  if (boxes.length === 0) return [];
  const colW = Math.max(...boxes.map((b) => b.w));
  const usable = width - 2 * g.padding;
  const fit = Math.max(1, Math.floor((usable + g.gap) / (colW + g.gap)));
  const k = Math.min(fit, boxes.length);
  const perColumn = Math.ceil(boxes.length / k);
  const columns: Boxed[][] = [];
  for (let i = 0; i < boxes.length; i += perColumn) columns.push(boxes.slice(i, i + perColumn));
  return columns;
}

/** Höhe der höchsten Spalte — sie bestimmt, was die Öffnung fassen muss. */
function tallestColumn(columns: Boxed[][], g: FunnelGeometry): number {
  let tallest = 0;
  for (const column of columns) {
    const used = column.reduce((sum, b) => sum + b.h + g.gap, 0) - g.gap;
    tallest = Math.max(tallest, used);
  }
  return tallest;
}

/**
 * Der Aufbau bei **einer** Kürzungsstufe. Ohne Maßstabssuche: die Breite folgt
 * dem Inhalt, also gibt es immer eine weitere Spalte, und die Packung kann
 * nicht scheitern.
 */
export function layoutFunnel(
  items: readonly FunnelItem[],
  geometry: FunnelGeometry = DEFAULT_GEOMETRY,
  maxCodeLength: number = CODE_STEPS[0],
  horizonTargets: HorizonTargets | null = null,
  options: FunnelOptions = {},
): FunnelLayout {
  const g = geometry;
  const sizing: FunnelSizing = options.sizing ?? "money";
  const homelessItems = items.filter((i) => i.horizon == null);
  const placedItems = items.filter((i) => i.horizon != null);

  // 1 · Das Geld je Band bestimmt die Öffnung.
  // **Je Station, nicht je Horizont.** Solange nur der Horizont ein Ziel hatte,
  // war eine Öffnung über beide H1-Hälften richtig — die Trennung war eine
  // Unterteilung, kein Tor. Seit die Guardrail eigene Ziele für H1.1 und H1.2
  // trägt, ist ihr Geld eine eigene Größe: eine Ziel-Linie, die springt,
  // während die Ist-Kurve flach durchläuft, misst an dieser Stelle nichts.
  const stationOfItem = (i: FunnelItem): Station =>
    i.horizon === "h1" ? (isExtracting(i) ? "h1.2" : "h1.1") : (i.horizon as Station);
  // Das Gewicht je Station: im Geld-Modus die Summe der Beträge, im Zählmodus
  // die Summe der laufenden Epics. Die Variable heisst weiter `money`, weil
  // sie an einem Dutzend Stellen so gelesen wird — der Modus steht daneben.
  const money = Object.fromEntries(STATIONS.map((st) => [st, 0])) as Record<Station, number>;
  for (const i of placedItems) money[stationOfItem(i)] += weightOf(i, sizing);
  const richest = Math.max(...Object.values(money), 1);
  const bandMoney = (h: Horizon) => stationsOf(h).reduce((sum, st) => sum + money[st], 0);
  const maxTotal = Math.max(...items.map((i) => weightOf(i, sizing)), 1);

  // 2 · Die Kästen je **Station**. Die Öffnung folgt erst, wenn feststeht, wie
  //     die Kästen liegen — sie muss ihren eigenen Inhalt fassen.
  const boxesByStation = new Map<Station, Boxed[]>();
  for (const h of HORIZONS) {
    const inBand = placedItems.filter((i) => i.horizon === h);
    for (const st of stationsOf(h)) {
      const own = h === "h1" ? inBand.filter((i) => isExtracting(i) === (st === "h1.2")) : inBand;
      boxesByStation.set(
        st,
        orderWithin(own, sizing).map((i) => boxOf(i, maxTotal, maxCodeLength, g, sizing)),
      );
    }
  }
  const filled = (h: Horizon) =>
    stationsOf(h).some((st) => (boxesByStation.get(st) ?? []).length > 0);

  // 3 · **Gleich breite Stationen.** Die waagerechte Achse ist eine
  //     Lebenszyklus-Achse und trägt keine Aussage — weder Geld noch Anzahl.
  //     H1 belegt zwei Stationen und ist deshalb doppelt so breit; ein leeres
  //     Band bekommt einen Stummel und bleibt aus der Teilung heraus, damit ein
  //     leerer Horizont nicht die Größe des Bildes bestimmt.
  const occupied = HORIZONS.filter(filled);
  const stubs = HORIZONS.length - occupied.length;
  const transitions = g.transition * (HORIZONS.length - 1);
  const free = g.targetWidth - 2 * g.padding - transitions - stubs * g.stubWidth;
  const slotCount = occupied.reduce((n, h) => n + stationsOf(h).length, 0);
  const unit = slotCount > 0 ? Math.max(g.stubWidth, free / slotCount) : g.stubWidth;

  // 4 · Spalten aus der Stationsbreite, Öffnungen aus dem Geld — **gemeinsam**
  //     skaliert.
  //
  //     Muss ein Band mehr fassen, als seine Öffnung hergibt, werden **alle**
  //     Öffnungen mit demselben Faktor geweitet, statt nur die des gedrängten
  //     Bandes. Der Unterschied ist die ganze Aussage der Zeichnung: klammerte
  //     man je Band, bekäme H3 mit 16 kleinen Posten eine weitere Öffnung als
  //     H1 mit dem meisten Geld — die Verzerrung wäre nur von der Breite in die
  //     Höhe gewandert. Ein gemeinsamer Faktor lässt die **Verhältnisse** exakt
  //     die des Geldes bleiben; der absolute Maßstab war ohnehin nie eine
  //     Aussage, er ist auf das reichste Band normiert.
  //
  //     **Gepackt wird auf das Plateau, nicht auf den Slot.** Ein Band mit zwei
  //     Stationen gibt in der Mitte `stationGap` an die Rampe ab; wer weiter
  //     gegen `unit` packt, schiebt Symbole in genau diese Rampe — und die
  //     Zusicherung „nichts liegt außerhalb der Kurven" gälte dort nicht mehr.
  const plateauWidth = (st: Station) =>
    stationsOf(horizonOfStation(st)).length > 1 ? unit - g.stationGap / 2 : unit;
  const columnsByStation = new Map<Station, Boxed[][]>();
  const proportional = {} as Record<Station, number>;
  const needed = {} as Record<Station, number>;
  let openFactor = 1;
  for (const st of STATIONS) {
    const columns = columnsInWidth(boxesByStation.get(st) ?? [], plateauWidth(st), g);
    columnsByStation.set(st, columns);
    proportional[st] =
      money[st] <= 0 ? g.minHalf : Math.max(g.minHalf, (money[st] / richest) * g.maxHalf);
    needed[st] = columns.length > 0 ? tallestColumn(columns, g) / 2 + g.padding : 0;
    // **Nur Stationen mit Geld treiben den Faktor.** Die Mindestöffnung einer
    // leeren Station ist keine Aussage über Geld, sondern ein Platzhalter —
    // gemessen riss ein leeres H3 mit drei Umrissen die Öffnung von H1 von 150
    // auf 248, weil sein Inhalt gegen den Bodensatz von 40 gerechnet wurde.
    if (money[st] > 0) openFactor = Math.max(openFactor, needed[st] / proportional[st]);
  }
  const halfOf = (st: Station) => {
    const minimal = money[st] <= 0;
    return {
      // Eine Station ohne Geld fasst ihren Inhalt für sich; sie verzerrt damit
      // nichts, weil ihre Öffnung ohnehin als Mindestöffnung ausgewiesen ist.
      half: minimal ? Math.max(g.minHalf * openFactor, needed[st]) : proportional[st] * openFactor,
      minimal,
      // Gekennzeichnet wird die Station, deren Inhalt die Weitung **verursacht**
      // hat — sie ist dicht belegt. Die übrigen ziehen mit, ohne dass ihr
      // Verhältnis zueinander sich ändert.
      enlarged: !minimal && needed[st] > proportional[st] + 1e-6,
    };
  };

  // 5 · Die Mittellinie weicht aus, wenn die weiteste Öffnung über sie
  //     hinauswächst — sonst liefe der obere Rand ins Negative.
  //
  //     **Die Ziel-Linie zählt mit.** Gemessen liegt in Large Test Corp das
  //     H1-Ziel bei einer halben Öffnung von 401 px, das Ist bei 249 — wer nur
  //     das Ist misst, schneidet die Vergleichslinie oben ab, und zwar genau
  //     dann, wenn der Abstand am größten und die Aussage am wichtigsten ist.
  const totalMoney = STATIONS.reduce((sum, st) => sum + money[st], 0);
  const targetHalfOf = (st: Station): number =>
    horizonTargets == null || totalMoney <= 0
      ? 0
      : (((horizonTargets[st] ?? 0) / 100) * totalMoney * g.maxHalf * openFactor) / richest;
  const maxHalf = Math.max(...STATIONS.map((st) => Math.max(halfOf(st).half, targetHalfOf(st))));
  const mid = Math.max(g.mid, maxHalf + g.headroom);

  // 6 · Bänder nebeneinander, dazwischen die Übergangslücke. Jedes Band führt
  //     seine Stationen samt eigener Öffnung — H1 hat zwei.
  const bands: FunnelBand[] = [];
  let x = g.padding;
  for (const [index, h] of HORIZONS.entries()) {
    const segs = filled(h) ? stationsOf(h) : [stationsOf(h)[0]!];
    const w = filled(h) ? segs.length * unit : g.stubWidth;
    const segWidth = w / segs.length;
    // Der Slot bleibt `segWidth` breit; das **Plateau** rückt an jeder inneren
    // Kante um eine halbe Lücke zurück. Die Bandbreite ändert sich dadurch
    // nicht — nur die Kurve bekommt Weg, auf dem sie steigen kann.
    const inset = segs.length > 1 ? g.stationGap / 2 : 0;
    const stations = segs.map((st, zone) => ({
      station: st,
      x0: x + zone * segWidth + (zone > 0 ? inset : 0),
      x1: x + (zone + 1) * segWidth - (zone < segs.length - 1 ? inset : 0),
      money: money[st],
      ...halfOf(st),
    }));
    bands.push({
      horizon: h,
      x0: x,
      x1: x + w,
      money: bandMoney(h),
      stations,
      // Für die Bandbeschriftung: die weiteste seiner Stationen, und „dicht
      // belegt", sobald **eine** von ihnen die Weitung verursacht hat.
      half: Math.max(...stations.map((z) => z.half)),
      minimal: stations.every((z) => z.minimal),
      enlarged: stations.some((z) => z.enlarged),
    });
    x += w + (index < HORIZONS.length - 1 ? g.transition : 0);
  }
  const width = x + g.padding;

  // 7 · Die Silhouette: über jeder Station konstant, bewegt nur in den Lücken —
  //     zwischen zwei Horizonten in `transition`, zwischen H1.1 und H1.2 in
  //     `stationGap`. Beide Male smoothstept `halfAt` zwischen den Plateaus;
  //     die Rundung ist damit kein Sonderfall, sondern dieselbe Regel.
  const profile: [number, number][] = [];
  for (const b of bands) {
    for (const z of b.stations) {
      profile.push([z.x0, z.half]);
      profile.push([z.x1, z.half]);
    }
  }

  // 7b · Dieselbe Silhouette für die **Soll-Verteilung**: wo die Kurve verliefe,
  //      wenn das Geld der Guardrail folgte.
  //
  //      Sie entsteht hier und nicht in der Fläche, weil hier die einzige
  //      Stelle ist, die Geld in eine Öffnung übersetzt. Zwei Linien, die
  //      dieselbe Skala meinen, dürfen sie nicht zweimal definieren.
  //
  //      **Ohne die Mindestöffnung.** Der Bodensatz `minHalf` ist ein
  //      Platzhalter für „kein Geld"; auf ein Ziel angewandt höbe er ein
  //      kleines Ziel künstlich an und behauptete eine Vorgabe, die es nicht
  //      gibt.
  const targetProfile: [number, number][] | null =
    horizonTargets == null || totalMoney <= 0
      ? null
      : bands.flatMap((b) =>
          b.stations.flatMap(
            (z) =>
              [
                [z.x0, targetHalfOf(z.station)],
                [z.x1, targetHalfOf(z.station)],
              ] as [number, number][],
          ),
        );

  // 8 · Platzieren: je Station ein Spaltenblock, waagerecht in seiner Station
  //     zentriert, jede Spalte senkrecht auf der Mittellinie.
  const placed: PlacedItem[] = [];
  for (const band of bands) {
    band.stations.forEach((zone) => {
      const columns = columnsByStation.get(zone.station) ?? [];
      if (columns.length === 0) return;
      const widths = columns.map((c) => Math.max(...c.map((b) => b.w)));
      const block = widths.reduce((s, w) => s + w + g.gap, 0) - g.gap;
      // Zentriert im **Plateau** der Station, nicht in einem aus `unit`
      // nachgerechneten Bereich: die beiden sind seit der Lücke nicht mehr
      // dasselbe.
      let cx = zone.x0 + (zone.x1 - zone.x0 - block) / 2;
      columns.forEach((column, ci) => {
        const colWidth = widths[ci]!;
        const used = column.reduce((s, b) => s + b.h + g.gap, 0) - g.gap;
        let y = mid - used / 2;
        for (const b of column) {
          placed.push({
            ...b.item,
            total: totalOf(b.item),
            label: b.label,
            size: b.size,
            cx: cx + colWidth / 2,
            cy: y + b.size,
            box: { x: cx + colWidth / 2 - b.w / 2, y, w: b.w, h: b.h },
          });
          y += b.h + g.gap;
        }
        cx += colWidth + g.gap;
      });
    });
  }

  // 8b · Die Trennung H1.1 | H1.2 — die Stationsgrenze, samt dem Geld beider
  //      Hälften. Sie steht, sobald H1 überhaupt belegt ist; eine leere Hälfte
  //      ist die Auskunft, nicht der Grund, die Linie wegzulassen.
  const stationMoney = (st: Station) =>
    (boxesByStation.get(st) ?? []).reduce((sum, b) => sum + totalOf(b.item), 0);
  const h1Band = bands.find((b) => b.horizon === "h1")!;
  // `x0 + unit` ist die **Mitte der Lücke**: beide Plateaus rücken um eine
  // halbe `stationGap` von ihr ab. Die Trennlinie steht damit weiterhin genau
  // zwischen den Hälften — jetzt dort, wo die Kurve am steilsten läuft.
  const h1 = filled("h1")
    ? {
        splitX: h1Band.x0 + unit,
        investing: stationMoney("h1.1"),
        extracting: stationMoney("h1.2"),
      }
    : null;

  // 9 · Der Streifen darunter: was keinen Horizont hat, lässt sich nicht
  //     platzieren — und das ist die Aussage, nicht die Lücke.
  const homeless: PlacedItem[] = [];
  let hx = g.padding;
  for (const item of [...homelessItems].sort(
    (a, b) => weightOf(b, sizing) - weightOf(a, sizing) || a.id.localeCompare(b.id),
  )) {
    const b = boxOf(item, maxTotal, maxCodeLength, g, sizing);
    homeless.push({
      ...item,
      total: totalOf(item),
      label: b.label,
      size: b.size,
      cx: hx + b.size,
      cy: 0,
      box: { x: hx, y: 0, w: b.w + g.gap * 4, h: 2 * b.size },
    });
    hx += b.w + g.gap * 4;
  }

  // 10 · Die Buchhaltung: nichts darf still verschwinden.
  const seen = new Set([...placed, ...homeless].map((i) => i.id));
  const dropped = items.filter((i) => !seen.has(i.id));

  return {
    bands,
    items: placed,
    homeless,
    dropped,
    profile,
    targetProfile,
    width,
    maxHalf,
    mid,
    h1,
    maxCodeLength,
    collisions: findCollisions(placed),
  };
}

/**
 * Die gestufte Kürzung: die **ausführlichste** Beschriftung nehmen, die noch
 * lesbar bleibt.
 *
 * Das Kriterium ist bewusst **nicht** „passt ohne Stauchung". Eine zu harte
 * Kürzung kostet die Aussage: bei acht Zeichen wurden aus „V&O · Pilot" und
 * „V&O · Programm" beide `V&O · P…` — zwei Produkte, ein Etikett.
 *
 * **Womit die Kürzung handelt, hat sich geändert.** Solange die Bandbreite dem
 * Inhalt folgte, machte eine lange Beschriftung das Bild *breiter*, und die
 * Stufe wurde gegen den Zoom abgewogen. Seit die Bänder gleich breit sind,
 * macht sie es *höher*: eine breitere Kiste passt seltener neben ihre
 * Nachbarin, das Band braucht mehr Zeilen, und die Öffnung muss sie fassen.
 * Gewogen wird deshalb gegen `g.maxHalf` — die Höhe, für die die Zeichnung
 * entworfen ist.
 *
 * Reicht keine Stufe, gilt die knappste; das Bild wird dann höher und sagt das
 * an den betroffenen Bändern („Öffnung vergrößert"). Die Breite bleibt in jedem
 * Fall die vorgegebene.
 */
export function fitFunnel(
  items: readonly FunnelItem[],
  targetWidth: number,
  geometry: FunnelGeometry = DEFAULT_GEOMETRY,
  minZoom = 0.8,
  horizonTargets: HorizonTargets | null = null,
  options: FunnelOptions = {},
): FunnelLayout {
  const g = { ...geometry, targetWidth };
  let last = layoutFunnel(items, g, CODE_STEPS[CODE_STEPS.length - 1]!, horizonTargets, options);
  // `CODE_STEPS` ist absteigend: die erste brauchbare Stufe ist die längste.
  for (const max of CODE_STEPS) {
    const layout = layoutFunnel(items, g, max, horizonTargets, options);
    if (layout.maxHalf <= g.maxHalf && targetWidth / layout.width >= minZoom) return layout;
    last = layout;
  }
  return last;
}

/** Die Zusicherung: kein Kastenpaar überschneidet sich. */
export function findCollisions(items: readonly PlacedItem[]): string[] {
  const bad: string[] = [];
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const p = items[a]!.box;
      const q = items[b]!.box;
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) {
        bad.push(`${items[a]!.label} ↔ ${items[b]!.label}`);
      }
    }
  }
  return bad;
}
