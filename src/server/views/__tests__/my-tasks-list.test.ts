import { describe, it, expect } from "vitest";
import { buildMyTasksListModel } from "@/server/views/my-tasks-list";
import type { MyTaskRow } from "@/server/services/my-tasks";
import type { EpicListRow } from "@/server/views/portfolio-epics-list";
import type { FeatureListRow } from "@/server/views/features-list";

const task = (over: Partial<MyTaskRow> = {}): MyTaskRow => ({
  id: "t1",
  level: "feature",
  title: "F1",
  href: "/feature/t1",
  bucket: "open",
  state: { status: "approved" },
  context: {
    valueStreamName: "Banking",
    artName: "Banking Core",
    parentEpicTitle: "Open Banking",
    piName: "2026-Q2",
  },
  ids: {
    valueStreamId: "vs-banking",
    artId: "art-banking",
    parentEpicId: "epic-1",
    piId: "pi-q2",
  },
  updatedAt: new Date("2026-06-01T00:00:00Z"),
  ...over,
});

const epicRow = (over: Partial<EpicListRow> = {}): EpicListRow =>
  ({
    id: "e1",
    title: "Open Banking",
    stageGate: "L4",
    status: "in_progress",
    approvalPhase: "approved",
    valueStream: { id: "vs-banking", name: "Banking" },
    ownerId: null,
    ownerLabel: null,
    needsSteeringAttention: false,
    stagedForBudgeting: false,
    economics: { implementationCost: null, oneTimeBenefit: null, recurringBenefitYear: null },
    kpiProgress: null,
    kpiTier: null,
    kpiCount: 0,
    pendingApprovalsCount: 0,
    childFeatureCount: 0,
    plannedStartAt: null,
    plannedEndAt: null,
    createdAtMs: 0,
    ...over,
  }) as EpicListRow;

const featureRow = (over: Partial<FeatureListRow> = {}): FeatureListRow =>
  ({
    id: "f1",
    title: "F1",
    status: "approved",
    epic: { id: "epic-1", title: "Open Banking" },
    artId: "art-banking",
    pi: { id: "pi-q2", name: "2026-Q2" },
    wsjfComputed: null,
    wsjfTier: "none",
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    wsjfJobSize: null,
    acceptanceCriteriaCount: 0,
    isBlocked: false,
    createdAtMs: 0,
    ...over,
  }) as FeatureListRow;

const baseInput = {
  tasks: [task()],
  epicRows: [],
  featureRows: [featureRow()],
  stageGatesEnabled: true,
  canEditEpic: true,
  canAdvanceEpic: true,
  canEditFeature: true,
};

describe("buildMyTasksListModel", () => {
  it("emits all three funnel slots even when empty", () => {
    const m = buildMyTasksListModel({
      ...baseInput,
      tasks: [task({ bucket: "open" }), task({ id: "t2", bucket: "open" })],
    });
    expect(m.funnelCounts).toEqual({ open: 2, ready: 0, done: 0 });
  });

  it("builds bucketById from tasks", () => {
    const m = buildMyTasksListModel({
      ...baseInput,
      tasks: [
        task({ id: "a", bucket: "open" }),
        task({ id: "b", bucket: "ready" }),
        task({ id: "c", bucket: "done" }),
      ],
    });
    expect(m.bucketById.get("a")).toBe("open");
    expect(m.bucketById.get("b")).toBe("ready");
    expect(m.bucketById.get("c")).toBe("done");
  });

  it("passes epicRows and featureRows through verbatim", () => {
    const e = epicRow({ id: "e1" });
    const f = featureRow({ id: "f1" });
    const m = buildMyTasksListModel({
      ...baseInput,
      epicRows: [e],
      featureRows: [f],
    });
    expect(m.epicRows).toEqual([e]);
    expect(m.featureRows).toEqual([f]);
  });

  it("reduces filter options to only those that appear in rows", () => {
    const m = buildMyTasksListModel({ ...baseInput, tasks: [task()] });
    expect(m.valueStreamOptions).toEqual([{ id: "vs-banking", name: "Banking" }]);
    expect(m.artOptions).toEqual([{ id: "art-banking", name: "Banking Core" }]);
    expect(m.parentEpicOptions).toEqual([{ id: "epic-1", title: "Open Banking" }]);
    expect(m.piOptions).toEqual([{ id: "pi-q2", name: "2026-Q2" }]);
  });

  it("emits levelOptions for exactly the levels present in tasks", () => {
    expect(
      buildMyTasksListModel({ ...baseInput, tasks: [task({ level: "epic" })] }).levelOptions,
    ).toEqual(["epic"]);
    expect(
      buildMyTasksListModel({
        ...baseInput,
        tasks: [task({ id: "a", level: "epic" }), task({ id: "b", level: "feature" })],
      }).levelOptions,
    ).toEqual(["epic", "feature"]);
    expect(buildMyTasksListModel({ ...baseInput, tasks: [] }).levelOptions).toEqual([]);
  });

  it("drops VS/ART/PI options for tasks that don't carry the corresponding id", () => {
    const m = buildMyTasksListModel({
      ...baseInput,
      tasks: [
        task({
          ids: { valueStreamId: null, artId: null, parentEpicId: null, piId: null },
          context: {
            valueStreamName: null,
            artName: null,
            parentEpicTitle: null,
            piName: null,
          },
        }),
      ],
    });
    expect(m.valueStreamOptions).toEqual([]);
    expect(m.artOptions).toEqual([]);
    expect(m.parentEpicOptions).toEqual([]);
    expect(m.piOptions).toEqual([]);
  });

  it("threads capability + practice flags through to the model", () => {
    const m = buildMyTasksListModel({
      ...baseInput,
      stageGatesEnabled: false,
      canEditEpic: false,
      canAdvanceEpic: false,
      canEditFeature: false,
    });
    expect(m.stageGatesEnabled).toBe(false);
    expect(m.canEditEpic).toBe(false);
    expect(m.canAdvanceEpic).toBe(false);
    expect(m.canEditFeature).toBe(false);
  });
});
