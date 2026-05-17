"use client";

import { useActionState } from "react";
import { saveBenefitHypothesisAction } from "@/features/portfolio/actions/benefit-hypothesis";
import type {
  BenefitHypothesisFields,
  BenefitHypothesisVersion,
} from "@/domain/benefit-hypothesis";

interface BenefitHypothesisEditorProps {
  epicId: string;
  current: BenefitHypothesisFields;
  history: BenefitHypothesisVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. VMO). */
  readOnly?: boolean;
}

const TEXTAREA_CLASS =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function formatVersionField(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

export function BenefitHypothesisEditor({
  epicId,
  current,
  history,
  readOnly = false,
}: BenefitHypothesisEditorProps) {
  const [state, action, isPending] = useActionState(saveBenefitHypothesisAction, {});

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <label htmlFor="bh-measures" className="block text-sm font-medium mb-1">
              Maßnahmen-Hypothese
            </label>
            <textarea
              id="bh-measures"
              name="measuresHypothesis"
              rows={4}
              defaultValue={current.measuresHypothesis}
              className={TEXTAREA_CLASS}
              placeholder="Welche Maßnahme wird vorgeschlagen und warum?"
            />
          </div>

          <div>
            <label htmlFor="bh-change" className="block text-sm font-medium mb-1">
              Veränderung ggü. Startpunkt
            </label>
            <textarea
              id="bh-change"
              name="changeFromBaseline"
              rows={3}
              defaultValue={current.changeFromBaseline}
              className={TEXTAREA_CLASS}
              placeholder="Wie unterscheidet sich die Lösung vom heutigen Zustand?"
            />
          </div>

          <div>
            <label htmlFor="bh-outcomes" className="block text-sm font-medium mb-1">
              Business Outcomes
              <span className="ml-2 font-normal text-muted-foreground">— ein Punkt pro Zeile</span>
            </label>
            <textarea
              id="bh-outcomes"
              name="businessOutcomes"
              rows={4}
              defaultValue={current.businessOutcomes?.join("\n")}
              className={TEXTAREA_CLASS}
              placeholder={
                "Messbare Vorteile, die das Unternehmen erzielen kann\n(eine Zeile = ein Outcome)"
              }
            />
          </div>

          <div>
            <label htmlFor="bh-indicators" className="block text-sm font-medium mb-1">
              Leading Indicators
              <span className="ml-2 font-normal text-muted-foreground">— ein Punkt pro Zeile</span>
            </label>
            <textarea
              id="bh-indicators"
              name="leadingIndicators"
              rows={4}
              defaultValue={current.leadingIndicators?.join("\n")}
              className={TEXTAREA_CLASS}
              placeholder={"Frühindikatoren, die den Business Outcome vorhersagen"}
            />
          </div>

          <div>
            <label htmlFor="bh-risks" className="block text-sm font-medium mb-1">
              Risks &amp; Abhängigkeiten
              <span className="ml-2 font-normal text-muted-foreground">— ein Punkt pro Zeile</span>
            </label>
            <textarea
              id="bh-risks"
              name="risks"
              rows={4}
              defaultValue={current.risks?.join("\n")}
              className={TEXTAREA_CLASS}
              placeholder={"Risiken und Abhängigkeiten"}
            />
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-red-600 text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-green-600 text-sm">
            Benefit Hypothese gespeichert.
          </p>
        )}

        {!readOnly && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isPending ? "Speichern…" : "Benefit Hypothese speichern"}
          </button>
        )}
      </form>

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            Versionshistorie ({history.length})
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((v, i) => (
              <div key={i} className="rounded border bg-white p-3 text-xs space-y-1">
                <p className="text-muted-foreground/60">
                  {new Date(v.savedAt).toLocaleString("de-DE")}
                </p>
                {(
                  [
                    ["measuresHypothesis", "Maßnahmen-Hypothese"],
                    ["changeFromBaseline", "Veränderung ggü. Startpunkt"],
                    ["businessOutcomes", "Business Outcomes"],
                    ["leadingIndicators", "Leading Indicators"],
                    ["risks", "Risks & Abhängigkeiten"],
                  ] as const
                )
                  .filter(([key]) => {
                    const value = v.content[key];
                    return Array.isArray(value) ? value.length > 0 : Boolean(value);
                  })
                  .map(([key, label]) => (
                    <p key={key}>
                      <span className="font-medium text-muted-foreground">{label}:</span>{" "}
                      <span className="text-foreground/80">
                        {formatVersionField(v.content[key])}
                      </span>
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
