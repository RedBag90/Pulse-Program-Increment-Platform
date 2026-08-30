import { describe, it, expect } from "vitest";
import {
  buildEpicDetailModel,
  type EpicDetailInputs,
} from "@/modules/work/server/views/epic-detail";

/**
 * Builder tests at the Epic-detail page-model seam. Fixtures are in-memory (no
 * Prisma, no DB). The builder never authorizes — the capability booleans and
 * `principalId` are inputs, so the visibility algebra is exercised directly.
 */

const PRINCIPAL_ID = "user-1";

type EpicOverrides = Partial<{
  id: string;
  title: string;
  valueStreamId: string;
  stageGate: string;
  approvalPhase: string | null;
  approvalRevision: number | null;
  benefitHypothesis: unknown;
  businessCase: unknown;
  timeline: unknown;
  baselineBusinessCase: unknown;
  baselineBenefitHypothesis: unknown;
  businessCaseApprovedAt: Date | null;
  impactRecognizedAt: Date | null;
  children: unknown[];
}>;

function makeEpic(over: EpicOverrides = {}): EpicDetailInputs["epic"] {
  return {
    id: over.id ?? "epic-1",
    title: over.title ?? "Epic",
    valueStreamId: over.valueStreamId ?? "vs-1",
    stageGate: over.stageGate ?? "L0",
    approvalPhase: over.approvalPhase === undefined ? "draft" : over.approvalPhase,
    approvalRevision: over.approvalRevision === undefined ? 1 : over.approvalRevision,
    benefitHypothesis: over.benefitHypothesis ?? null,
    businessCase: over.businessCase ?? null,
    timeline: over.timeline ?? null,
    baselineBusinessCase: over.baselineBusinessCase ?? null,
    baselineBenefitHypothesis: over.baselineBenefitHypothesis ?? null,
    businessCaseApprovedAt: over.businessCaseApprovedAt ?? null,
    impactRecognizedAt: over.impactRecognizedAt ?? null,
    children: over.children ?? [],
    valueStream: null,
  } as unknown as EpicDetailInputs["epic"];
}

function auditEvent(p: {
  id: string;
  action: string;
  occurredAt: string;
  actorId?: string;
  comment?: string;
}): EpicDetailInputs["historyEvents"][number] {
  return {
    id: p.id,
    action: p.action,
    occurredAt: new Date(p.occurredAt),
    actorId: p.actorId ?? null,
    changes: p.comment ? { comment: { before: null, after: p.comment } } : null,
  } as unknown as EpicDetailInputs["historyEvents"][number];
}

function approvalRow(p: {
  id: string;
  revision?: number;
  kind?: "party" | "section";
  party?: string | null;
  section?: string | null;
  status?: string;
  approverUserId?: string | null;
  comment?: string | null;
  decidedAt?: Date | null;
}): EpicDetailInputs["approvals"][number] {
  return {
    id: p.id,
    revision: p.revision ?? 1,
    kind: p.kind ?? "party",
    party: p.party ?? null,
    section: p.section ?? null,
    status: p.status ?? "pending",
    approverUserId: p.approverUserId ?? null,
    comment: p.comment ?? null,
    decidedAt: p.decidedAt ?? null,
  } as unknown as EpicDetailInputs["approvals"][number];
}

function makeInputs(over: Partial<EpicDetailInputs> = {}): EpicDetailInputs {
  return {
    epic: makeEpic(),
    historyEvents: [],
    kpis: [],
    approvals: [],
    pis: [],
    dependencies: [],
    budget: null,
    breakdownPositions: new Map(),
    enabled: { drumbeat: true, budgeting: true, risks: false },
    multiPartyApproval: true,
    principalId: PRINCIPAL_ID,
    canEdit: true,
    canDecideHypothesis: false,
    canSubmitHypothesis: false,
    canSubmitBusinessCase: false,
    canAssignOwner: false,
    gate: { disabled: true },
    canLinkDependency: false,
    showWsjf: true,
    canSetDelivery: false,
    ...over,
  };
}

describe("buildEpicDetailModel — degradation matrix", () => {
  it("drumbeat ON + budgeting ON: both slices enabled with computed data", () => {
    const inputs = makeInputs({
      enabled: { drumbeat: true, budgeting: true, risks: false },
      budget: { allocatedSum: 500, allocatedByPeriod: {} },
      pis: [
        { id: "pi-2", name: "PI 2", artId: "art-1", startDate: "2026-07-01" },
        { id: "pi-1", name: "PI 1", artId: "art-1", startDate: "2026-01-01" },
        { id: "pi-3", name: "PI 3", artId: "art-2", startDate: "2026-03-01" },
      ],
      dependencies: [{ id: "d1", fromId: "f1", toId: "f2", type: "blocks", from: null, to: null }],
    });
    const m = buildEpicDetailModel(inputs);

    expect(m.drumbeat.disabled).toBe(false);
    if (!m.drumbeat.disabled) {
      expect(m.drumbeat.pisByArt["art-1"]?.map((p) => p.id)).toEqual(["pi-2", "pi-1"]);
      expect(m.drumbeat.pisByArt["art-2"]?.map((p) => p.id)).toEqual(["pi-3"]);
      // breakdownPis is sorted by startDate ascending, deduped by id.
      expect(m.drumbeat.breakdownPis.map((p) => p.id)).toEqual(["pi-1", "pi-3", "pi-2"]);
      expect(m.drumbeat.dependencies).toHaveLength(1);
    }

    expect(m.budgeting.disabled).toBe(false);
    if (!m.budgeting.disabled) expect(m.budgeting.allocated).toBe(true);
  });

  it("drumbeat OFF: slice is {disabled:true} even though port data is empty", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        enabled: { drumbeat: false, budgeting: true, risks: false },
        pis: [],
        dependencies: [],
      }),
    );
    expect(m.drumbeat).toEqual({ disabled: true });
    expect(m.budgeting.disabled).toBe(false);
  });

  it("budgeting OFF: slice is {disabled:true} and nextStep uses budgetAllocated=false", () => {
    // L3 nextStep hint branches on budgetAllocated: allocated → prefixed with
    // "Budget ist alloziert."; not allocated → the plain "Lege …" hint.
    const off = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ stageGate: "L3" }),
        enabled: { drumbeat: true, budgeting: false, risks: false },
        budget: null,
      }),
    );
    expect(off.budgeting).toEqual({ disabled: true });
    expect(off.nextStep?.hint.startsWith("Budget ist alloziert.")).toBe(false);

    const on = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ stageGate: "L3" }),
        enabled: { drumbeat: true, budgeting: true, risks: false },
        budget: { allocatedSum: 1000, allocatedByPeriod: {} },
      }),
    );
    expect(on.nextStep?.hint.startsWith("Budget ist alloziert.")).toBe(true);
  });

  it("exposes lifecycleSteps derived from the stage gate (L0 → Hypothese current)", () => {
    const m = buildEpicDetailModel(makeInputs());
    expect(m.lifecycleSteps).toHaveLength(9);
    expect(m.lifecycleSteps[0]!.status).toBe("done"); // funnel
    expect(m.lifecycleSteps[1]!.status).toBe("done"); // detailing (folded marker)
    expect(m.lifecycleSteps[2]!.key).toBe("hypothesis");
    expect(m.lifecycleSteps[2]!.status).toBe("current");
    expect(m.lifecycleSteps.every((s) => s.description.length > 0)).toBe(true);
  });

  it("lifecycleSteps stay coherent with the stage gate (L3 → Backlog current)", () => {
    const m = buildEpicDetailModel(makeInputs({ epic: makeEpic({ stageGate: "L3" }) }));
    const currentStep = m.lifecycleSteps.find((s) => s.status === "current");
    expect(currentStep?.key).toBe("backlog");
  });

  it("risks slice is an entitlement gate (composed in the route)", () => {
    const on = buildEpicDetailModel(
      makeInputs({ enabled: { drumbeat: true, budgeting: true, risks: true } }),
    );
    expect(on.risks).toEqual({ disabled: false });
    const off = buildEpicDetailModel(
      makeInputs({ enabled: { drumbeat: true, budgeting: true, risks: false } }),
    );
    expect(off.risks).toEqual({ disabled: true });
  });

  it("budgeting ON with allocatedSum 0 → allocated=false", () => {
    const m = buildEpicDetailModel(
      makeInputs({ budget: { allocatedSum: 0, allocatedByPeriod: {} } }),
    );
    expect(m.budgeting.disabled).toBe(false);
    if (!m.budgeting.disabled) expect(m.budgeting.allocated).toBe(false);
  });
});

describe("buildEpicDetailModel — revision visibility algebra", () => {
  it("showHypoReviewDiff true when baseline + hypothesis_review + canDecideHypothesis", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({
          approvalPhase: "hypothesis_review",
          baselineBenefitHypothesis: { measuresHypothesis: "prev" },
        }),
        canDecideHypothesis: true,
      }),
    );
    expect(m.showHypoReviewDiff).toBe(true);
    expect(m.showHypoOwnerEdit).toBe(false);
  });

  it("showBcReviewDiff true when baseline + stakeholder_review + an open approval for the viewer", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({
          approvalPhase: "stakeholder_review",
          baselineBusinessCase: { costSlices: [{ amount: 10 }] },
        }),
        approvals: [approvalRow({ id: "a1", status: "pending", approverUserId: PRINCIPAL_ID })],
      }),
    );
    expect(m.viewerHasOpenApproval).toBe(true);
    expect(m.showBcReviewDiff).toBe(true);
    expect(m.showBcOwnerEdit).toBe(false);
  });

  it("showHypoOwnerEdit true when baseline + owner revision active + not a review diff", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({
          approvalPhase: "draft",
          baselineBenefitHypothesis: { measuresHypothesis: "prev" },
        }),
        canEdit: true,
      }),
    );
    expect(m.ownerRevisionActive).toBe(true);
    expect(m.showHypoReviewDiff).toBe(false);
    expect(m.showHypoOwnerEdit).toBe(true);
  });

  it("showBcOwnerEdit true when baseline + owner revision active + not a review diff", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({
          approvalPhase: "business_case",
          baselineBusinessCase: { costSlices: [{ amount: 10 }] },
        }),
        canEdit: true,
      }),
    );
    // No open approval for the viewer → showBcReviewDiff false → owner edit shows.
    expect(m.showBcReviewDiff).toBe(false);
    expect(m.showBcOwnerEdit).toBe(true);
  });

  it("plain view: no baselines → every side-by-side flag is false", () => {
    const m = buildEpicDetailModel(makeInputs({ epic: makeEpic({ approvalPhase: "approved" }) }));
    expect(m.showHypoReviewDiff).toBe(false);
    expect(m.showBcReviewDiff).toBe(false);
    expect(m.showHypoOwnerEdit).toBe(false);
    expect(m.showBcOwnerEdit).toBe(false);
    // approved → owner revision is not active.
    expect(m.ownerRevisionActive).toBe(false);
  });
});

describe("buildEpicDetailModel — lock reasons", () => {
  it("hypothesis_review locks both artefacts (canEdit=true)", () => {
    const m = buildEpicDetailModel(
      makeInputs({ epic: makeEpic({ approvalPhase: "hypothesis_review" }), canEdit: true }),
    );
    expect(m.hypoLockReason).toBe(
      "Die Benefit-Hypothese ist zur QS beim Portfolio Manager eingereicht und währenddessen gesperrt.",
    );
    expect(m.bcLockReason).toBe(
      "Der Business Case wird bearbeitbar, sobald der Portfolio Manager die Hypothese freigibt.",
    );
  });

  it("draft locks the Business Case but not the Hypothesis", () => {
    const m = buildEpicDetailModel(
      makeInputs({ epic: makeEpic({ approvalPhase: "draft" }), canEdit: true }),
    );
    expect(m.hypoLockReason).toBeUndefined();
    expect(m.bcLockReason).toBe(
      "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
    );
  });

  it("both lock reasons are undefined when canEdit is false", () => {
    const m = buildEpicDetailModel(
      makeInputs({ epic: makeEpic({ approvalPhase: "hypothesis_review" }), canEdit: false }),
    );
    expect(m.hypoLockReason).toBeUndefined();
    expect(m.bcLockReason).toBeUndefined();
  });
});

describe("buildEpicDetailModel — activity merge", () => {
  it("merges audit events + one approval comment newest-first with the right action label", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        historyEvents: [
          auditEvent({
            id: "old",
            action: "initiative.updated",
            occurredAt: "2026-01-01T00:00:00.000Z",
          }),
          auditEvent({
            id: "new",
            action: "epic.hypothesis.approved",
            occurredAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
        approvals: [
          approvalRow({
            id: "ap",
            party: "finance",
            status: "approved",
            comment: "Sieht gut aus",
            decidedAt: new Date("2026-02-01T00:00:00.000Z"),
            approverUserId: "user-9",
          }),
        ],
      }),
    );

    // Sorted newest-first: new (03) → approval (02) → old (01).
    expect(m.activityEvents.map((e) => e.id)).toEqual(["new", "approval-ap", "old"]);
    const approvalItem = m.activityEvents.find((e) => e.id === "approval-ap")!;
    expect(approvalItem.action).toBe("epic.approval.granted");
    expect(approvalItem.detail).toBe("Finance");
    expect(approvalItem.comment).toBe("Sieht gut aus");
  });

  it("a rejected approval maps to epic.approval.rejected", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        approvals: [
          approvalRow({
            id: "rej",
            party: "mgmt",
            status: "rejected",
            comment: "Bitte nacharbeiten",
            decidedAt: new Date("2026-02-01T00:00:00.000Z"),
          }),
        ],
      }),
    );
    const item = m.activityEvents.find((e) => e.id === "approval-rej")!;
    expect(item.action).toBe("epic.approval.rejected");
    expect(item.detail).toBe("MGMT");
  });
});
