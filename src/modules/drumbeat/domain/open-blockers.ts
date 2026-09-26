/**
 * **Wer blockiert dieses Feature gerade?**
 *
 * Zwei Kantenarten, zwei Richtungen — dieselbe Definition, die die Prüfung
 * beim PI-Wechsel benutzt (`work/server/services/feature.ts`):
 *
 *  - eine **eingehende `blocks`**-Kante: „Y blockiert X" — der Blocker ist
 *    `from`;
 *  - eine **ausgehende `depends_on`**-Kante: „X hängt ab von Y" — der Blocker
 *    ist `to`.
 *
 * Bis September 2026 zählte die Karte im Cockpit nur die erste Art und nannte
 * nur den ersten Blocker; wer auf etwas wartete, das mit „hängt ab von"
 * verknüpft war, stand dort als frei.
 *
 * **Offen** heisst: nicht abgeschlossen und nicht abgebrochen. Ein erledigter
 * Vorgänger blockiert nichts mehr.
 */

export interface BlockerRef {
  id: string;
  title: string;
}

interface BlockerCandidate extends BlockerRef {
  status: string;
}

const ERLEDIGT = new Set(["completed", "cancelled"]);

export function openBlockers(input: {
  /** `from` der eingehenden `blocks`-Kanten. */
  blocksIn: ReadonlyArray<BlockerCandidate | null>;
  /** `to` der ausgehenden `depends_on`-Kanten. */
  dependsOnOut: ReadonlyArray<BlockerCandidate | null>;
}): BlockerRef[] {
  const seen = new Map<string, BlockerRef>();
  for (const b of [...input.blocksIn, ...input.dependsOnOut]) {
    if (b == null || ERLEDIGT.has(b.status) || seen.has(b.id)) continue;
    seen.set(b.id, { id: b.id, title: b.title });
  }
  return [...seen.values()].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}
