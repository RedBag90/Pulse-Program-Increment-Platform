import type { EpicCascadeContribution } from "@/domain/goals-rollup";

/**
 * Ein Knoten im zusammengeführten Nutzen-Kaskaden-Baum (Explorer-Sicht). Wurzeln
 * sind die Top-Ziele; Kinder die Ebenen hinab bis zu den verknüpften Zielen. Der
 * Wert je Knoten ist die Summe aller durchlaufenden Beiträge in dessen Einheit;
 * `kpiNames` steht an den treibenden Blatt-Zielen.
 */
export interface CascadeTreeNode {
  goalId: string;
  name: string;
  unit: string | null;
  planned: number;
  realized: number;
  kpiNames: string[];
  /** Auf mindestens einem Pfad fehlte hier die Einheiten-Umrechnung (Beitrag = 0). */
  brokenHere: boolean;
  children: CascadeTreeNode[];
}

/**
 * Führt die je-Link-Kaskadenpfade (verknüpftes Ziel → … → Top-Ziel) zu **einem
 * Baum je Top-Ziel** zusammen: gemeinsame Präfixe (von der Wurzel) werden gemergt,
 * `planned`/`realized` je Knoten summiert (identische Einheit je goalId), und am
 * jeweils treibenden Blatt der `kpiName` angehängt. Vorher nach `impactKind`
 * filtern (einmalig/wiederkehrend). Rein.
 */
export function buildCascadeTree(
  contributions: readonly EpicCascadeContribution[],
): CascadeTreeNode[] {
  const roots: CascadeTreeNode[] = [];
  const findOrAdd = (
    list: CascadeTreeNode[],
    step: { goalId: string; goalName: string; unit: string | null },
  ): CascadeTreeNode => {
    let n = list.find((x) => x.goalId === step.goalId);
    if (!n) {
      n = {
        goalId: step.goalId,
        name: step.goalName,
        unit: step.unit,
        planned: 0,
        realized: 0,
        kpiNames: [],
        brokenHere: false,
        children: [],
      };
      list.push(n);
    }
    return n;
  };

  for (const c of contributions) {
    // steps: verknüpftes Ziel (0) … Top-Ziel (letzter) → für den Baum von der Wurzel her.
    const path = [...c.steps].reverse();
    let level = roots;
    let node: CascadeTreeNode | null = null;
    for (const step of path) {
      node = findOrAdd(level, step);
      node.planned += step.planned;
      node.realized += step.realized;
      if (step.brokenHere) node.brokenHere = true;
      level = node.children;
    }
    // node = tiefste Ebene (verknüpftes Ziel): treibende KPI annotieren.
    if (node && c.kpiName && !node.kpiNames.includes(c.kpiName)) {
      node.kpiNames.push(c.kpiName);
    }
  }
  return roots;
}
