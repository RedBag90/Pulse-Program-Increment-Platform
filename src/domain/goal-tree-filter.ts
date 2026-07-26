/**
 * Einheitlicher Baum-Filter für die Ziel-Hierarchie („ganzer Ast"): ein Knoten
 * ist sichtbar, wenn er selbst matcht, **ein Vorfahre** matcht **oder ein
 * Nachfahre** matcht. Damit zeigt jeder Treffer seinen kompletten Unterbaum, und
 * der Eltern-Pfad zu jedem Treffer bleibt erhalten; unbeteiligte Seitenäste ohne
 * Treffer fallen weg. Dieselbe Logik für Zeitraum-, Wertstrom-, ART- und
 * off-track-Filter (Loader + Client), damit sich alle Filter gleich verhalten.
 *
 * Rein und generisch über jeden Knotentyp mit `children`; mutiert nicht (Knoten
 * mit beschnittenen Kindern werden neu erzeugt, sonst per Referenz behalten).
 */
export function filterGoalBranches<T extends { children: T[] }>(
  nodes: T[],
  matches: (node: T) => boolean,
): T[] {
  const walk = (node: T, ancestorMatched: boolean): T | null => {
    // Sobald der Knoten selbst oder ein Vorfahre matcht, bleibt der ganze
    // Unterbaum unverändert erhalten.
    if (ancestorMatched || matches(node)) return node;
    // Sonst nur behalten, wenn ein Nachfahre matcht — dann als Eltern-Pfad mit
    // ausschließlich den Ästen, die zu Treffern führen.
    const keptChildren: T[] = [];
    for (const child of node.children) {
      const kept = walk(child, false);
      if (kept) keptChildren.push(kept);
    }
    return keptChildren.length > 0 ? { ...node, children: keptChildren } : null;
  };

  const out: T[] = [];
  for (const node of nodes) {
    const kept = walk(node, false);
    if (kept) out.push(kept);
  }
  return out;
}
