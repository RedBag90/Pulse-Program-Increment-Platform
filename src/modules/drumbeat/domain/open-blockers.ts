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
 *  - `earlierPi` — er ist offen, liegt aber in einem **früheren PI**: er ist
 *    eingeplant, bevor das Feature dran ist. Bis September 2026 zählte das als
 *    blockierend — „Feature 5" in PI 2 zeigte „⚠ 2", weil seine Vorgänger in
 *    PI 1 lagen;
 *  - sonst `blocking` — ein Vorgänger im **Backlog** (nicht eingeplant) oder
 *    in einem **späteren** PI. Liegt das Feature selbst im Backlog, blockiert
 *    jeder offene Vorgänger: es ist noch nicht eingeplant.
 *
 * Verglichen wird der Start der PIs, nicht ihre Reihenfolge in einer
 * Taktung: ein Vorgänger kann auf der Taktung eines anderen ARTs liegen.
 *
 * Die Karte zählt nur `blocking`; sind Kandidaten da, aber keiner blockiert,
 * zeigt sie das ausdrücklich als erfüllt.
 */

export type BlockerState = "blocking" | "samePi" | "earlierPi" | "done";

/** Ein PI, soweit die Regel es braucht. */
export interface BlockerPi {
  id: string;
  startDate: Date;
}

export interface BlockerRef {
  id: string;
  title: string;
  state: BlockerState;
}

interface BlockerCandidate {
  id: string;
  title: string;
  status: string;
  /** `null` = Backlog. */
  pi: BlockerPi | null;
}

const ERLEDIGT = new Set(["completed", "cancelled"]);
const RANG: Record<BlockerState, number> = { blocking: 0, samePi: 1, earlierPi: 2, done: 3 };

function stateOf(b: BlockerCandidate, own: BlockerPi | null): BlockerState {
  if (ERLEDIGT.has(b.status)) return "done";
  if (own == null || b.pi == null) return "blocking";
  if (b.pi.id === own.id) return "samePi";
  return b.pi.startDate.getTime() < own.startDate.getTime() ? "earlierPi" : "blocking";
}

export function classifyBlockers(input: {
  /** PI des Features selbst; `null` = Backlog. */
  pi: BlockerPi | null;
  /** `from` der eingehenden `blocks`-Kanten. */
  blocksIn: ReadonlyArray<BlockerCandidate | null>;
  /** `to` der ausgehenden `depends_on`-Kanten. */
  dependsOnOut: ReadonlyArray<BlockerCandidate | null>;
}): BlockerRef[] {
  const seen = new Map<string, BlockerRef>();
  for (const b of [...input.blocksIn, ...input.dependsOnOut]) {
    if (b == null || seen.has(b.id)) continue;
    seen.set(b.id, { id: b.id, title: b.title, state: stateOf(b, input.pi) });
  }
  return [...seen.values()].sort(
    (a, b) =>
      RANG[a.state] - RANG[b.state] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

/**
 * **Die Gegenrichtung: wen hält dieses Feature auf?**
 *
 * Nachfolger sind die Umkehrung der Blocker-Kanten — ausgehende `blocks`
 * („X blockiert Y") und eingehende `depends_on` („Y hängt ab von X"). Ihr
 * Zustand ist derselbe, den **ihre** Karte für X anzeigt: dieselbe Regel
 * (`stateOf`), nur mit vertauschten Rollen — X ist der Blocker, das PI des
 * Nachfolgers das Bezugs-PI. So sagen beide Karten dasselbe über dieselbe
 * Kante.
 *
 *  - `done` — X selbst ist erledigt und hält niemanden mehr auf;
 *  - `samePi` — beide im selben PI;
 *  - `earlierPi` — X liegt im früheren PI, der Nachfolger danach;
 *  - `blocking` — X im Backlog oder später als der Nachfolger, oder der
 *    Nachfolger selbst im Backlog.
 */
export function classifySuccessors(input: {
  /** Das Feature selbst — der Blocker aus Sicht der Nachfolger. */
  self: { status: string; pi: BlockerPi | null };
  /** `to` der ausgehenden `blocks`-Kanten. */
  blocksOut: ReadonlyArray<BlockerCandidate | null>;
  /** `from` der eingehenden `depends_on`-Kanten. */
  dependsOnIn: ReadonlyArray<BlockerCandidate | null>;
}): BlockerRef[] {
  const seen = new Map<string, BlockerRef>();
  for (const n of [...input.blocksOut, ...input.dependsOnIn]) {
    if (n == null || seen.has(n.id)) continue;
    const state = stateOf(
      { id: "", title: "", status: input.self.status, pi: input.self.pi },
      n.pi,
    );
    seen.set(n.id, { id: n.id, title: n.title, state });
  }
  return [...seen.values()].sort(
    (a, b) =>
      RANG[a.state] - RANG[b.state] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

/** Die tatsächlich blockierenden — was die Karte zählt. */
export const blockingOnly = (blockers: readonly BlockerRef[]): BlockerRef[] =>
  blockers.filter((b) => b.state === "blocking");
