/**
 * Reifegrad-Gruppierung für den Timeline-Gutter: fasst aufeinanderfolgende Phasen
 * gleichen Reifegrads (L0–L5) zu einer Gruppe zusammen, damit je Reifegrad **ein**
 * L-Kürzel + **eine** vertikale Linie über alle zugehörigen Zeilen gerendert wird.
 * Rein, keine I/O.
 */

export interface LevelGroup {
  /** Reifegrad-Kürzel dieser Gruppe (z. B. "L2"). */
  level: string;
  /** 0-basierter Index der ersten Phase der Gruppe. */
  start: number;
  /** Anzahl aufeinanderfolgender Phasen dieses Reifegrads. */
  span: number;
}

/**
 * Wandelt die Reifegrad-Folge der Phasen (in Reihenfolge) in zusammenhängende
 * Gruppen. Beispiel: `["L0","L1","L1","L2","L2","L3"]` → L0(1), L1(2), L2(2), L3(1).
 */
export function reifegradGroups(levels: readonly string[]): LevelGroup[] {
  const groups: LevelGroup[] = [];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const prev = groups[groups.length - 1];
    if (prev && prev.level === level) {
      prev.span += 1;
    } else {
      groups.push({ level, start: i, span: 1 });
    }
  }
  return groups;
}
