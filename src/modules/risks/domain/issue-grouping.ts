/**
 * **Die Issue-Liste nach einer Achse bündeln.**
 *
 * Bei 148 dokumentierten Issues ist die flache Liste 5,7 Bildschirme lang und
 * hat keinen einzigen Halt. Gruppen geben ihr welche — aber nur, wenn die Achse
 * im Bestand auch trägt. Am Bestand gemessen (Large Test Corp, 148 Zeilen):
 *
 * | Achse | Gruppen | grösste | ohne Wert |
 * |---|---|---|---|
 * | Exposure | 4 | 47 | 0 |
 * | ROAM | 5 | 34 | 0 |
 * | Kategorie | 4 | 41 | 0 |
 * | Owner | 6 | 29 | 0 |
 * | ~~ART~~ | 5 | — | **122** |
 * | ~~Wertstrom~~ | 4 | — | **122** |
 * | ~~Arbeitselement~~ | **87** | 4 | 3 |
 *
 * Die drei durchgestrichenen gibt es deshalb nicht: zwei bündeln fast alles in
 * „ohne", die dritte macht aus 148 Zeilen 87 Gruppen. Eine Gruppierung, die
 * nichts zusammenfasst, ist eine Liste mit Zwischenüberschriften.
 *
 * Rein, kein I/O.
 */

import type { Locale } from "@/i18n/routing";
import { EXPOSURE_BANDS, EXPOSURE_KEYS } from "@/modules/core/kernel/domain/exposure";
import { ROAM_KEYS, ROAM_STATUSES, normalizeRoamStatus } from "@/modules/core/kernel/domain/roam";
import {
  RISK_CATEGORIES,
  CATEGORY_KEYS,
  isRiskCategory,
} from "@/modules/risks/domain/risk-category";

export const ISSUE_GROUP_AXES = ["flach", "exposure", "roam", "category", "owner"] as const;
export type IssueGroupAxis = (typeof ISSUE_GROUP_AXES)[number];

/** Wie der Umschalter sie nennt. */
export const ISSUE_GROUP_KEYS: Record<IssueGroupAxis, string> = {
  flach: "risks.issueGroup.flach",
  exposure: "risks.issueGroup.exposure",
  roam: "risks.issueGroup.roam",
  category: "risks.issueGroup.category",
  owner: "risks.issueGroup.owner",
};

/** Was eine Zeile mitbringen muss, um gebündelt werden zu können. */
export interface GroupableIssue {
  band: string | null;
  roamStatus: string;
  category: string | null;
  ownerId: string | null;
  ownerLabel: string | null;
}

export interface IssueGroup<T> {
  key: string;
  /**
   * **Ein Katalog-Schlüssel, ausser bei den offenen Achsen.** Gruppen nach
   * Owner entstehen aus den Daten; dort steht der Name der Person, und der
   * gehört in keinen Katalog. Die Oberfläche übersetzt, was übersetzbar ist —
   * `t()` gibt einen unbekannten Schlüssel unverändert zurück.
   */
  labelKey: string;
  items: T[];
}

/** Wer nichts hat, bekommt eine eigene Gruppe statt stiller Einsortierung. */
const OHNE_KEY = "";
const OHNE_KEYS: Record<Exclude<IssueGroupAxis, "flach">, string> = {
  exposure: "risks.without.exposure",
  roam: "risks.without.roam",
  category: "risks.without.category",
  owner: "risks.without.owner",
};

/**
 * Die Reihenfolge der Gruppen je Achse — und, wo die Menge bekannt ist, **alle**
 * Gruppen, auch die leeren. Eine leere Gruppe ist eine Aussage („in diesem Band
 * steht nichts"); sie wegzulassen sähe aus wie ein Ladefehler.
 *
 * Exposure läuft **kritisch zuerst**: es ist die einzige geordnete Achse, und
 * oben steht, worauf man zuerst schaut.
 */
function skala(axis: Exclude<IssueGroupAxis, "flach">): { key: string; labelKey: string }[] | null {
  switch (axis) {
    case "exposure":
      return [
        ...[...EXPOSURE_BANDS]
          .reverse()
          .map((b) => ({ key: b as string, labelKey: EXPOSURE_KEYS[b] })),
        { key: OHNE_KEY, labelKey: OHNE_KEYS.exposure },
      ];
    case "roam":
      return ROAM_STATUSES.map((s) => ({ key: s as string, labelKey: ROAM_KEYS[s] }));
    case "category":
      return [
        ...RISK_CATEGORIES.map((c) => ({ key: c as string, labelKey: CATEGORY_KEYS[c] })),
        { key: OHNE_KEY, labelKey: OHNE_KEYS.category },
      ];
    // Owner ist offen: die Gruppen entstehen aus den Daten, nicht aus einer Liste.
    case "owner":
      return null;
  }
}

function schluessel(row: GroupableIssue, axis: Exclude<IssueGroupAxis, "flach">): string {
  switch (axis) {
    case "exposure":
      return row.band ?? OHNE_KEY;
    case "roam":
      return normalizeRoamStatus(row.roamStatus);
    case "category":
      return row.category && isRiskCategory(row.category) ? row.category : OHNE_KEY;
    case "owner":
      return row.ownerId ?? OHNE_KEY;
  }
}

/**
 * Bündelt `items` entlang einer Achse. `rowOf` holt die Merkmale aus dem
 * Element — die Tabelle reicht Baumknoten herein, nicht Zeilen, weil ein Kind
 * immer unter seinem Head bleibt und **nicht** eigenständig einsortiert wird:
 * sonst stünde dieselbe Zeile zweimal auf dem Bildschirm.
 */
export function groupIssues<T>(
  items: readonly T[],
  axis: Exclude<IssueGroupAxis, "flach">,
  rowOf: (item: T) => GroupableIssue,
  /**
   * Die Sprache der **Sortierung**. Nur die offene Achse (Owner) sortiert
   * überhaupt alphabetisch — dort stehen Personennamen, und deren Reihenfolge
   * hängt an der Kollation: „Ö" steht im Deutschen bei „O", im Schwedischen
   * am Ende. Bis September 2026 stand hier `"de"` fest verdrahtet.
   */
  locale: Locale = "de",
): IssueGroup<T>[] {
  const eimer = new Map<string, T[]>();
  const labels = new Map<string, string>();
  for (const item of items) {
    const row = rowOf(item);
    const key = schluessel(row, axis);
    if (axis === "owner") {
      labels.set(key, key === OHNE_KEY ? OHNE_KEYS.owner : (row.ownerLabel ?? key));
    }
    const prev = eimer.get(key);
    if (prev) prev.push(item);
    else eimer.set(key, [item]);
  }

  const feste = skala(axis);
  if (feste) return feste.map((g) => ({ ...g, items: eimer.get(g.key) ?? [] }));

  // Offene Achse: nach Beschriftung sortiert, „ohne" ans Ende.
  return [...eimer]
    .map(([key, items]) => ({ key, labelKey: labels.get(key) ?? key, items }))
    .sort((a, b) =>
      a.key === OHNE_KEY
        ? 1
        : b.key === OHNE_KEY
          ? -1
          : a.labelKey.localeCompare(b.labelKey, locale),
    );
}
