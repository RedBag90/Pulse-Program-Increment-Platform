/**
 * **PI-Lage** — liefern wir, was im laufenden PI geplant ist, und was steht im
 * Weg? Rein: kein I/O, jede Schwelle hier benannt.
 *
 * Grundlage ist die Job Size der Features eines ARTs in einem PI. Ein
 * verworfenes Feature zählt weder zum Plan noch zur Lieferung.
 */

const DAY = 86_400_000;

/** Abstand Zeit − Lieferung (Prozentpunkte), bis zu dem der PI „im Plan" ist. */
export const LAGE_IM_PLAN_BIS = 5;
/** … bis zu dem er „hinterher" ist; darüber „kritisch". */
export const LAGE_HINTERHER_BIS = 15;
/** Vorher gibt es keine Prognose — zwei Tage Tempo sagen nichts. */
export const PROGNOSE_AB_TAG = 3;

export type LageSignal = "planned" | "onTrack" | "behind" | "critical" | "done";

export interface PiWindow {
  startDate: Date;
  endDate: Date;
  status: string;
}

/** Tage des PIs und die vergangenen Tage bis `now`, auf das PI begrenzt. */
export function piDays(pi: PiWindow, now: Date): { total: number; elapsed: number } {
  const total = Math.max(1, Math.round((pi.endDate.getTime() - pi.startDate.getTime()) / DAY));
  const raw = Math.floor((now.getTime() - pi.startDate.getTime()) / DAY);
  return { total, elapsed: Math.min(total, Math.max(0, raw)) };
}

export interface LageFeature {
  id: string;
  title: string;
  status: string;
  jobSize: number | null;
  businessValue: number | null;
  completedAt: Date | null;
  updatedAt: Date;
  ownerName: string | null;
  /** Bei blockierten Features: seit wann und warum (aus dem Audit). */
  blockedSince: Date | null;
  blockedReason: string | null;
}

const zaehlt = (f: LageFeature) => f.status !== "cancelled";
const js = (f: LageFeature) => f.jobSize ?? 0;

export interface LageHead {
  signal: LageSignal;
  days: { total: number; elapsed: number };
  /** 0..1 */
  timeShare: number;
  /** 0..1; 0 ohne geplante Job Size. */
  deliveredShare: number;
  plannedJs: number;
  deliveredJs: number;
  plannedCount: number;
  deliveredCount: number;
  /** Zeitanteil − Lieferanteil in Prozentpunkten (positiv = hinterher). */
  gapPoints: number;
  /** Job Size zum PI-Ende im bisherigen Tempo; `null` zu früh oder ohne Zeit. */
  forecastJs: number | null;
}

/** Der Kopf der Lage: Zeit gegen Lieferung, Signal und Prognose. */
export function lageHead(features: readonly LageFeature[], pi: PiWindow, now: Date): LageHead {
  const plan = features.filter(zaehlt);
  const done = plan.filter((f) => f.status === "completed");
  const plannedJs = plan.reduce((s, f) => s + js(f), 0);
  const deliveredJs = done.reduce((s, f) => s + js(f), 0);
  const days = piDays(pi, now);
  const timeShare = days.elapsed / days.total;
  const deliveredShare = plannedJs > 0 ? deliveredJs / plannedJs : 0;
  // Aus den gerundeten Anteilen, die auch dastehen — sonst läse man „41 %"
  // und „33 %" und darunter „7 Punkte".
  const gapPoints = Math.round(timeShare * 100) - Math.round(deliveredShare * 100);
  return {
    signal: lageSignal(pi.status, gapPoints),
    days,
    timeShare,
    deliveredShare,
    plannedJs,
    deliveredJs,
    plannedCount: plan.length,
    deliveredCount: done.length,
    gapPoints,
    forecastJs: forecast(deliveredJs, days),
  };
}

export function lageSignal(piStatus: string, gapPoints: number): LageSignal {
  if (piStatus === "completed") return "done";
  if (piStatus !== "active") return "planned";
  if (gapPoints <= LAGE_IM_PLAN_BIS) return "onTrack";
  if (gapPoints <= LAGE_HINTERHER_BIS) return "behind";
  return "critical";
}

export function forecast(
  deliveredJs: number,
  days: { total: number; elapsed: number },
): number | null {
  if (days.elapsed < PROGNOSE_AB_TAG) return null;
  return Math.round((deliveredJs / days.elapsed) * days.total);
}

export interface AttentionItem {
  feature: LageFeature;
  /** Tage seit der Blockade; `null`, wenn kein Audit sie datiert. */
  days: number | null;
}

/**
 * **Braucht jetzt Hilfe** — die blockierten Features des laufenden PIs, die
 * am längsten blockierten zuerst, bei Gleichstand die grössere Job Size.
 *
 * Nur „blockiert": das ist der Status, mit dem ein Team selbst sagt, dass es
 * nicht weiterkommt. Abgeleitete Verdachtsmomente (wartet auf Vorgänger, ohne
 * Bewegung, noch nicht begonnen) verwässerten die Liste — gemessen standen 20
 * Einträge darin.
 */
export function attentionOf(
  features: readonly LageFeature[],
  pi: PiWindow,
  now: Date,
): AttentionItem[] {
  if (pi.status !== "active") return [];
  const tage = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY));
  return features
    .filter((f) => f.status === "blocked")
    .map((f) => ({ feature: f, days: f.blockedSince ? tage(f.blockedSince) : null }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || js(b.feature) - js(a.feature));
}

export interface PiMoveEvent {
  featureId: string;
  at: Date;
  /** Ins PI verschoben (`in`) oder hinaus (`out`). */
  direction: "in" | "out";
  actorId: string;
}

export interface ScopeChange {
  featureId: string;
  title: string;
  jobSize: number;
  direction: "in" | "out";
  at: Date;
  actorId: string | null;
  /** In den PI hinein angelegt statt verschoben. */
  created?: boolean;
}

export interface ScopeDrift {
  changes: ScopeChange[];
  /** Geplante Job Size zu PI-Beginn. */
  startJs: number;
  /** Geplante Job Size heute. */
  nowJs: number;
}

/**
 * **Scope seit PI-Start.** Je Feature zählt der Nettoeffekt: rein und wieder
 * raus ist keine Änderung. Ein Feature, das nach dem Start in der App direkt
 * im PI angelegt wurde (`created`, aus dem Audit), gilt als hineingekommen —
 * nicht jedes mit jüngerem `createdAt`: Importe und Seeds legen ohne Audit an,
 * und die wären sonst ein Scope-Sprung, den niemand gemacht hat.
 *
 * `featuresNow` sind die Features, die heute im PI stehen; `info` kennt Titel
 * und Job Size auch der hinausgeschobenen.
 */
export function foldScopeDrift(input: {
  pi: PiWindow;
  featuresNow: readonly LageFeature[];
  moves: readonly PiMoveEvent[];
  /** In der App angelegt: wann und von wem (Audit `initiative.created`). */
  created: ReadonlyMap<string, { at: Date; actorId: string }>;
  info: ReadonlyMap<string, { title: string; jobSize: number | null; status: string }>;
}): ScopeDrift {
  const { pi, featuresNow, moves, created, info } = input;
  const jetzt = new Set(featuresNow.filter(zaehlt).map((f) => f.id));
  const byFeature = new Map<string, PiMoveEvent[]>();
  for (const m of moves) {
    if (m.at.getTime() < pi.startDate.getTime()) continue;
    (byFeature.get(m.featureId) ?? byFeature.set(m.featureId, []).get(m.featureId)!).push(m);
  }
  const changes: ScopeChange[] = [];
  for (const [featureId, evs] of byFeature) {
    evs.sort((a, b) => a.at.getTime() - b.at.getTime());
    const warDrin = evs[0]!.direction === "out";
    const istDrin = evs[evs.length - 1]!.direction === "in";
    if (warDrin === istDrin) continue;
    const i = info.get(featureId);
    if (!i || i.status === "cancelled") continue;
    const last = evs[evs.length - 1]!;
    changes.push({
      featureId,
      title: i.title,
      jobSize: i.jobSize ?? 0,
      direction: istDrin ? "in" : "out",
      at: last.at,
      actorId: last.actorId,
    });
  }
  // Direkt im PI angelegt, ohne Verschiebung.
  for (const f of featuresNow) {
    const c = created.get(f.id);
    if (!zaehlt(f) || byFeature.has(f.id) || !c) continue;
    if (c.at.getTime() > pi.startDate.getTime()) {
      changes.push({
        featureId: f.id,
        title: f.title,
        jobSize: js(f),
        direction: "in",
        at: c.at,
        actorId: c.actorId,
        created: true,
      });
    }
  }
  changes.sort((a, b) => a.at.getTime() - b.at.getTime());
  const nowJs = featuresNow.filter((f) => jetzt.has(f.id)).reduce((s, f) => s + js(f), 0);
  const rein = changes.filter((c) => c.direction === "in").reduce((s, c) => s + c.jobSize, 0);
  const raus = changes.filter((c) => c.direction === "out").reduce((s, c) => s + c.jobSize, 0);
  return { changes, startJs: nowJs - rein + raus, nowJs };
}

export interface BurnupPoint {
  day: number;
  js: number;
}

export interface Burnup {
  totalDays: number;
  today: number;
  /** Treppe der Lieferung bis heute. */
  delivered: BurnupPoint[];
  /** Treppe des Umfangs über den ganzen PI. */
  scope: BurnupPoint[];
  /** Höchster Wert der Achse. */
  maxJs: number;
  forecastJs: number | null;
}

/**
 * Die Punkte des Burn-ups in PI-Tagen: Lieferung als Treppe aus `completedAt`,
 * Umfang als Treppe aus der Scope-Drift. Ideallinie und Prognose zeichnet die
 * Oberfläche aus `scope` und `forecastJs`.
 */
export function burnup(
  features: readonly LageFeature[],
  drift: ScopeDrift,
  pi: PiWindow,
  now: Date,
): Burnup {
  const { total, elapsed } = piDays(pi, now);
  const tagVon = (d: Date) =>
    Math.min(total, Math.max(0, Math.floor((d.getTime() - pi.startDate.getTime()) / DAY)));

  const fertig = features
    .filter((f) => f.status === "completed" && f.completedAt)
    .map((f) => ({ day: tagVon(f.completedAt!), js: js(f) }))
    .sort((a, b) => a.day - b.day);
  const delivered: BurnupPoint[] = [{ day: 0, js: 0 }];
  let sum = 0;
  for (const s of fertig) {
    sum += s.js;
    const last = delivered[delivered.length - 1]!;
    if (last.day === s.day) last.js = sum;
    else delivered.push({ day: s.day, js: sum });
  }
  if (delivered[delivered.length - 1]!.day < elapsed) delivered.push({ day: elapsed, js: sum });

  const scope: BurnupPoint[] = [{ day: 0, js: drift.startJs }];
  let umfang = drift.startJs;
  for (const c of drift.changes) {
    umfang += c.direction === "in" ? c.jobSize : -c.jobSize;
    const day = tagVon(c.at);
    const last = scope[scope.length - 1]!;
    if (last.day === day) last.js = umfang;
    else scope.push({ day, js: umfang });
  }
  scope.push({ day: total, js: umfang });

  const forecastJs = forecast(sum, { total, elapsed });
  const maxJs = Math.max(1, ...scope.map((p) => p.js), sum, forecastJs ?? 0);
  return { totalDays: total, today: elapsed, delivered, scope, maxJs, forecastJs };
}
