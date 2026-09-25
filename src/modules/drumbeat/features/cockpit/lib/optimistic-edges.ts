import type { Edge } from "@xyflow/react";

/**
 * **Eine optimistische Kante überlebt, bis der Server sie kennt.**
 *
 * Der Netzplan hält seine Kanten in lokalem Zustand, damit ein Drag-Connect
 * sofort sichtbar ist: `onConnect` legt eine Kante mit der Kennung `tmp-…` an
 * und schickt die Aktion hinterher. Danach synchronisierte ein Effekt den
 * lokalen Stand mit dem Server-Stand — durch **Ersetzen**:
 *
 * ```ts
 * useEffect(() => setEdges(baseGraph.edges), [baseGraph.edges]);
 * ```
 *
 * Das ist genau so lange richtig, wie der ankommende Stand die neue Kante
 * bereits trägt. Er tut es oft nicht, und zwar aus zwei Gründen gleichzeitig:
 * `onConnect` ruft selbst `router.refresh()`, und `useBreakdownRealtime`
 * schlägt 600 ms später ein zweites Mal zu. Wer zuerst da ist, kann ein Stand
 * von **vor** dem Schreiben sein — und löscht die Kante wieder weg. Auf dem
 * Bildschirm: „Abhängigkeit angelegt", Kante da, Kante nach einer Sekunde weg.
 *
 * Die Regel hier ist deshalb nicht „ersetzen", sondern:
 *
 * > Eine `tmp-`-Kante bleibt stehen, solange der Server-Stand **keine** Kante
 * > mit derselben Quelle, demselben Ziel und demselben Typ trägt.
 *
 * Damit verschwindet sie genau dann, wenn sie durch eine echte ersetzt wurde —
 * und keinen Moment früher. Schlägt das Schreiben fehl, räumt `onConnect` sie
 * selbst weg; das ist der einzige andere Weg hinaus.
 *
 * Alles, was **nicht** `tmp-` heisst, kommt unverändert vom Server: eine
 * gelöschte Kante soll verschwinden, eine umgetypte ihren neuen Typ zeigen.
 *
 * Rein, kein React.
 */
export function mergeOptimisticEdges(fromServer: Edge[], current: Edge[]): Edge[] {
  const pending = current.filter((e) => e.id.startsWith("tmp-") && !isRepresented(e, fromServer));
  return pending.length === 0 ? fromServer : [...fromServer, ...pending];
}

/** Der Typ liegt in `data.type`; fehlt er, zählt nur das Paar. */
function edgeType(edge: Edge): string | undefined {
  const type = (edge.data as { type?: unknown } | undefined)?.type;
  return typeof type === "string" ? type : undefined;
}

function isRepresented(pending: Edge, fromServer: readonly Edge[]): boolean {
  const type = edgeType(pending);
  return fromServer.some(
    (e) =>
      e.source === pending.source &&
      e.target === pending.target &&
      (type === undefined || edgeType(e) === undefined || edgeType(e) === type),
  );
}
