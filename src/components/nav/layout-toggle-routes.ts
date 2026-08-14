/**
 * Mapping zwischen alter Pfad-Segment-Sub-Nav und neuer `?tab=`-Detail-Shell.
 * Tab-Keys und Sub-Route-Segmente sind absichtlich gleich benannt
 * (`teams ↔ /teams`, `board ↔ /board`); die Helfer kapseln nur die
 * "overview = Root" Sonderbehandlung.
 */

export type LayoutEntity = "art" | "pi";

const ROOT_BY_ENTITY: Record<LayoutEntity, (id: string) => string> = {
  art: (id) => `/art/${id}`,
  pi: (id) => `/pi/${id}`,
};

/** New (`/X/[id]/v2?tab=Y`) → Old (`/X/[id]/Y` oder `/X/[id]` bei overview). */
export function tabToOldHref(entity: LayoutEntity, id: string, tab: string): string {
  const root = ROOT_BY_ENTITY[entity](id);
  return tab === "overview" ? root : `${root}/${tab}`;
}

/** Old (`/X/[id]/Y` oder `/X/[id]`) → New (`/X/[id]/v2?tab=Y`). */
export function oldToNewHref(entity: LayoutEntity, id: string, tab: string): string {
  const root = ROOT_BY_ENTITY[entity](id);
  return tab === "overview" ? `${root}/v2` : `${root}/v2?tab=${tab}`;
}

/**
 * Aus einem `pathname` wie `/de/art/abc/teams` den Tab-Key extrahieren.
 * Locale-Praefix ist optional; wir nehmen den letzten Pfad-Bestandteil und
 * fallen auf "overview" zurueck, wenn er die Entity-Id ist.
 */
export function segmentToTab(pathname: string, id: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (!last || last === id) return "overview";
  return last;
}
