import type { NodeKind } from "@/modules/core/org/server/views/structure-page";

/**
 * Die Adressen der Struktur-Fläche.
 *
 * Ein Knoten ist eine **Route**, kein Query-Parameter: Lesezeichen, geteilte
 * Links und die gezielte Cache-Invalidierung hängen daran. Der Baum liest die
 * aktive Auswahl aus dem Pfad zurück, statt sie selbst zu halten — damit gibt
 * es nur eine Wahrheit, und der Zurück-Knopf des Browsers tut das Richtige.
 */

/**
 * Die Knotenarten mit eigener Route. `timeline` gehört nicht dazu: Timelines
 * sind ein eigener Bereichs-Eintrag mit eigener Fläche, kein Knoten im
 * Organisations-Baum.
 */
export type RoutedKind = Extract<NodeKind, "vs" | "art" | "solution">;

const ROUTED = new Set<NodeKind>(["vs", "art", "solution"]);

export function isRoutedKind(kind: NodeKind): kind is RoutedKind {
  return ROUTED.has(kind);
}

/**
 * Pfadsegment je Knotenart, englisch wie das umgebende `/structure`.
 *
 * Einzahl für den Knoten, Mehrzahl für die Liste: `/structure/solution/<id>`
 * ist ein Knoten **im Baum**, `/structure/solutions` die flache Liste über alle
 * Wertströme. Zwei Flächen, zwei Segmente — sonst lägen sie im selben
 * Routen-Zweig und müssten sich ein Layout teilen, das nur einer von beiden
 * bekommt.
 */
const SEGMENT: Record<RoutedKind, string> = {
  vs: "value-stream",
  art: "art",
  solution: "solution",
};

const KIND_BY_SEGMENT = new Map<string, RoutedKind>(
  (Object.entries(SEGMENT) as [RoutedKind, string][]).map(([kind, seg]) => [seg, kind]),
);

export function nodeHref(kind: RoutedKind, id: string, tab?: string | null): string {
  const base = `/structure/${SEGMENT[kind]}/${id}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export interface ActiveNode {
  kind: RoutedKind;
  id: string;
}

/**
 * Liest den aktiven Knoten aus dem Pfad — mit oder ohne Locale-Präfix, weil
 * `usePathname()` im Client das Präfix trägt und der Server es abstreift.
 * `null`, solange nichts gewählt ist (`/structure` selbst).
 */
export function activeNodeFromPath(pathname: string): ActiveNode | null {
  const parts = pathname.split("/").filter(Boolean);
  const i = parts.indexOf("structure");
  if (i === -1) return null;
  const segment = parts[i + 1];
  const id = parts[i + 2];
  if (!segment || !id) return null;
  const kind = KIND_BY_SEGMENT.get(segment);
  return kind ? { kind, id } : null;
}
