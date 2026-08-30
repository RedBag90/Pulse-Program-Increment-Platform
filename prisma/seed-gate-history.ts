/**
 * Reifegrad-Historie für Seeds — die Zeilen und Stempel, die entstanden wären,
 * wenn ein Epic den dokumentierten Weg wirklich gegangen wäre.
 *
 * Die Seeds schrieben den Reifegrad bisher als *Endzustand*: `stageGate` plus
 * ein paar aus einem Prädikat abgeleitete Datumsspalten. Damit stand im
 * Demo-Mandanten ein Epic auf L4, dessen Verlauf „Noch kein Reifegrad-Wechsel
 * beantragt" meldete — der Datensatz widersprach der Aussage, die das Produkt
 * über sich trifft (siehe `docs/concepts/epic-lifecycle-walkthrough.md`).
 *
 * Dieses Modul dreht das um: der Aufrufer beschreibt den **Weg** als Folge von
 * Zügen, und die Faltung hier leitet daraus Spalten, Anträge und Abnahmen ab —
 * mit **derselben reinen Domänenlogik, die die App benutzt**:
 *
 *   `stampsForAdvance`  → welche Spalte welcher Schritt setzt
 *   `unwindStampsFor`   → was eine Rückstufung abräumt
 *   `gateReadiness`     → der Kriterien-Schnappschuss am Antrag
 *   `resolveGatePolicy` + `expandApprovers` → wer abnimmt
 *
 * Damit kann ein Seed nicht mehr von der Leiter abdriften: ändert sich, welchen
 * Stempel ein Schritt setzt, ziehen die Seeds beim nächsten Lauf automatisch mit.
 *
 * Rein — kein Prisma, kein I/O. Der Aufrufer schreibt die zurückgegebenen Zeilen.
 */
import type { Prisma } from "@/generated/prisma";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { isoDay } from "@/modules/core/kernel/domain/calendar";
import { currentGateStep, gateOfStep, type GateStep } from "@/modules/work/domain/stage-gate";
import {
  stampsForAdvance,
  unwindStampsFor,
  type GateStamps,
} from "@/modules/work/domain/gate-transition";
import {
  gateReadiness,
  previousGate,
  type ChildFeatureStats,
  type EpicGateFacts,
} from "@/modules/work/domain/gate-readiness";
import {
  expandApprovers,
  resolveGatePolicy,
  type ApproverContext,
  type ApproverOverride,
  type GateApproverRole,
  type GateApproverRuleRow,
  type ResolvedApprover,
} from "@/modules/work/domain/gate-policy";
import { withImplementationActual } from "@/modules/work/domain/timeline";

// ---------------------------------------------------------------------------
// Die Züge, aus denen ein Weg besteht
// ---------------------------------------------------------------------------

/**
 * Ein Zug auf der Reifegrad-Achse. `advance` ist der Normalfall; die übrigen
 * vier sind die Zustände, die der Walkthrough beschreibt und die ein Datensatz
 * ohne sie nie zeigt.
 */
export type GateMove =
  /** Beantragt und abgenommen — das Epic rückt vor. */
  | { kind: "advance"; to: GateStep; requestedAt: Date; decidedAt: Date; comment?: string }
  /** Begründet abgelehnt: der Antrag ist entschieden, das Epic bleibt stehen. */
  | { kind: "rejected"; to: GateStep; requestedAt: Date; decidedAt: Date; reason: string }
  /** Der Antragsteller zieht seinen eigenen Antrag zurück. */
  | { kind: "withdrawn"; to: GateStep; requestedAt: Date; decidedAt: Date }
  /** Rückstufung mit Pflicht-Begründung — räumt die Stempel des Schritts ab. */
  | { kind: "revert"; to: GateStep; at: Date; reason: string }
  /**
   * Ein offener Antrag. Höchstens **einer** je Epic (partieller Unique-Index
   * `stage_gate_transitions_one_open`), und er muss der letzte Zug sein.
   * `decidedRoles` haben schon zugestimmt, der Rest steht aus.
   */
  | {
      kind: "open";
      to: GateStep;
      requestedAt: Date;
      decidedRoles?: readonly GateApproverRole[];
      decidedAt?: Date;
    };

/** Die fünf Business-Case-Parteien, soweit sie nicht aus dem Wertstrom kommen. */
export interface PartySeats {
  mgmt: string;
  /** `null` ⇒ dieser Antrag geht ohne Business Owner raus (Guardrail-4-Lücke). */
  businessOwner: string | null;
  irtOwner: string;
}

export interface GateHistoryInput {
  tenantId: string;
  epicId: string;
  /**
   * Erzeugt die Zeilen-Ids. Muss **UUIDs** liefern — die Id-Spalten sind
   * `@db.Uuid`, ein zusammengesetzter String wie `<uuid>:0` scheitert am
   * Insert. Die Seeds reichen hier ihr deterministisches `uid()` durch.
   */
  makeId: (suffix: string) => string;
  /** Wer die Anträge stellt — in der Regel der Epic Owner. */
  requestedBy: string;
  /** Audit-Spalte `createdBy` auf den Abnahme-Zeilen. */
  createdBy: string;
  ownerId: string | null;
  valueStreamId: string | null;
  valueStreamVmoId: string | null;
  valueStreamFinanceApproverId: string | null;
  /** Die gepflegten Regelzeilen; leer ⇒ es gilt der Code-Default. */
  rules: readonly GateApproverRuleRow[];
  parties: PartySeats;
  /** Practice `multiPartyApproval` — aus ihr folgt die Besetzung von L3.1. */
  multiPartyApproval?: boolean;
  /** Inhalte des Epics — aus ihnen zieht die Abnahme die Baselines. */
  benefitHypothesis: Prisma.InputJsonValue | null;
  businessCase: Prisma.InputJsonValue | null;
  /** Timeline-JSON des Epics; L4.2 spiegelt sein Ist-Datum hinein. */
  timeline: Prisma.InputJsonValue;
  childFeatureStats?: ChildFeatureStats;
  budgetAllocationSum?: number;
  moves: readonly GateMove[];
}

/** Eine Antragszeile, fertig für `createMany`. */
export interface GateTransitionRow {
  id: string;
  tenantId: string;
  initiativeId: string;
  fromGate: string;
  toGate: string;
  kind: string;
  status: string;
  quorum: string;
  requestedBy: string;
  requestedAt: Date;
  reason: string | null;
  /** Weggelassen bei Rückstufungen — der Service schreibt dort keinen Snapshot. */
  readiness?: Prisma.InputJsonValue;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

/** Eine Abnahme-Zeile, fertig für `createMany`. */
export interface GateApprovalRow {
  id: string;
  tenantId: string;
  transitionId: string;
  approverUserId: string;
  source: string;
  role: string | null;
  status: string;
  decidedAt: Date | null;
  comment: string | null;
  requestedAt: Date;
  createdBy: string;
}

export interface GateHistoryResult {
  /** Spalten-Patch für die Initiative-Zeile. */
  stamps: GateStamps & {
    baselineBenefitHypothesis?: Prisma.InputJsonValue;
    baselineBusinessCase?: Prisma.InputJsonValue;
    timeline?: Prisma.InputJsonValue;
    updatedBy?: string;
  };
  transitions: GateTransitionRow[];
  approvals: GateApprovalRow[];
  /** Der Schritt, auf dem das Epic am Ende steht — für Invarianten-Prüfungen. */
  finalStep: GateStep;
}

// ---------------------------------------------------------------------------
// Bequeme Wege
// ---------------------------------------------------------------------------

/** Die Schritte von L0 bis `target`, in der Reihenfolge, in der sie fallen. */
export function stepsUpTo(target: GateStep): GateStep[] {
  const out: GateStep[] = [];
  let step: GateStep | null = target;
  while (step != null && step !== "L0") {
    out.unshift(step);
    step = previousGate(step);
  }
  return out;
}

/**
 * Der glatte Weg: jeder Schritt bis `target` beantragt und abgenommen.
 * `decidedAt(step)` bestimmt das Tempo, `leadDays` den Abstand zum Antrag.
 */
export function straightPath(
  target: GateStep,
  decidedAt: (step: GateStep) => Date,
  leadDays = 4,
): GateMove[] {
  return stepsUpTo(target).map((to) => {
    const decided = decidedAt(to);
    return {
      kind: "advance" as const,
      to,
      requestedAt: addDays(decided, -leadDays),
      decidedAt: decided,
    };
  });
}

/** Tage auf ein Datum rechnen — lokal, damit das Modul ohne Seed-Kontext läuft. */
export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

// ---------------------------------------------------------------------------
// Die Faltung
// ---------------------------------------------------------------------------

function initialFacts(input: GateHistoryInput): EpicGateFacts {
  return {
    stageGate: "L0",
    ownerId: input.ownerId,
    hypothesisApprovedAt: null,
    hasHypothesisContent: input.benefitHypothesis != null,
    hasBusinessCaseContent: input.businessCase != null,
    businessCaseApprovedAt: null,
    budgetAllocationSum: input.budgetAllocationSum ?? 0,
    childFeatureStats: input.childFeatureStats ?? { total: 0, started: 0, completed: 0 },
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: null,
    implementationStartedAt: null,
    implementationCompletedAt: null,
    approvedAt: null,
    impactRecognizedAt: null,
    multiPartyApproval: input.multiPartyApproval ?? true,
  };
}

/** Die Stempel eines Zuges in die mitlaufenden Fakten übernehmen. */
function applyToFacts(facts: EpicGateFacts, stamps: GateStamps): EpicGateFacts {
  const next = { ...facts };
  if (stamps.stageGate !== undefined) next.stageGate = stamps.stageGate;
  if (stamps.selectedForDetailingAt !== undefined)
    next.selectedForDetailingAt = stamps.selectedForDetailingAt;
  if (stamps.hypothesisApprovedAt !== undefined)
    next.hypothesisApprovedAt = stamps.hypothesisApprovedAt;
  if (stamps.selectedForAnalyzingAt !== undefined)
    next.selectedForAnalyzingAt = stamps.selectedForAnalyzingAt;
  if (stamps.businessCaseApprovedAt !== undefined)
    next.businessCaseApprovedAt = stamps.businessCaseApprovedAt;
  if (stamps.implementationStartedAt !== undefined)
    next.implementationStartedAt = stamps.implementationStartedAt;
  if (stamps.implementationCompletedAt !== undefined)
    next.implementationCompletedAt = stamps.implementationCompletedAt;
  if (stamps.approvedAt !== undefined) next.approvedAt = stamps.approvedAt;
  if (stamps.impactRecognizedAt !== undefined) next.impactRecognizedAt = stamps.impactRecognizedAt;
  return next;
}

/**
 * Die Abnehmer eines Schritts, aufgelöst wie zur Laufzeit. An L3.1 reicht der
 * Aufrufer die drei Parteien nach, die keinen Wertstrom-Default haben — genau
 * das tut der Abnehmer-Picker am Antrag.
 */
function approversFor(input: GateHistoryInput, to: GateStep): ResolvedApprover[] {
  const policy = resolveGatePolicy(to, input.rules, input.valueStreamId, {
    multiPartyApproval: input.multiPartyApproval ?? true,
  });
  const ctx: ApproverContext = {
    valueStreamFinanceApproverId: input.valueStreamFinanceApproverId,
    valueStreamVmoId: input.valueStreamVmoId,
    epicOwnerId: input.ownerId,
  };
  const override: ApproverOverride[] | undefined =
    to === "L3.1" && (input.multiPartyApproval ?? true)
      ? [
          { userId: input.parties.mgmt, role: "epic.party.mgmt" },
          ...(input.parties.businessOwner
            ? [
                {
                  userId: input.parties.businessOwner,
                  role: "epic.party.business_owner" as GateApproverRole,
                },
              ]
            : []),
          { userId: input.parties.irtOwner, role: "epic.party.irt_owner" },
          ...(input.valueStreamFinanceApproverId
            ? [
                {
                  userId: input.valueStreamFinanceApproverId,
                  role: "epic.party.finance" as GateApproverRole,
                },
              ]
            : []),
          ...(input.valueStreamVmoId
            ? [
                {
                  userId: input.valueStreamVmoId,
                  role: "epic.party.lace_vmo" as GateApproverRole,
                },
              ]
            : []),
        ]
      : undefined;

  const resolved = expandApprovers(policy, ctx, override);
  // Ein Schritt ohne auflösbaren Abnehmer wäre ein Antrag, auf den niemand
  // antworten kann — `planGateRequest` lehnt das zur Laufzeit ab. Im Seed
  // greifen wir auf den Antragsteller zurück, statt eine tote Zeile zu bauen.
  return resolved.length > 0
    ? resolved
    : [{ userId: input.requestedBy, role: null, source: "manual" }];
}

function quorumFor(input: GateHistoryInput, to: GateStep): string {
  return resolveGatePolicy(to, input.rules, input.valueStreamId, {
    multiPartyApproval: input.multiPartyApproval ?? true,
  }).quorum;
}

/**
 * Baut die vollständige Historie eines Epics.
 *
 * Reihenfolge-Annahmen, die der Aufrufer einhalten muss (und die die Seeds
 * hinterher prüfen): die Züge stehen chronologisch, und ein `open`-Zug ist der
 * letzte — offen sein kann immer nur der jüngste Antrag.
 */
export function buildGateHistory(input: GateHistoryInput): GateHistoryResult {
  let facts = initialFacts(input);
  const stamps: GateHistoryResult["stamps"] = {};
  const transitions: GateTransitionRow[] = [];
  const approvals: GateApprovalRow[] = [];
  let timeline: Prisma.InputJsonValue = input.timeline;
  let n = 0;

  const merge = (patch: GateStamps): void => {
    Object.assign(stamps, patch);
    facts = applyToFacts(facts, patch);
  };

  for (const move of input.moves) {
    const from = currentGateStep(facts);
    const transitionId = input.makeId(String(n));
    n += 1;

    if (move.kind === "revert") {
      // Eine Rückstufung trägt keine Abnahmen: sie ist die Korrektur einer
      // Person, kein Antrag an mehrere. Die Begründung ist Pflicht.
      const patch = unwindStampsFor(from, move.to);
      transitions.push({
        id: transitionId,
        tenantId: input.tenantId,
        initiativeId: input.epicId,
        fromGate: from,
        toGate: move.to,
        kind: "revert",
        status: "approved",
        quorum: "all",
        requestedBy: input.requestedBy,
        requestedAt: move.at,
        reason: move.reason,
        resolvedAt: move.at,
        resolvedBy: input.requestedBy,
      });
      merge(patch);
      // Der Revert räumt auch das Timeline-Ist-Datum ab, wenn er die
      // L4.2-Bestätigung zurücknimmt — genau wie `applyGateStamps`.
      if (patch.implementationCompletedAt === null) {
        timeline = withImplementationActual(timeline, null) as unknown as Prisma.InputJsonValue;
      }
      continue;
    }

    const readiness = gateReadiness(facts, move.to).criteria;
    const resolved = approversFor(input, move.to);
    const quorum = quorumFor(input, move.to);

    const status =
      move.kind === "advance" ? "approved" : move.kind === "open" ? "pending" : move.kind;
    const resolvedAt = move.kind === "open" ? null : move.decidedAt;
    // Der Service stempelt den **letzten entscheidenden** Abnehmer.
    const decider = resolved[resolved.length - 1]!.userId;

    transitions.push({
      id: transitionId,
      tenantId: input.tenantId,
      initiativeId: input.epicId,
      fromGate: from,
      toGate: move.to,
      kind: "forward",
      status,
      quorum,
      requestedBy: input.requestedBy,
      requestedAt: move.requestedAt,
      reason:
        move.kind === "rejected"
          ? move.reason
          : move.kind === "advance"
            ? (move.comment ?? null)
            : null,
      readiness: readiness as unknown as Prisma.InputJsonValue,
      resolvedAt,
      resolvedBy: resolvedAt ? decider : null,
    });

    for (const [k, a] of resolved.entries()) {
      const decidedByThisOne =
        move.kind === "advance"
          ? true
          : move.kind === "open"
            ? (move.decidedRoles ?? []).includes(a.role as GateApproverRole)
            : // Bei Ablehnung entscheidet einer ablehnend, die übrigen bleiben offen;
              // bei Rückzug entscheidet niemand.
              move.kind === "rejected" && k === resolved.length - 1;
      const approvalStatus =
        move.kind === "rejected" && decidedByThisOne
          ? "rejected"
          : decidedByThisOne
            ? "approved"
            : "pending";
      const at =
        move.kind === "open"
          ? decidedByThisOne
            ? (move.decidedAt ?? move.requestedAt)
            : null
          : decidedByThisOne
            ? move.decidedAt
            : null;
      approvals.push({
        id: input.makeId(`${n - 1}-a${k}`),
        tenantId: input.tenantId,
        transitionId,
        approverUserId: a.userId,
        source: a.source,
        role: a.role,
        status: approvalStatus,
        decidedAt: at,
        comment:
          approvalStatus === "rejected"
            ? move.kind === "rejected"
              ? move.reason
              : null
            : approvalStatus === "approved"
              ? "Freigegeben."
              : null,
        requestedAt: move.requestedAt,
        createdBy: input.createdBy,
      });
    }

    if (move.kind !== "advance") continue;

    merge(stampsForAdvance(facts, move.to, decider, move.decidedAt, move.comment));

    // Die zwei Sonderfälle, die `applyGateStamps` zusätzlich schreibt.
    if (move.to === "L4.2") {
      timeline = withImplementationActual(
        timeline,
        isoDay(move.decidedAt),
      ) as unknown as Prisma.InputJsonValue;
    }
    if (move.to === "L1" && input.benefitHypothesis != null) {
      stamps.baselineBenefitHypothesis = input.benefitHypothesis;
    }
    if (move.to === "L3.1" && input.businessCase != null) {
      stamps.baselineBusinessCase = input.businessCase;
    }
  }

  stamps.timeline = timeline;
  stamps.updatedBy = input.createdBy;
  return { stamps, transitions, approvals, finalStep: currentGateStep(facts) };
}

// ---------------------------------------------------------------------------
// Approver-Regeln
// ---------------------------------------------------------------------------

/**
 * Die Tenant-Default-Regeln, auf **GateStep**-Namen.
 *
 * Der Lookup in `resolveGateApprovers` filtert `where: { toGate }` mit einem
 * GateStep und `resolveGatePolicy` vergleicht `r.toGate === toGate`. Eine Zeile
 * mit dem Haupt-Gate `"L3"` trifft deshalb weder `"L3.1"` noch `"L3.2"` und
 * fällt still auf den Code-Default zurück — was die Regeln wirkungslos macht.
 * Diese Liste hält die Namen deshalb exakt auf `GATE_STEPS`.
 */
export const GATE_STEP_RULES: { toGate: GateStep; approverRoles: GateApproverRole[] }[] = [
  { toGate: "L1", approverRoles: ["value_stream.vmo"] },
  { toGate: "L2", approverRoles: ["value_stream.vmo"] },
  {
    toGate: "L3.1",
    approverRoles: [
      "epic.party.mgmt",
      "epic.party.business_owner",
      "epic.party.finance",
      "epic.party.irt_owner",
      "epic.party.lace_vmo",
    ],
  },
  { toGate: "L3.2", approverRoles: ["value_stream.vmo", "value_stream.finance_approver"] },
  { toGate: "L4", approverRoles: ["value_stream.vmo"] },
  { toGate: "L4.2", approverRoles: ["value_stream.vmo"] },
  { toGate: "L5", approverRoles: ["value_stream.finance_approver"] },
];

/** Dieselben Regeln als Rows, wie der Adapter sie liest. */
export function gateRuleRows(valueStreamId: string | null = null): GateApproverRuleRow[] {
  return GATE_STEP_RULES.map((r) => ({
    valueStreamId,
    toGate: r.toGate,
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: r.approverRoles,
  }));
}

/** Der Reifegrad, den die Initiative-Spalte tragen muss. */
export function gateColumnFor(step: GateStep): StageGate {
  return gateOfStep(step);
}

// ---------------------------------------------------------------------------
// Selbstprüfung
// ---------------------------------------------------------------------------

/**
 * Prüft die Historie eines Epics gegen die Regeln, die der Service zur Laufzeit
 * erzwingt. Ein Seed, der hier scheitert, hätte einen Datensatz erzeugt, den die
 * App nie hätte produzieren können — und je nach Datenbank sogar einen, der am
 * partiellen Unique-Index `stage_gate_transitions_one_open` zerschellt.
 *
 * Wirft mit einem Text, der das Epic benennt; die Seeds rufen das vor dem
 * Schreiben auf.
 */
export function assertGateHistory(result: GateHistoryResult, label: string): void {
  const fail = (why: string): never => {
    throw new Error(`Seed-Invariante verletzt (${label}): ${why}`);
  };

  const open = result.transitions.filter((t) => t.status === "pending");
  if (open.length > 1) {
    fail(`${open.length} offene Anträge — der Unique-Index lässt nur einen zu.`);
  }
  if (open[0] && open[0] !== result.transitions[result.transitions.length - 1]) {
    fail("der offene Antrag ist nicht der jüngste.");
  }
  if (open[0] && open[0].fromGate !== result.finalStep) {
    fail(
      `der offene Antrag geht von ${open[0].fromGate} aus, das Epic steht aber auf ${result.finalStep} — er wäre nicht entscheidbar.`,
    );
  }

  for (let i = 1; i < result.transitions.length; i++) {
    const prev = result.transitions[i - 1]!;
    const cur = result.transitions[i]!;
    if (cur.requestedAt.getTime() < prev.requestedAt.getTime()) {
      fail(`die Anträge stehen nicht chronologisch (${i}).`);
    }
  }

  for (const t of result.transitions) {
    if (t.resolvedAt && t.resolvedAt.getTime() < t.requestedAt.getTime()) {
      fail(`ein Antrag wurde vor seiner Stellung entschieden (${t.fromGate}→${t.toGate}).`);
    }
    if (t.kind === "revert" && !t.reason) fail("eine Rückstufung ohne Begründung.");
  }

  const ids = new Set(result.transitions.map((t) => t.id));
  const seen = new Set<string>();
  for (const a of result.approvals) {
    if (!ids.has(a.transitionId)) fail(`eine Abnahme zeigt auf einen fremden Antrag.`);
    const key = `${a.transitionId}|${a.approverUserId}`;
    if (seen.has(key)) fail("dieselbe Person nimmt einen Antrag zweimal ab.");
    seen.add(key);
  }

  const expected = gateOfStep(result.finalStep);
  if (result.transitions.length > 0 && result.stamps.stageGate !== expected) {
    fail(`stageGate ist ${String(result.stamps.stageGate)}, erwartet ${expected}.`);
  }
  const completed = result.stamps.implementationCompletedAt;
  const actual = (result.stamps.timeline as { actuals?: Record<string, unknown> } | undefined)
    ?.actuals?.implementation;
  if ((completed != null) !== (actual != null)) {
    fail("L4.2-Stempel und Timeline-Ist-Datum stimmen nicht überein.");
  }
}
