/**
 * Baut aus der flachen Ziel-Picker-Liste (`listGoalsForPicker` → `/api/v1/goals`,
 * sortiert nach `sortOrder`) den Hierarchie-Baum für den Baum-Picker. Rein, damit
 * testbar; die Eingabereihenfolge bleibt je Ebene erhalten (globale Sortierung
 * bewahrt die Relativordnung jeder Kind-Menge). Eltern-Referenzen, die nicht im
 * Satz sind (z. B. jenseits des `take`-Caps), werden als Wurzel behandelt.
 */
export interface GoalPickerRow {
  id: string;
  name: string;
  parentObjectiveId: string | null;
  status?: string | null;
  period?: string | null;
}

export interface PickerTreeNode {
  id: string;
  name: string;
  status: string | null;
  period: string | null;
  children: PickerTreeNode[];
}

export function buildGoalPickerTree(rows: GoalPickerRow[]): PickerTreeNode[] {
  const byId = new Map<string, PickerTreeNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      status: r.status ?? null,
      period: r.period ?? null,
      children: [],
    });
  }
  const roots: PickerTreeNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    const parent = r.parentObjectiveId ? byId.get(r.parentObjectiveId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node); // null-Eltern ODER Eltern nicht im Satz → Wurzel
  }
  return roots;
}
