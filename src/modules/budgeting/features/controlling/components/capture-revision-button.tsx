"use client";

import { useActionState } from "react";
import { captureBudgetPlanRevisionAction } from "@/modules/budgeting/features/controlling/actions/budget-plan-revision";

interface Props {
  /** Label of the cycle that will be captured (`H1 2026` etc.) — displayed on the button. */
  cycleLabel: string;
  /** Render variant. Primary = prominent CTA; compact = inline button for already-populated pages. */
  variant?: "primary" | "compact";
  /** Disables the button (e.g. for users without `budget_plan.revision.capture`). */
  disabled?: boolean;
}

/**
 * One-click "Snapshot erstellen"-Trigger. Idempotent per cycle on the server,
 * so we don't gate it behind a confirmation dialog. Renders a tiny inline
 * error if the action returns one; the success toast is handled by the
 * server-action runtime (`describeCreated`).
 */
export function CaptureRevisionButton({ cycleLabel, variant = "primary", disabled }: Props) {
  const [state, action, pending] = useActionState(captureBudgetPlanRevisionAction, {});

  const className =
    variant === "primary"
      ? "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      : "rounded border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

  return (
    <div className="space-y-1">
      <form action={action}>
        <button type="submit" disabled={pending || disabled} className={className}>
          {pending ? "Erstelle…" : `Snapshot für ${cycleLabel} erstellen`}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
