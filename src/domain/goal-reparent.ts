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
