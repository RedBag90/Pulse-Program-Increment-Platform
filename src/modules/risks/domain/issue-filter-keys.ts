/**
 * **Was ein gespeicherter Issue-Filter trägt** — und wie er zwischen URL und
 * Datensatz hin- und herreist.
 *
 * Die beiden älteren Flächen (Portfolio, Ziele) speichern nur Facetten. Das
 * Issue-Register nimmt **auch die Ansicht** mit: Sortierung, Gruppierung und
 * Zeilenhöhe. Das ist die bewusste Abweichung — „meine kritischen, nach
 * Exposure gruppiert, kompakt" ist der Blick, den jemand wiederhaben will, und
 * die halbe Wiederherstellung wäre ärgerlicher als keine.
 *
 * `FilterCriteria` ist `Record<string, string[]>`. Die Einzelwerte reisen
 * deshalb als ein- oder null-elementiges Array; das Auspacken steht hier, damit
 * Seite und Fläche es nicht je einmal nachbauen.
 *
 * Rein, kein I/O.
 */

import type { FilterCriteria } from "@/server/services/saved-filter";

/** Mehrfachauswahl — in der URL kommagetrennt. */
export const ISSUE_FILTER_SET_KEYS = ["roam", "category", "owner", "band", "vs", "art"] as const;

/** Einzelwerte — Suchtext und die drei Ansichts-Schalter. */
export const ISSUE_FILTER_SINGLE_KEYS = ["q", "sort", "group", "density"] as const;

export const ISSUE_FILTER_KEYS = [
  ...ISSUE_FILTER_SET_KEYS,
  ...ISSUE_FILTER_SINGLE_KEYS,
] as readonly string[];

/** Trägt dieses Kriterium überhaupt etwas? Ein leerer Filter löst nichts aus. */
export function hasAnyCriteria(c: FilterCriteria): boolean {
  return ISSUE_FILTER_KEYS.some((k) => (c[k]?.length ?? 0) > 0);
}

/**
 * Kriterium → URL-Parameter. Leere Schlüssel werden `null`, damit der Aufrufer
 * sie aus der URL **entfernt**, statt sie leer zu setzen — sonst stünde nach
 * jedem Anwenden ein halbes Dutzend `&owner=` in der Adresse.
 */
export function criteriaToParams(c: FilterCriteria): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of ISSUE_FILTER_SET_KEYS) out[k] = c[k]?.length ? c[k]!.join(",") : null;
  for (const k of ISSUE_FILTER_SINGLE_KEYS) out[k] = c[k]?.[0] ? c[k]![0]! : null;
  return out;
}

/** URL-Parameter → Kriterium. `read` liefert den Rohwert eines Schlüssels. */
export function criteriaFromParams(read: (key: string) => string | null): FilterCriteria {
  const out: FilterCriteria = {};
  for (const k of ISSUE_FILTER_SET_KEYS) {
    const raw = read(k) ?? "";
    out[k] = raw ? raw.split(",").filter(Boolean) : [];
  }
  for (const k of ISSUE_FILTER_SINGLE_KEYS) {
    const raw = read(k) ?? "";
    out[k] = raw ? [raw] : [];
  }
  return out;
}
