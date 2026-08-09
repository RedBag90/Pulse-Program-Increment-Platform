/**
 * Einheitlicher Baum-Filter für die Ziel-Hierarchie (**strikt**): ein Knoten ist
 * sichtbar **genau dann**, wenn er **selbst** matcht **oder ein Nachfahre**
 * sichtbar ist. Ein Match am Elternteil zieht **nicht** die nicht-passenden
 * Kinder mit — jeder Knoten wird eigenständig geprüft, die Kinder werden immer
 * auf die sichtbaren beschnitten. Der Eltern-Pfad zu einem tiefen Treffer bleibt
 * als Kontext erhalten. Dieselbe Logik für Zeitraum-, Wertstrom-, ART-, Status-
 * und off-track-Filter (Loader + Client), damit sich alle Filter gleich verhalten.
 *
 * Rein und generisch über jeden Knotentyp mit `children`; mutiert nicht (Knoten
 * mit beschnittenen Kindern werden neu erzeugt, sonst per Referenz behalten).
 */
export function filterGoalBranches<T extends { children: T[] }>(
  nodes: T[],
  matches: (node: T) => boolean,
): T[] {
  const walk = (node: T): T | null => {
    // Kinder zuerst filtern; der Knoten bleibt, wenn er selbst matcht ODER ein
    // Kind (rekursiv) sichtbar ist — nie „ganzer Ast" nur wegen des Elternteils.
    const keptChildren: T[] = [];
    for (const child of node.children) {
      const kept = walk(child);
      if (kept) keptChildren.push(kept);
    }
    if (!matches(node) && keptChildren.length === 0) return null;
    // Referenz behalten, wenn kein Kind beschnitten wurde.
    const unchanged =
      keptChildren.length === node.children.length &&
      keptChildren.every((c, i) => c === node.children[i]);
    return unchanged ? node : { ...node, children: keptChildren };
  };

  const out: T[] = [];
  for (const node of nodes) {
    const kept = walk(node);
    if (kept) out.push(kept);
  }
  return out;
}

/**
 * Alle Knoten-Ids mit mindestens einem Kind (die einklappbaren Knoten). Ein
 * Ergebnis, das Tabelle (Array) und Netzplan (`new Set(...)`) gemeinsam nutzen —
 * statt zweier paralleler Rekursionen (`collectParentIds` / `collapsibleIds`).
 */
export function collectNodeIdsWithChildren<T extends { id: string; children: T[] }>(
  nodes: T[],
  acc: string[] = [],
): string[] {
  for (const n of nodes) {
    if (n.children.length > 0) {
      acc.push(n.id);
      collectNodeIdsWithChildren(n.children, acc);
    }
  }
  return acc;
}

/**
 * Pre-order-Flachlegung des Baums zu `{ node, depth }`-Zeilen; `depth` ist relativ
 * zu den übergebenen Wurzeln (0 = Wurzel). Ein Walker für alle Zeilen-Renderer.
 */
export function flattenGoalTree<T extends { children: T[] }>(
  nodes: T[],
  depth = 0,
  acc: { node: T; depth: number }[] = [],
): { node: T; depth: number }[] {
  for (const n of nodes) {
    acc.push({ node: n, depth });
    flattenGoalTree(n.children, depth + 1, acc);
  }
  return acc;
}
