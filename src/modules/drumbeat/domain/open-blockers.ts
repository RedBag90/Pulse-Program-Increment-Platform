/**
 * **Welche Abhängigkeiten blockieren dieses Feature gerade — und welche nicht?**
 *
 * Kandidaten sind zwei Kantenarten in zwei Richtungen — dieselbe Definition,
 * die die Prüfung beim PI-Wechsel benutzt (`work/server/services/feature.ts`):
 *
 *  - eine **eingehende `blocks`**-Kante: „Y blockiert X" — der Blocker ist
 *    `from`;
 *  - eine **ausgehende `depends_on`**-Kante: „X hängt ab von Y" — der Blocker
 *    ist `to`.
 *
 * Ob ein Kandidat **tatsächlich** blockiert, entscheidet zweierlei:
 *
 *  - `done` — er ist abgeschlossen oder abgebrochen; ein erledigter Vorgänger
 *    hält nichts mehr auf;
 *  - `samePi` — er ist offen, liegt aber im **selben PI**: dann wird er im
 *    selben Zeitraum geliefert und kann gemeinsam geplant werden, statt das
 *    Feature aufzuhalten;
 *  - sonst `blocking` — auch ein Vorgänger im Backlog oder in einem anderen PI.
 *
 * Die Karte zählt nur `blocking`; sind Kandidaten da, aber keiner blockiert,
 * zeigt sie das ausdrücklich als erfüllt.
 */

export type BlockerState = "blocking" | "samePi" | "done";

export interface BlockerRef {
  id: string;
  title: string;
  state: BlockerState;
}

interface BlockerCandidate {
  id: string;
  title: string;
  status: string;
  piId: string | null;
}

const ERLEDIGT = new Set(["completed", "cancelled"]);
const RANG: Record<BlockerState, number> = { blocking: 0, samePi: 1, done: 2 };

export function classifyBlockers(input: {
  /** PI des Features selbst; `null` = Backlog. */
  piId: string | null;
  /** `from` der eingehenden `blocks`-Kanten. */
  blocksIn: ReadonlyArray<BlockerCandidate | null>;
  /** `to` der ausgehenden `depends_on`-Kanten. */
  dependsOnOut: ReadonlyArray<BlockerCandidate | null>;
}): BlockerRef[] {
  const seen = new Map<string, BlockerRef>();
  for (const b of [...input.blocksIn, ...input.dependsOnOut]) {
    if (b == null || seen.has(b.id)) continue;
    const state: BlockerState = ERLEDIGT.has(b.status)
      ? "done"
      : input.piId != null && b.piId === input.piId
        ? "samePi"
        : "blocking";
    seen.set(b.id, { id: b.id, title: b.title, state });
  }
  return [...seen.values()].sort(
    (a, b) =>
      RANG[a.state] - RANG[b.state] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

/** Die tatsächlich blockierenden — was die Karte zählt. */
export const blockingOnly = (blockers: readonly BlockerRef[]): BlockerRef[] =>
  blockers.filter((b) => b.state === "blocking");
