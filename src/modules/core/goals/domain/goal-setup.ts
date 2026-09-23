/**
 * First-run setup guide for the Ziele page — the ordered steps to get from an
 * empty page to a meaningful Ziel-Übersicht. Each step carries a static Erklärung
 * so the whole path is readable up front; the per-tenant status (done/current/
 * upcoming) is derived **live** from the already-loaded goal tree (no persistence).
 * Mirrors the Epic `epicLifecycleSteps` shape (reached[] → firstOpen → status).
 *
 * Der Guide beschreibt den **Tenant**, nicht den gerade sichtbaren Ausschnitt:
 * abgeleitet wird immer auf dem **ungefilterten** Baum. Sonst kippt ein Schritt
 * zurück auf `current`, sobald der Zeitraum-/Status-Filter das eine Ziel
 * ausblendet, das ihn erfüllt. Der zweite (optionale) Parameter liefert nur die
 * unter den Filtern sichtbaren Knoten — daraus entsteht `actionGoalHidden`.
 *
 * Pure / DB-free: the input is a structural subset of the loaded `GoalNode`, so
 * this module stays independent of the server views. Der Zeitraum-Schritt prüft
 * den **effektiven** Zeitraum (`goalTimeframe`) — dieselbe Wahrheit, an der auch
 * Roadmap, Sortierung und Filter hängen.
 */

import { goalTimeframe } from "@/modules/core/goals/domain/goal-period";

/** Reserved `setup_progress.checkId` for the tenant-level "guide dismissed" flag. */
export const ZIELE_SETUP_DISMISSED_KEY = "ziele-setup-guide-dismissed";

/** Structural subset of `GoalNode` (server/views/ziele-view.ts) the deriver needs. */
export interface GoalSetupNode {
  id: string;
  period: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  ownerId: string | null;
  target: number | null;
  latestCheckin: unknown;
  status: string | null;
  children: GoalSetupNode[];
}

export type GoalSetupStepKey = "create" | "period" | "owner" | "metric" | "checkin";

export type GoalSetupCtaKind = "create" | "open-goal";

export interface GoalSetupStepMeta {
  key: GoalSetupStepKey;
  label: string;
  description: string;
  ctaKind: GoalSetupCtaKind;
  ctaLabel: string;
}

export const GOAL_SETUP_STEPS: readonly GoalSetupStepMeta[] = [
  {
    key: "create",
    label: "Erstes Ziel anlegen",
    description: "Leg dein erstes Ziel an — Unterziele hängst du später dran.",
    ctaKind: "create",
    ctaLabel: "Ziel anlegen",
  },
  {
    key: "period",
    label: "Zeitraum festlegen",
    description:
      "Ordne dem Ziel einen Zeitraum zu (Quartal/Halbjahr/Jahr) — Basis für Roadmap und Verlauf.",
    ctaKind: "open-goal",
    ctaLabel: "Ziel öffnen",
  },
  {
    key: "owner",
    label: "Owner zuweisen",
    description: "Weise dem Ziel einen Verantwortlichen (Owner) zu.",
    ctaKind: "open-goal",
    ctaLabel: "Ziel öffnen",
  },
  {
    key: "metric",
    label: "Messgröße & Zielwert",
    description: "Definiere Messgröße und Zielwert — oder häng Unterziele für ein Rollup an.",
    ctaKind: "open-goal",
    ctaLabel: "Ziel öffnen",
  },
  {
    key: "checkin",
    label: "Erstes Status-Update",
    description:
      "Gib ein erstes Status-Update ab, damit Status und Fortschritt echte Werte zeigen.",
    ctaKind: "open-goal",
    ctaLabel: "Ziel öffnen",
  },
];

export interface GoalSetupStep extends GoalSetupStepMeta {
  /**
   * **Erfüllt dieser Schritt sich selbst?** Unabhängig von den anderen.
   *
   * Bis September 2026 stand hier ein Dreiklang „erledigt · aktuell · kommt
   * noch", abgeleitet aus der **Reihenfolge**: alles nach dem ersten offenen
   * Schritt galt als „kommt noch" — auch ein Schritt, der längst erfüllt war.
   * Die Leiste behauptete damit eine Abfolge, wo es eine Liste ist.
   */
  done: boolean;
  /** Der erste offene Schritt — die Auskunft, wo man anfängt. */
  isNext: boolean;
  /**
   * Das Ziel, an dem man diesen Schritt erledigt — das erste, das ihn noch
   * nicht erfüllt. `null` beim Anlegen-Schritt, der noch kein Ziel kennt.
   */
  actionGoalId: string | null;
  /**
   * Dieses Ziel existiert, ist unter den aktiven Filtern aber nicht geladen ⇒
   * der Deep-Link muss die Filter abräumen, sonst öffnet der Drawer ein leeres
   * Formular.
   *
   * Steht **je Schritt**, nicht am Ergebnis: mit einem Sprungziel je Zeile kann
   * jedes einzelne davon hinter dem Filter liegen, und ein gemeinsames Flag
   * beantwortete die Frage nur für eines von fünf.
   */
  actionGoalHidden: boolean;
}

export interface GoalSetupResult {
  steps: GoalSetupStep[];
  complete: boolean;
}

function flatten(nodes: readonly GoalSetupNode[]): GoalSetupNode[] {
  const out: GoalSetupNode[] = [];
  const walk = (n: GoalSetupNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/** Per-node predicate for each step (index-aligned with GOAL_SETUP_STEPS 1..4). */
const NODE_SATISFIES: readonly ((n: GoalSetupNode) => boolean)[] = [
  // Der **effektive** Zeitraum zählt, nicht das blosse Vorhandensein eines
  // Feldes: eine halbe Range (nur Start) ergibt keinen Zeitraum und trüge den
  // Schritt sonst fälschlich als erledigt.
  (n) => goalTimeframe(n.period, n.periodStart, n.periodEnd) != null, // period
  (n) => n.ownerId != null, // owner
  (n) => n.target != null || n.children.length > 0, // metric / rollup
  (n) => n.latestCheckin != null || n.status != null, // checkin
];

/**
 * Leitet die Einrichtungs-Schritte aus dem geladenen Ziel-Baum ab. Jeder Schritt
 * trägt seine **eigene** Antwort; `isNext` markiert den ersten offenen, und
 * `complete` heisst: keiner mehr offen.
 *
 * `allThemes` ist der **ungefilterte** Baum (die Wahrheit über den Tenant);
 * `visibleThemes` der unter den aktiven Filtern geladene Ausschnitt — nur dafür,
 * ob ein Sprungziel gerade sichtbar ist. Ohne zweiten Parameter (= kein Filter)
 * ist jedes Ziel sichtbar.
 */
export function goalSetupSteps(
  allThemes: readonly GoalSetupNode[],
  visibleThemes: readonly GoalSetupNode[] = allThemes,
): GoalSetupResult {
  const nodes = flatten(allThemes);
  const hasGoal = nodes.length > 0;

  // done + first goal that still fails the step (for the "open-goal" CTA).
  const perStep = NODE_SATISFIES.map((pred) => ({
    done: nodes.some(pred),
    firstFailId: nodes.find((n) => !pred(n))?.id ?? null,
  }));

  // Schritt 0 („erstes Ziel anlegen") hat kein Praedikat — er haengt daran, ob
  // es ueberhaupt ein Ziel gibt. Die uebrigen vier sind index-versetzt.
  const erledigt = [hasGoal, ...perStep.map((p) => p.done)];
  const firstOpen = erledigt.indexOf(false);

  const sichtbar = new Set(flatten(visibleThemes).map((n) => n.id));

  const steps: GoalSetupStep[] = GOAL_SETUP_STEPS.map((meta, i) => {
    // Das erste Ziel, dem dieser Schritt noch fehlt — der Ort, an dem man ihn
    // erledigt. Frueher nur fuer den einen aktuellen Schritt berechnet und
    // sonst weggeworfen, obwohl `perStep` ihn fuer jeden kennt.
    const actionGoalId = i > 0 ? (perStep[i - 1]!.firstFailId ?? null) : null;
    return {
      ...meta,
      done: erledigt[i]!,
      isNext: i === firstOpen,
      actionGoalId,
      // Ohne Filter stammt die Id aus demselben Baum, der Treffer ist also
      // garantiert ⇒ nie versteckt.
      actionGoalHidden: actionGoalId != null && !sichtbar.has(actionGoalId),
    };
  });

  return { steps, complete: firstOpen === -1 };
}
