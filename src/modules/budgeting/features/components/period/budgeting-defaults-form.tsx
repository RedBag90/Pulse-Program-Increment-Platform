"use client";

import { useActionState } from "react";
import { setBudgetingDefaultsAction } from "@/modules/budgeting/features/actions/settings";

/**
 * Kompakte Tenant-Einstellung: der Default-Aufwand (Kosten-Richtwert), der für
 * Ballot-Kandidaten greift, die erst eine Benefit-Hypothese (noch keinen Lean
 * Business Case) haben. Leeres Feld ⇒ Code-Fallback.
 */
export function BudgetingDefaultsForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(setBudgetingDefaultsAction, {});
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-xs"
    >
      <div>
        <label
          htmlFor="defaultHypothesisEffort"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Standard-Aufwand für Hypothesen-Epics (€)
        </label>
        <input
          id="defaultHypothesisEffort"
          name="defaultHypothesisEffort"
          type="number"
          min={0}
          step={1000}
          defaultValue={current ?? ""}
          placeholder="z. B. 50000"
          className="w-40 rounded border border-gray-300 px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "…" : "Speichern"}
      </button>
      <p className="w-full text-xs text-muted-foreground">
        Kosten-Richtwert im Ballot für Epics mit freigegebener Benefit-Hypothese, aber noch ohne Lean
        Business Case. Leer ⇒ Standard (50.000 €).
      </p>
      {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
      {state.success && <span className="w-full text-xs text-emerald-700">Gespeichert.</span>}
    </form>
  );
}
