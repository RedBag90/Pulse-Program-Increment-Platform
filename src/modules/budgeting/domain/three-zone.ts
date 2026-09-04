/**
 * Drei-Zonen-Auswertung des Participatory Budgeting.
 *
 * Mehrere Gruppen finanzieren dieselbe Menge an Epics unabhängig (jeweils
 * Ja/Nein bis MVP). Ausgewertet wird nicht die einzelne Gruppenverteilung,
 * sondern die **Übereinstimmung** zwischen den Gruppen:
 *   - **Konsens** (alle Gruppen Ja)  → unstrittig, keine Diskussion.
 *   - **Ablehnung** (keine Gruppe Ja) → unstrittig, keine Diskussion.
 *   - **Streuzone** (uneinheitlich)   → einzige Diskussion + Entscheidung.
 *
 * `majority` speist die Begründungspflicht (E-04): weicht die Entscheidungs-
 * instanz von der Gruppenmehrheit ab, ist eine schriftliche Begründung Pflicht.
 * Bei gerader Gruppenzahl und Gleichstand gibt es **keine** Mehrheit (`none`)
 * → dann ist keine Abweichung definiert.
 *
 * Rein, kein I/O.
 */

export type Zone = "consensus" | "rejection" | "spread";
export type Majority = "yes" | "no" | "none";

/** Eine Gruppen-Stimme: hat Gruppe `groupId` das Epic `epicId` bis MVP finanziert? */
export interface GroupVote {
  groupId: string;
  epicId: string;
  funded: boolean;
}

export interface EpicZone {
  epicId: string;
  /** Anzahl Gruppen, die das Epic finanziert haben. */
  yes: number;
  /** Gesamtzahl der Gruppen (Nicht-Stimme = Nein). */
  total: number;
  zone: Zone;
  majority: Majority;
}

/**
 * Klassifiziert jedes PB-Listen-Epic in seine Zone. `total` ist immer die
 * Gruppenzahl — eine fehlende Stimme zählt als Nein (die Gruppe hat das Epic
 * nicht finanziert). Reihenfolge folgt `epicIds`.
 */
export function classifyZones(
  votes: readonly GroupVote[],
  epicIds: readonly string[],
  groupCount: number,
): EpicZone[] {
  const yesByEpic = new Map<string, number>();
  for (const v of votes) {
    if (v.funded) yesByEpic.set(v.epicId, (yesByEpic.get(v.epicId) ?? 0) + 1);
  }

  return epicIds.map((epicId) => {
    const yes = yesByEpic.get(epicId) ?? 0;
    const total = groupCount;
    const zone: Zone =
      yes === total && total > 0 ? "consensus" : yes === 0 ? "rejection" : "spread";
    const majority: Majority = yes * 2 > total ? "yes" : yes * 2 < total ? "no" : "none";
    return { epicId, yes, total, zone, majority };
  });
}

/** Nur die Streuzonen-Epics — die einzige zu diskutierende Menge. */
export function spreadZone(zones: readonly EpicZone[]): EpicZone[] {
  return zones.filter((z) => z.zone === "spread");
}
