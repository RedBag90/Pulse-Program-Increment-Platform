"use client";

import { useTranslations } from "next-intl";
import { useEntityOptions } from "@/features/create/use-entity-options";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { MultiSelectFilter, type MultiSelectSection } from "@/components/ui/multi-select-filter";
import { SavedFilterControls } from "@/components/ui/saved-filter-controls";
import type { SavedFilterDTO, FilterCriteria } from "@/server/services/saved-filter";
import {
  saveGoalFilterAction,
  deleteGoalFilterAction,
} from "@/modules/core/goals/features/actions/saved-filter";
import { PeriodMultiSelect } from "@/modules/core/goals/features/components/period-multi-select";
import {
  OPEN_STATUSES,
  CLOSED_STATUSES,
  goalStatusKey,
  goalStatusColor,
} from "@/modules/core/goals/domain/goal-status";

interface ScopeOption {
  id: string;
  name?: string;
}

/**
 * Prominente Filterleiste für die Strategie/Ziele-Liste: **Zeitraum · Wertstrom ·
 * ART · Status** — alle als **Mehrfachauswahl**. Jede Auswahl wird als CSV im
 * URL-State abgelegt (`?period=`/`?vs=`/`?art=`/`?status=`); der Loader
 * (`loadStrategyTree`) filtert serverseitig (UND zwischen Gruppen, ODER innerhalb).
 * Zeitraum ist der strukturierte `PeriodMultiSelect` (Jahr-Stepper + FY/H1·H2/Q1–Q4),
 * VS/ART aus den v1-APIs. Status ist gruppiert (Offen/Geschlossen/Ohne Status) — die
 * Gruppen-„alle" deckt Aktiv/Geschlossen ab. Sentinel `none` = ohne Status.
 */
export function GoalScopeFilterBar({
  savedFilters = [],
}: {
  /** Persönlich gespeicherte Filter dieser Fläche. */
  savedFilters?: SavedFilterDTO[];
} = {}) {
  const t = useTranslations();
  const { params, push } = useUrlState();
  const readSet = (key: string): Set<string> =>
    new Set((params.get(key) ?? "").split(",").filter(Boolean));
  const writeSet = (key: string, set: Set<string>): void =>
    push({ [key]: set.size ? [...set].join(",") : null });

  const handlers = (key: string, set: Set<string>) => ({
    onToggle: (v: string) => {
      const next = new Set(set);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      writeSet(key, next);
    },
    onToggleSection: (values: string[], on: boolean) => {
      const next = new Set(set);
      for (const v of values)
        if (on) next.add(v);
        else next.delete(v);
      writeSet(key, next);
    },
    onClear: () => push({ [key]: null }),
  });

  const periodSel = readSet("period");
  const vsSel = readSet("vs");
  const artSel = readSet("art");
  const statusSel = readSet("status");

  // **Immer geladen.** Bis September 2026 hingen diese beiden Abfragen an
  // `showValueStreams` / `showArts`, gefüttert aus den Modulen `work` und
  // `drumbeat`. Wertströme und ARTs sind aber Core — die Filter fehlten damit
  // ausgerechnet dort, wo es sonst nichts zu filtern gibt.
  const valueStreams = useEntityOptions<ScopeOption>("/api/v1/value-streams", true);
  const arts = useEntityOptions<ScopeOption>("/api/v1/arts", true);

  const anyActive = periodSel.size + vsSel.size + artSel.size + statusSel.size > 0;

  const csv = (arr: string[] | undefined) => (arr && arr.length ? arr.join(",") : null);
  /** Ein angewandter Filter räumt den „bewusst leer"-Marker weg. */
  const applySaved = (c: FilterCriteria) =>
    push({
      period: csv(c.period),
      vs: csv(c.vs),
      art: csv(c.art),
      status: csv(c.status),
      f: null,
    });

  const vsSections: MultiSelectSection[] = [
    { options: valueStreams.data.map((v) => ({ value: v.id, label: v.name ?? v.id })) },
  ];
  const artSections: MultiSelectSection[] = [
    { options: arts.data.map((a) => ({ value: a.id, label: a.name ?? a.id })) },
  ];
  const statusSections: MultiSelectSection[] = [
    {
      heading: t("goals.group.open"),
      options: OPEN_STATUSES.map((s) => ({
        value: s,
        label: t(goalStatusKey(s)),
        color: goalStatusColor(s),
      })),
    },
    {
      heading: t("goals.group.closed"),
      options: CLOSED_STATUSES.map((s) => ({
        value: s,
        label: t(goalStatusKey(s)),
        color: goalStatusColor(s),
      })),
    },
    { options: [{ value: "none", label: t("goals.tier.neutral") }] },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card shadow-card p-2.5 shadow-xs">
      <PeriodMultiSelect
        selected={periodSel}
        onToggle={handlers("period", periodSel).onToggle}
        onClear={() => push({ period: null })}
      />
      <MultiSelectFilter
        label={t("goals.filter.wertstrom")}
        sections={vsSections}
        selected={vsSel}
        disabled={valueStreams.loading}
        {...handlers("vs", vsSel)}
      />
      <MultiSelectFilter
        label={t("goals.filter.art")}
        sections={artSections}
        selected={artSel}
        disabled={arts.loading}
        {...handlers("art", artSel)}
      />
      <MultiSelectFilter
        label={t("goals.filter.status")}
        sections={statusSections}
        selected={statusSel}
        {...handlers("status", statusSel)}
      />
      {anyActive && (
        <button
          type="button"
          // `f: "0"` ist der Marker „bewusst leer". Ohne ihn wäre
          // zurückgesetzt nicht von „Seite frisch geöffnet" zu unterscheiden,
          // und der Standard-Filter schlüge sofort wieder zu.
          onClick={() => push({ period: null, vs: null, art: null, status: null, f: "0" })}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("goals.filter.resetAll")}
        </button>
      )}

      <SavedFilterControls
        filters={savedFilters}
        criteria={{
          period: [...periodSel],
          vs: [...vsSel],
          art: [...artSel],
          status: [...statusSel],
        }}
        anyActive={anyActive}
        onApply={applySaved}
        saveAction={saveGoalFilterAction}
        deleteAction={deleteGoalFilterAction}
      />
    </div>
  );
}
