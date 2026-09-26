import { isFeatureType, type FeatureType } from "@/modules/work/domain/portfolio-guardrails";

/**
 * **Die Typ-Achse eines Features — Feature, Enabler, Maintenance.**
 *
 * Eine eigene Achse im Sinne von ADR-0021 („Farbe steht nie allein"): Feature
 * blau, Enabler violett, Maintenance türkis, ohne Typ grau — dieselben Töne,
 * die die Kapazitäts-Guardrail für Business, Enabler und Maintenance meint.
 *
 * Bis September 2026 lag die Palette als Einzelfall im Netzplan
 * (`breakdown-network-view.tsx`). Seit auch die Kachel im Board ihren Typ
 * zeigt — ihr Streifen trug vorher den Status, den die Board-Zeilen ohnehin
 * zeigen —, steht sie hier, damit beide Flächen dieselbe Farbe für denselben
 * Typ benutzen. Die Farbe steht dabei nie allein: am Knoten steht das Wort,
 * an der Kachel trägt der Streifen es als Label, und das Board hat eine
 * Legende.
 *
 * Eine Tabelle je Darstellung, jede mit Eintrag für jeden Typ und für „ohne
 * Typ" (`""`): ein neuer Typ zwingt hier einen Eintrag.
 */

/** Fläche + Schrift — Badges am Knoten. */
export const FEATURE_TYPE_BADGE: Record<FeatureType | "", string> = {
  feature: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  enabler: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  maintenance: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "": "bg-muted text-muted-foreground",
};

/** Der Farbstreifen links an der Kachel im Board, samt Legende. */
export const FEATURE_TYPE_STRIPE: Record<FeatureType | "", string> = {
  feature: "bg-blue-500 dark:bg-blue-400",
  enabler: "bg-violet-500 dark:bg-violet-400",
  maintenance: "bg-teal-500 dark:bg-teal-400",
  "": "bg-muted-foreground/30",
};

/** Dieselbe Zuordnung für die MiniMap, die nur eine Farbe tragen kann. */
export const FEATURE_TYPE_MINIMAP: Record<FeatureType | "", string> = {
  feature: "var(--chart-1)",
  enabler: "var(--chart-4)",
  maintenance: "var(--chart-3)",
  "": "var(--muted-foreground)",
};

/**
 * Ein roher Typ-String aus dem Server-Modell auf einen bekannten Wert.
 *
 * Bis September 2026 war das im Netzplan eine ternäre Kaskade, die **jeden**
 * unbekannten Wert auf `""` warf — also den Typ **löschte**, sobald jemand
 * einen Knoten mit einem neueren Typ im Schnell-Editor öffnete. Das war kein
 * Anzeigefehler, sondern stiller Datenverlust.
 */
export function normalizeFeatureType(raw: string | null | undefined): FeatureType | "" {
  return isFeatureType(raw) ? raw : "";
}
