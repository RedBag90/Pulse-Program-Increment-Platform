"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ChevronDown, MoreHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { saveGoalAction } from "@/features/transformation/actions/target-goal";
import { saveTargetOutcomeAction } from "@/features/transformation/actions/target-outcome";
import { Button } from "@/components/ui/button";
import type {
  GoalCard as GoalCardData,
  GoalBoundOutcome,
} from "@/server/views/transformation-cockpit";
import type { RagTier } from "@/domain/transformation-delta";

interface Props {
  goal: GoalCardData;
  canManage: boolean;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const TIER_STYLES: Record<RagTier, { ring: string; chip: string; bar: string }> = {
  green: {
    ring: "border-emerald-200",
    chip: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  amber: {
    ring: "border-amber-200",
    chip: "bg-amber-50 text-amber-700",
    bar: "bg-amber-500",
  },
  red: {
    ring: "border-red-200",
    chip: "bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  done: {
    ring: "border-emerald-300",
    chip: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-600",
  },
};

const TIER_LABEL: Record<RagTier, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  done: "✓",
};

/**
 * A single strategic-goal card on the cockpit. Replaces the bar-list row of
 * the old cockpit and surfaces the inline actions that previously required a
 * trip to `/transformation/ziele`:
 *
 * - **Mark achieved** sets `status: "achieved"` via `saveGoalAction` (this
 *   is destructive in the workflow sense, so it gates on a confirm).
 * - **Update KPI current value** opens a small popover listing the goal's
 *   bound outcomes; each row submits a single-field update via
 *   `saveTargetOutcomeAction`.
 * - **⋯ Verwalten** links out to the full goal-management page for the
 *   ops that aren't worth duplicating inline (link/unlink epic, archive,
 *   rename, change owner).
 *
 * Achieved goals hide the action row and render a tick. Goals without KPIs
 * show an inline "Noch keine KPIs gebunden" hint, with the popover empty
 * state offering a link to `/transformation/ziele/{id}` to add one.
 */
export function GoalCard({ goal, canManage }: Props) {
  const tier = TIER_STYLES[goal.tier];
  const done = goal.status === "achieved";

  return (
    <article className={`flex flex-col gap-3 rounded-lg border bg-card p-4 ${tier.ring}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/transformation/ziele/${goal.id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {goal.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {goal.kpiCount} KPI{goal.kpiCount !== 1 ? "s" : ""} · {goal.epicCount} Epic
            {goal.epicCount !== 1 ? "s" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tier.chip}`}
        >
          {TIER_LABEL[goal.tier]}{" "}
          {done ? "erreicht" : goal.kpiCount > 0 ? pct(goal.kpiProgress) : "—"}
        </span>
      </header>

      {!done && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${tier.bar}`}
            style={{ width: goal.kpiCount > 0 ? pct(goal.kpiProgress) : "0%" }}
          />
        </div>
      )}

      {done ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ziel erreicht.
        </p>
      ) : (
        canManage && <GoalCardActions goal={goal} />
      )}
    </article>
  );
}

/** Inline action row split into a client child so the card body stays trivial. */
function GoalCardActions({ goal }: { goal: GoalCardData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MarkAchievedButton goal={goal} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2 text-xs"
      >
        Update KPI
        <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      <Link
        href={`/transformation/ziele/${goal.id}`}
        className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted/50"
        aria-label="Im Detail verwalten"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Link>

      {open && (
        <div className="mt-2 w-full rounded-md border bg-background p-3">
          {goal.boundOutcomes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine KPIs gebunden.{" "}
              <Link
                href={`/transformation/ziele/${goal.id}`}
                className="text-primary hover:underline"
              >
                KPI hinzufügen →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {goal.boundOutcomes.map((o) => (
                <li key={o.id}>
                  <UpdateOutcomeRow outcome={o} onDone={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Destructive "Mark achieved" — confirms before flipping the status. */
function MarkAchievedButton({ goal }: { goal: GoalCardData }) {
  const [state, action, pending] = useActionState(saveGoalAction, {});

  function submit() {
    if (!window.confirm(`„${goal.title}" als erreicht markieren?`)) return;
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ id: goal.id, title: goal.title, status: "achieved" }));
    action(fd);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={submit}
        className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
      >
        {pending ? "…" : "✓ Erreicht"}
      </Button>
      {state.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </>
  );
}

/** One row in the "Update KPI" popover — a number input + save button. */
function UpdateOutcomeRow({ outcome, onDone }: { outcome: GoalBoundOutcome; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveTargetOutcomeAction, {});
  const [value, setValue] = useState<string>(outcome.current?.toString() ?? "");

  function submit() {
    const parsed = value === "" ? null : Number(value);
    if (parsed !== null && Number.isNaN(parsed)) return;
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        id: outcome.id,
        title: outcome.title,
        target: outcome.target,
        current: parsed,
      }),
    );
    action(fd);
    onDone();
  }

  const unit = outcome.metricUnit ? ` ${outcome.metricUnit}` : "";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate">{outcome.title}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={outcome.current?.toString() ?? "—"}
        className="h-7 w-20 rounded-md border px-2 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
        step="any"
        inputMode="decimal"
      />
      <span className="text-muted-foreground tabular-nums">
        / {outcome.target}
        {unit}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending || value === (outcome.current?.toString() ?? "")}
        onClick={submit}
        className="h-7 px-2"
      >
        {pending ? "…" : "Speichern"}
      </Button>
      {state.error && (
        <span role="alert" className="w-full text-destructive">
          {state.error}
        </span>
      )}
    </div>
  );
}
