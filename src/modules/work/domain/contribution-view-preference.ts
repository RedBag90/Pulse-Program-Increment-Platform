/**
 * **Was die Kachel „Epic-Beitrag zu Kopf-Zielen" sich merkt.**
 *
 * Zwei Schalter: wonach zusammengefasst wird und wonach sortiert, samt
 * Richtung. Bis September 2026 standen beide in `useState` und damit nach jedem
 * Seitenaufruf wieder auf der Voreinstellung — bei 128 Zeilen jedes Mal
 * dieselbe Handarbeit. Sie liegen jetzt in `view_preferences`, am Konto statt
 * im Browser.
 *
 * **Der Parser ist der Gehalt dieser Datei, nicht der Typ.** Ein gespeicherter
 * Wert ueberlebt Code-Aenderungen: wird eine Achse umbenannt oder ein
 * Sortierschluessel entfernt, liegt in der Datenbank ein Wert, den es nicht mehr
 * gibt. Ungeprueft durchgereicht liefert `CONTRIBUTION_AXIS_COLUMNS[axis]` dann
 * eine **leere Spaltenueberschrift** und `groupContributions` eine unbekannte
 * Achse. Deshalb prueft `parseContributionView` jedes Feld gegen das Vokabular,
 * das der Code heute kennt, und faellt **je Feld einzeln** auf die Vorgabe
 * zurueck — dieselbe Haltung wie `parseGuardrailTargets`: eine halb veraltete
 * Einstellung verliert die veraltete Haelfte, nicht die ganze.
 *
 * Rein, kein I/O.
 */

import type { ContributionMode } from "@/modules/core/goals/domain/epic-contribution";
import {
  CONTRIBUTION_AXES,
  type ContributionAxis,
} from "@/modules/work/domain/contribution-grouping";

/**
 * Der Schluessel in `view_preferences`. Traegt die Flaeche im Namen, damit
 * daneben Platz fuer die naechste Kachel bleibt.
 */
export const CONTRIBUTION_VIEW_KEY = "portfolio.goalContribution";

/**
 * Wonach die Tabelle sortiert. „Abweichung" ist keine dritte Zahl, sondern ein
 * Verhaeltnis der beiden anderen — deshalb steht sie neben `ContributionMode`
 * und nicht darin.
 */
export const CONTRIBUTION_SORT_KEYS = ["planned", "realized", "deviation"] as const;
export type ContributionSortKey = ContributionMode | "deviation";

/** Voreingestellte Richtung je Schluessel: die interessante Seite zuerst. */
export const DEFAULT_ASC: Record<ContributionSortKey, boolean> = {
  planned: false, // groesster Plan oben
  realized: false, // groesstes Ist oben
  deviation: true, // groesster Rueckstand oben — dort tut man etwas
};

export interface ContributionView {
  axis: ContributionAxis;
  sortKey: ContributionSortKey;
  asc: boolean;
}

export const DEFAULT_CONTRIBUTION_VIEW: ContributionView = {
  axis: "epic",
  sortKey: "planned",
  asc: DEFAULT_ASC.planned,
};

const isAxis = (v: unknown): v is ContributionAxis =>
  typeof v === "string" && (CONTRIBUTION_AXES as readonly string[]).includes(v);

const isSortKey = (v: unknown): v is ContributionSortKey =>
  typeof v === "string" && (CONTRIBUTION_SORT_KEYS as readonly string[]).includes(v);

/**
 * Aus dem, was in der Datenbank steht, wird eine Einstellung, die die Kachel
 * rendern kann — **immer**. Kein Wurf, kein `null`, kein halbes Objekt.
 *
 * `asc` haengt am Sortierschluessel: faellt der auf die Vorgabe zurueck, gilt
 * auch dessen Vorzugsrichtung. Eine gespeicherte Richtung zu einem Schluessel,
 * den es nicht mehr gibt, waere keine Information.
 */
export function parseContributionView(raw: unknown): ContributionView {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_CONTRIBUTION_VIEW;
  }
  const o = raw as Record<string, unknown>;
  const axis = isAxis(o["axis"]) ? o["axis"] : DEFAULT_CONTRIBUTION_VIEW.axis;
  const keyKept = isSortKey(o["sortKey"]);
  const sortKey = keyKept
    ? (o["sortKey"] as ContributionSortKey)
    : DEFAULT_CONTRIBUTION_VIEW.sortKey;
  // Die Richtung zaehlt nur, wenn ihr Schluessel ueberlebt hat. „Aufsteigend"
  // zu einem Schluessel, den es nicht mehr gibt, ist keine Aussage ueber den,
  // der an seine Stelle tritt.
  const asc = keyKept && typeof o["asc"] === "boolean" ? o["asc"] : DEFAULT_ASC[sortKey];
  return { axis, sortKey, asc };
}
