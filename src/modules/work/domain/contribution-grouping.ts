/**
 * **Den Epic-Beitrag zu Kopf-Zielen nach Struktur zusammenfassen.**
 *
 * Die Fläche listet 128 Epics. Wer wissen will, was ein *Wertstrom* beiträgt,
 * addiert sie bis dahin im Kopf. Diese Regeln fassen dieselben Zeilen entlang
 * einer der drei Strukturachsen zusammen — Wertstrom, ART, Solution — und
 * erben dabei die zwei Zusagen, die für eine einzelne Zeile schon gelten:
 *
 * 1. **Gleiche Einheit addieren, verschiedene getrennt lassen.** „12,4 Mio €"
 *    und „2.400 t CO₂" stehen nebeneinander, nie in einer Zahl.
 * 2. **„Ist vs. Plan" nur über bewertbare Zeilen** (ab L4.2). Der Prozentwert
 *    einer Gruppe wird aus deren summierten Beträgen **neu gerechnet**, nicht
 *    aus den Prozentwerten der Zeilen gemittelt: ein Mittelwert gäbe einem
 *    kleinen Epic dasselbe Gewicht wie einem hundertmal grösseren.
 *
 * Rein, kein I/O.
 */

import { totalContribution } from "@/modules/core/goals/domain/epic-contribution";
import type { UnitValue } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { NO_SOLUTION_LABEL } from "@/modules/work/domain/epic-class-filter";

/** „je Epic" ist keine Zusammenfassung, sondern ihr Aus-Zustand. */
export const CONTRIBUTION_AXES = ["epic", "valueStream", "art", "solution"] as const;
export type ContributionAxis = (typeof CONTRIBUTION_AXES)[number];

/** Wie der Schalter sie nennt. */
export const CONTRIBUTION_AXIS_KEYS: Record<ContributionAxis, string> = {
  epic: "work.contributionAxis.epic",
  valueStream: "work.contributionAxis.valueStream",
  art: "work.contributionAxis.art",
  solution: "work.contributionAxis.solution",
};

/** Wie die erste Spalte heisst, wenn nach dieser Achse gruppiert ist. */
export const CONTRIBUTION_AXIS_COLUMNS: Record<ContributionAxis, string> = {
  epic: "Epic",
  valueStream: "Wertstrom",
  art: "ART",
  solution: "Solution",
};

/**
 * Wer keine hat, bekommt trotzdem einen Platz — **stille Verrechnung ist das
 * Gegenteil einer Summe**. „Ohne Solution" gibt es schon, für die Facette; die
 * beiden anderen folgen ihrem Vorbild.
 */
const WITHOUT_LABELS: Record<Exclude<ContributionAxis, "epic">, string> = {
  valueStream: "Ohne Wertstrom",
  art: "Ohne ART",
  solution: NO_SOLUTION_LABEL,
};

/** Ein Strukturknoten, wie ihn eine Beitragszeile mitbringt. */
interface NodeRef {
  id: string;
  name: string;
}

/**
 * Was eine Zeile mitbringen muss, um zusammengefasst werden zu können —
 * strukturell beschrieben, damit die Regel nichts vom Server-Modell weiss.
 */
export interface GroupableContribution {
  epicId: string;
  valueStreamId: string | null;
  valueStreamName: string | null;
  art: NodeRef | null;
  solution: NodeRef | null;
  recurring: readonly UnitValue[];
  oneTime: readonly UnitValue[];
  benefitAssessable: boolean;
}

export interface ContributionGroup {
  /** Die Id des Knotens; `""` für die „Ohne …"-Gruppe. */
  key: string;
  label: string;
  epicCount: number;
  recurring: UnitValue[];
  oneTime: UnitValue[];
  /**
   * Die Grundlage von „Ist vs. Plan": Σ **nur** über die bewertbaren Zeilen,
   * plus deren Anzahl. Die Fläche sagt damit „9 von 61 bewertbar" — ohne diese
   * Angabe behauptete ein Prozentwert etwas über einen ganzen Wertstrom,
   * während er neun Epics beschreibt.
   */
  assessable: { count: number; planned: number; realized: number };
}

/**
 * Gleiche Einheit addieren, verschiedene getrennt lassen — dieselbe Regel, die
 * `aggregateEpicContribution` für ein einzelnes Epic anwendet.
 *
 * Sie stand bis September 2026 als lokale Helferin im Beitrags-Block. Mit der
 * Gruppierung gäbe es eine zweite Abschrift, und zwei Abschriften derselben
 * Summenregel sind die Stelle, an der die Zahlen eines Tages auseinanderlaufen.
 */
export function sumUnits(lists: readonly (readonly UnitValue[])[]): UnitValue[] {
  const byUnit = new Map<string, UnitValue>();
  for (const values of lists) {
    for (const v of values) {
      const key = v.unit ?? "";
      const prev = byUnit.get(key);
      if (prev) {
        prev.planned += v.planned;
        prev.realized += v.realized;
      } else {
        byUnit.set(key, { ...v });
      }
    }
  }
  return [...byUnit.values()];
}

/** Der Knoten dieser Zeile auf der gewählten Achse. */
function nodeOf(
  row: GroupableContribution,
  axis: Exclude<ContributionAxis, "epic">,
): NodeRef | null {
  if (axis === "valueStream") {
    return row.valueStreamId == null
      ? null
      : { id: row.valueStreamId, name: row.valueStreamName ?? row.valueStreamId };
  }
  return axis === "art" ? row.art : row.solution;
}

/**
 * Die Zeilen entlang einer Achse zu Summenzeilen bündeln.
 *
 * Die Reihenfolge ist die des ersten Auftretens — sortiert wird ausserhalb,
 * nach demselben Schlüssel, nach dem auch die Epic-Zeilen sortieren.
 */
export function groupContributions(
  rows: readonly GroupableContribution[],
  axis: Exclude<ContributionAxis, "epic">,
): ContributionGroup[] {
  const buckets = new Map<string, GroupableContribution[]>();
  const labels = new Map<string, string>();
  for (const row of rows) {
    const node = nodeOf(row, axis);
    const key = node?.id ?? "";
    labels.set(key, node?.name ?? WITHOUT_LABELS[axis]);
    const prev = buckets.get(key);
    if (prev) prev.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets].map(([key, group]) => {
    const assessable = group.filter((r) => r.benefitAssessable);
    return {
      key,
      label: labels.get(key) ?? WITHOUT_LABELS[axis],
      epicCount: group.length,
      recurring: sumUnits(group.map((r) => r.recurring)),
      oneTime: sumUnits(group.map((r) => r.oneTime)),
      assessable: {
        count: assessable.length,
        planned: assessable.reduce((s, r) => s + totalContribution(r, "planned"), 0),
        realized: assessable.reduce((s, r) => s + totalContribution(r, "realized"), 0),
      },
    };
  });
}
