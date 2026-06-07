"use client";

import { useEffect, useState } from "react";
import type { MyTasksListModel, SortKey } from "@/server/views/my-tasks-list";
import type { TaskLevel } from "@/server/services/my-tasks";

interface Props {
  query: string;
  level: TaskLevel | null;
  valueStreamId: string | null;
  artId: string | null;
  epicId: string | null;
  piId: string | null;
  sort: SortKey;
  group: "flat" | "bucket";
  density: "comfortable" | "compact";
  options: Pick<
    MyTasksListModel,
    "levelOptions" | "valueStreamOptions" | "artOptions" | "parentEpicOptions" | "piOptions"
  >;
  onQueryChange: (next: string) => void;
  onLevelChange: (next: TaskLevel | null) => void;
  onValueStreamChange: (next: string | null) => void;
  onArtChange: (next: string | null) => void;
  onEpicChange: (next: string | null) => void;
  onPiChange: (next: string | null) => void;
  onSortChange: (next: SortKey) => void;
  onGroupChange: (next: "flat" | "bucket") => void;
  onDensityChange: (next: "comfortable" | "compact") => void;
}

const LEVEL_LABEL: Record<TaskLevel, string> = { epic: "Epic", feature: "Feature" };

/**
 * Filter-Bar im selben Stil wie die Features-/Epics-Filterbars.
 * Suche ist 200ms debounced; die Selects schreiben direkt durch.
 */
export function MyTasksFilterBar(props: Props) {
  const [localQuery, setLocalQuery] = useState(props.query);

  // Sync, wenn der Param von außen geändert wird (z.B. Funnel-Klick).
  useEffect(() => setLocalQuery(props.query), [props.query]);
  // 200ms debounce → onQueryChange. Stable callback aus dem Shell (useCallback).
  const onQueryChange = props.onQueryChange;
  const externalQuery = props.query;
  useEffect(() => {
    if (localQuery === externalQuery) return;
    const t = setTimeout(() => onQueryChange(localQuery), 200);
    return () => clearTimeout(t);
  }, [localQuery, externalQuery, onQueryChange]);

  return (
    <div className="grid gap-2 md:grid-cols-[1fr_repeat(5,auto)_auto_auto_auto]">
      <input
        type="search"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Suche Titel · Parent-Epic …"
        className="rounded-md border border-input bg-card px-3 py-1.5 text-sm"
      />
      <select
        value={props.level ?? ""}
        onChange={(e) =>
          props.onLevelChange(e.target.value === "" ? null : (e.target.value as TaskLevel))
        }
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle Levels</option>
        {props.options.levelOptions.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
      <select
        value={props.valueStreamId ?? ""}
        onChange={(e) => props.onValueStreamChange(e.target.value || null)}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle Wertströme</option>
        {props.options.valueStreamOptions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <select
        value={props.artId ?? ""}
        onChange={(e) => props.onArtChange(e.target.value || null)}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle ARTs</option>
        {props.options.artOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        value={props.epicId ?? ""}
        onChange={(e) => props.onEpicChange(e.target.value || null)}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle Parent-Epics</option>
        {props.options.parentEpicOptions.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
      <select
        value={props.piId ?? ""}
        onChange={(e) => props.onPiChange(e.target.value || null)}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle PIs</option>
        <option value="backlog">— Backlog</option>
        {props.options.piOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={props.sort}
        onChange={(e) => props.onSortChange(e.target.value as SortKey)}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="updatedAt:desc">Neueste zuerst</option>
        <option value="updatedAt:asc">Älteste zuerst</option>
        <option value="bucket:priority">Bucket-Reihenfolge</option>
      </select>
      <select
        value={props.group}
        onChange={(e) => props.onGroupChange(e.target.value as "flat" | "bucket")}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="flat">Flach</option>
        <option value="bucket">Nach Bucket</option>
      </select>
      <select
        value={props.density}
        onChange={(e) => props.onDensityChange(e.target.value as "comfortable" | "compact")}
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="comfortable">Bequem</option>
        <option value="compact">Kompakt</option>
      </select>
    </div>
  );
}
