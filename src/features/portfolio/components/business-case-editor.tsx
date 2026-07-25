"use client";

import { useActionState, useState } from "react";
import { Lock, Lightbulb, ArrowRight } from "lucide-react";
import { saveBusinessCaseAction } from "@/features/portfolio/actions/business-case";
import { submitEpicBusinessCaseAction } from "@/features/portfolio/actions/epic-approval";
import { Link } from "@/i18n/navigation";
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
  /** When true, renders the "Fertig zum Einreichen"-Checkbox + Submit-Button
   *  next to the save button. Aktiv nur in `approvalPhase = business_case`
   *  und mit `epic.businesscase.submit`-Capability — Sichtbarkeistlogik
   *  liegt auf der Page. */
  canSubmit?: boolean;
  /** KPI-Namen aus dem KPI-Tab. Ersetzen das frueher freie Leading-
   *  Indicators-Feld: Single-Source-of-Truth ist der KPI-Tab. */
  kpiNames?: string[];
  /** Nutzen bei 100 % KPI-Zielerreichung — direkt aus den KPIs berechnet (read-only). */
  kpiBenefit?: { oneTimeBenefit: number; recurringBenefit: number };
  /** Ob mindestens eine bewertete KPI (valuePerUnit gesetzt) existiert — steuert den Hinweis. */
  hasValuedKpis?: boolean;
}

const fmtEur = (n: number): string =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

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
  canSubmit = false,
  kpiNames = [],
  kpiBenefit = { oneTimeBenefit: 0, recurringBenefit: 0 },
  hasValuedKpis = false,
}: BusinessCaseEditorProps) {
  const [state, action, isPending] = useActionState(saveBusinessCaseAction, {});
  const [submitState, submitAction, submitPending] = useActionState(
    submitEpicBusinessCaseAction,
    {},
  );
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const submitDisabled = !readyToSubmit || submitPending;
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
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <label className="block text-sm font-medium">Leading Indicators</label>
                <a
                  href="?tab=kpis"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Im KPI-Tab pflegen <ArrowRight className="size-3" />
                </a>
              </div>
              {/* Bestandswert mitsenden, damit der Full-Replace-Save den
                  alten Freitext nicht ueberschreibt (Migration koennte
                  separat folgen). */}
              <input
                type="hidden"
                name="leadingIndicators"
                value={current.leadingIndicators ?? ""}
              />
              {kpiNames.length === 0 ? (
                <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-muted-foreground">
                  Noch keine KPI erfasst — pflege sie im KPI-Tab.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {kpiNames.map((name) => (
                    <li
                      key={name}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
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
          <section className="rounded-lg border p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
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
              </div>

              <aside className="self-start rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-xs leading-snug text-muted-foreground">
                      Zur besseren Konkretisierung nimm ein Breakdown vor — Features mit Aufwand
                      machen die Kostenkalkulation belastbarer.
                    </p>
                    <Link
                      href={`/portfolio/epics/${epicId}?tab=breakdown` as never}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                    >
                      Zum Breakdown <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* Expected benefit */}
          <section className="rounded-lg border p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <p className="text-sm font-medium">Nutzen</p>
                <p className="text-xs text-muted-foreground">
                  Der Nutzen wird direkt aus den KPIs berechnet — der Wert bei 100 % Zielerreichung.
                  Pflege ihn je KPI im Tab „KPIs" (€/Einheit + Ziel).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Einmaliger Nutzen</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {hasValuedKpis ? fmtEur(kpiBenefit.oneTimeBenefit) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">aus one-time-KPIs</p>
                  </div>
                  <div className="rounded border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Wiederkehrender Nutzen p.a.</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {hasValuedKpis ? fmtEur(kpiBenefit.recurringBenefit) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      aus wiederkehrenden KPIs, auf p.a. normalisiert
                    </p>
                  </div>
                </div>
              </div>

              <aside className="self-start rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-xs leading-snug text-muted-foreground">
                      {hasValuedKpis
                        ? "Der Nutzen ergibt sich aus €/Einheit × |Ziel − Baseline| je bewerteter KPI. Zum Anpassen die KPIs pflegen."
                        : "Noch keine bewertete KPI — hinterlege je KPI Benefit-Art, €/Einheit und Ziel, damit der Nutzen berechnet werden kann."}
                    </p>
                    <Link
                      href={`/portfolio/epics/${epicId}?tab=kpis` as never}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                    >
                      Zu den KPIs <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {isPending ? "Speichern…" : "Business Case speichern"}
            </button>
          </div>
        )}
      </form>

      {canSubmit && !readOnly && (
        // Separate form, damit Submit (epic.businesscase.submit) nicht
        // versehentlich die Save-Felder mitschickt. Auf gleicher Hoehe
        // wie der Save-Knopf, rechts ausgerichtet — analog zur Hypothese.
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
          <button
            type="submit"
            disabled={submitDisabled}
            className={`rounded px-4 py-2 text-sm font-medium text-white transition-opacity ${
              submitDisabled ? "cursor-not-allowed bg-blue-700/40" : "bg-blue-700 hover:bg-blue-800"
            }`}
          >
            {submitPending ? "Einreichen…" : "Business Case einreichen"}
          </button>
          {submitState.error && (
            <p role="alert" className="w-full text-right text-sm text-red-600">
              {submitState.error}
            </p>
          )}
          {submitState.success && (
            <p role="status" className="w-full text-right text-sm text-green-700">
              Business Case eingereicht — die Stakeholder entscheiden jetzt.
            </p>
          )}
        </form>
      )}

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
