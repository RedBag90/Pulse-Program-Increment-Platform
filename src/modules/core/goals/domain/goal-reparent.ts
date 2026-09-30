/**
 * Reparent-Guard für die Ziel-Kaskade. Verhindert Zyklen: ein Knoten darf nicht
 * unter sich selbst oder einen seiner Nachfahren verschoben werden. Nutzt den
 * materialisierten `path` ( id-Segmente, "/"-getrennt) — ein Nachfahre hat einen
 * Pfad, der mit `nodePath + "/"` beginnt.
 */
export interface CanReparentInput {
  nodeId: string;
  /** Materialisierter Pfad des zu verschiebenden Knotens. */
  nodePath: string;
  /** Neuer Ziel-Parent; `null` = auf oberste Ebene verschieben. */
  targetId: string | null;
  /** Pfad des Ziel-Parents (`null` bei Top-Level). */
  targetPath: string | null;
}

export function canReparent(input: CanReparentInput): boolean {
  // Auf oberste Ebene verschieben ist immer erlaubt.
  if (input.targetId === null) return true;
  // Nicht unter sich selbst.
  if (input.targetId === input.nodeId) return false;
  // Nicht unter einen Nachfahren (dessen Pfad beginnt mit nodePath + "/").
  if (input.targetPath !== null && input.targetPath.startsWith(`${input.nodePath}/`)) {
    return false;
  }
  return true;
}

// ── Subtree-Re-Materialisierung (der riskante Teil, jetzt rein & testbar) ──────

/** Der zu verschiebende Knoten mit seinen materialisierten Feldern. */
export interface ReparentNode {
  id: string;
  path: string;
  level: number;
  themeId: string;
  parentObjectiveId: string | null;
}

/** Ein Knoten des zu verschiebenden Subtrees (Knoten selbst + alle Nachfahren). */
export interface ReparentSubtreeNode {
  id: string;
  path: string;
  level: number;
}

/** Ein einzelner Write: neue materialisierte Felder eines Subtree-Knotens. */
export interface ReparentWrite {
  id: string;
  path: string;
  level: number;
  themeId: string;
  /** Nur für den bewegten Knoten selbst gesetzt (neuer Eltern-Verweis). */
  parentObjectiveId?: string | null;
}

/**
 * **Reine Subtree-Re-Materialisierung.** Berechnet für den bewegten Knoten und
 * jeden Nachfahren die neuen `path`/`level`/`themeId` (vom neuen Parent geerbt);
 * der bewegte Knoten bekommt zusätzlich den neuen `parentObjectiveId`. Der Service
 * persistiert nur noch die zurückgegebenen Writes — die riskante Pfad-Arithmetik
 * (Präfix-Umschreiben, Level-Delta, themeId-Vererbung) ist damit DB-frei testbar.
 *
 * `parent = null` ⇒ auf oberste Ebene (level 0, eigener themeId behalten).
 */
export function planReparent(input: {
  node: ReparentNode;
  parent: { path: string; level: number; themeId: string } | null;
  newParentId: string | null;
  subtree: ReparentSubtreeNode[];
}): ReparentWrite[] {
  const { node, parent, newParentId, subtree } = input;
  const oldPath = node.path;
  const newBasePath = parent ? `${parent.path}/${node.id}` : node.id;
  const newLevel = parent ? parent.level + 1 : 0;
  const levelDelta = newLevel - node.level;
  const newThemeId = parent ? parent.themeId : node.themeId;

  return subtree.map((d) => ({
    id: d.id,
    path: d.id === node.id ? newBasePath : `${newBasePath}${d.path.slice(oldPath.length)}`,
    level: d.level + levelDelta,
    themeId: newThemeId,
    ...(d.id === node.id ? { parentObjectiveId: newParentId } : {}),
  }));
}

// ── Geschwister-Reihenfolge (manuelles Sortieren per Drag) ────────────────────

/**
 * Fügt `movedId` in eine geordnete Geschwister-Liste ein: **vor** `beforeId`, bzw.
 * ans Ende, wenn `beforeId` null oder nicht (mehr) enthalten ist. `movedId` wird
 * vorher entfernt (Dedupe / Umsortieren im selben Parent). Rückgabe = neue
 * Reihenfolge; der Aufrufer schreibt daraus dichte `sortOrder`-Werte. Rein & testbar.
 */
export function reorderSiblingIds(
  orderedIds: string[],
  movedId: string,
  beforeId: string | null,
): string[] {
  const without = orderedIds.filter((id) => id !== movedId);
  const idx = beforeId != null && beforeId !== movedId ? without.indexOf(beforeId) : -1;
  if (idx < 0) {
    without.push(movedId);
    return without;
  }
  without.splice(idx, 0, movedId);
  return without;
}

// ── Ziehen in der Ziele-Tabelle (rein & testbar) ──────────────────────────────

/** Drop-Position relativ zur Zielzeile: davor/danach (Geschwister) oder unterordnen. */
export type DropPlacement = "before" | "inside" | "after";

/**
 * Wo in der Zielzeile losgelassen wird: oberes 40 % = davor, unteres 40 % =
 * danach, die Mitte = unterordnen. Ist Umsortieren gerade nicht möglich (eine
 * andere Sortierung als „Manuell" ist aktiv), bleibt nur das Unterordnen.
 *
 * `relY` = Anteil der Fingerposition an der Zeilenhöhe (0 = oben, 1 = unten).
 */
export function dropPlacement(relY: number, reorderable: boolean): DropPlacement {
  if (!reorderable) return "inside";
  if (relY < 0.4) return "before";
  if (relY > 0.6) return "after";
  return "inside";
}

interface DropTree {
  id: string;
  children: readonly DropTree[];
}

/** Was der Server zum Verschieben braucht; `beforeId: null` = ans Ende. */
export interface DropPlan {
  newParentId: string | null;
  beforeId: string | null;
}

/**
 * **Aus einem Loslassen die Server-Anfrage machen.** `targetId = null` ist die
 * Zone „auf oberste Ebene" (ans Ende). `null` als Ergebnis = nichts tun: das
 * Ziel liegt im eigenen Teilbaum (Zyklus) oder ist die gezogene Zeile selbst.
 *
 * „Danach" heisst: vor das nächste Geschwister — und zwar das nächste **ausser
 * der gezogenen Zeile**. Sonst zeigte `beforeId` beim Ablegen hinter den
 * direkten Vorgänger auf die Zeile selbst, und der Server hinge sie ans Ende.
 */
export function planDrop(
  forest: readonly DropTree[],
  srcId: string,
  targetId: string | null,
  placement: DropPlacement,
): DropPlan | null {
  if (targetId === null) return { newParentId: null, beforeId: null };
  if (targetId === srcId) return null;
  const src = findNode(forest, srcId);
  if (!src || findNode(src.children, targetId)) return null;

  if (placement === "inside") return { newParentId: targetId, beforeId: null };

  const loc = locate(forest, targetId, null);
  if (!loc) return null;
  if (placement === "before") return { newParentId: loc.parentId, beforeId: targetId };
  const rest = loc.siblings.map((s) => s.id).filter((id) => id !== srcId);
  const i = rest.indexOf(targetId);
  return { newParentId: loc.parentId, beforeId: rest[i + 1] ?? null };
}

function findNode(nodes: readonly DropTree[], id: string): DropTree | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function locate(
  nodes: readonly DropTree[],
  id: string,
  parentId: string | null,
): { parentId: string | null; siblings: readonly DropTree[] } | null {
  if (nodes.some((n) => n.id === id)) return { parentId, siblings: nodes };
  for (const n of nodes) {
    const r = locate(n.children, id, n.id);
    if (r) return r;
  }
  return null;
}
