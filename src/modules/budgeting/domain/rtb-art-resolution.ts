/**
 * **Wem gehört das Betriebsgeld?**
 *
 * Eine Betriebsposition hängt im Schema an drei möglichen Stellen: an einem ART
 * (`artId`), an einer Solution (`solutionId`) oder nur am Wertstrom. Das Modell
 * kann alle drei — **kein Code nutzte das**: gemessen tragen alle aktiven
 * `run`-Positionen `artId = null`, und die Auflösung über die Solution existierte
 * im Schema, nicht in der Software. Auf der Fläche war das Betriebsgeld damit
 * die grösste Summe, die niemandem gehörte.
 *
 * **Nachtrag 2026-09-19 zu Weg 1:** dass keine `run`-Position einen ART trug,
 * lag nicht an der Gewohnheit, sondern am Formular — es bot das Feld nur an
 * ART-Rahmen an. Seit es bei jeder Art steht, ist Weg 1 erreichbar, und die
 * Wertstrom-Prüfung im Service gilt für beide Arten.
 *
 * Die Festlegung (2026-09-18): **alle drei Wege enden am ART.**
 *
 * 1. Steht ein ART an der Position, gilt er.
 * 2. Sonst die Solution — sie gehört zu einem ART.
 * 3. Sonst ist es Wertstrom-Geld und wird **gleichmässig** auf die ARTs des
 *    Stroms geschlüsselt.
 *
 * **Der Schlüssel ist grob, und das steht hier so.** Gleichmässig verteilen ist
 * keine Aussage über Verursachung; es ist die Aussage „genauer wissen wir es
 * nicht". Ein Schlüssel je Position von Hand bleibt das Ziel und bekommt seine
 * eigene Tabelle, wenn es klemmt — grob verteilt ist besser als gar nicht, aber
 * nur, solange niemand die Zahl für eine Messung hält.
 *
 * Rein, kein I/O.
 */

/** Eine Betriebsposition, auf das Halbjahr gerechnet. */
export interface ResolvableRtbPosition {
  id: string;
  /** `null` = keine Zuordnung an der Position selbst. */
  artId: string | null;
  /** `null` = nicht an eine Solution gebunden. */
  solutionId: string | null;
  /** Betrag dieses Halbjahres (`rtbCycleAmount`). */
  amount: number;
}

/** Warum eine Position keinem ART zugeordnet werden konnte. */
export type RtbUnresolvedReason =
  /** Die Position hängt an einer Solution, die kein ART hat. */
  | "solutionWithoutArt"
  /** Wertstrom-Geld, aber der Strom hat kein ART, auf das man schlüsseln könnte. */
  | "noArtsInStream";

/**
 * Derselbe Betrag, aufgeteilt nach dem **Weg**, auf dem er am ART gelandet ist.
 *
 * Für die Summe ist der Weg gleichgültig; für den Business Case ist er die
 * Aussage. „77.500 € Betrieb" beantwortet nichts — „77.500 € über Solutions
 * dieses ARTs, 24.500 € geschlüsselt" sagt, wie belastbar die Zahl ist: das
 * eine ist zugeordnet, das andere ein grober Schlüssel (siehe oben).
 */
export interface RtbByPath {
  /** Weg 1 — der ART steht an der Position. */
  direct: number;
  /** Weg 2 — über die Solution, die zu diesem ART gehört. */
  viaSolution: number;
  /** Weg 3 — Wertstrom-Geld, gleichmässig geschlüsselt. Eine Schätzung. */
  keyed: number;
}

export interface RtbArtResolution {
  /**
   * artId → Betrag dieses Halbjahres, je Weg. Enthält **jeden** gefragten ART,
   * auch mit lauter Nullen.
   */
  byPath: Record<string, RtbByPath>;
  /**
   * artId → Σ der drei Wege. Abgeleitet, nicht zweitgezählt — `byArt` und
   * `byPath` können nicht auseinanderlaufen.
   */
  byArt: Record<string, number>;
  /** Was nicht ankam — mit Grund, damit die Fläche es benennen kann statt es zu verschlucken. */
  unresolved: { id: string; amount: number; reason: RtbUnresolvedReason }[];
}

/** Σ der drei Wege einer ART-Zeile. */
export function pathTotal(p: RtbByPath): number {
  return p.direct + p.viaSolution + p.keyed;
}

/**
 * Löst Betriebspositionen auf die ARTs eines Wertstroms auf.
 *
 * `artOfSolution` bildet `solutionId → artId | null` ab; eine unbekannte
 * Solution zählt wie eine ohne ART.
 *
 * **Eine Solution ohne ART wird nicht geschlüsselt.** Das wäre die bequeme
 * Lösung und die falsche Aussage: diese Position ist nicht Wertstrom-Geld,
 * sondern Solution-Geld mit einer Lücke in den Stammdaten. Sie gleichmässig zu
 * verteilen würde die Lücke unsichtbar machen — und genau sie ist der Grund,
 * warum `solutions.art_id` zur Pflicht wird.
 */
export function resolveRtbToArts(
  positions: readonly ResolvableRtbPosition[],
  artOfSolution: Readonly<Record<string, string | null>>,
  artIdsOfStream: readonly string[],
): RtbArtResolution {
  const known = new Set(artIdsOfStream);
  const byPath: Record<string, RtbByPath> = Object.fromEntries(
    artIdsOfStream.map((id) => [id, { direct: 0, viaSolution: 0, keyed: 0 }]),
  );
  const add = (artId: string, weg: keyof RtbByPath, amount: number) => {
    const row = (byPath[artId] ??= { direct: 0, viaSolution: 0, keyed: 0 });
    row[weg] += amount;
  };
  const unresolved: RtbArtResolution["unresolved"] = [];

  for (const p of positions) {
    // (1) Der ART an der Position. Ein ART, den dieser Strom nicht kennt, zählt
    // nicht als Zuordnung — sonst tauchte fremdes Geld in einer Summe auf, die
    // „dieser Wertstrom" heisst.
    if (p.artId != null && known.has(p.artId)) {
      add(p.artId, "direct", p.amount);
      continue;
    }

    // (2) Über die Solution.
    if (p.solutionId != null) {
      const viaSolution = artOfSolution[p.solutionId] ?? null;
      if (viaSolution != null && known.has(viaSolution)) {
        add(viaSolution, "viaSolution", p.amount);
      } else {
        unresolved.push({ id: p.id, amount: p.amount, reason: "solutionWithoutArt" });
      }
      continue;
    }

    // (3) Wertstrom-Geld — gleichmässig geschlüsselt.
    if (artIdsOfStream.length === 0) {
      unresolved.push({ id: p.id, amount: p.amount, reason: "noArtsInStream" });
      continue;
    }
    const share = p.amount / artIdsOfStream.length;
    for (const artId of artIdsOfStream) add(artId, "keyed", share);
  }

  return {
    byPath,
    byArt: Object.fromEntries(Object.entries(byPath).map(([id, p]) => [id, pathTotal(p)])),
    unresolved,
  };
}

/** Σ des aufgelösten Betriebsgeldes — die Gegenprobe zur Summe der Eingaben. */
export function resolvedTotal(r: RtbArtResolution): number {
  return Object.values(r.byArt).reduce((s, n) => s + n, 0);
}

/**
 * **Auf welcher Ebene ist eine Position eingetragen?**
 *
 * Die Fläche „Einrichten" gliedert danach, statt die Ebene in jeder Zeile zu
 * wiederholen: was allen gehört, was einem ART gehört, was einer Solution
 * gehört.
 *
 * **Die Gruppe folgt der Eingabe, nicht der Auflösung.** Trägt eine Position
 * beides — einen ART **und** eine Solution —, steht sie bei der Solution: wer
 * sie dort einträgt, sucht sie dort. `resolveRtbToArts` nimmt in diesem Fall
 * den **direkten** ART (Weg 1 schlägt Weg 2), Gliederung und Rechnung können
 * also auseinanderlaufen. Gemessen tun sie es nicht — bei allen vier
 * betroffenen Positionen ist der direkte ART derselbe wie der ART der Solution.
 * Weicht er ab, muss die Zeile das sagen; dafür gibt es `zaehltBeiAnderemArt`.
 */
export type RtbAssignmentGroup = "stream" | "art" | "solution";

/**
 * **Ein Wort je Ebene, an einem Ort.** Die drei Namen standen in der
 * Einrichten-Fläche und bei den Vorlagen — mit der Aufteil-Fläche wären es drei
 * Kopien geworden, und die erste, die jemand ändert, hätte die anderen zu
 * Lügen gemacht. Sie stehen hier, wo die Einteilung selbst wohnt.
 */
export const RTB_ASSIGNMENT_GROUP_KEYS: Record<RtbAssignmentGroup, string> = {
  stream: "budgeting.rtbAssignmentGroup.stream",
  art: "budgeting.rtbAssignmentGroup.art",
  solution: "budgeting.rtbAssignmentGroup.solution",
};

/** Von der breitesten Zurechnung zur engsten — die Lesereihenfolge der Flächen. */
export const RTB_ASSIGNMENT_GROUPS = ["stream", "art", "solution"] as const;

export function rtbAssignmentGroup(item: {
  artId?: string | null | undefined;
  solutionId?: string | null | undefined;
}): RtbAssignmentGroup {
  if (item.solutionId != null) return "solution";
  if (item.artId != null) return "art";
  return "stream";
}

/**
 * Steht die Position unter einer Solution, zählt ihr Geld aber bei einem
 * **anderen** ART? Dann ist die Überschrift, unter der sie steht, nicht die
 * ganze Wahrheit — und die Zeile nennt den ART, der wirklich zählt.
 *
 * `null`, solange beides übereinstimmt oder gar kein direkter ART gesetzt ist.
 */
export function zaehltBeiAnderemArt(
  item: { artId?: string | null | undefined; solutionId?: string | null | undefined },
  artOfSolution: Readonly<Record<string, string | null>>,
): string | null {
  if (item.solutionId == null || item.artId == null) return null;
  const viaSolution = artOfSolution[item.solutionId] ?? null;
  return viaSolution === item.artId ? null : item.artId;
}
