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

export interface RtbArtResolution {
  /** artId → Betrag dieses Halbjahres. Enthält **jeden** gefragten ART, auch mit 0. */
  byArt: Record<string, number>;
  /** Was nicht ankam — mit Grund, damit die Fläche es benennen kann statt es zu verschlucken. */
  unresolved: { id: string; amount: number; reason: RtbUnresolvedReason }[];
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
  const byArt: Record<string, number> = Object.fromEntries(artIdsOfStream.map((id) => [id, 0]));
  const unresolved: RtbArtResolution["unresolved"] = [];

  for (const p of positions) {
    // (1) Der ART an der Position. Ein ART, den dieser Strom nicht kennt, zählt
    // nicht als Zuordnung — sonst tauchte fremdes Geld in einer Summe auf, die
    // „dieser Wertstrom" heisst.
    if (p.artId != null && known.has(p.artId)) {
      byArt[p.artId] = (byArt[p.artId] ?? 0) + p.amount;
      continue;
    }

    // (2) Über die Solution.
    if (p.solutionId != null) {
      const viaSolution = artOfSolution[p.solutionId] ?? null;
      if (viaSolution != null && known.has(viaSolution)) {
        byArt[viaSolution] = (byArt[viaSolution] ?? 0) + p.amount;
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
    for (const artId of artIdsOfStream) byArt[artId] = (byArt[artId] ?? 0) + share;
  }

  return { byArt, unresolved };
}

/** Σ des aufgelösten Betriebsgeldes — die Gegenprobe zur Summe der Eingaben. */
export function resolvedTotal(r: RtbArtResolution): number {
  return Object.values(r.byArt).reduce((s, n) => s + n, 0);
}
