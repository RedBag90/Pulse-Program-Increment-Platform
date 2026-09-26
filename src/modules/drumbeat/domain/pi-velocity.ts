import { halfYearKey } from "@/modules/core/kernel/domain/calendar";

/**
 * **PI-Velocity: wie viel ein ART je Kapazität tatsächlich liefert.**
 *
 * JS je Kapazität (eines PI) = geliefertes Job Size ÷ Kapazität — dieselbe
 * Quote, aus der das Cockpit sein Ziel rechnet (`pi-job-size-target.ts`).
 * Dort blickt sie auf die letzten vier PIs vor einem PI; hier auf ein
 * **Fenster aus Halbjahren**, in dem die PIs **geendet** haben — dasselbe
 * Fenster, aus dem Budgeting seinen €-Satz je JS bildet (`RATE_WINDOW`).
 * Dazu kommt das **laufende** Halbjahr, aber nur mit seinen abgeschlossenen
 * PIs: was darin noch läuft oder geplant ist, hat nichts geliefert und
 * stünde nur als Rauschen in der Tabelle.
 *
 * **Was zählt**, gilt wie dort (`eligiblePredecessors`): nur abgeschlossene
 * PIs, nur mit Kapazität > 0. Ein PI ohne Kapazität ist keine Null, sondern
 * eine fehlende Angabe; ein laufender PI hat noch nicht fertig geliefert.
 *
 * Rein — keine Datenbank, keine Uhr.
 */

/**
 * Das Fenster: abgeschlossene Halbjahre ganz, das laufende nur mit seinen
 * abgeschlossenen PIs. Liegt das laufende auch unter `closedKeys` (gewählt
 * ist das nächste Halbjahr), gilt trotzdem die strengere Regel.
 */
export interface VelocityWindow {
  closedKeys: readonly string[];
  runningKey: string;
}

/** Alle Halbjahre des Fensters, älteste zuerst — für die Beschriftung. */
export function windowKeysOf(window: VelocityWindow): string[] {
  return [...new Set([...window.closedKeys, window.runningKey])].sort();
}

export interface VelocityInput {
  id: string;
  name: string;
  endDate: Date;
  status: string;
  capacity: number | null;
  delivered: number;
}

/** Warum ein PI im Fenster nicht in den Mittelwert eingeht. */
export type VelocitySkip = "notCompleted" | "noCapacity";

export interface VelocityRow {
  piId: string;
  name: string;
  endDate: Date;
  status: string;
  delivered: number;
  capacity: number | null;
  /** delivered ÷ capacity; `null` ohne Kapazität. */
  ratio: number | null;
  /** `null` = zählt; sonst der Grund, warum nicht. */
  skip: VelocitySkip | null;
}

export interface ArtVelocity {
  rows: VelocityRow[];
  /** Ø der Quoten der gezählten PIs — jeder PI wiegt gleich, wie im Cockpit. */
  mean: number | null;
  countedCount: number;
}

export interface StreamVelocity {
  rows: VelocityRow[];
  /** Σ geliefert ÷ Σ Kapazität über alle gezählten PIs aller ARTs. */
  ratio: number | null;
  countedCount: number;
}

function skipOf(p: { status: string; capacity: number | null }): VelocitySkip | null {
  if (p.capacity == null || p.capacity <= 0) return "noCapacity";
  if (p.status !== "completed") return "notCompleted";
  return null;
}

/** Die PIs eines ARTs, die im Fenster endeten — älteste zuerst. */
export function artVelocity(pis: readonly VelocityInput[], window: VelocityWindow): ArtVelocity {
  const abgeschlossen = new Set(window.closedKeys);
  const imFenster = (p: VelocityInput) => {
    const key = halfYearKey(p.endDate);
    if (key === window.runningKey) return p.status === "completed";
    return abgeschlossen.has(key);
  };
  const rows: VelocityRow[] = pis
    .filter(imFenster)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
    .map((p) => ({
      piId: p.id,
      name: p.name,
      endDate: p.endDate,
      status: p.status,
      delivered: p.delivered,
      capacity: p.capacity,
      ratio: p.capacity != null && p.capacity > 0 ? p.delivered / p.capacity : null,
      skip: skipOf(p),
    }));
  const gezaehlt = rows.filter((r) => r.skip == null);
  const mean =
    gezaehlt.length === 0
      ? null
      : gezaehlt.reduce((s, r) => s + (r.ratio ?? 0), 0) / gezaehlt.length;
  return { rows, mean, countedCount: gezaehlt.length };
}

/**
 * **Der Wertstrom: Σ geliefert ÷ Σ Kapazität.** Große ARTs wiegen damit mehr
 * — die Summe stimmt nur, wenn alle ARTs dieselbe Kapazitätseinheit nutzen.
 *
 * ARTs derselben Taktung teilen sich einen PI; er steht einmal da, mit den
 * Summen der ARTs, die ihn zählen. Ein PI zählt für den Wertstrom, sobald
 * ein ART ihn zählt.
 */
export function streamVelocity(perArt: readonly ArtVelocity[]): StreamVelocity {
  const byPi = new Map<string, VelocityRow & { counted: boolean }>();
  for (const art of perArt) {
    for (const r of art.rows) {
      const zaehlt = r.skip == null;
      const cur = byPi.get(r.piId);
      // Bis ein ART den PI zählt, stehen seine rohen Werte da; ab dann die
      // Summen der zählenden ARTs.
      if (!cur) {
        byPi.set(r.piId, { ...r, counted: zaehlt });
      } else if (zaehlt && !cur.counted) {
        byPi.set(r.piId, { ...r, counted: true });
      } else if (zaehlt) {
        cur.delivered += r.delivered;
        cur.capacity = (cur.capacity ?? 0) + (r.capacity ?? 0);
      }
    }
  }
  const rows: VelocityRow[] = [...byPi.values()]
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
    .map(({ counted, ...r }) => ({
      ...r,
      ratio: counted && r.capacity ? r.delivered / r.capacity : null,
      skip: counted ? null : r.skip,
    }));
  const gezaehlt = rows.filter((r) => r.skip == null);
  const summeJs = gezaehlt.reduce((s, r) => s + r.delivered, 0);
  const summeKap = gezaehlt.reduce((s, r) => s + (r.capacity ?? 0), 0);
  return {
    rows,
    ratio: summeKap > 0 ? summeJs / summeKap : null,
    countedCount: gezaehlt.length,
  };
}
