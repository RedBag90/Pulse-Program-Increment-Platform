"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MyTasksFunnelBar } from "@/features/my-tasks/components/my-tasks-funnel-bar";
import { MyTasksFilterBar } from "@/features/my-tasks/components/my-tasks-filter-bar";
import { MyTasksListTable } from "@/features/my-tasks/components/my-tasks-list-table";
import {
  BUCKETS,
  LEVELS,
  compareBy,
  type Bucket,
  type MyTaskListRow,
  type MyTasksListModel,
  type SortKey,
} from "@/server/views/my-tasks-list";
import type { TaskLevel } from "@/server/services/my-tasks";

interface Props {
  model: MyTasksListModel;
}

const SORT_KEYS: SortKey[] = ["updatedAt:desc", "updatedAt:asc", "bucket:priority"];

function parseBucket(raw: string | null): Bucket | null {
  if (!raw) return null;
  return (BUCKETS as readonly string[]).includes(raw) ? (raw as Bucket) : null;
}
function parseLevel(raw: string | null): TaskLevel | null {
  if (!raw) return null;
  return (LEVELS as readonly string[]).includes(raw) ? (raw as TaskLevel) : null;
}
function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "updatedAt:desc";
}
function parseGroup(raw: string | null): "flat" | "bucket" {
  return raw === "bucket" ? "bucket" : "flat";
}
function parseDensity(raw: string | null): "comfortable" | "compact" {
  return raw === "compact" ? "compact" : "comfortable";
}

/**
 * Shell der My-Tasks Inbox — owns URL-State (`bucket`, `level`, `vs`,
 * `art`, `epic`, `pi`, `q`, `sort`, `group`, `density`), computed
 * filtered rows via `useMemo`, rendert Funnel + Filter + Tabelle.
 */
export function MyTasksListShell({ model }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bucket = parseBucket(searchParams.get("bucket"));
  const level = parseLevel(searchParams.get("level"));
  const valueStreamId = searchParams.get("vs");
  const artId = searchParams.get("art");
  const epicId = searchParams.get("epic");
  const piId = searchParams.get("pi");
  const query = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));
  const group = parseGroup(searchParams.get("group"));
  const density = parseDensity(searchParams.get("density"));

  const pushParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onBucketChange = useCallback(
    (next: Bucket | null) => pushParam({ bucket: next }),
    [pushParam],
  );
  const onLevelChange = useCallback(
    (next: TaskLevel | null) => pushParam({ level: next }),
    [pushParam],
  );
  const onValueStreamChange = useCallback(
    (next: string | null) => pushParam({ vs: next, art: null }),
    [pushParam],
  );
  const onArtChange = useCallback((next: string | null) => pushParam({ art: next }), [pushParam]);
  const onEpicChange = useCallback((next: string | null) => pushParam({ epic: next }), [pushParam]);
  const onPiChange = useCallback((next: string | null) => pushParam({ pi: next }), [pushParam]);
  const onQueryChange = useCallback((next: string) => pushParam({ q: next || null }), [pushParam]);
  const onSortChange = useCallback(
    (next: SortKey) => pushParam({ sort: next === "updatedAt:desc" ? null : next }),
    [pushParam],
  );
  const onGroupChange = useCallback(
    (next: "flat" | "bucket") => pushParam({ group: next === "flat" ? null : next }),
    [pushParam],
  );
  const onDensityChange = useCallback(
    (next: "comfortable" | "compact") =>
      pushParam({ density: next === "comfortable" ? null : next }),
    [pushParam],
  );

  const filtered = useMemo<MyTaskListRow[]>(() => {
    const q = query.trim().toLowerCase();
    const arr = model.rows.filter((r) => {
      if (bucket != null && r.bucket !== bucket) return false;
      if (level != null && r.level !== level) return false;
      if (valueStreamId && r.ids.valueStreamId !== valueStreamId) return false;
      if (artId && r.ids.artId !== artId) return false;
      if (epicId && r.ids.parentEpicId !== epicId) return false;
      if (piId === "backlog" && r.ids.piId != null) return false;
      if (piId && piId !== "backlog" && r.ids.piId !== piId) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if ((r.context.parentEpicTitle ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
    return arr.slice().sort(compareBy(sort));
  }, [model.rows, bucket, level, valueStreamId, artId, epicId, piId, query, sort]);

  return (
    <main className="space-y-4 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Meine Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alles, wofür ich Owner oder Assignee bin — Epics und Features.
        </p>
      </header>

      <MyTasksFunnelBar counts={model.funnelCounts} active={bucket} onChange={onBucketChange} />

      <MyTasksFilterBar
        query={query}
        level={level}
        valueStreamId={valueStreamId}
        artId={artId}
        epicId={epicId}
        piId={piId}
        sort={sort}
        group={group}
        density={density}
        options={{
          levelOptions: model.levelOptions,
          valueStreamOptions: model.valueStreamOptions,
          artOptions: model.artOptions,
          parentEpicOptions: model.parentEpicOptions,
          piOptions: model.piOptions,
        }}
        onQueryChange={onQueryChange}
        onLevelChange={onLevelChange}
        onValueStreamChange={onValueStreamChange}
        onArtChange={onArtChange}
        onEpicChange={onEpicChange}
        onPiChange={onPiChange}
        onSortChange={onSortChange}
        onGroupChange={onGroupChange}
        onDensityChange={onDensityChange}
      />

      <MyTasksListTable rows={filtered} group={group} compact={density === "compact"} />

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {model.rows.length} Tasks im Zugriff.
      </p>
    </main>
  );
}
