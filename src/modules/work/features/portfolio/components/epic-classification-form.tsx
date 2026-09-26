"use client";

import { useTranslations } from "next-intl";
import { useActionState, startTransition } from "react";
import { updateEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import {
  EPIC_TYPES,
  EPIC_TYPE_KEYS,
  HORIZONS,
  HORIZON_KEYS,
} from "@/modules/work/domain/portfolio-guardrails";
import { epicHorizon, horizonEditDeniedReason } from "@/modules/work/domain/epic-horizon";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { intendedClassOptions } from "@/modules/work/features/portfolio/components/intended-class-options";
import { EPIC_CLASS_KEYS } from "@/modules/work/domain/pb-submission";
import { PortfolioOverrideDialog } from "@/modules/work/features/portfolio/components/portfolio-override-dialog";
import { useLocale } from "next-intl";
import type { Gated } from "@/modules/core/kernel/domain/gated";

interface Props {
  epicId: string;
  epicType: string | null;
  /** Der am Epic gesetzte Horizont. `null` = aus der Primär-Solution ableiten. */
  ownHorizon: string | null;
  /** Der Horizont der Primär-Solution — die Ableitung, falls es eine gibt. */
  solutionHorizon: string | null;
  /** Der L3.1-Stempel als ISO-Tag; er entscheidet über das Einfrieren. */
  businessCaseApprovedAtIso: string | null;
  canEdit: boolean;
  /**
   * `epic.portfolio_override` — nötig, sobald der Horizont eingefroren ist,
   * **und** um ein ART-Epic zur Portfolio-Sache zu erklären.
   */
  canOverrideHorizon: boolean;
  /**
   * **Die Einordnung als Scheibe, nicht als drei Felder.**
   *
   * Bis September 2026 standen hier `intendedClass`, `derivedClass` und
   * `portfolioThreshold` einzeln und je `… | null`. Die Aufrufstelle füllte sie
   * mit `classification?.intended ?? null` — und weil die Lesestelle hinter der
   * Practice `artEpics` lag, das Feld aber davor, wurde aus „die Practice ist
   * aus" ein „noch nicht eingeordnet": gespeichert wurde, angezeigt nicht.
   *
   * Als `Gated` lässt sich das nicht mehr schreiben. Ist die Practice aus,
   * entfällt der Abschnitt — Epic-Typ und Horizont bleiben, die hängen nicht
   * daran.
   */
  classification: Gated<{
    /** Die beim Anlegen hinterlegte Erwartung. Vor L2 das Einzige, was es gibt. */
    intended: "portfolio" | "art" | null;
    /**
     * Die **abgeleitete** Klasse, sobald der Business Case freigegeben ist —
     * `null`, solange sie noch nicht entstanden ist.
     */
    derived: "portfolio" | "art" | null;
    /** Das Portfolio-Limit des Wertstroms; steht im Etikett der Optionen. */
    threshold: number | null;
  }>;
  /** Gesetzt, wenn jemand die Ableitung bereits überschrieben hat. */
  portfolioOverrideAtIso: string | null;
  /** Für `setPortfolioOverrideAction` — der Scope des Rechts. */
  valueStreamId: string | null;
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

/**
 * SAFe-Guardrails-Klassifikation: **Epic-Typ** und **Investitionshorizont**,
 * beide mit Auto-Submit.
 *
 * Der Horizont war bis September 2026 read-only und kam bei jedem Lesen aus der
 * Primär-Solution. Jetzt kann er am Epic stehen — nötig für Epics ohne Solution
 * (das Feld ist beim Anlegen optional) — und friert mit der
 * Business-Case-Freigabe ein, damit ein späterer Solution-Wechsel die
 * Geschichte nicht rückwirkend umschreibt.
 *
 * Die drei Zustände stehen im Untertext, damit niemand raten muss, woher der
 * angezeigte Wert kommt: *aus Primär-Solution* · *am Epic gesetzt* ·
 * *eingefroren mit der Business-Case-Freigabe am …*
 */
export function EpicClassificationForm({
  epicId,
  epicType,
  ownHorizon,
  solutionHorizon,
  businessCaseApprovedAtIso,
  canEdit,
  canOverrideHorizon,
  classification,
  portfolioOverrideAtIso,
  valueStreamId,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as "de" | "en";
  const [state, submit, busy] = useActionState(updateEpicAction, {});

  const resolved = epicHorizon({
    investmentHorizon: ownHorizon,
    solutionHorizon,
    businessCaseApprovedAt: businessCaseApprovedAtIso ? new Date(businessCaseApprovedAtIso) : null,
  });
  const denied = horizonEditDeniedReason({
    frozen: resolved.frozen,
    mayEditEpic: canEdit,
    mayOverride: canOverrideHorizon,
  });

  function update(field: "epicType" | "investmentHorizon" | "intendedClass", value: string) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set(field, value);
    startTransition(() => submit(fd));
  }

  // Woher der Wert kommt — in Nutzersprache, nicht als Feldname.
  const origin =
    resolved.frozen && businessCaseApprovedAtIso
      ? t("work.epic.horizontEingefroren", { datum: dateLabel(businessCaseApprovedAtIso) })
      : resolved.source === "epic"
        ? t("work.epic.horizontAmEpic")
        : resolved.source === "solution"
          ? t("work.epic.horizontAusSolution")
          : t("work.epic.horizontOhne");

  return (
    <div className="space-y-2">
      {/* Untereinander, nicht nebeneinander: die Karte steht in der schmalen
          Akten-Spalte, und zwei Selects daneben ergeben zwei enge Streifen.
          Bisher stand hier `grid-cols-2` ganz ohne Breakpoint — auf dem Handy
          war es derselbe Fehler, nur früher. */}
      <div className="grid gap-3">
        <div>
          <label
            htmlFor="epic-type-select"
            className="mb-1.5 block text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            {t("work.epic.epicTyp")}
          </label>
          {canEdit ? (
            <select
              id="epic-type-select"
              value={epicType ?? ""}
              disabled={busy}
              onChange={(e) => update("epicType", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">{t("work.epic.ungesetzt")}</option>
              {EPIC_TYPES.map((wert) => (
                <option key={wert} value={wert}>
                  {t(EPIC_TYPE_KEYS[wert] ?? wert)}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {epicType
                ? t(EPIC_TYPE_KEYS[epicType as keyof typeof EPIC_TYPE_KEYS] ?? epicType)
                : "—"}
            </div>
          )}
        </div>
        {/**
         * **Einordnung: vor L2 eine Erwartung, danach eine Ableitung.**
         *
         * Die Klasse eines Epics entsteht mit der Business-Case-Freigabe aus
         * den Kosten gegen das Portfolio-Limit seines Wertstroms — vorher gibt
         * es sie schlicht nicht. Was das Epic bis dahin trägt, ist die Angabe
         * aus dem Anlege-Dialog: womit gerechnet wird.
         *
         * Deshalb zwei Zustände statt eines Auswahlfelds, das immer ginge:
         * solange nichts freigegeben ist, ist die Erwartung änderbar; danach
         * steht die Ableitung da, und wer `epic.portfolio_override` trägt,
         * kann sie **einseitig** anheben — ART-Epic zur Portfolio-Sache, nie
         * umgekehrt. Was über dem Limit liegt, braucht eine
         * Portfolio-Entscheidung, und der Rahmen eines ARTs könnte es ohnehin
         * nicht tragen.
         */}
        {/**
         * **Der Abschnitt steht und fällt mit der Practice — als Ganzes.**
         *
         * Vorher hing das Abzeichen darüber hinter `artEpics`, dieses Feld
         * aber davor: man konnte speichern, was nie zurückgelesen wurde. Jetzt
         * entscheidet **eine** Bedingung über beides, und der Typ erzwingt sie.
         */}
        {classification.disabled
          ? null
          : (() => {
              const { intended, derived, threshold } = classification;
              return (
                <div>
                  <label
                    htmlFor="epic-class-select"
                    className="mb-1.5 block text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    {t("work.epic.einordnung")}
                  </label>
                  {derived == null ? (
                    canEdit ? (
                      <select
                        id="epic-class-select"
                        value={intended ?? ""}
                        disabled={busy}
                        onChange={(e) => update("intendedClass", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        <option value="">{t("work.epic.nochNichtEingeordnet")}</option>
                        {intendedClassOptions(threshold, t, locale).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        {intended ? t(EPIC_CLASS_KEYS[intended]) : "—"}
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                      <span>{t(EPIC_CLASS_KEYS[derived])}</span>
                      {canOverrideHorizon &&
                        derived === "art" &&
                        portfolioOverrideAtIso == null && (
                          <PortfolioOverrideDialog
                            epicId={epicId}
                            valueStreamId={valueStreamId ?? ""}
                          />
                        )}
                    </div>
                  )}
                  {/* Vor der Freigabe steht die Auskunft schon im Abzeichen darüber —
                hier stünde sie zum dritten Mal. */}
                  {derived == null ? null : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {portfolioOverrideAtIso
                        ? t("work.epic.einordnungUeberschrieben", {
                            datum: dateLabel(portfolioOverrideAtIso),
                          })
                        : t("work.epic.einordnungAbgeleitet")}
                    </p>
                  )}
                </div>
              );
            })()}
        <div>
          <label
            htmlFor="epic-horizon-select"
            className="mb-1.5 block text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            {t("work.epic.horizont")}
          </label>
          {denied === null ? (
            <select
              id="epic-horizon-select"
              value={ownHorizon ?? ""}
              disabled={busy}
              onChange={(e) => update("investmentHorizon", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {/* Leerer Wert = wieder ableiten. Ohne Solution heisst das „ohne". */}
              <option value="">
                {solutionHorizon
                  ? t("work.epic.horizontAusPrimaerSolutionOption", {
                      horizon:
                        t(HORIZON_KEYS[solutionHorizon as keyof typeof HORIZON_KEYS]) ??
                        solutionHorizon,
                    })
                  : t("work.epic.ohneHorizontOption")}
              </option>
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {t(HORIZON_KEYS[h])}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <HorizonBadge horizon={resolved.horizon} withHelp />
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{origin}</p>
          {denied !== null && canEdit && (
            <p className="mt-1 text-xs text-muted-foreground">{denied}</p>
          )}
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
