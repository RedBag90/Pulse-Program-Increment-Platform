/**
 * Related-Work-Arten für die referenzielle Ziel-Verknüpfung (Epic 5, Feature/PI).
 * Epics laufen separat wertbringend über GoalEpicLink.
 */
export const RELATED_WORK_KINDS = ["feature", "pi"] as const;
export type RelatedWorkKind = (typeof RELATED_WORK_KINDS)[number];

export function isRelatedWorkKind(s: string): s is RelatedWorkKind {
  return (RELATED_WORK_KINDS as readonly string[]).includes(s);
}
