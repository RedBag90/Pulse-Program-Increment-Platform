import { describe, it, expect } from "vitest";
import { gateOfStep, type GateStep } from "@/modules/work/domain/stage-gate";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import {
  planGateRequest,
  decideGateTransitionOutcome,
  planGateRevert,
  stampsForAdvance,
  unwindStampsFor,
  type GateApprovalRow,
} from "@/modules/work/domain/gate-transition";
import type { EpicGateFacts } from "@/modules/work/domain/gate-readiness";
import type { GatePolicy, ResolvedApprover } from "@/modules/work/domain/gate-policy";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const ACTOR = "actor-1";
const CONFIRMED = new Date("2026-05-01T00:00:00.000Z");
const VMO = "user-vmo";
const FINANCE = "user-finance";

/**
 * Fakten für einen **Schritt**: „L4.2" ist kein Haupt-Gate — das Epic steht dann
 * auf L4 mit gesetztem Bestätigungs-Stempel (genau wie in der DB).
 */
function facts(step: GateStep, over: Partial<EpicGateFacts> = {}): EpicGateFacts {
  return {
    stageGate: gateOfStep(step),
    ownerId: "owner-1",
    hypothesisApprovedAt: null,
    hasHypothesisContent: false,
    hasBusinessCaseContent: false,
    businessCaseApprovedAt: null,
    budgetAllocationSum: 0,
    childFeatureStats: { total: 0, started: 0, completed: 0 },
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: null,
    implementationStartedAt: null,
    implementationCompletedAt: null,
    approvedAt: null,
    impactRecognizedAt: null,
    multiPartyApproval: true,
    // Die zweiten Schritte materialisieren sich in ihrem jeweiligen Stempel.
    ...(step === "L3.2" ? { approvedAt: CONFIRMED } : {}),
    ...(step === "L4.2" ? { implementationCompletedAt: CONFIRMED } : {}),
    ...over,
  };
}

function policy(toGate: GateStep, over: Partial<GatePolicy> = {}): GatePolicy {
  return {
    toGate,
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: [],
    source: "value_stream",
    ...over,
  };
}

const APPROVERS: ResolvedApprover[] = [
  { userId: VMO, role: "value_stream.vmo", source: "value_stream" },
  { userId: FINANCE, role: "value_stream.finance_approver", source: "value_stream" },
];

/** Ein Epic, das für `to` inhaltlich reif ist. */
function readyFor(to: GateStep): EpicGateFacts {
  switch (to) {
    case "L1":
      // Reif fuer L1 heisst: die Hypothese ist ausgearbeitet. Freigegeben wird
      // sie mit der Abnahme dieses Schritts.
      return facts("L0", { hasHypothesisContent: true });
    case "L2":
      return facts("L1", { hypothesisApprovedAt: EARLIER });
    case "L3.1":
      // Reif fuer L3.1 heisst: der Business Case ist ausgearbeitet. Freigegeben
      // wird er mit der Abnahme dieses Schritts — das Geld folgt in L3.2.
      return facts("L2", { hasBusinessCaseContent: true });
    case "L3.2":
      return facts("L3.1", { businessCaseApprovedAt: EARLIER, budgetAllocationSum: 500_000 });
    case "L4":
      return facts("L3.2", { businessCaseApprovedAt: EARLIER, budgetAllocationSum: 500_000 });
    case "L4.2":
      return facts("L4", { childFeatureStats: { total: 2, started: 2, completed: 2 } });
    case "L5":
      // Reif für den Impact-Antrag heißt: die Umsetzung ist abgenommen (L4.2).
      return facts("L4.2", { childFeatureStats: { total: 2, started: 2, completed: 2 } });
    default:
      return facts("L0");
  }
}

function request(to: GateStep, over: Partial<Parameters<typeof planGateRequest>[0]> = {}) {
  return planGateRequest({
    facts: readyFor(to),
    to,
    policy: policy(to),
    approvers: APPROVERS,
    actorId: ACTOR,
    hasOpenRequest: false,
    now: NOW,
    ...over,
  });
}

// ---------------------------------------------------------------------------

describe("planGateRequest — strukturelle Guards", () => {
  it("legt für jeden der sieben Vorwärts-Schritte einen Antrag an", () => {
    for (const to of ["L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"] as const) {
      const r = request(to);
      expect(isOk(r), `${to} sollte beantragbar sein`).toBe(true);
      if (!isOk(r)) continue;
      expect(r.value.to).toBe(to);
      expect(r.value.immediate).toBe(false);
      expect(r.value.approvers).toHaveLength(2);
    }
  });

  it("ein übersprungenes Gate ist eine Hierarchieverletzung", () => {
    const r = request("L3.1", { facts: facts("L1", { hypothesisApprovedAt: EARLIER }) });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("hierarchy_violation");
  });

  it("rückwärts ist kein Antrag, sondern eine Korrektur — mit sprechendem Grund", () => {
    const r = request("L2", { facts: facts("L3.1") });
    expect(isErr(r)).toBe(true);
    if (!isErr(r) || r.error.kind !== "hierarchy_violation") return;
    expect(r.error.detail).toContain("Korrektur");
  });

  it("das eigene Gate erneut zu beantragen ist ein Konflikt", () => {
    const r = request("L3.1", { facts: facts("L3.1") });
    expect(isErr(r) && r.error.kind).toBe("conflict");
  });

  it("von L5 führt kein Antrag weiter", () => {
    const r = request("L5", { facts: facts("L5") });
    expect(isErr(r)).toBe(true);
  });

  it("ein bereits offener Antrag blockiert einen zweiten", () => {
    const r = request("L3.1", { hasOpenRequest: true });
    expect(isErr(r) && r.error.kind).toBe("conflict");
    if (!isErr(r) || r.error.kind !== "conflict") return;
    expect(r.error.reason).toContain("bereits ein Reifegrad-Wechsel beantragt");
  });
});

describe("planGateRequest — Reife", () => {
  it("ein unerfülltes blockierendes Kriterium verhindert den Antrag und nennt es", () => {
    const r = request("L3.1", { facts: facts("L2", { budgetAllocationSum: 500_000 }) });
    expect(isErr(r)).toBe(true);
    if (!isErr(r) || r.error.kind !== "forbidden") return;
    expect(r.error.reason).toContain("Business Case ist ausgearbeitet");
  });

  it("ein unerfülltes BERATENDES Kriterium verhindert nichts", () => {
    // L4 ohne gestartetes Feature: der Antrag ist der bewusste Start.
    const r = request("L4", { facts: facts("L3.2") });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.readiness.criteria.some((c) => !c.satisfied)).toBe(true);
    expect(r.value.readiness.ready).toBe(true);
  });

  it("die Kriterien werden als Snapshot mitgegeben", () => {
    const r = request("L3.1");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.readiness.criteria.map((c) => c.key)).toEqual([
      "business_case_drafted",
      "owner_nominated",
    ]);
    expect(r.value.readiness.criteria.every((c) => c.satisfied)).toBe(true);
  });
});

describe("planGateRequest — Besetzung", () => {
  it("required=false rückt sofort vor und stempelt in einem Zug", () => {
    const r = request("L3.2", { policy: policy("L3.2", { required: false }), approvers: [] });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.immediate).toBe(true);
    expect(r.value.approvers).toEqual([]);
    // L3.2 lebt im Haupt-Gate L3 — die Spalte bleibt stehen.
    expect(r.value.stamps?.stageGate).toBe("L3");
    // L3.2 ist die Investitionsentscheidung — der Antragsteller unterschreibt.
    expect(r.value.stamps?.approvedBy).toBe(ACTOR);
    expect(r.value.stamps?.approvedAt).toEqual(NOW);
  });

  it("abnahmepflichtig ohne auflösbare Abnehmer scheitert laut statt still", () => {
    // Sonst entstünde ein Antrag, auf den niemand antworten kann.
    const r = request("L3.1", { approvers: [] });
    expect(isErr(r)).toBe(true);
    if (!isErr(r) || r.error.kind !== "conflict") return;
    expect(r.error.reason).toContain("keine abnehmende Person");
  });

  it("ein abnahmepflichtiger Antrag stempelt noch nichts", () => {
    const r = request("L3.1");
    expect(isOk(r) && r.value.stamps).toBeNull();
  });
});

// ---------------------------------------------------------------------------

function rows(...statuses: Array<[string, GateApprovalRow["status"]]>): GateApprovalRow[] {
  return statuses.map(([approverUserId, status]) => ({ approverUserId, status }));
}

function decide(over: Partial<Parameters<typeof decideGateTransitionOutcome>[0]> = {}) {
  return decideGateTransitionOutcome({
    facts: readyFor("L3.1"),
    to: "L3.1",
    quorum: "all",
    rows: rows([VMO, "pending"], [FINANCE, "pending"]),
    decision: "approve",
    deciderId: VMO,
    now: NOW,
    ...over,
  });
}

describe("decideGateTransitionOutcome — Quorum 'all' (einstimmig)", () => {
  it("die vorletzte Zustimmung hält den Antrag offen", () => {
    const o = decide();
    expect(o.kind).toBe("still_pending");
    if (o.kind !== "still_pending") return;
    expect(o.remaining).toBe(1);
  });

  it("die letzte Zustimmung schiebt das Gate", () => {
    const o = decide({ rows: rows([VMO, "approved"], [FINANCE, "pending"]), deciderId: FINANCE });
    expect(o.kind).toBe("advance");
    if (o.kind !== "advance") return;
    expect(o.from).toBe("L2");
    expect(o.to).toBe("L3.1");
    expect(o.stamps.stageGate).toBe("L3");
  });

  it("eine einzige Ablehnung stoppt den Antrag sofort", () => {
    expect(decide({ decision: "reject" }).kind).toBe("rejected");
  });

  it("eine schon vorhandene Ablehnung dominiert eine spätere Zustimmung", () => {
    const o = decide({ rows: rows([VMO, "rejected"], [FINANCE, "pending"]), deciderId: FINANCE });
    expect(o.kind).toBe("rejected");
  });
});

describe("decideGateTransitionOutcome — Quorum 'any'", () => {
  it("die erste Zustimmung genügt", () => {
    const o = decide({ quorum: "any" });
    expect(o.kind).toBe("advance");
  });

  it("auch bei 'any' stoppt eine Ablehnung — ein Einwand wird nicht überstimmt", () => {
    const o = decide({ quorum: "any", decision: "reject" });
    expect(o.kind).toBe("rejected");
  });
});

describe("decideGateTransitionOutcome — Stempel tragen den Entscheidenden", () => {
  it("L3.1→L3.2: approvedBy ist der entscheidende Abnehmer, nicht der Antragsteller", () => {
    const o = decide({
      facts: readyFor("L3.2"),
      to: "L3.2",
      rows: rows([VMO, "approved"], [FINANCE, "pending"]),
      deciderId: FINANCE,
    });
    if (o.kind !== "advance") throw new Error("erwartet: advance");
    expect(o.stamps.approvedBy).toBe(FINANCE);
    expect(o.stamps.approvedAt).toEqual(NOW);
    // Die Spalte bleibt auf dem Haupt-Gate stehen.
    expect(o.stamps.stageGate).toBe("L3");
  });

  it("L4→L5: impactRecognizedBy + Kommentar kommen aus der Abnahme", () => {
    const o = decideGateTransitionOutcome({
      facts: readyFor("L5"),
      to: "L5",
      quorum: "all",
      rows: rows([FINANCE, "pending"]),
      decision: "approve",
      deciderId: FINANCE,
      comment: "Nutzen in Q2 realisiert",
      now: NOW,
    });
    if (o.kind !== "advance") throw new Error("erwartet: advance");
    expect(o.stamps.impactRecognizedBy).toBe(FINANCE);
    expect(o.stamps.impactRecognizedAt).toEqual(NOW);
    expect(o.stamps.impactComment).toBe("Nutzen in Q2 realisiert");
  });

  it("set-once: ein bereits gesetzter Stempel wird nicht überschrieben", () => {
    const o = decideGateTransitionOutcome({
      facts: { ...readyFor("L3.2"), approvedAt: EARLIER },
      to: "L3.2",
      quorum: "all",
      rows: rows([VMO, "pending"]),
      decision: "approve",
      deciderId: VMO,
      now: NOW,
    });
    if (o.kind !== "advance") throw new Error("erwartet: advance");
    expect(o.stamps.approvedAt).toBeUndefined();
    expect(o.stamps.stageGate).toBe("L3");
  });
});

// ---------------------------------------------------------------------------

describe("planGateRevert", () => {
  it("verlangt eine Begründung", () => {
    const r = planGateRevert({ facts: facts("L3.1"), to: "L2", reason: "   ", now: NOW });
    expect(isErr(r) && r.error.kind).toBe("conflict");
  });

  it("geht nur rückwärts", () => {
    const r = planGateRevert({ facts: facts("L2"), to: "L3.1", reason: "x", now: NOW });
    expect(isErr(r) && r.error.kind).toBe("conflict");
  });

  it("geht nur einen Schritt", () => {
    const r = planGateRevert({ facts: facts("L3.1"), to: "L1", reason: "x", now: NOW });
    expect(isErr(r) && r.error.kind).toBe("hierarchy_violation");
  });

  it("räumt je Paar genau die Stempel des verlassenen Schritts ab", () => {
    const cases: Array<[GateStep, GateStep, keyof ReturnType<typeof unwindStampsFor>]> = [
      ["L1", "L0", "selectedForDetailingAt"],
      ["L2", "L1", "selectedForAnalyzingAt"],
      // Die Investitionsentscheidung haengt an L3.2, nicht am Eintritt in L3.
      ["L3.2", "L3.1", "approvedAt"],
      ["L4", "L3.2", "implementationStartedAt"],
      // L4.2 ist ein eigener Schritt: zurück heißt „Bestätigung zurücknehmen",
      // das Haupt-Gate bleibt dabei L4.
      ["L4.2", "L4", "implementationCompletedAt"],
      ["L5", "L4.2", "impactRecognizedAt"],
    ];
    for (const [from, to, cleared] of cases) {
      const r = planGateRevert({ facts: facts(from), to, reason: "Korrektur", now: NOW });
      expect(isOk(r), `${from}→${to}`).toBe(true);
      if (!isOk(r)) continue;
      expect(r.value.stamps.stageGate).toBe(gateOfStep(to));
      expect(r.value.stamps[cleared], `${from}→${to} räumt ${String(cleared)}`).toBeNull();
    }
  });

  it("L3.2→L3.1 räumt die vollständige Freigabe-Signatur ab, nicht nur den Zeitstempel", () => {
    const s = unwindStampsFor("L3.2", "L3.1");
    expect(s).toMatchObject({
      // Das Haupt-Gate bleibt L3 — zurückgenommen wird die Investitionsentscheidung.
      stageGate: "L3",
      approvedBy: null,
      approvedAt: null,
      approvalComment: null,
    });
  });

  it("L3.1→L2 räumt die Business-Case-Freigabe ab", () => {
    expect(unwindStampsFor("L3.1", "L2")).toEqual({
      stageGate: "L2",
      businessCaseApprovedAt: null,
    });
  });
});

describe("L2 → L3.1 trägt die Business-Case-Freigabe", () => {
  it("stempelt den Business Case und markiert fürs Steering", () => {
    const s = stampsForAdvance(facts("L2", { hasBusinessCaseContent: true }), "L3.1", VMO, NOW);
    expect(s.businessCaseApprovedAt).toEqual(NOW);
    expect(s.needsSteeringAttention).toBe(true);
    expect(s.stageGate).toBe("L3");
  });

  it("set-once: ein vorhandener Stempel wird nicht überschrieben", () => {
    const s = stampsForAdvance(
      facts("L2", { hasBusinessCaseContent: true, businessCaseApprovedAt: EARLIER }),
      "L3.1",
      VMO,
      NOW,
    );
    expect(s.businessCaseApprovedAt).toBeUndefined();
    expect(s.needsSteeringAttention).toBe(true);
  });
});

describe("L0 → L1 trägt die Hypothesen-Freigabe", () => {
  it("stempelt Hypothese und Selektion und schiebt die Phase", () => {
    const s = stampsForAdvance(readyFor("L1"), "L1", VMO, NOW);
    expect(s.hypothesisApprovedAt).toEqual(NOW);
    expect(s.selectedForDetailingAt).toEqual(NOW);
    expect(s.needsSteeringAttention).toBe(true);
    expect(s.stageGate).toBe("L1");
  });

  it("set-once: ein vorhandener Stempel wird nicht überschrieben", () => {
    const s = stampsForAdvance(
      { ...readyFor("L1"), hypothesisApprovedAt: EARLIER, selectedForDetailingAt: EARLIER },
      "L1",
      VMO,
      NOW,
    );
    expect(s.hypothesisApprovedAt).toBeUndefined();
    expect(s.selectedForDetailingAt).toBeUndefined();
    // Das Steering-Flag folgt der Abnahme, nicht dem Stempel.
    expect(s.needsSteeringAttention).toBe(true);
  });

  it("der Revert L1 → L0 räumt die Freigabe ab", () => {
    const s = unwindStampsFor("L1", "L0");
    expect(s.hypothesisApprovedAt).toBeNull();
    expect(s.selectedForDetailingAt).toBeNull();
    expect(s.stageGate).toBe("L0");
  });
});

describe("Rundlauf: vorrücken → zurückstufen → erneut vorrücken", () => {
  it("stempelt beim zweiten Mal wieder — der set-once-Defekt ist behoben", () => {
    // 1. Vorrücken nach L3.2: approvedAt wird gesetzt.
    const first = stampsForAdvance(readyFor("L3.2"), "L3.2", VMO, EARLIER);
    expect(first.approvedAt).toEqual(EARLIER);

    // 2. Zurückstufen: die Signatur wird abgeräumt.
    const back = unwindStampsFor("L3.2", "L3.1");
    expect(back.approvedAt).toBeNull();

    // 3. Erneut vorrücken auf einem Epic, dessen Stempel geleert wurde.
    //    Früher blieb approvedAt hier für immer auf dem alten Wert stehen.
    const again = stampsForAdvance({ ...readyFor("L3.2"), approvedAt: null }, "L3.2", FINANCE, NOW);
    expect(again.approvedAt).toEqual(NOW);
    expect(again.approvedBy).toBe(FINANCE);
  });
});
