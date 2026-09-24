/**
 * **Die Struktur als Bild** — Wertstrom → ART → Solution, verschachtelt statt
 * flach, mit Summen je Ebene.
 *
 * Bis September 2026 gab es dafür zwei Flächen: links ein 288 px breiter
 * Baum, der die Hierarchie trug, und daneben — als **eigene Seite ohne den
 * Baum** — eine flache Tabelle über dieselben Solutions. Beide lasen denselben
 * `getStructureTree`. Der Baum konnte keine Summen bilden, die Tabelle keine
 * Zugehörigkeit zeigen, und keiner von beiden machte sichtbar, dass ein ART
 * **gar keine** Solution hat: im Baum sieht ein Knoten ohne Kinder aus wie ein
 * eingeklappter.
 *
 * Dieses Modell speist beide Darstellungen der einen Fläche — die Karte und
 * die gegliederte Tabelle. Rein, kein I/O.
 *
 * **Geld kommt von aussen** (ADR-0013). Grow ist `work`, Run ist `budgeting`;
 * Core darf beides nicht kennen. `buildStructureOverview` baut deshalb die
 * Struktur **ohne** Beträge, und `rollUpStructureMoney` legt sie nachträglich
 * auf — als schlichte Zuordnung `solutionId → Zahlen`, die kein Modul nennt.
 * Was der Mandant nicht gebucht hat, bleibt `null` statt 0 €.
 */

import type { StructureTree } from "@/modules/core/org/server/services/structure";
import { horizonLabel, isHorizon, type Horizon } from "@/modules/core/org/domain/horizon";
import { nestSolutionsByArt } from "@/modules/core/org/domain/structure-nesting";
import {
  isInvestmentMode,
  solutionStatusOf,
  SOLUTION_STATUSES,
  type SolutionStatus,
} from "@/modules/core/org/domain/solution";

/** Die drei Zahlen, die an einer Solution hängen — und je Ebene aufsummiert werden. */
export interface StructureMoney {
  /** Σ Umsetzungskosten der freigegebenen Primär-Epics (`work`). */
  grow: number;
  /** Σ Jahres-Äquivalent der zugerechneten Betriebspositionen (`budgeting`). */
  run: number;
  /** Alle Primär-Epics, auch die unreifen (`work`). */
  epicCount: number;
}

export interface OverviewSolution {
  id: string;
  name: string;
  /** `null` bei einem Wert, den das Modell nicht kennt — dann steht er roh da. */
  horizon: Horizon | null;
  /** Der Rohwert aus der Datenbank, für den Fall, dass `horizon` `null` ist. */
  rawHorizon: string;
  /** Emerging / Investing / Extracting / Decommissioning — die Gruppierungsachse. */
  status: SolutionStatus | null;
  /** „H1 · Extracting" — dieselbe Regel wie das Horizont-Abzeichen. */
  statusLabelKey: string;
  money: StructureMoney | null;
}

export interface OverviewArt {
  id: string;
  name: string;
  piCount: number;
  /** „12 PIs" — oder „Keine Kadenz", wenn das ART an keinem Takt hängt. */
  cadenceLabel: string;
  gaps: string[];
  solutions: OverviewSolution[];
  money: StructureMoney | null;
}

export interface OverviewValueStream {
  id: string;
  name: string;
  gaps: string[];
  arts: OverviewArt[];
  /**
   * Solutions, deren ART hier nicht zu sehen ist — sie hängen direkt am
   * Wertstrom. Der Fall entsteht durch ein **weich gelöschtes** ART: seine
   * Solutions zeigten sonst auf einen Knoten, den niemand rendert, und wären
   * aus der Fläche verschwunden. Der Wertstrom ist ohnehin ihre Heimat
   * (ADR-0022), das ART nur ein Verweis.
   */
  looseSolutions: OverviewSolution[];
  money: StructureMoney | null;
}

export interface StructureOverview {
  valueStreams: OverviewValueStream[];
  counts: { valueStreams: number; arts: number; solutions: number };
}

/**
 * Wie viele PIs plant dieses ART — und was steht da, wenn keines?
 *
 * Die Zahl kommt aus der **Kadenz**, der das ART folgt; `art.pis` ist der
 * Alt-Verweis von vor der Timeline-Umstellung und im Bestand durchweg leer
 * (gemessen: 0 von 17 ARTs). Wer nur ihn las, schrieb an jedes ART „0 PIs".
 *
 * Ohne Kadenz steht kein „0 PIs" da: das ART plant nicht gegen null
 * Increments, es hängt an keinem Takt. Das ist eine Lücke in der Struktur und
 * liest sich auch so.
 */
function artCadence(art: {
  _count: { pis: number };
  timeline: { _count: { programIncrements: number } } | null;
}): { count: number; label: string } {
  const count = art.timeline?._count.programIncrements ?? art._count.pis;
  if (art.timeline == null && art._count.pis === 0) return { count: 0, label: "Keine Kadenz" };
  return { count, label: `${count} PI${count === 1 ? "" : "s"}` };
}

function toSolution(sol: {
  id: string;
  name: string;
  horizon: string;
  investmentMode: string | null;
}): OverviewSolution {
  const horizon = isHorizon(sol.horizon) ? sol.horizon : null;
  const mode = isInvestmentMode(sol.investmentMode) ? sol.investmentMode : null;
  return {
    id: sol.id,
    name: sol.name,
    horizon,
    rawHorizon: sol.horizon,
    status: horizon ? solutionStatusOf(horizon, mode) : null,
    // Ein unbekannter Horizont steht roh da statt still auf H1 zu fallen — eine
    // falsche Auskunft wäre schlimmer als eine unschöne.
    statusLabelKey: horizon ? horizonLabel(horizon, mode) : sol.horizon,
    money: null,
  };
}

export function buildStructureOverview(tree: StructureTree): StructureOverview {
  let arts = 0;
  let solutions = 0;

  const valueStreams = tree.map((vs) => {
    const gaps: string[] = [];
    if (!vs.vmoId) gaps.push("Kein:e Portfolio Manager");
    if (!vs.financeApproverId) gaps.push("Kein:e Finance-Approver:in");

    // Die Zuordnung „Solution unter ihren ART, sonst an den Wertstrom" steht
    // in der Domäne — die Rollenverteilung braucht dieselbe (ADR-0022).
    const nested = nestSolutionsByArt(vs);
    solutions += vs.solutions.length;
    const byArt = new Map<string, OverviewSolution[]>(
      [...nested.byArt].map(([artId, sols]) => [artId, sols.map(toSolution)]),
    );
    const loose = nested.loose.map(toSolution);

    const artRows = vs.arts.map((art) => {
      arts += 1;
      const cadence = artCadence(art);
      const artGaps: string[] = [];
      if (!art.rteId) artGaps.push("Kein:e RTE");
      return {
        id: art.id,
        name: art.name,
        piCount: cadence.count,
        cadenceLabel: cadence.label,
        gaps: artGaps,
        solutions: byArt.get(art.id) ?? [],
        money: null,
      } satisfies OverviewArt;
    });

    return {
      id: vs.id,
      name: vs.name,
      gaps,
      arts: artRows,
      looseSolutions: loose,
      money: null,
    } satisfies OverviewValueStream;
  });

  return {
    valueStreams,
    counts: { valueStreams: valueStreams.length, arts, solutions },
  };
}

/** Σ über eine Menge von Knoten; `null`, wenn keiner einen Betrag trägt. */
function sum(parts: readonly (StructureMoney | null)[]): StructureMoney | null {
  const known = parts.filter((p): p is StructureMoney => p != null);
  if (known.length === 0) return null;
  return known.reduce(
    (a, b) => ({
      grow: a.grow + b.grow,
      run: a.run + b.run,
      epicCount: a.epicCount + b.epicCount,
    }),
    { grow: 0, run: 0, epicCount: 0 },
  );
}

/**
 * Legt Grow, Run und Epics je Solution auf und summiert sie **je ART und je
 * Wertstrom** auf.
 *
 * `bySolution` trägt keinen Modul-Bezug — die Route komponiert, was der Mandant
 * gebucht hat. Fehlt eine Solution in der Zuordnung, bleibt ihr `money` `null`:
 * das heisst „nicht gemessen", nicht „null Euro".
 */
export function rollUpStructureMoney(
  overview: StructureOverview,
  bySolution: Readonly<Record<string, StructureMoney>>,
): StructureOverview {
  const withMoney = (s: OverviewSolution): OverviewSolution => ({
    ...s,
    money: bySolution[s.id] ?? null,
  });

  const valueStreams = overview.valueStreams.map((vs) => {
    const arts = vs.arts.map((art) => {
      const solutions = art.solutions.map(withMoney);
      return { ...art, solutions, money: sum(solutions.map((s) => s.money)) };
    });
    const looseSolutions = vs.looseSolutions.map(withMoney);
    return {
      ...vs,
      arts,
      looseSolutions,
      money: sum([...arts.map((a) => a.money), ...looseSolutions.map((s) => s.money)]),
    };
  });

  return { ...overview, valueStreams };
}

/** Eine Solution samt ihrem Ort — die Zeile der Gruppierung „nach Horizont". */
export interface FlatSolution {
  solution: OverviewSolution;
  valueStreamName: string;
  /** `null`, wenn die Solution direkt am Wertstrom hängt. */
  artName: string | null;
}

/** Alle Solutions über alle Wertströme, in Baum-Reihenfolge. */
export function flattenSolutions(overview: StructureOverview): FlatSolution[] {
  const out: FlatSolution[] = [];
  for (const vs of overview.valueStreams) {
    for (const art of vs.arts) {
      for (const s of art.solutions)
        out.push({ solution: s, valueStreamName: vs.name, artName: art.name });
    }
    for (const s of vs.looseSolutions)
      out.push({ solution: s, valueStreamName: vs.name, artName: null });
  }
  return out;
}

export interface SolutionStatusGroup {
  status: SolutionStatus | null;
  /** Katalog-Schlüssel — der Server-View beschriftet nicht (ADR-0024). */
  labelKey: string;
  rows: FlatSolution[];
}

/**
 * Nach dem **Stand** gruppiert, nicht nach dem Horizont: *Investing* und
 * *Extracting* tragen beide `h1`, sind wirtschaftlich aber zwei verschiedene
 * Lagen — „wir bauen aus" gegen „wir ernten". Die frühere flache Liste sortierte
 * nach `horizon` und warf die beiden deshalb zusammen.
 *
 * Reihenfolge ist die der Lebenszyklus-Leiter (`SOLUTION_STATUSES`); leere
 * Gruppen entfallen. Solutions mit unbekanntem Horizont stehen am Ende.
 */
export function groupByStatus(rows: readonly FlatSolution[]): SolutionStatusGroup[] {
  const groups: SolutionStatusGroup[] = SOLUTION_STATUSES.map((status) => ({
    status,
    labelKey: statusLabelOf(rows, status),
    rows: rows.filter((r) => r.solution.status === status),
  })).filter((g) => g.rows.length > 0);

  const rest = rows.filter((r) => r.solution.status == null);
  if (rest.length > 0) groups.push({ status: null, labelKey: "org.horizon.none", rows: rest });
  return groups;
}

/**
 * Die Überschrift einer Gruppe kommt aus den Zeilen selbst (`statusLabelKey`),
 * nicht aus einer zweiten Etikettenliste, die neben `horizonLabel` veralten
 * könnte. Der Rückfall greift nur für eine Gruppe ohne Zeilen — und die wird
 * ohnehin weggefiltert.
 */
function statusLabelOf(rows: readonly FlatSolution[], status: SolutionStatus): string {
  return rows.find((r) => r.solution.status === status)?.solution.statusLabelKey ?? status;
}

/**
 * Sucht über alle drei Ebenen.
 *
 * **Ein Treffer bringt seinen Ort mit.** Passt ein Wertstrom, bleibt er
 * vollständig — man sucht ihn, um ihn zu sehen, nicht um ihn leer zu finden.
 * Passt ein ART, bleiben seine Solutions; passt nur eine Solution, bleibt ihr
 * ART als Überschrift stehen, aber ohne die Geschwister. Ein Wertstrom ohne
 * verbliebenen Inhalt fällt ganz heraus.
 *
 * Die Summen werden **nicht** neu gerechnet: sie beschreiben den Knoten, nicht
 * die Auswahl. Eine Suche, die den Wert eines Wertstroms schrumpfen liesse,
 * wäre eine Rechnung, die niemand angefordert hat.
 */
export function filterStructureOverview(
  overview: StructureOverview,
  query: string,
): StructureOverview {
  const q = query.trim().toLowerCase();
  if (q === "") return overview;
  const hit = (name: string) => name.toLowerCase().includes(q);

  const valueStreams = overview.valueStreams.flatMap((vs) => {
    if (hit(vs.name)) return [vs];
    const arts = vs.arts.flatMap((art) => {
      if (hit(art.name)) return [art];
      const solutions = art.solutions.filter((s) => hit(s.name));
      return solutions.length > 0 ? [{ ...art, solutions }] : [];
    });
    const looseSolutions = vs.looseSolutions.filter((s) => hit(s.name));
    if (arts.length === 0 && looseSolutions.length === 0) return [];
    return [{ ...vs, arts, looseSolutions }];
  });

  return { ...overview, valueStreams, counts: countOf(valueStreams) };
}

function countOf(valueStreams: readonly OverviewValueStream[]): StructureOverview["counts"] {
  return {
    valueStreams: valueStreams.length,
    arts: valueStreams.reduce((n, vs) => n + vs.arts.length, 0),
    solutions: valueStreams.reduce(
      (n, vs) => n + vs.looseSolutions.length + vs.arts.reduce((m, a) => m + a.solutions.length, 0),
      0,
    ),
  };
}
