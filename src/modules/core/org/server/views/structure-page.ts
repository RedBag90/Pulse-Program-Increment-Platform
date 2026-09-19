import type { StructureTimeline } from "@/modules/core/org/server/services/structure";

/**
 * Das Seitenmodell der **Kadenz-Fläche** (`/structure/timelines`) — eine flache
 * Liste von Timeline-Zeilen plus je Timeline ihr Detail.
 *
 * **Es war einmal zwei Modelle in einem.** Bis September 2026 baute dieselbe
 * Funktion über einen `mode`-Schalter auch den Organisations-Baum: dieselben
 * Zeilen, eingerückt, mit Wertströmen, ARTs und Solutions. Dieser Baum ist
 * entfallen — die Struktur wird als Karte und als gegliederte Tabelle gezeigt
 * (`structure-overview.ts`), beide über ein verschachteltes Modell mit Summen
 * je Ebene, das eine flache Zeilenliste nicht tragen kann.
 *
 * Damit entfielen hier: der `mode`, der `tree`, die Personennamen und die
 * Wertstrom-/ART-Details. Die Kadenz-Fläche hat sie nie gelesen; sie wurden bei
 * jedem Aufruf gebaut. `/structure/timelines` kommt seitdem mit zwei Abfragen
 * weniger aus.
 *
 * Der Dateiname ist geblieben — ihn zu ändern, hiesse sechs Dateien anzufassen,
 * die nur den Typ importieren.
 */

/**
 * Die Knotenarten des Modells.
 *
 * `timeline` ist die einzige, die hier noch Zeilen erzeugt. Die drei anderen
 * bleiben im Typ, weil die Filter-Chips und die Adressen der Struktur-Fläche
 * (`structure-routes.ts`) dieselbe Aufzählung lesen.
 */
export type NodeKind = "vs" | "art" | "timeline" | "solution";

/** Eine Zeile in der linken Liste. `depth` treibt die Einrückung. */
export interface StructureRow {
  kind: NodeKind;
  id: string;
  /** Eltern-Zeile, oder `null` für die oberste Ebene. */
  parentId: string | null;
  depth: number;
  label: string;
  /** Zusatzangabe hinter dem Namen, z. B. „6 PIs · 3 ARTs". */
  subtitle: string;
  /** Lücken-Signale; treiben die Marke an der Zeile. */
  gaps: string[];
}

/** Detail einer Timeline. */
export interface TimelineDetail {
  kind: "timeline";
  id: string;
  name: string;
  pis: { id: string; name: string; startDate: string; endDate: string; status: string }[];
  subscribedArts: { id: string; name: string; valueStreamName: string | null }[];
  unassignedArts: { id: string; name: string; valueStreamName: string | null }[];
}

export interface StructurePageModel {
  rows: StructureRow[];
  timeline: Map<string, TimelineDetail>;
  /** Alle ARTs ohne Timeline — je Timeline-Detail zum Zuordnen angeboten. */
  unassignedArts: { id: string; name: string; valueStreamName: string | null }[];
  /** Zahlen für die Filter-Chips. */
  kindCounts: Record<NodeKind, number>;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export function buildStructurePageModel(input: {
  timeline: StructureTimeline;
}): StructurePageModel {
  const { timeline } = input;

  const rows: StructureRow[] = [];
  const timelineDetails = new Map<string, TimelineDetail>();

  const unassignedArts = timeline.unassignedArts.map((a) => ({
    id: a.id,
    name: a.name,
    valueStreamName: a.valueStream?.name ?? null,
  }));

  for (const t of timeline.timelines) {
    rows.push({
      kind: "timeline",
      id: t.id,
      parentId: null,
      depth: 0,
      label: t.name,
      subtitle: `${t.programIncrements.length} PIs · ${t.arts.length} ARTs`,
      gaps: [],
    });

    timelineDetails.set(t.id, {
      kind: "timeline",
      id: t.id,
      name: t.name,
      pis: t.programIncrements.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: isoDay(p.startDate),
        endDate: isoDay(p.endDate),
        status: p.status,
      })),
      subscribedArts: t.arts.map((a) => ({
        id: a.id,
        name: a.name,
        valueStreamName: a.valueStream?.name ?? null,
      })),
      unassignedArts,
    });
  }

  const kindCounts: Record<NodeKind, number> = { vs: 0, art: 0, timeline: 0, solution: 0 };
  for (const r of rows) kindCounts[r.kind] += 1;

  return { rows, timeline: timelineDetails, unassignedArts, kindCounts };
}
