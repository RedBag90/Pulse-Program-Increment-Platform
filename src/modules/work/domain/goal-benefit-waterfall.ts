/**
 * Benefit-Wasserfall — Momentaufnahme des Portfolio-Nutzens **je Reifegrad-Status**
 * gegen den **Zielwert** eines Ziels. Rein, kein I/O.
 *
 * Antwortet: „Wie viel Value steckt heute in jedem Status (L0–L5) — und wie viel
 * fehlt bis zum aufgestellten Zielwert?". Der Wert je Epic wird **reifegradabhängig**
 * bewertet (siehe {@link maturityBand}): frühe Epics zählen mit ihrem geschätzten
 * Zielbeitrag (Estimate/Forecast), Epics in laufender Umsetzung mit dem gemessenen
 * Anteil plus gestricheltem Rest, fertige Epics mit dem tatsächlichen Wert.
 *
 * Alle Beträge sind bereits in der **Einheit des Ziels** ausgedrückt (die Umrechnung
 * über `conversionFactor`/Einheiten-Kaskade passiert im Loader).
 */

import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { SubStage } from "@/modules/work/domain/stage-gate";

/** Reifegrad-Band, das die Bewertung des Epic-Beitrags bestimmt. */
export type MaturityBand = "estimate" | "achieved_gap" | "actual";

/**
 * Bewertungs-Band aus Gate + Sub-Stage:
 *  - **estimate**   L0–L3 (noch nichts gebaut) → voller *geplanter* Beitrag (Forecast).
 *  - **achieved_gap** L4 & L4.1 (Umsetzung läuft) → *gemessener* Anteil + Rest zum Ziel.
 *  - **actual**     L4 & L4.2 (alle Features fertig) oder L5 → nur *tatsächlicher* Wert.
 * L4 ohne Sub-Stage (keine Features) wird wie L4.1 behandelt.
 */
export function maturityBand(gate: StageGate, subStage: SubStage | null): MaturityBand {
  if (gate === "L5") return "actual";
  if (gate === "L4") return subStage === "L4.2" ? "actual" : "achieved_gap";
  return "estimate"; // L0–L3
}

/** Ein Ziel als Zielwert-Referenz des Wasserfalls (Zielwert in eigener Einheit). */
export interface GoalWaterfallGoal {
  id: string;
  title: string;
  /** Zielwert `Objective.target` in der Ziel-Einheit. */
  target: number;
  /** `number | percent | currency` — steuert die Formatierung. */
  metricType: string;
  /** Freitext-Einheit (z. B. „Kunden"), null bei € via `currencyCode`. */
  metricUnit: string | null;
  currencyCode: string | null;
  precision: number;
}

/** Ein ziel-verknüpftes Epic mit seinem Beitrag in der Ziel-Einheit + Reifegrad. */
export interface GoalWaterfallEpic {
  epicId: string;
  gate: StageGate;
  subStage: SubStage | null;
  /** Geplanter Zielbeitrag @Ziel (in Ziel-Einheit). */
  planned: number;
  /** Gemessener/tatsächlicher Beitrag bis heute (in Ziel-Einheit). */
  realized: number;
}

/**
 * Serialisierbares DTO des Wasserfall-Loaders (Server → Client): alle messbaren
 * Kopf-Ziele + je Ziel die beitragenden Epics. Die Wasserfall-Mathematik läuft
 * client-seitig über {@link buildGoalWaterfall} (reagiert auf den Projekt-ID-Filter).
 */
export interface GoalWaterfallData {
  goals: GoalWaterfallGoal[];
  epicsByGoal: Record<string, GoalWaterfallEpic[]>;
}

/** Ein Balken des Wasserfalls (schwebend: `base` = Sockel, dann `solid` + `forecast`). */
export interface WaterfallStep {
  /** Stabiler Schlüssel: Gate-Kürzel bzw. „total" / „gap". */
  key: string;
  kind: "stage" | "total" | "gap";
  /** Gate (nur bei `kind === "stage"`). */
  gate: StageGate | null;
  /** Unsichtbarer Sockel (Laufsumme vor diesem Balken). */
  base: number;
  /** Ist/Actual-Anteil (solide). */
  solid: number;
  /** Estimate/Rest-Anteil (schraffiert). */
  forecast: number;
}

export interface GoalWaterfall {
  goalId: string;
  steps: WaterfallStep[];
  /** Zielwert (Referenzlinie). */
  target: number;
  /** Σ aller Status-Beiträge (solid + forecast) zum Bezugszeitpunkt. */
  total: number;
  /** Deckungslücke = max(target − total, 0). */
  gap: number;
  /** Übererfüllung = max(total − target, 0). */
  overshoot: number;
}

const STAGE_ORDER: readonly StageGate[] = ["L0", "L1", "L2", "L3", "L4", "L5"];

/** Leerer Beitrags-Akkumulator je Gate. */
interface Bucket {
  solid: number;
  forecast: number;
}

/**
 * Baut den Wasserfall eines Ziels aus seinen (gefilterten) Epic-Beiträgen:
 *  - je Gate-Spalte `solid = Σ realized` (Bänder achieved_gap & actual),
 *    `forecast = Σ planned` (estimate) + `Σ max(planned−realized, 0)` (achieved_gap);
 *  - kumulierter Aufbau L0→L5 (`base` = Laufsumme davor);
 *  - Abschluss-Balken „Σ heute" (Summe) und „Lücke" (target − Σ, ≥ 0).
 * `selectedEpicIds = null` ⇒ alle Epics; sonst nur die enthaltenen (Projekt-ID-Filter).
 */
export function buildGoalWaterfall(
  goal: GoalWaterfallGoal,
  epics: readonly GoalWaterfallEpic[],
  selectedEpicIds: ReadonlySet<string> | null,
): GoalWaterfall {
  const buckets = new Map<StageGate, Bucket>();
  for (const gate of STAGE_ORDER) buckets.set(gate, { solid: 0, forecast: 0 });

  for (const e of epics) {
    if (selectedEpicIds && !selectedEpicIds.has(e.epicId)) continue;
    const b = buckets.get(e.gate);
    if (!b) continue; // unbekanntes Gate defensiv überspringen
    const band = maturityBand(e.gate, e.subStage);
    if (band === "estimate") {
      b.forecast += e.planned;
    } else if (band === "actual") {
      b.solid += e.realized;
    } else {
      // achieved_gap: gemessen solide, Rest zum Plan gestrichelt
      b.solid += e.realized;
      b.forecast += Math.max(e.planned - e.realized, 0);
    }
  }

  const steps: WaterfallStep[] = [];
  let running = 0;
  for (const gate of STAGE_ORDER) {
    const b = buckets.get(gate)!;
    steps.push({
      key: gate,
      kind: "stage",
      gate,
      base: running,
      solid: b.solid,
      forecast: b.forecast,
    });
    running += b.solid + b.forecast;
  }

  const total = running;
  const gap = Math.max(goal.target - total, 0);
  const overshoot = Math.max(total - goal.target, 0);

  // Summen-Balken (0→total, als solider Umriss gerendert).
  steps.push({ key: "total", kind: "total", gate: null, base: 0, solid: total, forecast: 0 });
  // Deckungslücke (total→target), nur wenn positiv.
  if (gap > 0) {
    steps.push({ key: "gap", kind: "gap", gate: null, base: total, solid: 0, forecast: gap });
  }

  return { goalId: goal.id, steps, target: goal.target, total, gap, overshoot };
}
