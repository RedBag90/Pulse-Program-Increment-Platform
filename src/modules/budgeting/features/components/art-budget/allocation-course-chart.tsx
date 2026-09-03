"use client";

import { ReferenceLine } from "recharts";

import { Panel, StackedChart, quarterTick, type Row } from "@/components/charts/stacked-chart";
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

export function AllocationCourseChart({
  course,
  todayIndex,
  title,
  subtitle,
}: {
  course: AllocationCourse;
  todayIndex: number;
  title: string;
  subtitle: string;
}) {
  if (course.points.length === 0 || course.perMonth === 0) {
    return (
      <Panel title={title} subtitle={subtitle}>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Für dieses Halbjahr ist nichts zugeteilt.
        </p>
      </Panel>
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
    <Panel title={title} subtitle={subtitle}>
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
    </Panel>
  );
}
