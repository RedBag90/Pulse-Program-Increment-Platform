/**
 * Benefit-Wasserfall — Momentaufnahme des Portfolio-Nutzens **je Bucket** einer
 * wählbaren Dimension (Reifegrad-Status, Wertstrom, ART, Epic, …) gegen den
 * **Zielwert** eines Ziels. Rein, kein I/O.
 *
 * Antwortet: „Wie viel Value steckt heute in jeder Spalte — und wie viel fehlt
 * bis zum aufgestellten Zielwert?". Der Wert je Epic wird **reifegradabhängig**
 * bewertet (siehe {@link maturityBand}): frühe Epics zählen mit ihrem geschätzten
 * Zielbeitrag (Estimate/Forecast), Epics in laufender Umsetzung mit dem gemessenen
 * Anteil plus gestricheltem Rest, fertige Epics mit dem tatsächlichen Wert.
 * Diese Ist/Forecast-Semantik ist **dimensionsunabhängig** — die Dimension
 * bestimmt nur, in welcher Spalte ein Epic landet ({@link WaterfallDimension};
 * ohne Angabe: Reifegrad-Status L0–L5).
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
  /** Eltern-Ziel (null = Wurzel) — für die Hierarchie im Ziel-Selektor. */
  parentId: string | null;
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
 * Ziele (Wurzeln + Unterziele mit Zielwert) + je Ziel die beitragenden Epics.
 * Die Wasserfall-Mathematik läuft client-seitig über {@link buildGoalWaterfall}
 * (reagiert auf den Projekt-ID-Filter).
 */
export interface GoalWaterfallData {
  goals: GoalWaterfallGoal[];
  epicsByGoal: Record<string, GoalWaterfallEpic[]>;
}

/** Eine Spalte der gewählten Wasserfall-Dimension (Präsentation beim Aufrufer). */
export interface WaterfallBucketDef {
  key: string;
  label: string;
  sublabel?: string;
  color?: string;
}

/**
 * Die Bucket-Dimension des Wasserfalls: geordnete Spalten + Zuordnung je Epic.
 * `keyOf`-Ergebnisse außerhalb der Defs werden defensiv übersprungen — der
 * Aufrufer leitet die Defs aus derselben Epic-Menge ab und deckt damit alles ab.
 */
export interface WaterfallDimension {
  buckets: readonly WaterfallBucketDef[];
  keyOf: (e: GoalWaterfallEpic) => string;
}

/** Ein Balken des Wasserfalls (schwebend: `base` = Sockel, dann `solid` + `forecast`). */
export interface WaterfallStep {
  /** Stabiler Schlüssel: Bucket-Key bzw. „total" / „gap". */
  key: string;
  kind: "bucket" | "total" | "gap";
  /** Gate (nur bei der Status-Dimension gesetzt; sonst null). */
  gate: StageGate | null;
  /** Anzeige-Label der Spalte (bei total/gap leer — der Renderer beschriftet). */
  label: string;
  sublabel: string;
  /** Spaltenfarbe aus der Bucket-Def (undefined bei total/gap). */
  color?: string;
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

export const STAGE_ORDER: readonly StageGate[] = ["L0", "L1", "L2", "L3", "L4", "L5"];

const STAGE_GATE_SET = new Set<string>(STAGE_ORDER);

/** Default-Dimension: Reifegrad-Status L0–L5 (Label = Gate, Farbe beim Renderer). */
function stageDimension(): WaterfallDimension {
  return {
    buckets: STAGE_ORDER.map((gate) => ({ key: gate, label: gate })),
    keyOf: (e) => e.gate,
  };
}

/** Leerer Beitrags-Akkumulator je Spalte. */
interface Bucket {
  solid: number;
  forecast: number;
}

/**
 * Baut den Wasserfall eines Ziels aus seinen (gefilterten) Epic-Beiträgen:
 *  - je Bucket-Spalte `solid = Σ realized` (Bänder achieved_gap & actual),
 *    `forecast = Σ planned` (estimate) + `Σ max(planned−realized, 0)` (achieved_gap);
 *  - kumulierter Aufbau in Bucket-Reihenfolge (`base` = Laufsumme davor);
 *  - Abschluss-Balken „Σ heute" (Summe) und „Lücke" (target − Σ, ≥ 0).
 * `selectedEpicIds = null` ⇒ alle Epics; sonst nur die enthaltenen (Projekt-ID-
 * Filter). `dimension` bestimmt die Spalten; ohne Angabe: Status L0–L5. Leere
 * Buckets werden vorgeseedet, damit ihre Spalten sichtbar bleiben.
 */
export function buildGoalWaterfall(
  goal: GoalWaterfallGoal,
  epics: readonly GoalWaterfallEpic[],
  selectedEpicIds: ReadonlySet<string> | null,
  dimension?: WaterfallDimension,
): GoalWaterfall {
  const dim = dimension ?? stageDimension();
  const buckets = new Map<string, Bucket>();
  for (const def of dim.buckets) buckets.set(def.key, { solid: 0, forecast: 0 });

  for (const e of epics) {
    if (selectedEpicIds && !selectedEpicIds.has(e.epicId)) continue;
    const b = buckets.get(dim.keyOf(e));
    if (!b) continue; // Schlüssel außerhalb der Defs defensiv überspringen
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
  for (const def of dim.buckets) {
    const b = buckets.get(def.key)!;
    steps.push({
      key: def.key,
      kind: "bucket",
      gate: STAGE_GATE_SET.has(def.key) ? (def.key as StageGate) : null,
      label: def.label,
      sublabel: def.sublabel ?? "",
      ...(def.color !== undefined ? { color: def.color } : {}),
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
  steps.push({
    key: "total",
    kind: "total",
    gate: null,
    label: "",
    sublabel: "",
    base: 0,
    solid: total,
    forecast: 0,
  });
  // Deckungslücke (total→target), nur wenn positiv.
  if (gap > 0) {
    steps.push({
      key: "gap",
      kind: "gap",
      gate: null,
      label: "",
      sublabel: "",
      base: total,
      solid: 0,
      forecast: gap,
    });
  }

  return { goalId: goal.id, steps, target: goal.target, total, gap, overshoot };
}
