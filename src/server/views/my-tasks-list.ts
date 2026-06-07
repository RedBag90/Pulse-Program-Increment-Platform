/**
 * My-Tasks page-model — wandelt die `MyTaskRow`s aus `listMyTasks` in
 * das Rich-Row-DTO für die Inbox-Shell um. Spiegelt das Idiom der
 * Epics-, Features- und Features-Overview-Modelle: jede Funnel-Slot
 * existiert (auch leer), Filter-Optionen werden auf die tatsächlich
 * vorkommenden IDs reduziert.
 */

import type { MyTaskRow, TaskLevel } from "@/server/services/my-tasks";

export const BUCKETS = ["open", "ready", "done"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const LEVELS = ["epic", "feature"] as const satisfies readonly TaskLevel[];

export interface MyTaskListRow {
  id: string;
  level: TaskLevel;
  title: string;
  href: string;
  bucket: Bucket;
  /** Anzeige-State: Epic = stageGate · approvalPhase; Feature = status. */
  state: {
    stageGate?: string;
    approvalPhase?: string | null;
    status?: string;
  };
  context: {
    valueStreamName: string | null;
    artName: string | null;
    parentEpicTitle: string | null;
    piName: string | null;
  };
  ids: {
    valueStreamId: string | null;
    artId: string | null;
    parentEpicId: string | null;
    piId: string | null;
  };
  updatedAtMs: number;
}

export interface ValueStreamOption {
  id: string;
  name: string;
}

export interface ArtOption {
  id: string;
  name: string;
}

export interface EpicOption {
  id: string;
  title: string;
}

export interface PiOption {
  id: string;
  name: string;
}

export interface MyTasksListModel {
  rows: MyTaskListRow[];
  funnelCounts: Record<Bucket, number>;
  /** Levels, die in `rows` mindestens einmal vorkommen — Reihenfolge wie in `LEVELS`. */
  levelOptions: TaskLevel[];
  valueStreamOptions: ValueStreamOption[];
  artOptions: ArtOption[];
  parentEpicOptions: EpicOption[];
  piOptions: PiOption[];
}

export function buildMyTasksListModel(input: { tasks: readonly MyTaskRow[] }): MyTasksListModel {
  const { tasks } = input;

  const rows: MyTaskListRow[] = tasks.map((t) => ({
    id: t.id,
    level: t.level,
    title: t.title,
    href: t.href,
    bucket: t.bucket,
    state: t.state,
    context: {
      valueStreamName: t.context.valueStreamName ?? null,
      artName: t.context.artName ?? null,
      parentEpicTitle: t.context.parentEpicTitle ?? null,
      piName: t.context.piName ?? null,
    },
    ids: t.ids,
    updatedAtMs: t.updatedAt.getTime(),
  }));

  const funnelCounts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  for (const r of rows) funnelCounts[r.bucket] += 1;

  const levelOptions: TaskLevel[] = LEVELS.filter((l) => rows.some((r) => r.level === l));

  // Filter-Optionen werden auf die IDs reduziert, die in `rows` vorkommen —
  // gleiches Idiom wie in den anderen Modellen.
  const vsMap = new Map<string, string>();
  const artMap = new Map<string, string>();
  const epicMap = new Map<string, string>();
  const piMap = new Map<string, string>();
  for (const r of rows) {
    if (r.ids.valueStreamId && r.context.valueStreamName) {
      vsMap.set(r.ids.valueStreamId, r.context.valueStreamName);
    }
    if (r.ids.artId && r.context.artName) {
      artMap.set(r.ids.artId, r.context.artName);
    }
    if (r.ids.parentEpicId && r.context.parentEpicTitle) {
      epicMap.set(r.ids.parentEpicId, r.context.parentEpicTitle);
    }
    if (r.ids.piId && r.context.piName) {
      piMap.set(r.ids.piId, r.context.piName);
    }
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de");
  const byTitle = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title, "de");

  const valueStreamOptions = [...vsMap].map(([id, name]) => ({ id, name })).sort(byName);
  const artOptions = [...artMap].map(([id, name]) => ({ id, name })).sort(byName);
  const parentEpicOptions = [...epicMap].map(([id, title]) => ({ id, title })).sort(byTitle);
  const piOptions = [...piMap].map(([id, name]) => ({ id, name })).sort(byName);

  return {
    rows,
    funnelCounts,
    levelOptions,
    valueStreamOptions,
    artOptions,
    parentEpicOptions,
    piOptions,
  };
}

// ---- Sort + Filter helpers (auch von der Shell genutzt) ----

export type SortKey = "updatedAt:desc" | "updatedAt:asc" | "bucket:priority";

const BUCKET_PRIORITY: Record<Bucket, number> = { open: 0, ready: 1, done: 2 };

export function compareBy(sort: SortKey): (a: MyTaskListRow, b: MyTaskListRow) => number {
  switch (sort) {
    case "updatedAt:asc":
      return (a, b) => a.updatedAtMs - b.updatedAtMs;
    case "bucket:priority":
      // primär bucket, sekundär updatedAt:desc innerhalb des Buckets.
      return (a, b) =>
        BUCKET_PRIORITY[a.bucket] - BUCKET_PRIORITY[b.bucket] || b.updatedAtMs - a.updatedAtMs;
    case "updatedAt:desc":
    default:
      return (a, b) => b.updatedAtMs - a.updatedAtMs;
  }
}
