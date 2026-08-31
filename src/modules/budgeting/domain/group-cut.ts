/**
 * Gruppen-Schnitt-Prüfung (C-01..C-03) — Warnungen, keine harten Fehler.
 *
 * Der Wert des PB-Verfahrens hängt an unabhängigen, ausgewogen geschnittenen
 * Gruppen: mindestens 3 Gruppen (bei 2 ist die Streuzone nicht auswertbar),
 * 4–6 Personen, Einreicher gleichmäßig verteilt, je Gruppe ein Sprecher.
 * Verstöße werden als Warnungen zurückgegeben, damit der Moderator bewusst
 * entscheiden kann.
 *
 * Die frühere Prüfung „keine zwei aus demselben Team" ist entfallen: Teams gibt
 * es als Entität nicht mehr, der Zweig konnte nie feuern.
 *
 * Rein, kein I/O.
 */

export const MIN_GROUPS = 3;
export const MIN_GROUP_SIZE = 4;
export const MAX_GROUP_SIZE = 6;

export interface CutGroup {
  id: string;
  name: string;
  spokespersonId: string | null;
}

export interface CutMember {
  groupId: string;
  userId: string;
  isSubmitter: boolean;
}

export type CutWarningCode =
  | "too_few_groups"
  | "group_size"
  | "no_spokesperson"
  | "submitters_uneven";

export interface CutWarning {
  code: CutWarningCode;
  message: string;
  groupId?: string;
}

/** Prüft den Gruppen-Schnitt und liefert alle Warnungen (leer = sauber). */
export function checkGroupCut(
  groups: readonly CutGroup[],
  members: readonly CutMember[],
): CutWarning[] {
  const warnings: CutWarning[] = [];

  if (groups.length < MIN_GROUPS) {
    warnings.push({
      code: "too_few_groups",
      message: `Mindestens ${MIN_GROUPS} Gruppen nötig — bei weniger ist die Streuzone nicht auswertbar (aktuell ${groups.length}).`,
    });
  }

  const submitterCounts: number[] = [];
  for (const g of groups) {
    const gm = members.filter((m) => m.groupId === g.id);

    if (gm.length < MIN_GROUP_SIZE || gm.length > MAX_GROUP_SIZE) {
      warnings.push({
        code: "group_size",
        message: `Gruppe „${g.name}" hat ${gm.length} Personen (empfohlen ${MIN_GROUP_SIZE}–${MAX_GROUP_SIZE}).`,
        groupId: g.id,
      });
    }

    if (!g.spokespersonId) {
      warnings.push({
        code: "no_spokesperson",
        message: `Gruppe „${g.name}" hat keinen benannten Sprecher.`,
        groupId: g.id,
      });
    }

    submitterCounts.push(gm.filter((m) => m.isSubmitter).length);
  }

  // Einreicher gleichmäßig verteilt: Spanne > 1 ⇒ ungleich.
  if (submitterCounts.length > 0) {
    const spread = Math.max(...submitterCounts) - Math.min(...submitterCounts);
    if (spread > 1) {
      warnings.push({
        code: "submitters_uneven",
        message: `Einreicher ungleich verteilt (${Math.min(...submitterCounts)}–${Math.max(...submitterCounts)} je Gruppe).`,
      });
    }
  }

  return warnings;
}
