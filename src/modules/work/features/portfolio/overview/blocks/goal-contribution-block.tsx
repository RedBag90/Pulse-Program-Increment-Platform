"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";
import {
  totalContribution,
  type ContributionMode,
} from "@/modules/core/goals/domain/epic-contribution";
import type { UnitValue } from "@/modules/core/goals/server/views/epic-goal-contributions";
import type {
  ClassFilterState,
  ContributionRow,
} from "@/modules/work/server/views/portfolio-overview";
import {
  isClassShown,
  rollUpBySolution,
  type SolutionRollup,
} from "@/modules/work/domain/epic-class-filter";
import {
  RollupHint,
  rollupCellTone,
} from "@/modules/work/features/portfolio/overview/blocks/class-rollup";

/** Kompakte Zahl (Muster aus der früheren Funding-Kachel), ohne Einheit. */
function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

/** Wert mit dem Einheiten-Label des Top-Ziels (€, %, Stück, …). */
function fmt(unit: string | null, n: number): string {
  return unit ? `${compact(n)} ${unit}` : compact(n);
}

/**
 * Beitragswerte einer Effektart im aktiven Modus — je Einheit eine Zeile. Top-Ziele
 * können unterschiedliche Einheiten haben; deshalb wird nicht über Einheiten
 * summiert. „—" heißt „kein Beitrag berechnet"; ein Ist von 0 rendert als „0 €",
 * sonst wäre das nicht von „noch nichts realisiert" zu unterscheiden.
 */
function ValueCell({ values, mode }: { values: UnitValue[]; mode: ContributionMode }) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1 tabular-nums">
      {values.map((v, i) => (
        <div key={v.unit ?? `u${i}`} className="font-medium">
          {fmt(v.unit, v[mode])}
        </div>
      ))}
    </div>
  );
}

/**
 * Gleiche Einheit addieren, verschiedene getrennt lassen — dieselbe Regel wie
 * `aggregateEpicContribution` sie für ein einzelnes Epic anwendet.
 */
function sumUnits(lists: readonly UnitValue[][]): UnitValue[] {
  const byUnit = new Map<string, UnitValue>();
  for (const values of lists) {
    for (const v of values) {
      const key = v.unit ?? "";
      const prev = byUnit.get(key);
      if (prev) {
        prev.planned += v.planned;
        prev.realized += v.realized;
      } else {
        byUnit.set(key, { ...v });
      }
    }
  }
  return [...byUnit.values()];
}

/**
 * Die zusammengefasste Klasse — eine Zeile je Solution. Kein Link auf ein Epic,
 * weil sie keines ist; der eingefärbte Grund sagt, dass hier gebündelt wurde.
 */
function SolutionRow({
  rollup,
  mode,
  classFilter,
}: {
  rollup: { group: SolutionRollup; recurring: UnitValue[]; oneTime: UnitValue[] };
  mode: ContributionMode;
  classFilter: ClassFilterState;
}) {
  const tone = rollupCellTone(classFilter.hiddenClass);
  return (
    <tr className="border-b last:border-0">
      <td className={`px-3 py-2 font-medium ${tone}`}>
        {rollup.group.name}
        <span className="ml-2 font-mono text-[10px] font-normal opacity-80">
          {rollup.group.count} zusammengefasst
        </span>
      </td>
      <td className={`px-3 py-2 text-xs ${tone}`}>{classFilter.hiddenLabel}</td>
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.recurring} mode={mode} />
      </td>
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.oneTime} mode={mode} />
      </td>
    </tr>
  );
}

const MODE_OPTIONS: ReadonlyArray<ToggleGroupOption<ContributionMode>> = [
  { id: "planned", label: "Plan" },
  { id: "realized", label: "Ist" },
];

/**
 * „Epic-Beitrag zu Kopf-Zielen" — ersetzt die Funding-Kachel. Listet die Epics
 * nach ihrem berechneten Nutzen-Beitrag an die Top-Ziele (KPI × Conversion die
 * Ziel-Kette hoch), getrennt nach wiederkehrendem und einmaligem Effekt.
 * Umschaltbar zwischen Plan und Ist; die Sortierung folgt dem Modus.
 */
export function GoalContributionBlock({
  rows,
  classFilter,
}: {
  rows: ContributionRow[];
  classFilter: ClassFilterState;
}) {
  const [mode, setMode] = useState<ContributionMode>("planned");

  const visible = useMemo(
    () => rows.filter((r) => isClassShown(r.epicClass, classFilter.selected)),
    [rows, classFilter.selected],
  );
  // Zusammengefasst wird je Solution und **je Einheit** — dieselbe Regel, nach
  // der ein einzelnes Epic seine Beiträge schon bündelt. Über Einheiten hinweg
  // zu addieren hieße, € und Stück in eine Zahl zu werfen.
  const rollups = useMemo(() => {
    const hidden = rows.filter((r) => !isClassShown(r.epicClass, classFilter.selected));
    const byKey = new Map<string, ContributionRow[]>();
    for (const r of hidden) {
      const key = r.solution?.id ?? "";
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    return rollUpBySolution(hidden).map((group) => ({
      group,
      recurring: sumUnits((byKey.get(group.solutionId ?? "") ?? []).map((r) => r.recurring)),
      oneTime: sumUnits((byKey.get(group.solutionId ?? "") ?? []).map((r) => r.oneTime)),
    }));
  }, [rows, classFilter.selected]);

  // Plan = Server-Reihenfolge (dort bereits nach Plan sortiert). Ist muss neu
  // sortiert werden — sonst stehen die Ist-Werte in Plan-Reihenfolge und wirken
  // willkürlich untereinander. Dieselbe Formel wie der Server (ADR-frei: ein
  // Helfer in der Domain-Schicht, kein zweiter Rang-Begriff).
  const sorted = useMemo(
    () =>
      mode === "planned"
        ? visible
        : [...visible].sort((a, b) => totalContribution(b, mode) - totalContribution(a, mode)),
    [visible, mode],
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Epic-Beitrag zu Kopf-Zielen</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          <ToggleGroup
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
            ariaLabel="Beitragswert"
            className="bg-card text-[11px]"
          />
          {sorted.length + rollups.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {sorted.length + rollups.length}
            </span>
          )}
        </div>
      </div>

      <RollupHint classFilter={classFilter} detail="je Einheit summiert" />

      {sorted.length + rollups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Epic-Ziel-Beiträge berechnet.{" "}
          <Link href="/ziele" className="text-primary hover:underline">
            Ziele verknüpfen →
          </Link>
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Epic</th>
                <th className="px-3 py-2 text-left font-medium">Wertstrom</th>
                <th className="px-3 py-2 text-right font-medium">
                  Wiederkehrend
                  <span className="block font-normal normal-case">pro Jahr</span>
                </th>
                <th className="px-3 py-2 text-right font-medium">Einmalig</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.epicId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/portfolio/epics/${r.epicId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.recurring} mode={mode} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.oneTime} mode={mode} />
                  </td>
                </tr>
              ))}
              {rollups.map((r) => (
                <SolutionRow
                  key={r.group.solutionId ?? "none"}
                  rollup={r}
                  mode={mode}
                  classFilter={classFilter}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
