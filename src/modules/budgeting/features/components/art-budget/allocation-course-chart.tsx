"use client";

import { ReferenceLine } from "recharts";

import { StackedChart, quarterTick, type Row } from "@/components/charts/stacked-chart";
import type { Stack } from "@/components/charts/stack-tooltip";
import { formatEUR } from "@/lib/formatting";
import {
  ALLOCATION_STATE_LABELS,
  type AllocationState,
} from "@/modules/budgeting/domain/allocation-state";
import type { AllocationCourse } from "@/modules/budgeting/domain/allocation-course";

/**
 * Der Monatsverlauf einer Halbjahres-Zuteilung.
 *
 * Die Säulenhöhe ist konstant — eine Halbjahres-Zuteilung, gleichmäßig auf ihre
 * Monate verteilt, ergibt jeden Monat denselben Betrag. Was wandert, ist die
 * Zusammensetzung.
 *
 * Eine waagerechte „Soll"-Linie wäre hier irreführend: sie läge auf der
 * Säulenspitze und sagte nichts. Der Vergleich steht deshalb als Satz unter dem
 * Chart — Soll gegen Ist zum laufenden Monat, in Worten statt als Linie, die
 * man falsch lesen kann.
 */

const STATE_COLOR: Record<AllocationState, string> = {
  notStarted: "var(--muted-foreground)",
  committed: "#60a5fa",
  consumed: "var(--primary)",
};

/** Von unten nach oben: offen, laufend, geliefert — die Bewegung geht nach oben. */
const STACK_ORDER: AllocationState[] = ["notStarted", "committed", "consumed"];

const STACKS: Stack[] = STACK_ORDER.map((state) => ({
  id: state,
  title: ALLOCATION_STATE_LABELS[state],
  color: STATE_COLOR[state],
  confirmed: true,
}));

/**
 * **Nur das Diagramm** — Titel und Erklärsatz trägt die `SectionCard`, in der es
 * steht.
 *
 * Es brachte sein eigenes `Panel` mit, also eine eigene Karte. Auf einer Fläche,
 * deren Abschnitte selbst Karten sind, hiesse das Karte in Karte — und
 * ausgerechnet dieses Diagramm war lange der **einzige** Block mit Container
 * und deutete damit eine Regel an, die sonst nirgends galt.
 */
export function AllocationCourseChart({
  course,
  todayIndex,
}: {
  course: AllocationCourse;
  todayIndex: number;
}) {
  if (course.points.length === 0 || course.perMonth === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Für dieses Halbjahr ist nichts zugeteilt.
      </p>
    );
  }

  const rows: Row[] = course.points.map((p) => ({
    label: p.label,
    notStarted: p.byState.notStarted,
    committed: p.byState.committed,
    consumed: p.byState.consumed,
  }));
  const months = course.points.map((p) => ({ key: p.key, label: p.label }));
  const ticks = months.map((m) => m.label).filter((l) => quarterTick(l) !== "");
  const behind =
    course.expectedByToday != null && course.actualByToday != null
      ? course.expectedByToday - course.actualByToday
      : null;

  return (
    <>
      <StackedChart
        rows={rows}
        stacks={STACKS}
        ticks={ticks.length > 0 ? ticks : months.map((m) => m.label)}
        months={months}
        todayIndex={todayIndex}
        height={240}
      >
        <ReferenceLine y={course.perMonth} stroke="var(--border)" />
      </StackedChart>

      {behind != null && (
        <p className="mt-1 text-sm text-muted-foreground">
          Bis {course.points[todayIndex]?.label} sollten bei gleichmäßigem Abfluss{" "}
          <strong className="font-medium text-foreground tabular-nums">
            {formatEUR(course.expectedByToday ?? 0)}
          </strong>{" "}
          je Monat in Arbeit oder geliefert sein — tatsächlich sind es{" "}
          <strong className="font-medium text-foreground tabular-nums">
            {formatEUR(course.actualByToday ?? 0)}
          </strong>
          {behind > 0.5 ? (
            <>
              , also <span className="text-foreground">{formatEUR(behind)}</span> weniger.
            </>
          ) : (
            "."
          )}
        </p>
      )}
    </>
  );
}
