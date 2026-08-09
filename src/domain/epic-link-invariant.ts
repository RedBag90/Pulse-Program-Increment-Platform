import type { DomainError, Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";

/**
 * **Count-once-Invariante** für Ziel ↔ Epic-Verknüpfungen (Einheiten-Kaskade).
 *
 * Domain-Regel: jede einzelne KPI treibt höchstens EIN Ziel — ein Epic darf
 * mehrere Ziele treiben, aber je über eine andere KPI. Das Count-once liegt auf
 * **KPI-Ebene** (`@@unique([kpiId])` auf `goal_epic_links`, NULLs distinct).
 *
 * Zwei Durchsetzungs-Seams:
 *  - dieses Modul (Validierung vor jedem Schreiben),
 *  - `linkEpicToGoal`-Service (advisory-lock + atomarer Upsert),
 *  - `UNIQUE(kpiId)` auf `goal_epic_links` (DB-Backstop).
 */
export interface EpicLinkTargetInput {
  /** Ziel-Knoten (Objective), an den verknüpft werden soll. */
  objectiveId: string;
  /** Gewählte Erfolgs-KPI, die dieses Ziel treibt; `null` = Alt-€-Ganz-Epic-Link. */
  kpiId: string | null;
  /** Ziel-Einheit je 1 KPI-Einheit (z. B. 10000 €/Wagon). Pflicht bei gesetzter KPI. */
  conversionFactor: number | null;
}

export interface CheckEpicLinkInput {
  /** Ziel für die Verknüpfung; `null` = Epic von DIESEM Ziel lösen. */
  target: EpicLinkTargetInput | null;
  /** Bestehender Link für DIESES (epicId, objectiveId)-Paar; `null` = keiner. */
  existing: { kpiId: string | null } | null;
  /** Treibt die gewählte KPI bereits ein ANDERES Ziel (anderer GoalEpicLink)? */
  chosenKpiLinkedElsewhere: boolean;
  /** Gehört die gewählte KPI zu diesem Epic? */
  chosenKpiBelongsToEpic: boolean;
}

export type EpicLinkPlan =
  | { kind: "noop" }
  | { kind: "create" }
  | { kind: "update" }
  | { kind: "delete" };

/**
 * Plant die Verknüpfungs-Mutation für ein (epicId, objectiveId)-Paar unter
 * Count-once-Garantie auf KPI-Ebene.
 * - Lösen (`target = null`): `delete` falls verknüpft, sonst `noop`.
 * - Verknüpfen mit gewählter KPI: validiert Erfolgs-KPI-Markierung +
 *   Umrechnungsfaktor und lehnt `conflict` ab, wenn die KPI bereits einzeln
 *   gebunden ist oder schon ein anderes Ziel treibt. Danach `update` (Paar
 *   existiert) oder `create`.
 */
export function checkEpicLink(input: CheckEpicLinkInput): Result<EpicLinkPlan, DomainError> {
  const { target, existing } = input;

  // Unlink
  if (target === null) {
    return ok(existing ? { kind: "delete" } : { kind: "noop" });
  }

  // Link/Update mit gewählter KPI → Validierung + Count-once.
  if (target.kpiId !== null) {
    if (!input.chosenKpiBelongsToEpic) {
      return err({
        kind: "validation" as const,
        issues: ["Die gewählte KPI muss zu diesem Epic gehören."],
      });
    }
    if (target.conversionFactor === null) {
      return err({
        kind: "validation" as const,
        issues: ["Umrechnungsfaktor (Ziel-Einheit je 1 KPI-Einheit) ist erforderlich."],
      });
    }
    if (input.chosenKpiLinkedElsewhere) {
      return err({
        kind: "conflict" as const,
        reason: "Diese KPI treibt bereits ein anderes Ziel — jede KPI kann nur ein Ziel treiben.",
      });
    }
  }

  return ok(existing ? { kind: "update" } : { kind: "create" });
}
