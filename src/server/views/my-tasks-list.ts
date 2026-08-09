/**
 * My-Tasks page-model — kombiniert die per-Level-Sicht (Epic / Feature)
 * mit den Bucket-Aktionen (open / ready / done).
 *
 * Folgt dem Reuse-vor-Reimplement-Prinzip aus dem Plan: Die eigentlichen
 * Row-DTOs werden mit `buildEpicsListModel` und `buildFeaturesListModel`
 * gebaut — also denselben Funktionen, die `/portfolio/epics` und
 * `/art/[artId]/features` benutzen. Dieses Modul reicht die fertigen
 * Row-Arrays durch, baut die Bucket-Funnel-Counts und die Filter-
 * Optionen aus den Service-Rows, und liefert eine Bucket-Lookup-Map
 * (id → Bucket), damit der Client-Shell-Filter einen einheitlichen
 * Bucket-Filter über beide Row-Shapes legen kann.
 */

import type { MyTaskRow, TaskLevel } from "@/server/services/my-tasks";
import type { EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";
import type { FeatureListRow } from "@/server/views/features-list";

export const BUCKETS = ["open", "ready", "done"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const LEVELS = ["epic", "feature"] as const satisfies readonly TaskLevel[];

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
  /** Voll-rich Epic-Rows aus `buildEpicsListModel`. */
  epicRows: EpicListRow[];
  /** Voll-rich Feature-Rows aus `buildFeaturesListModel`. */
  featureRows: FeatureListRow[];
  /** id → bucket — für den Cross-Shape-Bucket-Filter im Shell. */
  bucketById: Map<string, Bucket>;
  funnelCounts: Record<Bucket, number>;
  levelOptions: TaskLevel[];
  valueStreamOptions: ValueStreamOption[];
  artOptions: ArtOption[];
  parentEpicOptions: EpicOption[];
  piOptions: PiOption[];
  /** Zeigt der EpicSection den Stage-Chevron + Action-Menü? */
  stageGatesEnabled: boolean;
  canEditEpic: boolean;
  canAdvanceEpic: boolean;
  canEditFeature: boolean;
}

export function buildMyTasksListModel(input: {
  tasks: readonly MyTaskRow[];
  epicRows: readonly EpicListRow[];
  featureRows: readonly FeatureListRow[];
  stageGatesEnabled: boolean;
  canEditEpic: boolean;
  canAdvanceEpic: boolean;
  canEditFeature: boolean;
}): MyTasksListModel {
  const {
    tasks,
    epicRows,
    featureRows,
    stageGatesEnabled,
    canEditEpic,
    canAdvanceEpic,
    canEditFeature,
  } = input;

  const bucketById = new Map<string, Bucket>(tasks.map((t) => [t.id, t.bucket]));

  const funnelCounts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  for (const t of tasks) funnelCounts[t.bucket] += 1;

  const levelOptions: TaskLevel[] = LEVELS.filter((l) => tasks.some((t) => t.level === l));

  // Filter-Optionen aus den Service-Rows: Labels + IDs liegen dort beieinander.
  const vsMap = new Map<string, string>();
  const artMap = new Map<string, string>();
  const epicMap = new Map<string, string>();
  const piMap = new Map<string, string>();
  for (const t of tasks) {
    if (t.ids.valueStreamId && t.context.valueStreamName) {
      vsMap.set(t.ids.valueStreamId, t.context.valueStreamName);
    }
    if (t.ids.artId && t.context.artName) {
      artMap.set(t.ids.artId, t.context.artName);
    }
    if (t.ids.parentEpicId && t.context.parentEpicTitle) {
      epicMap.set(t.ids.parentEpicId, t.context.parentEpicTitle);
    }
    if (t.ids.piId && t.context.piName) {
      piMap.set(t.ids.piId, t.context.piName);
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
    epicRows: [...epicRows],
    featureRows: [...featureRows],
    bucketById,
    funnelCounts,
    levelOptions,
    valueStreamOptions,
    artOptions,
    parentEpicOptions,
    piOptions,
    stageGatesEnabled,
    canEditEpic,
    canAdvanceEpic,
    canEditFeature,
  };
}
