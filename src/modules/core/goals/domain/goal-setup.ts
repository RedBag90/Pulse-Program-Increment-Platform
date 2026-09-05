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

export type GoalSetupStepStatus = "done" | "current" | "upcoming";

export interface GoalSetupStep extends GoalSetupStepMeta {
  status: GoalSetupStepStatus;
  /** For the current `open-goal` step: the goal to open to satisfy it. */
  actionGoalId: string | null;
}

export interface GoalSetupResult {
  steps: GoalSetupStep[];
  complete: boolean;
  /**
   * Das CTA-Ziel des aktuellen Schritts existiert, ist unter den aktiven Filtern
   * aber nicht geladen ⇒ der Deep-Link muss die Filter abräumen, sonst öffnet
   * der Drawer ein leeres Formular.
   */
  actionGoalHidden: boolean;
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
 * Derive the setup steps from the loaded goal tree. `current` is the first
 * not-done step; earlier = done, later = upcoming; `complete` = all five done.
 *
 * `allThemes` ist der **ungefilterte** Baum (die Wahrheit über den Tenant);
 * `visibleThemes` der unter den aktiven Filtern geladene Ausschnitt — nur für
 * `actionGoalHidden`. Ohne zweiten Parameter (= kein Filter) verhält sich die
 * Funktion exakt wie zuvor.
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

  const reached = [hasGoal, ...perStep.map((p) => p.done)];
  const firstOpen = reached.indexOf(false);

  const steps: GoalSetupStep[] = GOAL_SETUP_STEPS.map((meta, i) => ({
    ...meta,
    status: firstOpen === -1 || i < firstOpen ? "done" : i === firstOpen ? "current" : "upcoming",
    // actionGoalId only matters for the current open-goal step.
    actionGoalId: i === firstOpen && i > 0 ? perStep[i - 1]!.firstFailId : null,
  }));

  // Zeigt der CTA auf ein Ziel, das der aktive Filter ausblendet? Dann muss der
  // Deep-Link die Filter abräumen. Ohne Filter stammt die Id aus demselben Baum
  // und der Treffer ist garantiert ⇒ false.
  const actionGoalId = steps.find((s) => s.status === "current")?.actionGoalId ?? null;
  const actionGoalHidden =
    actionGoalId != null && !flatten(visibleThemes).some((n) => n.id === actionGoalId);

  return { steps, complete: firstOpen === -1, actionGoalHidden };
}
