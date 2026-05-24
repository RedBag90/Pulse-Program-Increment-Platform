"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { saveBusinessCaseAction } from "@/features/portfolio/actions/business-case";
import {
  costSliceLabel,
  type BusinessCaseFields,
  type BusinessCaseVersion,
} from "@/domain/business-case";

interface BusinessCaseEditorProps {
  epicId: string;
  current: BusinessCaseFields;
  history: BusinessCaseVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. VMO). */
  readOnly?: boolean;
  /** Why the form is locked (the current approval phase) — shown as a hint. */
  lockReason?: string;
}

const INPUT_CLASS =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function parseNum(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Cost slice amounts as form strings — defaults to two 6-month periods. */
function initialSlices(slices: BusinessCaseFields["costSlices"]): string[] {
  if (slices && slices.length > 0) {
    return slices.map((s) => (s.amount != null ? String(s.amount) : ""));
  }
  return ["", ""];
}

export function BusinessCaseEditor({
  epicId,
  current,
  history,
  readOnly = false,
  lockReason,
}: BusinessCaseEditorProps) {
  const [state, action, isPending] = useActionState(saveBusinessCaseAction, {});
  const [slices, setSlices] = useState<string[]>(() => initialSlices(current.costSlices));

  const costTotal = slices.reduce((sum, v) => sum + (parseNum(v) ?? 0), 0);

  return (
    <div className="space-y-6">
      {readOnly && lockReason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lockReason}</span>
        </div>
      )}
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <label htmlFor="bc-stakeholders" className="block text-sm font-medium mb-1">
              Key Stakeholders
            </label>
            <input
              id="bc-stakeholders"
              name="keyStakeholders"
              defaultValue={current.keyStakeholders}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="bc-description" className="block text-sm font-medium mb-1">
              Initiative Description
            </label>
            <textarea
              id="bc-description"
              name="initiativeDescription"
              rows={4}
              defaultValue={current.initiativeDescription}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bc-outcome" className="block text-sm font-medium mb-1">
                Business Outcome Hypothesis
              </label>
              <textarea
                id="bc-outcome"
                name="businessOutcomeHypothesis"
                rows={4}
                defaultValue={current.businessOutcomeHypothesis}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="bc-indicators" className="block text-sm font-medium mb-1">
                Leading Indicators
              </label>
              <textarea
                id="bc-indicators"
                name="leadingIndicators"
                rows={4}
                defaultValue={current.leadingIndicators}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="bc-inscope" className="block text-sm font-medium mb-1">
                In Scope
              </label>
              <textarea
                id="bc-inscope"
                name="inScope"
                rows={3}
                defaultValue={current.inScope}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="bc-outscope" className="block text-sm font-medium mb-1">
                Out of Scope
              </label>
              <textarea
                id="bc-outscope"
                name="outOfScope"
                rows={3}
                defaultValue={current.outOfScope}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="bc-believe" className="block text-sm font-medium mb-1">
                What you need to believe in
              </label>
              <textarea
                id="bc-believe"
                name="whatYouNeedToBelieve"
                rows={3}
                defaultValue={current.whatYouNeedToBelieve}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Implementation cost — 6-month demand calculation */}
          <section className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Implementierungskosten — Bedarfskalkulation</p>
              <p className="text-xs text-muted-foreground">
                Geschätzter Kostenbedarf je 6-Monats-Periode.
              </p>
            </div>

            <input type="hidden" name="costSliceCount" value={slices.length} />

            <div className="space-y-2">
              {slices.map((amount, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted-foreground">
                    {costSliceLabel(i)}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    name={`costSlice_${i}`}
                    aria-label={costSliceLabel(i)}
                    value={amount}
                    onChange={(e) =>
                      setSlices((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder="0"
                    className={`${INPUT_CLASS} max-w-[12rem]`}
                  />
                  <button
                    type="button"
                    onClick={() => setSlices((prev) => prev.filter((_, j) => j !== i))}
                    disabled={slices.length <= 1}
                    className="text-sm text-muted-foreground hover:text-red-600 disabled:opacity-40"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSlices((prev) => [...prev, ""])}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              + Periode hinzufügen
            </button>

            <div className="flex items-center gap-3 border-t pt-2 text-sm font-medium">
              <span className="w-32 shrink-0">Gesamtkosten</span>
              <span>{costTotal.toLocaleString("de-DE")}</span>
            </div>
          </section>

          {/* Expected benefit */}
          <section className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Nutzen</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bc-onetime" className="block text-sm font-medium mb-1">
                  Einmaliger Nutzen
                </label>
                <input
                  id="bc-onetime"
                  type="number"
                  step="any"
                  min={0}
                  name="oneTimeBenefit"
                  defaultValue={current.oneTimeBenefit ?? ""}
                  placeholder="0"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="bc-recurring" className="block text-sm font-medium mb-1">
                  Wiederkehrender Nutzen p.a. (bei 100 % KPI-Zielerreichung)
                </label>
                <input
                  id="bc-recurring"
                  type="number"
                  step="any"
                  min={0}
                  name="recurringBenefit"
                  defaultValue={current.recurringBenefit ?? ""}
                  placeholder="0"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Die Gewichtung, welche KPI den wiederkehrenden Nutzen realisiert, wird im Tab „KPIs"
              je KPI als „Nutzen-Anteil" gepflegt.
            </p>
          </section>

          <div>
            <label htmlFor="bc-customers" className="block text-sm font-medium mb-1">
              Which internal and/or external customers are affected, and how?
            </label>
            <textarea
              id="bc-customers"
              name="customersAffected"
              rows={3}
              defaultValue={current.customersAffected}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="bc-impact" className="block text-sm font-medium mb-1">
              What is the potential impact on solutions, programs and services?
            </label>
            <textarea
              id="bc-impact"
              name="impactOnSolutions"
              rows={3}
              defaultValue={current.impactOnSolutions}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="bc-summary" className="block text-sm font-medium mb-1">
              Analysis Summary
            </label>
            <textarea
              id="bc-summary"
              name="analysisSummary"
              rows={4}
              defaultValue={current.analysisSummary}
              className={INPUT_CLASS}
            />
          </div>

          <div className="rounded border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            Business-Case-Freigaben werden im Tab <span className="font-medium">„Freigaben"</span>{" "}
            verwaltet (Mehrparteien-Workflow mit Status, Genehmiger und Datum).
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-red-600 text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-green-600 text-sm">
            Business Case gespeichert.
          </p>
        )}

        {!readOnly && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isPending ? "Speichern…" : "Business Case speichern"}
          </button>
        )}
      </form>

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            Versionshistorie ({history.length})
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((v, i) => (
              <p key={i} className="text-xs text-muted-foreground/60">
                {new Date(v.savedAt).toLocaleString("de-DE")}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
