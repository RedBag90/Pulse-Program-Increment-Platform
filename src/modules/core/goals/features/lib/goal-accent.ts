/**
 * Kopf-Ziel-Indikator: ein einheitliches, ruhiges Hellblau für Top-Level-Themes
 * (Farbschiene in der Tabelle + linker Rand der Netzplan-Knoten). Bewusst EINE
 * Farbe statt einer pro-Theme-Palette — die Regenbogen-Variante war zu bunt.
 * blue-400: auf hellem UND dunklem Grund gut sichtbar.
 */
export const HEAD_GOAL_ACCENT = "#60a5fa";

/**
 * **Astfarben im Rad** (Netzplan): jedes Oberziel bekommt eine, seine
 * Unterziele erben sie. Bewusst entsättigt: die Farbe ordnet nur zu (Rand und
 * Kante), sie soll nicht schreien — die Aussage trägt der Status-Ring. Acht
 * gedeckte Töne, auch in der Helligkeit verschieden, auf hellem wie dunklem
 * Grund lesbar; ab dem neunten Oberziel beginnt die Reihe von vorn.
 */
export const BRANCH_COLORS = [
  "#5b7394", // schieferblau
  "#a08a63", // sand
  "#6f8f7b", // salbei
  "#957088", // mauve
  "#7b77a0", // dämmerviolett
  "#5e8c91", // graupetrol
  "#87895f", // oliv
  "#a07565", // ton
] as const;

export function goalBranchColor(branch: number): string {
  return BRANCH_COLORS[branch % BRANCH_COLORS.length]!;
}
