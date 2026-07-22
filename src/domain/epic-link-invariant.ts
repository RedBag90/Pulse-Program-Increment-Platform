import type { DomainError, Result } from "./errors";
import { ok, err } from "./errors";

/**
 * **Count-once-Invariante** für Ziel ↔ Epic-Verknüpfungen ("Related work").
 *
 * Domain-Regel: der von einer KPI bestimmte Mehrwert erreicht Ziele über
 * *genau einen* Pfad — entweder die direkte KPI→KR-Bindung
 * (`KrKpiContribution`) **oder** das Verknüpfen des Epics an ein Ziel
 * (`GoalEpicLink`), nie über beide. Zusammen mit `@@unique([epicId])`
 * (jedes Epic feedet ≤ 1 Ziel-Knoten) zählt jeder Euro auf jeder Rollup-
 * Ebene genau einmal. ADR: epic-goal-link-value-single-path.
 *
 * Drei Durchsetzungs-Seams (parallel zur KPI-Pyramide):
 *  - dieses Modul (Validierung vor jedem Schreiben),
 *  - `linkEpicToGoal`-Service (advisory-lock + atomarer re-link) plus die
 *    symmetrische Prüfung in `setKpiBinding` (KPI eines bereits verlinkten
 *    Epics darf nicht einzeln gebunden werden),
 *  - `UNIQUE(epicId)` auf `goal_epic_links` (DB-Backstop).
 */
export interface ExistingGoalLink {
  epicId: string;
  /** Genau eine der beiden ist gesetzt (der aktuell verknüpfte Ziel-Knoten). */
  objectiveId: string | null;
  keyResultId: string | null;
}

/** Ziel-Knoten, an den verknüpft werden soll (genau eine FK gesetzt). */
export interface GoalLinkTarget {
  objectiveId: string | null;
  keyResultId: string | null;
}

export interface CheckEpicLinkInput {
  epicId: string;
  /** Ziel-Knoten für die Verknüpfung; `null` = Epic vom Ziel lösen. */
  target: GoalLinkTarget | null;
  /** Aktuelle Verknüpfung dieses Epics (`null` wenn keine). */
  existing: ExistingGoalLink | null;
  /**
   * Anzahl KPIs dieses Epics, die bereits einzeln via `KrKpiContribution`
   * an einen KR gebunden sind. `> 0` ⇒ Count-once-Konflikt beim Verknüpfen.
   */
  boundKpiCount: number;
}

export type EpicLinkPlan =
  | { kind: "noop" }
  | { kind: "create" }
  | { kind: "delete" }
  | { kind: "rebind"; from: GoalLinkTarget };

function sameTarget(a: GoalLinkTarget, b: GoalLinkTarget): boolean {
  return a.objectiveId === b.objectiveId && a.keyResultId === b.keyResultId;
}

/**
 * Plant die Verknüpfungs-Mutation unter Count-once-Garantie.
 * - Lösen (`target = null`): `delete` falls verknüpft, sonst `noop`.
 * - Verknüpfen: `conflict`, falls KPIs des Epics bereits einzeln gebunden
 *   sind (`boundKpiCount > 0`); sonst `create`, `noop` (schon am selben Ziel)
 *   oder `rebind` (Epic zu einem anderen Ziel-Knoten verschieben).
 */
export function checkEpicLink(input: CheckEpicLinkInput): Result<EpicLinkPlan, DomainError> {
  const { target, existing, boundKpiCount } = input;

  // Unlink
  if (target === null) {
    if (!existing) return ok({ kind: "noop" });
    return ok({ kind: "delete" });
  }

  // Link/rebind — Count-once: keine KPI darf schon einzeln gebunden sein.
  if (boundKpiCount > 0) {
    return err({
      kind: "conflict",
      reason:
        "KPIs dieses Epics sind bereits einzeln an ein Key Result gebunden — " +
        "erst im Controlling lösen, dann das Epic verknüpfen.",
    });
  }

  if (!existing) return ok({ kind: "create" });

  const existingTarget: GoalLinkTarget = {
    objectiveId: existing.objectiveId,
    keyResultId: existing.keyResultId,
  };
  if (sameTarget(existingTarget, target)) return ok({ kind: "noop" });

  return ok({ kind: "rebind", from: existingTarget });
}
