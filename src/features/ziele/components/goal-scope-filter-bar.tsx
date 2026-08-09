"use client";

import { useEntityOptions } from "@/features/create/use-entity-options";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { MultiSelectFilter, type MultiSelectSection } from "@/components/ui/multi-select-filter";
import { PeriodMultiSelect } from "@/features/ziele/components/period-multi-select";
import {
  OPEN_STATUSES,
  CLOSED_STATUSES,
  goalStatusLabel,
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
  showValueStreams = true,
  showArts = true,
}: {
  /** VS = Portfolio-Inhalt — im Free-Tenant ausgeblendet. */
  showValueStreams?: boolean;
  /** ARTs = Programm-Inhalt — dito. */
  showArts?: boolean;
} = {}) {
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

  const valueStreams = useEntityOptions<ScopeOption>("/api/v1/value-streams", showValueStreams);
  const arts = useEntityOptions<ScopeOption>("/api/v1/arts", showArts);

  const anyActive = periodSel.size + vsSel.size + artSel.size + statusSel.size > 0;

  const vsSections: MultiSelectSection[] = [
    { options: valueStreams.data.map((v) => ({ value: v.id, label: v.name ?? v.id })) },
  ];
  const artSections: MultiSelectSection[] = [
    { options: arts.data.map((a) => ({ value: a.id, label: a.name ?? a.id })) },
  ];
  const statusSections: MultiSelectSection[] = [
    {
      heading: "Offen",
      options: OPEN_STATUSES.map((s) => ({
        value: s,
        label: goalStatusLabel(s),
        color: goalStatusColor(s),
      })),
    },
    {
      heading: "Geschlossen",
      options: CLOSED_STATUSES.map((s) => ({
        value: s,
        label: goalStatusLabel(s),
        color: goalStatusColor(s),
      })),
    },
    { options: [{ value: "none", label: "Ohne Status" }] },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5 shadow-xs">
      <PeriodMultiSelect
        selected={periodSel}
        onToggle={handlers("period", periodSel).onToggle}
        onClear={() => push({ period: null })}
      />
      {showValueStreams && (
        <MultiSelectFilter
          label="Wertstrom"
          sections={vsSections}
          selected={vsSel}
          disabled={valueStreams.loading}
          {...handlers("vs", vsSel)}
        />
      )}
      {showArts && (
        <MultiSelectFilter
          label="ART"
          sections={artSections}
          selected={artSel}
          disabled={arts.loading}
          {...handlers("art", artSel)}
        />
      )}
      <MultiSelectFilter
        label="Status"
        sections={statusSections}
        selected={statusSel}
        {...handlers("status", statusSel)}
      />
      {anyActive && (
        <button
          type="button"
          onClick={() => push({ period: null, vs: null, art: null, status: null })}
          className="ml-auto rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Alle Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
