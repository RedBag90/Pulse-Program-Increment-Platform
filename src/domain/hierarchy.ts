import { InitiativeLevel } from "@/domain/types";
import { ok, err, type Result } from "@/domain/errors";

// ---------------------------------------------------------------------------
// Hierarchy invariants — the parent/child level rules for the four-tier
// Epic → Feature → Story → Task hierarchy (invariants I1 + I2, concept §6.4).
//
// Pure, in-process: no I/O. Services load the parent row; this module owns the
// rule for whether that parent is the right level.
// ---------------------------------------------------------------------------

/** The required parent level for each initiative level. `null` = no parent (Epic). */
export const PARENT_LEVEL: Record<InitiativeLevel, InitiativeLevel | null> = {
  [InitiativeLevel.EPIC]: null,
  [InitiativeLevel.FEATURE]: InitiativeLevel.EPIC,
  [InitiativeLevel.STORY]: InitiativeLevel.FEATURE,
  [InitiativeLevel.TASK]: InitiativeLevel.STORY,
};

const LEVEL_NAME: Record<InitiativeLevel, string> = {
  [InitiativeLevel.EPIC]: "EPIC",
  [InitiativeLevel.FEATURE]: "FEATURE",
  [InitiativeLevel.STORY]: "STORY",
  [InitiativeLevel.TASK]: "TASK",
};

/**
 * Validates that `parent` is the correct level to parent a `childLevel`
 * initiative (invariants I1 + I2).
 *
 * - `parent === null` → `not_found` for the expected parent type.
 * - parent of the wrong level → `hierarchy_violation` (I1).
 *
 * `parentId` is echoed back in the error so callers need not re-wrap it.
 */
export function validateParentLevel(
  childLevel: InitiativeLevel,
  parent: { level: number } | null,
  parentId: string,
): Result<void> {
  const expected = PARENT_LEVEL[childLevel];

  if (expected === null) {
    // An Epic must not have a parent.
    if (parent !== null) {
      return err({
        kind: "hierarchy_violation" as const,
        violatedConstraint: "I2_epic_has_no_parent",
        detail: "An EPIC (level=0) must not have a parent.",
      });
    }
    return ok(undefined);
  }

  if (parent === null) {
    return err({ kind: "not_found" as const, resourceType: LEVEL_NAME[expected], id: parentId });
  }

  if (parent.level !== expected) {
    const actual = LEVEL_NAME[parent.level as InitiativeLevel] ?? String(parent.level);
    return err({
      kind: "hierarchy_violation" as const,
      violatedConstraint: "I1_level_strictness",
      detail:
        `A ${LEVEL_NAME[childLevel]} (level=${childLevel}) must have a parent of level ` +
        `${LEVEL_NAME[expected]} (level=${expected}). Got parent of level ${actual}.`,
    });
  }

  return ok(undefined);
}
