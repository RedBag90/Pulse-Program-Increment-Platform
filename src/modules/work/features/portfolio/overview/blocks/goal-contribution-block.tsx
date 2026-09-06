"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";
import {
  benefitPerformance,
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
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import {
  rollupCellTone,
  rollupTone,
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

/** Welcher der beiden Werte gerade die Reihenfolge macht — `null` bei Abweichung. */
type Emphasis = ContributionMode | null;

/**
 * Beitragswerte einer Effektart — je Einheit eine Zeile, **beide Werte**.
 *
 * Bis September 2026 zeigte die Zelle nur einen der beiden (`v[mode]`), und der
 * Umschalter bestimmte damit Anzeige und Sortierung zugleich: wer Plan und Ist
 * vergleichen wollte, musste hin- und herschalten und sich die Zahl merken.
 *
 * **Inhalt und Ort sind fest, nur die Gewichtung wandert.** Beide Werte stehen
 * immer da, immer in derselben Reihenfolge — sonst spränge beim Umschalten eine
 * Zahl. Fett steht der, nach dem sortiert wird; ohne das wäre die Liste nach
 * einer Zahl geordnet, die im Bild zurücktritt.
 *
 * Beide tragen ihr Wort. Trüge nur das Ist eines, führte bei Sortierung nach Ist
 * eine kleine graue Zahl ohne Wort die Zeile an.
 *
 * „—" heißt „kein Beitrag berechnet"; ein Ist von 0 rendert als „0 €", sonst
 * wäre das nicht von „noch nichts realisiert" zu unterscheiden.
 */
function ValueCell({ values, emphasis }: { values: UnitValue[]; emphasis: Emphasis }) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const cls = (which: ContributionMode) =>
    emphasis === which ? "font-medium" : "text-[10px] text-muted-foreground";
  return (
    <div className="space-y-0.5 tabular-nums">
      {values.map((v, i) => (
        <div key={v.unit ?? `u${i}`}>
          <span className={cls("planned")}>Plan {fmt(v.unit, v.planned)}</span>{" "}
          <span className={cls("realized")}>· Ist {fmt(v.unit, v.realized)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Übertrifft das Epic seinen Plan?
 *
 * **Nur ab L4.2.** Der realisierte Nutzen wächst über die Zeit; ein Epic mitten
 * in der Umsetzung hat den Plan noch gar nicht erreichen können. Ohne diese
 * Schranke stünde bei fast jeder Zeile dasselbe Zeichen — und ein Indikator,
 * der immer dasselbe sagt, sagt nichts.
 */
function PerformanceCell({ row, emphasised }: { row: ContributionRow; emphasised: boolean }) {
  const perf = row.benefitAssessable ? rowPerformance(row) : null;
  if (perf == null) {
    return (
      <span className="text-muted-foreground" title="Erst ab L4.2 bewertbar">
        —
      </span>
    );
  }
  // Unter einem halben Prozent stünde sonst „−0 %" — ein Zeichen ohne Zahl.
  const abs = Math.abs(perf.delta) * 100;
  const pct = `${perf.delta > 0 ? "+" : "−"}${abs.toFixed(abs < 0.5 ? 1 : 0).replace(".", ",")} %`;
  const look = {
    over: { sign: "↗", cls: "text-emerald-600 dark:text-emerald-400" },
    under: { sign: "↘", cls: "text-rose-600 dark:text-rose-400" },
    on: { sign: "→", cls: "text-muted-foreground" },
  }[perf.state];
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${look.cls} ${emphasised ? "font-medium" : ""}`}
    >
      {look.sign} {perf.state === "on" ? "wie geplant" : pct}
    </span>
  );
}

/** Die Abweichung einer Zeile — dieselbe einheitenblinde Summe, die auch sortiert. */
function rowPerformance(row: ContributionRow) {
  return benefitPerformance({
    planned: totalContribution(row, "planned"),
    realized: totalContribution(row, "realized"),
  });
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

/** Wertstrom oben, Solution darunter — sechsmal „Produktion" sagt für sich nichts. */
function StreamCell({ row }: { row: ContributionRow }) {
  if (row.valueStreamName == null && row.solution == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0">
      <div className="truncate text-muted-foreground">{row.valueStreamName ?? "—"}</div>
      {row.solution && (
        <div className="truncate text-[10px] text-muted-foreground/80">{row.solution.name}</div>
      )}
    </div>
  );
}

/**
 * Die zusammengefasste Klasse — eine Zeile je Solution. Kein Link auf ein Epic,
 * weil sie keines ist; der eingefärbte Grund sagt, dass hier gebündelt wurde.
 */
function SolutionRow({
  rollup,
  classFilter,
  emphasis,
}: {
  rollup: { group: SolutionRollup; recurring: UnitValue[]; oneTime: UnitValue[] };
  classFilter: ClassFilterState;
  emphasis: Emphasis;
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
      <td className={`px-3 py-2 ${tone}`} />
      <td className={`px-3 py-2 text-[10px] ${tone}`}>{classFilter.hiddenLabel}</td>
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.recurring} emphasis={emphasis} />
      </td>
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.oneTime} emphasis={emphasis} />
      </td>
      <td className={`px-3 py-2 text-right ${tone}`} />
    </tr>
  );
}

/**
 * Wonach die Liste geordnet ist — **nicht** dasselbe wie „welcher Wert".
 *
 * `ContributionMode` beantwortet die zweite Frage und bleibt, wie er ist;
 * `totalContribution` nimmt weiterhin nur ihn entgegen. „Abweichung" ist keine
 * dritte Zahl, sondern ein Verhältnis der beiden.
 */
type SortKey = ContributionMode | "deviation";

/** Voreingestellte Richtung je Schlüssel: die interessante Seite zuerst. */
const DEFAULT_ASC: Record<SortKey, boolean> = {
  planned: false, // grösster Plan oben
  realized: false, // grösstes Ist oben
  deviation: true, // grösster Rückstand oben — dort tut man etwas
};

const SORT_LABEL: Record<SortKey, string> = {
  planned: "Plan",
  realized: "Ist",
  deviation: "Abweichung",
};

/**
 * „Epic-Beitrag zu Kopf-Zielen" — listet die Epics nach ihrem berechneten
 * Nutzen-Beitrag an die Top-Ziele (KPI × Conversion die Ziel-Kette hoch),
 * getrennt nach wiederkehrendem und einmaligem Effekt.
 *
 * Der Umschalter **sortiert nur**. Beide Werte stehen ohnehin in jeder Zelle;
 * würde er auch die Anzeige drehen, wäre der Vergleich wieder ein Merkspiel.
 */
export function GoalContributionBlock({
  rows,
  classFilter,
}: {
  rows: ContributionRow[];
  classFilter: ClassFilterState;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "planned",
    asc: DEFAULT_ASC.planned,
  });
  const emphasis: Emphasis = sort.key === "deviation" ? null : sort.key;

  // Ein erneuter Klick auf die aktive Option dreht die Richtung; ein Klick auf
  // eine andere setzt sie auf deren interessante Seite. `ToggleGroup` meldet
  // jeden Klick, auch den auf die aktive Option — der Baustein bleibt dafuer
  // unangetastet, sein Doc-Kommentar bittet ausdruecklich darum.
  const pick = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: DEFAULT_ASC[key] },
    );

  const options: ReadonlyArray<ToggleGroupOption<SortKey>> = (
    ["planned", "realized", "deviation"] as const
  ).map((key) => ({
    id: key,
    label: sort.key === key ? `${SORT_LABEL[key]} ${sort.asc ? "↑" : "↓"}` : SORT_LABEL[key],
  }));

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

  // Dieselbe Formel wie der Server (`totalContribution`), nur hier auch fuer Ist
  // und fuer die Abweichung. **Nicht bewertbare Epics stehen hinten**, in beiden
  // Richtungen: sie haben keine Abweichung, und sie ans andere Ende zu werfen
  // waere eine Aussage ueber sie, die es nicht gibt.
  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    if (sort.key !== "deviation") {
      const key = sort.key;
      return [...visible].sort(
        (a, b) => (totalContribution(a, key) - totalContribution(b, key)) * dir,
      );
    }
    const deviationOf = (r: ContributionRow) =>
      r.benefitAssessable ? (rowPerformance(r)?.delta ?? null) : null;
    return [...visible].sort((a, b) => {
      const da = deviationOf(a);
      const db = deviationOf(b);
      if (da == null) return db == null ? 0 : 1;
      if (db == null) return -1;
      return (da - db) * dir;
    });
  }, [visible, sort]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Epic-Beitrag zu Kopf-Zielen</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            sortiert nach
          </span>
          <ToggleGroup
            value={sort.key}
            options={options}
            onChange={pick}
            ariaLabel="Sortierung"
            className="bg-card text-[11px]"
          />
          {sorted.length + rollups.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {sorted.length + rollups.length}
            </span>
          )}
        </div>
      </div>

      {sorted.length + rollups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Epic-Ziel-Beiträge berechnet.{" "}
          <Link href="/ziele" className="text-primary hover:underline">
            Ziele verknüpfen →
          </Link>
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-xs">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-3 py-2 text-left font-medium">Epic</th>
                <th className="px-3 py-2 text-left font-medium">Horizont</th>
                <th className="px-3 py-2 text-left font-medium">
                  Wertstrom
                  <span className="block font-normal normal-case">Solution</span>
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Wiederkehrend
                  <span className="block font-normal normal-case">pro Jahr</span>
                </th>
                <th className="px-3 py-2 text-right font-medium">Einmalig</th>
                <th className="px-3 py-2 text-right font-medium">
                  Ist vs. Plan
                  <span className="block font-normal normal-case">ab L4.2</span>
                </th>
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
                  <td className="px-3 py-2">
                    <HorizonBadge horizon={r.horizon} short />
                  </td>
                  <td className="max-w-[14rem] px-3 py-2">
                    <StreamCell row={r} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.recurring} emphasis={emphasis} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.oneTime} emphasis={emphasis} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PerformanceCell row={r} emphasised={sort.key === "deviation"} />
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Die Zusammenfassung bekommt einen **eigenen Abschnitt**. Vorher
                hingen ihre Zeilen im selben Rumpf hinter den Epics — man musste
                scrollen und merkte den Wechsel kaum. Die Erklaerzeile, die
                frueher ueber der Tabelle stand, sitzt jetzt hier, wo sie gilt. */}
            {rollups.length > 0 && (
              <tbody>
                <tr className="border-y bg-muted/40">
                  <th
                    colSpan={6}
                    className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 shrink-0 rounded-[2px] border ${rollupTone(classFilter.hiddenClass)}`}
                      />
                      {classFilter.hiddenLabel} je Solution · je Einheit summiert
                    </span>
                  </th>
                </tr>
                {rollups.map((r) => (
                  <SolutionRow
                    key={r.group.solutionId ?? "none"}
                    rollup={r}
                    classFilter={classFilter}
                    emphasis={emphasis}
                  />
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
