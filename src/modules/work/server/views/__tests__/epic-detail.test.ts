import { describe, it, expect } from "vitest";
import {
  buildEpicDetailModel,
  type EpicDetailInputs,
} from "@/modules/work/server/views/epic-detail";

/** Ein Budget-Stand ohne Geld — die Fixtures prüfen `allocated`, nicht ihn. */
const noStanding = {
  state: "none" as const,
  currentAmount: 0,
  currentPeriod: null,
  totalAmount: 0,
  cycleCount: 0,
  span: null,
  startsAt: null,
  periods: [],
};

/** Was der Budget-Port ohne Zuteilung liefert. */
const noAllocation = {
  allocationState: null,
  fundable: { may: true, firstStep: "L2" },
};

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

function makeInputs(over: Partial<EpicDetailInputs> = {}): EpicDetailInputs {
  return {
    epic: makeEpic(),
    historyEvents: [],
    kpis: [],
    pis: [],
    dependencies: [],
    budget: null,
    breakdownPositions: new Map(),
    enabled: { drumbeat: true, budgeting: true, risks: false },
    multiPartyApproval: true,
    principalId: PRINCIPAL_ID,
    canEdit: true,
    canAssignOwner: false,
    gate: { disabled: true },
    canLinkDependency: false,
    canOverrideHorizon: false,
    showWsjf: true,
    canSetDelivery: false,
    canDeleteFeature: () => false,
    ...over,
  };
}

describe("buildEpicDetailModel — degradation matrix", () => {
  it("drumbeat ON + budgeting ON: both slices enabled with computed data", () => {
    const inputs = makeInputs({
      enabled: { drumbeat: true, budgeting: true, risks: false },
      budget: { allocatedSum: 500, allocatedByPeriod: {}, standing: noStanding, ...noAllocation },
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
    }
    expect(m.dependencies).toHaveLength(1);

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

  /**
   * **Die Kante überlebt ein fehlendes Drumbeat.**
   *
   * `dependency.` ist im September 2026 nach Work gewandert, der Leseweg blieb
   * an der Drumbeat-Scheibe hängen. Ein Mandant mit Work ohne Drumbeat legte
   * eine Abhängigkeit an, bekam die Bestätigung — und der nächste
   * `router.refresh()` lieferte `[]`: die optimistische Kante verschwand nach
   * gut einer Sekunde wieder. Geschrieben war sie; weggelesen wurde sie.
   *
   * Diese Zusicherung fehlte, und mit ihr wäre die Umstellung nicht
   * durchgegangen.
   */
  it("trägt die Abhängigkeiten auch ohne Drumbeat — die PIs bleiben leer", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        enabled: { drumbeat: false, budgeting: true, risks: false },
        pis: [],
        dependencies: [
          { id: "d1", fromId: "f1", toId: "f2", type: "blocks", from: null, to: null },
        ],
      }),
    );

    expect(m.drumbeat).toEqual({ disabled: true });
    expect(m.dependencies).toHaveLength(1);
  });

  it("budgeting OFF: slice is {disabled:true} and nextStep uses budgetAllocated=false", () => {
    // Der Hinweis auf L2 verzweigt an `budgetAllocated`: alloziert → der
    // Schlüssel mit dem „Budget ist alloziert."-Satz; sonst der schlichte.
    const off = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ stageGate: "L2" }),
        enabled: { drumbeat: true, budgeting: false, risks: false },
        budget: null,
      }),
    );
    expect(off.budgeting).toEqual({ disabled: true });
    expect(off.nextStep?.hintKey).toBe("work.nextStep.investmentHintPlain");

    const on = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ stageGate: "L2" }),
        enabled: { drumbeat: true, budgeting: true, risks: false },
        budget: {
          allocatedSum: 1000,
          allocatedByPeriod: {},
          standing: noStanding,
          ...noAllocation,
        },
      }),
    );
    expect(on.nextStep?.hintKey).toBe("work.nextStep.investmentHintBudgeting");
  });

  it("exposes lifecycleSteps derived from the stage gate (L0 → Erstsichtung offen)", () => {
    // Acht Abschnitte statt neun gemischter Schritte: ein frisch angelegtes Epic
    // wartet im Funnel auf die Erstsichtung — davor ist nichts erreicht.
    const m = buildEpicDetailModel(makeInputs());
    expect(m.lifecycleSteps).toHaveLength(8);
    expect(m.lifecycleSteps[0]!.key).toBe("detailing");
    expect(m.lifecycleSteps[0]!.status).toBe("current");
    expect(m.lifecycleSteps[0]!.milestone.labelKey).toBe("work.lifecycle.detailing.milestoneLabel");
    expect(m.lifecycleSteps.slice(1).every((s) => s.status === "upcoming")).toBe(true);
    expect(m.lifecycleSteps.every((s) => s.descriptionKey.length > 0)).toBe(true);
  });

  it("lifecycleSteps stay coherent with the stage gate (L2 → Budget zuteilen)", () => {
    const m = buildEpicDetailModel(makeInputs({ epic: makeEpic({ stageGate: "L2" }) }));
    const currentStep = m.lifecycleSteps.find((s) => s.status === "current");
    expect(currentStep?.key).toBe("backlog");
    expect(currentStep?.labelKey).toBe("work.lifecycle.backlog.label");
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
      makeInputs({
        budget: { allocatedSum: 0, allocatedByPeriod: {}, standing: noStanding, ...noAllocation },
      }),
    );
    expect(m.budgeting.disabled).toBe(false);
    if (!m.budgeting.disabled) expect(m.budgeting.allocated).toBe(false);
  });

  /**
   * Der Budget-Port beantwortet drei Fragen, die Work nicht selbst beantworten
   * darf (ADR-0013): den Zeitraum-Aufschluss, den Zustand der Zuteilung und ab
   * welchem Schritt dieses Epic überhaupt Geld halten darf. Alle drei müssen
   * unverändert im Modell ankommen — sonst hat das Panel nichts zu zeigen.
   */
  it("reicht Zeiträume, Zustand und Förderfähigkeit des Ports ins Modell", () => {
    const periods = [
      {
        cycleKey: "2026-H1",
        amount: 400,
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-06-30T00:00:00.000Z"),
        applies: true,
      },
      { cycleKey: "2026-H2", amount: 600, start: null, end: null, applies: false },
    ];
    const m = buildEpicDetailModel(
      makeInputs({
        budget: {
          allocatedSum: 1000,
          allocatedByPeriod: { "2026-H1": 400, "2026-H2": 600 },
          standing: { ...noStanding, state: "applies", currentAmount: 400, periods },
          allocationState: { key: "committed", label: "Gebunden" },
          fundable: { may: true, firstStep: "L2" },
        },
      }),
    );
    expect(m.budgeting.disabled).toBe(false);
    if (m.budgeting.disabled) return;
    expect(m.budgeting.standing.periods).toEqual(periods);
    expect(m.budgeting.allocationState).toEqual({ key: "committed", label: "Gebunden" });
    expect(m.budgeting.fundable).toEqual({ may: true, firstStep: "L2" });
  });

  it("ohne Budgeting bleibt der Slice abgeschaltet — kein leerer Stand", () => {
    const m = buildEpicDetailModel(
      makeInputs({ enabled: { drumbeat: false, budgeting: false, risks: false }, budget: null }),
    );
    expect(m.budgeting).toEqual({ disabled: true });
  });
});

describe("buildEpicDetailModel — revision visibility algebra", () => {
  // Die Algebra selbst deckt `epic-revision-visibility.test.ts` ab. Hier zaehlt
  // nur, dass der Model-Bau sie richtig verdrahtet — insbesondere, dass der
  // offene Reifegrad-Antrag und die Abnehmerschaft des Betrachters ankommen.
  it("ohne laufenden Antrag zeigt der Owner seinen eigenen Hypothesen-Diff", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ baselineBenefitHypothesis: { measuresHypothesis: "prev" } }),
        canEdit: true,
      }),
    );
    expect(m.showHypoReviewDiff).toBe(false);
    expect(m.showHypoOwnerEdit).toBe(true);
  });

  it("ohne Baselines ist jede Gegenüberstellung aus", () => {
    const m = buildEpicDetailModel(makeInputs({ epic: makeEpic({ stageGate: "L3" }) }));
    expect(m.showHypoReviewDiff).toBe(false);
    expect(m.showBcReviewDiff).toBe(false);
    expect(m.showHypoOwnerEdit).toBe(false);
    expect(m.showBcOwnerEdit).toBe(false);
  });

  it("auf L2 mit BC-Baseline sieht der Bearbeiter die Gegenüberstellung", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({
          stageGate: "L2",
          baselineBusinessCase: { costSlices: [{ amount: 10 }] },
        }),
        canEdit: true,
      }),
    );
    expect(m.showBcReviewDiff).toBe(false);
    expect(m.showBcOwnerEdit).toBe(true);
  });
});

describe("buildEpicDetailModel — lock reasons", () => {
  it("ab L1 ist die Hypothese gesperrt — die Abnahme war die Freigabe", () => {
    const m = buildEpicDetailModel(
      makeInputs({ epic: makeEpic({ stageGate: "L2" }), canEdit: true }),
    );
    expect(m.hypoLockReason).toBe(
      "Die Hypothese ist mit dem Schritt auf L1 freigegeben und damit gesperrt. Für " +
        "Änderungen das Epic auf L0 zurückstufen.",
    );
    // Der Business Case ist auf L2 offen.
    expect(m.bcLockReason).toBeUndefined();
  });

  it("auf L0 ist der Business Case gesperrt, die Hypothese nicht", () => {
    const m = buildEpicDetailModel(makeInputs({ epic: makeEpic(), canEdit: true }));
    expect(m.hypoLockReason).toBeUndefined();
    expect(m.bcLockReason).toContain("L1");
  });

  it("both lock reasons are undefined when canEdit is false", () => {
    const m = buildEpicDetailModel(
      makeInputs({ epic: makeEpic({ stageGate: "L2" }), canEdit: false }),
    );
    expect(m.hypoLockReason).toBeUndefined();
    expect(m.bcLockReason).toBeUndefined();
  });
});

describe("buildEpicDetailModel — activity merge", () => {
  it("sortiert die Audit-Ereignisse neueste zuerst und zieht den Kommentar heraus", () => {
    // Die Freigabe-Kommentare kommen seit dem Umbau ueber denselben
    // Audit-Strom: jede Gate-Entscheidung schreibt sie als `changes.comment`.
    const m = buildEpicDetailModel(
      makeInputs({
        historyEvents: [
          auditEvent({
            id: "old",
            action: "initiative.updated",
            occurredAt: "2026-01-01T00:00:00.000Z",
          }),
          auditEvent({
            id: "decided",
            action: "initiative.stage_gate.advanced",
            occurredAt: "2026-02-01T00:00:00.000Z",
            comment: "Sieht gut aus",
          }),
          auditEvent({
            id: "new",
            action: "initiative.updated",
            occurredAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      }),
    );

    expect(m.activityEvents.map((e) => e.id)).toEqual(["new", "decided", "old"]);
    expect(m.activityEvents.find((e) => e.id === "decided")!.comment).toBe("Sieht gut aus");
  });
});

/**
 * **Der Loesch-Knopf wird je Zeile entschieden, nicht je Tabelle.**
 *
 * Bis September 2026 hing er hier an `canEdit` — und das ist auf dieser Flaeche
 * `epic.update`. Ausser dem Portfolio Manager traegt keine Rolle `epic.update`
 * **und** `feature.delete`: ein Epic Owner sah „Loeschen" an jedem Feature
 * seines Epics und wurde nach dem Bestaetigen abgewiesen.
 *
 * Ein einzelnes Flag waere jetzt wieder falsch, nur unauffaelliger: die Kinder
 * eines Epics koennen in **verschiedenen** ARTs liegen, und das Recht ist
 * `art`-scoped.
 */
describe("Loeschrecht je Breakdown-Zeile", () => {
  const kind = (id: string, artId: string) =>
    ({
      id,
      title: id,
      status: "approved",
      description: null,
      artId,
      art: { id: artId, name: artId },
      piId: null,
      pi: null,
      createdAt: new Date("2026-01-01"),
      acceptanceCriteria: [],
      wsjfBusinessValue: null,
      wsjfTimeCriticality: null,
      wsjfRiskReduction: null,
      wsjfJobSize: null,
      wsjfComputed: null,
      featureType: null,
    }) as unknown as EpicDetailInputs["epic"]["children"][number];

  it("traegt das Recht des jeweiligen ARTs, nicht eines fuer alle", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ children: [kind("f-eigen", "art-1"), kind("f-fremd", "art-2")] }),
        canEdit: true,
        canDeleteFeature: (artId) => artId === "art-1",
      }),
    );
    expect(m.breakdownFeatures.map((f) => [f.id, f.canDelete])).toEqual([
      ["f-eigen", true],
      ["f-fremd", false],
    ]);
  });

  it("haengt nicht an canEdit — das ist hier `epic.update`", () => {
    const m = buildEpicDetailModel(
      makeInputs({
        epic: makeEpic({ children: [kind("f1", "art-1")] }),
        canEdit: true,
        canDeleteFeature: () => false,
      }),
    );
    expect(m.breakdownFeatures[0]!.canDelete).toBe(false);
  });
});
