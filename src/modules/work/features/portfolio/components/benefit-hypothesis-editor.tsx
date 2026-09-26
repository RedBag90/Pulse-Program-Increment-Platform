"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { saveBenefitHypothesisAction } from "@/modules/work/features/portfolio/actions/benefit-hypothesis";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type {
  BenefitHypothesisFields,
  BenefitHypothesisVersion,
} from "@/modules/work/domain/benefit-hypothesis";

interface BenefitHypothesisEditorProps {
  epicId: string;
  current: BenefitHypothesisFields;
  history: BenefitHypothesisVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. Portfolio Manager). */
  readOnly?: boolean;
  /** Why the form is locked (the current approval phase) — shown as a hint. */
  lockReason?: string;
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
}: BenefitHypothesisEditorProps) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(saveBenefitHypothesisAction, {});

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
              {t("work.epic.massnahmenHypothese")}
            </label>
            <Textarea
              id="bh-measures"
              name="measuresHypothesis"
              rows={4}
              defaultValue={current.measuresHypothesis}
              placeholder={t("work.epic.welcheMassnahmeWirdVorgeschlagen")}
            />
          </div>

          <div>
            <label htmlFor="bh-change" className="block text-sm font-medium mb-1">
              {t("work.epic.veraenderungGgueStartpunkt")}
            </label>
            <Textarea
              id="bh-change"
              name="changeFromBaseline"
              rows={3}
              defaultValue={current.changeFromBaseline}
              placeholder={t("work.epic.wieUnterscheidetSichDie")}
            />
          </div>

          <div>
            <label htmlFor="bh-outcomes" className="block text-sm font-medium mb-1">
              {t("work.epic.businessOutcomes")}
              <span className="ml-2 font-normal text-muted-foreground">
                {t("work.epic.einPunktProZeile")}
              </span>
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
              {t("work.epic.leadingIndicators")}
              <span className="ml-2 font-normal text-muted-foreground">
                {t("work.epic.einPunktProZeile")}
              </span>
            </label>
            <Textarea
              id="bh-indicators"
              name="leadingIndicators"
              rows={4}
              defaultValue={current.leadingIndicators?.join("\n")}
              placeholder={t("work.epic.fruehindikatorenDieDenBusiness")}
            />
          </div>

          <div>
            <label htmlFor="bh-risks" className="block text-sm font-medium mb-1">
              {t("work.epic.risksUndAbhaengigkeitenLabel")}
              <span className="ml-2 font-normal text-muted-foreground">
                {t("work.epic.einPunktProZeile")}
              </span>
            </label>
            <Textarea
              id="bh-risks"
              name="risks"
              rows={4}
              defaultValue={current.risks?.join("\n")}
              placeholder={t("work.epic.risikenUndAbhaengigkeiten")}
            />
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("work.epic.benefitHypotheseGespeichert")}
          </p>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("common.ui.speichernLaeuft")
                : t("work.epic.benefitHypotheseSpeichern")}
            </Button>
          </div>
        )}
      </form>

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            {t("work.epic.versionshistorieAnzahl", { count: history.length })}
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((v, i) => (
              <div key={i} className="space-y-1 rounded-md bg-card p-3 text-xs shadow-card">
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
