"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { saveBenefitHypothesisAction } from "@/features/portfolio/actions/benefit-hypothesis";
import { submitEpicHypothesisAction } from "@/features/portfolio/actions/epic-approval";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type {
  BenefitHypothesisFields,
  BenefitHypothesisVersion,
} from "@/domain/benefit-hypothesis";

interface BenefitHypothesisEditorProps {
  epicId: string;
  current: BenefitHypothesisFields;
  history: BenefitHypothesisVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. Portfolio Manager). */
  readOnly?: boolean;
  /** Why the form is locked (the current approval phase) — shown as a hint. */
  lockReason?: string;
  /** When true, renders the "Fertig zum Einreichen"-Checkbox + Submit-Button
   *  next to the save button. Aktiv nur in `approvalPhase = draft` und mit
   *  `epic.hypothesis.submit`-Capability — die Sichtbarkeitslogik liegt auf
   *  der Page. */
  canSubmit?: boolean;
}

function formatVersionField(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

export function BenefitHypothesisEditor({
  epicId,
  current,
  history,
  readOnly = false,
  lockReason,
  canSubmit = false,
}: BenefitHypothesisEditorProps) {
  const [state, action, isPending] = useActionState(saveBenefitHypothesisAction, {});
  const [submitState, submitAction, submitPending] = useActionState(submitEpicHypothesisAction, {});
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const submitDisabled = !readyToSubmit || submitPending;

  return (
    <div className="space-y-6">
      {readOnly && lockReason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lockReason}</span>
        </div>
      )}
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <label htmlFor="bh-measures" className="block text-sm font-medium mb-1">
              Maßnahmen-Hypothese
            </label>
            <Textarea
              id="bh-measures"
              name="measuresHypothesis"
              rows={4}
              defaultValue={current.measuresHypothesis}
              placeholder="Welche Maßnahme wird vorgeschlagen und warum?"
            />
          </div>

          <div>
            <label htmlFor="bh-change" className="block text-sm font-medium mb-1">
              Veränderung ggü. Startpunkt
            </label>
            <Textarea
              id="bh-change"
              name="changeFromBaseline"
              rows={3}
              defaultValue={current.changeFromBaseline}
              placeholder="Wie unterscheidet sich die Lösung vom heutigen Zustand?"
            />
          </div>

          <div>
            <label htmlFor="bh-outcomes" className="block text-sm font-medium mb-1">
              Business Outcomes
              <span className="ml-2 font-normal text-muted-foreground">— ein Punkt pro Zeile</span>
            </label>
            <Textarea
              id="bh-outcomes"
              name="businessOutcomes"
              rows={4}
              defaultValue={current.businessOutcomes?.join("\n")}
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
            <Textarea
              id="bh-indicators"
              name="leadingIndicators"
              rows={4}
              defaultValue={current.leadingIndicators?.join("\n")}
              placeholder={"Frühindikatoren, die den Business Outcome vorhersagen"}
            />
          </div>

          <div>
            <label htmlFor="bh-risks" className="block text-sm font-medium mb-1">
              Risks &amp; Abhängigkeiten
              <span className="ml-2 font-normal text-muted-foreground">— ein Punkt pro Zeile</span>
            </label>
            <Textarea
              id="bh-risks"
              name="risks"
              rows={4}
              defaultValue={current.risks?.join("\n")}
              placeholder={"Risiken und Abhängigkeiten"}
            />
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-600">
            Benefit Hypothese gespeichert.
          </p>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Speichern…" : "Benefit Hypothese speichern"}
            </Button>
          </div>
        )}
      </form>

      {canSubmit && !readOnly && (
        // Separate form, damit Submit (epic.hypothesis.submit) nicht
        // versehentlich die Save-Felder mitschickt. Auf gleicher Hoehe
        // wie der Save-Knopf, rechts ausgerichtet.
        <form
          action={submitAction}
          className="flex flex-wrap items-center justify-end gap-3 border-t pt-4"
        >
          <input type="hidden" name="epicId" value={epicId} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={readyToSubmit}
              onChange={(e) => setReadyToSubmit(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Fertig zum Einreichen
          </label>
          <Button type="submit" disabled={submitDisabled}>
            {submitPending ? "Einreichen…" : "Hypothese einreichen"}
          </Button>
          {submitState.error && (
            <p role="alert" className="w-full text-right text-sm text-destructive">
              {submitState.error}
            </p>
          )}
          {submitState.success && (
            <p role="status" className="w-full text-right text-sm text-emerald-600">
              Hypothese eingereicht — der Portfolio Manager entscheidet jetzt.
            </p>
          )}
        </form>
      )}

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            Versionshistorie ({history.length})
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((v, i) => (
              <div key={i} className="space-y-1 rounded-md border bg-card p-3 text-xs">
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
