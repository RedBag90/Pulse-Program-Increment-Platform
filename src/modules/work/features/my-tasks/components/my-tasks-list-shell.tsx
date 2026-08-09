"use client";

import { useCallback, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { MyTasksFilterBar } from "@/modules/work/features/my-tasks/components/my-tasks-filter-bar";
import { MyTasksEpicsSection } from "@/modules/work/features/my-tasks/components/my-tasks-epics-section";
import { MyTasksFeaturesSection } from "@/modules/work/features/my-tasks/components/my-tasks-features-section";
import {
  BUCKETS,
  LEVELS,
  type Bucket,
  type MyTasksListModel,
} from "@/modules/work/server/views/my-tasks-list";
import type { EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";
import type { FeatureListRow } from "@/server/views/features-list";
import type { TaskLevel } from "@/server/services/my-tasks";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  model: MyTasksListModel;
  tenantId: string;
  showWsjf: boolean;
}

function parseBucket(raw: string | null): Bucket | null {
  if (!raw) return null;
  return (BUCKETS as readonly string[]).includes(raw) ? (raw as Bucket) : null;
}
function parseLevel(raw: string | null): TaskLevel | null {
  if (!raw) return null;
  return (LEVELS as readonly string[]).includes(raw) ? (raw as TaskLevel) : null;
}

/**
 * Shell für /my-tasks. Owns URL-State, computed beide Section-Inhalte
 * via `useMemo`, rendert Funnel → Filter → EpicsSection → FeaturesSection.
 *
 * Filter-Logik wird pro Row-Shape unterschiedlich angewendet (Epics
 * tragen `valueStream` direkt, Features tragen `artId` direkt etc.);
 * der Bucket-Filter geht über `model.bucketById` und ist Cross-Shape.
 */
export function MyTasksListShell({ model, showWsjf }: Props) {
  const { params, push: pushParam } = useUrlState();

  const bucket = parseBucket(params.get("bucket"));
  const level = parseLevel(params.get("level"));
  const valueStreamId = params.get("vs");
  const artId = params.get("art");
  const epicId = params.get("epic");
  const piId = params.get("pi");
  const query = params.get("q") ?? "";

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

  // ── Epic-Filter: bucket (via bucketById) + level + vs + epic-search.
  const filteredEpics = useMemo<EpicListRow[]>(() => {
    if (level === "feature") return [];
    const q = query.trim().toLowerCase();
    return model.epicRows.filter((r) => {
      if (bucket && model.bucketById.get(r.id) !== bucket) return false;
      if (valueStreamId && r.valueStream?.id !== valueStreamId) return false;
      // Epic-Rows kennen keinen ART / PI / Parent-Epic — diese Facetten
      // schließen die Epic-Sektion still aus, wenn aktiv.
      if (artId || piId || epicId) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.valueStream?.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [model.epicRows, model.bucketById, level, bucket, valueStreamId, artId, piId, epicId, query]);

  // ── Feature-Filter: bucket + level + art + parent-epic + pi + q.
  const filteredFeatures = useMemo<FeatureListRow[]>(() => {
    if (level === "epic") return [];
    const q = query.trim().toLowerCase();
    return model.featureRows.filter((r) => {
      if (bucket && model.bucketById.get(r.id) !== bucket) return false;
      if (artId && r.artId !== artId) return false;
      if (epicId && r.epic?.id !== epicId) return false;
      if (piId === "backlog" && r.pi != null) return false;
      if (piId && piId !== "backlog" && r.pi?.id !== piId) return false;
      // Value-Stream-Filter wirkt indirekt über die Parent-Epic-Beziehung,
      // die wir hier nicht aufgelöst tragen — Features fallen aus, wenn
      // der Filter aktiv ist und der ART nicht zur VS-Auswahl gehört.
      if (valueStreamId) {
        const artStillOk = model.artOptions.some((a) => a.id === r.artId);
        if (!artStillOk) return false;
      }
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.epic?.title.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [
    model.featureRows,
    model.bucketById,
    model.artOptions,
    level,
    bucket,
    artId,
    epicId,
    piId,
    valueStreamId,
    query,
  ]);

  const compact = false;

  return (
    <Page>
      <PageHeader
        title="Meine Tasks"
        subtitle="Alles, wofür ich Owner oder Assignee bin — Epics und Features mit denselben Zeileninhalten wie auf den Hauptlisten."
      />

      <MyTasksFilterBar
        query={query}
        level={level}
        valueStreamId={valueStreamId}
        artId={artId}
        epicId={epicId}
        piId={piId}
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
      />

      <MyTasksEpicsSection
        rows={filteredEpics}
        canEdit={model.canEditEpic}
        canAdvance={model.canAdvanceEpic}
        stageGatesEnabled={model.stageGatesEnabled}
        compact={compact}
      />
      <MyTasksFeaturesSection
        rows={filteredFeatures}
        canEdit={model.canEditFeature}
        showWsjf={showWsjf}
        compact={compact}
      />

      {filteredEpics.length === 0 && filteredFeatures.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Tasks im aktuellen Filter.
        </div>
      )}
    </Page>
  );
}
