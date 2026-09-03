/**
 * Die Facette „Epic-Klasse" der Portfolio-Übersicht — als reine Regeln.
 *
 * Sie unterscheidet sich von den vier bestehenden Facetten in einem Punkt: sie
 * **verwirft nichts**. Die nicht gewählte Klasse wird je Solution
 * zusammengefasst ausgewiesen, statt zu verschwinden. Ein Portfolio-Manager
 * will die vierzig kleinen ART-Epics nicht einzeln lesen — aber sehr wohl
 * wissen, was die ARTs beitragen.
 */

import { EPIC_CLASS_LABELS, type EpicClass } from "@/modules/work/domain/pb-submission";

/** Die Primär-Solution eines Epics — der Sammelpunkt der Zusammenfassung. */
export interface SolutionRef {
  id: string;
  name: string;
}

/** Eigene Gruppe statt stiller Verrechnung. */
export const NO_SOLUTION_LABEL = "Ohne Solution";

/**
 * Steht diese Klasse einzeln da?
 *
 * Ein Epic **ohne** freigegebenen Business Case hat noch keine Klasse — vor
 * L3.1 ist nicht entschieden, wie groß das Vorhaben ist. Es zählt zur
 * Portfolio-Seite: Vorhaben treten dort ein und werden erst später abgezweigt.
 * Deshalb hat die Facette zwei Werte, nicht drei.
 */
export function isClassShown(cls: EpicClass | null, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(cls ?? "portfolio");
}

/**
 * Wie die zusammengefasste Menge heißt — `null`, wenn nichts verborgen ist
 * (keine Auswahl, oder beide Klassen gewählt).
 */
export function hiddenClassLabel(selected: readonly string[]): string | null {
  if (selected.length === 0) return null;
  const hidden = (["portfolio", "art"] as const).filter((c) => !selected.includes(c));
  if (hidden.length === 0) return null;
  return hidden.map((c) => `${EPIC_CLASS_LABELS[c]}s`).join(" und ");
}

/** Die Klasse, die zusammengefasst wird — treibt die Einfärbung (REQ-9). */
export function hiddenClass(selected: readonly string[]): EpicClass | null {
  if (selected.length === 0) return null;
  if (selected.includes("portfolio") && !selected.includes("art")) return "art";
  if (selected.includes("art") && !selected.includes("portfolio")) return "portfolio";
  return null;
}

export interface SolutionRollup {
  /** `null` ⇒ die Gruppe „Ohne Solution". */
  solutionId: string | null;
  name: string;
  count: number;
  /** Nur die Fälligkeitslisten füllen das; sonst 0. */
  overdue: number;
}

/**
 * Gruppiert die verborgene Menge nach ihrer Primär-Solution, größte Gruppe
 * zuerst, bei Gleichstand alphabetisch.
 *
 * Warum die Solution und nicht der Wertstrom oder der ART: ein ART-Epic ist ein
 * Stück Veränderung **an einer Solution**. Der Wertstrom wäre zu grob; der ART
 * benennt die Zuständigkeit, nicht den Gegenstand.
 *
 * Summiert wird ausschließlich die Anzahl. Eine gemittelte Überfälligkeit über
 * sechs Epics wäre eine Zahl, die für kein einziges gilt.
 */
export function rollUpBySolution(
  hidden: readonly { solution: SolutionRef | null; overdue?: boolean }[],
): SolutionRollup[] {
  const byId = new Map<string, SolutionRollup>();
  for (const row of hidden) {
    const key = row.solution?.id ?? "";
    let group = byId.get(key);
    if (!group) {
      group = {
        solutionId: row.solution?.id ?? null,
        name: row.solution?.name ?? NO_SOLUTION_LABEL,
        count: 0,
        overdue: 0,
      };
      byId.set(key, group);
    }
    group.count += 1;
    if (row.overdue) group.overdue += 1;
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
}
