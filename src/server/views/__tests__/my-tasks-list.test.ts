import { describe, it, expect } from "vitest";
import { buildMyTasksListModel, compareBy, type MyTaskListRow } from "@/server/views/my-tasks-list";
import type { MyTaskRow } from "@/server/services/my-tasks";

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

describe("buildMyTasksListModel", () => {
  it("emits all three funnel slots even when empty", () => {
    const m = buildMyTasksListModel({
      tasks: [task({ bucket: "open" }), task({ id: "t2", bucket: "open" })],
    });
    expect(m.funnelCounts).toEqual({ open: 2, ready: 0, done: 0 });
  });

  it("preserves the bucket classification from the service", () => {
    const m = buildMyTasksListModel({
      tasks: [
        task({ id: "a", bucket: "open" }),
        task({ id: "b", bucket: "ready" }),
        task({ id: "c", bucket: "done" }),
      ],
    });
    expect(m.rows.map((r) => r.bucket)).toEqual(["open", "ready", "done"]);
  });

  it("reduces filter options to only those that appear in rows", () => {
    const m = buildMyTasksListModel({
      tasks: [
        task({
          id: "a",
          ids: {
            valueStreamId: "vs-banking",
            artId: "art-banking",
            parentEpicId: "epic-1",
            piId: "pi-q2",
          },
          context: {
            valueStreamName: "Banking",
            artName: "Banking Core",
            parentEpicTitle: "Open Banking",
            piName: "2026-Q2",
          },
        }),
      ],
    });
    expect(m.valueStreamOptions).toEqual([{ id: "vs-banking", name: "Banking" }]);
    expect(m.artOptions).toEqual([{ id: "art-banking", name: "Banking Core" }]);
    expect(m.parentEpicOptions).toEqual([{ id: "epic-1", title: "Open Banking" }]);
    expect(m.piOptions).toEqual([{ id: "pi-q2", name: "2026-Q2" }]);
  });

  it("emits levelOptions exactly for the levels present", () => {
    expect(buildMyTasksListModel({ tasks: [task({ level: "epic" })] }).levelOptions).toEqual([
      "epic",
    ]);
    expect(
      buildMyTasksListModel({
        tasks: [task({ id: "a", level: "epic" }), task({ id: "b", level: "feature" })],
      }).levelOptions,
    ).toEqual(["epic", "feature"]);
    expect(buildMyTasksListModel({ tasks: [] }).levelOptions).toEqual([]);
  });

  it("drops VS/ART/PI options for tasks that don't carry the corresponding id", () => {
    const m = buildMyTasksListModel({
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

  it("flat-copies the title labels onto rows so the row can render without service access", () => {
    const m = buildMyTasksListModel({
      tasks: [task({ context: { ...task().context, valueStreamName: "Risk", piName: null } })],
    });
    expect(m.rows[0]!.context.valueStreamName).toBe("Risk");
    expect(m.rows[0]!.context.piName).toBeNull();
  });
});

describe("compareBy", () => {
  const row = (over: Partial<MyTaskListRow>): MyTaskListRow => ({
    id: "r",
    level: "feature",
    title: "T",
    href: "/x",
    bucket: "open",
    state: {},
    context: {
      valueStreamName: null,
      artName: null,
      parentEpicTitle: null,
      piName: null,
    },
    ids: { valueStreamId: null, artId: null, parentEpicId: null, piId: null },
    updatedAtMs: 0,
    ...over,
  });

  it("default updatedAt:desc orders newest first", () => {
    const arr = [row({ id: "old", updatedAtMs: 100 }), row({ id: "new", updatedAtMs: 200 })].sort(
      compareBy("updatedAt:desc"),
    );
    expect(arr.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("bucket:priority orders open → ready → done", () => {
    const arr = [
      row({ id: "d", bucket: "done" }),
      row({ id: "o", bucket: "open" }),
      row({ id: "r", bucket: "ready" }),
    ].sort(compareBy("bucket:priority"));
    expect(arr.map((r) => r.id)).toEqual(["o", "r", "d"]);
  });

  it("bucket:priority falls back to updatedAt:desc within a bucket", () => {
    const arr = [
      row({ id: "old", bucket: "open", updatedAtMs: 100 }),
      row({ id: "new", bucket: "open", updatedAtMs: 200 }),
    ].sort(compareBy("bucket:priority"));
    expect(arr.map((r) => r.id)).toEqual(["new", "old"]);
  });
});
