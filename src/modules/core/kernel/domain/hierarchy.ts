import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

// ---------------------------------------------------------------------------
// Hierarchy invariants — the parent/child level rules for the two-tier
// Epic → Feature hierarchy (invariants I1 + I2, concept §6.4).
//
// Pure, in-process: no I/O. Services load the parent row; this module owns the
// rule for whether that parent is the right level.
// ---------------------------------------------------------------------------

/** The required parent level for each initiative level. `null` = no parent (Epic). */
export const PARENT_LEVEL: Record<InitiativeLevel, InitiativeLevel | null> = {
  [InitiativeLevel.EPIC]: null,
  [InitiativeLevel.FEATURE]: InitiativeLevel.EPIC,
};

const LEVEL_NAME: Record<InitiativeLevel, string> = {
  [InitiativeLevel.EPIC]: "EPIC",
  [InitiativeLevel.FEATURE]: "FEATURE",
};

/**
 * Wie ein Aufrufer ein **fehlendes** Elternteil gewertet haben will.
 *
 * Für ein Feature war „kein Elternteil" immer ein Fehler. Seit es
 * eigenständige Features gibt — ART-eigene Arbeit unter keinem
 * Portfolio-Vorhaben — ist es ein erlaubter Zustand, aber nur dort, wo der
 * Aufrufer ihn ausdrücklich zulässt.
 *
 * Die Vorgabe bleibt **streng**: wer nichts sagt, bekommt das alte Verhalten.
 */
export interface ParentLevelOptions {
  /**
   * `true` = **keine** angegebene `parentId` ist in Ordnung, statt `not_found`.
   *
   * Greift ausdrücklich nur bei leerer `parentId`. Eine angegebene, aber nicht
   * auffindbare Id bleibt ein Fehler — sonst würde ein Tippfehler zu einem
   * stillschweigend eigenständigen Feature.
   */
  allowOrphan?: boolean;
}

/**
 * Validates that `parent` is the correct level to parent a `childLevel`
 * initiative (invariants I1 + I2).
 *
 * - `parent === null` → `not_found` for the expected parent type,
 *   **unless** `allowOrphan` is set.
 * - parent of the wrong level → `hierarchy_violation` (I1).
 *
 * `parentId` is echoed back in the error so callers need not re-wrap it.
 */
export function validateParentLevel(
  childLevel: InitiativeLevel,
  parent: { level: number } | null,
  parentId: string,
  opts: ParentLevelOptions = {},
): Result<void> {
  const expected = PARENT_LEVEL[childLevel];

  if (expected === null) {
    // An Epic must not have a parent.
    if (parent !== null) {
      return err({
        kind: "hierarchy_violation" as const,
        violatedConstraint: "I2_epic_has_no_parent",
        detail: "errors.hierarchy.epicHasParent",
      });
    }
    return ok(undefined);
  }

  if (parent === null) {
    // Ein eigenständiges Feature ist elternlos — aber „ohne Epic" heisst **gar
    // keine** Id, nicht eine falsche. Wurde eine angegeben und nichts gefunden,
    // bleibt es `not_found`, auch mit Erlaubnis: sonst schluckte ein Tippfehler
    // in einer Id die Zuordnung stillschweigend.
    if (opts.allowOrphan && parentId === "") return ok(undefined);
    return err({ kind: "not_found" as const, resourceType: LEVEL_NAME[expected], id: parentId });
  }

  if (parent.level !== expected) {
    const actual = LEVEL_NAME[parent.level as InitiativeLevel] ?? String(parent.level);
    return err({
      kind: "hierarchy_violation" as const,
      violatedConstraint: "I1_level_strictness",
      detail: "errors.hierarchy.wrongParentLevel",
      values: {
        child: LEVEL_NAME[childLevel],
        childLevel,
        expected: LEVEL_NAME[expected],
        expectedLevel: expected,
        actual,
      },
    });
  }

  return ok(undefined);
}
