import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatEUR } from "@/lib/formatting";
import {
  classificationDrift,
  EPIC_CLASS_KEYS,
  type EpicClassification,
  type IntendedClass,
} from "@/modules/work/domain/pb-submission";
import {
  GUARDRAIL_SOURCE_KEYS,
  type GuardrailTargetsSource,
} from "@/modules/work/domain/portfolio-guardrails";

/**
 * Portfolio-Epic oder ART-Epic — mit der Begründung daneben.
 *
 * Ein Badge allein wirft die Frage auf, warum. Deshalb steht die Rechnung dabei:
 * welche Kosten, gegen welches Limit, aus welcher Quelle. Und wo die Klasse noch
 * nicht feststeht, sagt die Fläche das, statt „ART-Epic" zu behaupten — ohne
 * freigegebenen Business Case ist nicht entschieden, wie groß das Vorhaben ist.
 */
export function EpicClassBadge({
  classification,
  source,
  fundingGap,
  intended = null,
}: {
  classification: EpicClassification;
  source: GuardrailTargetsSource;
  /** Warum dieses ART-Epic derzeit nirgends finanziert werden kann. */
  fundingGap?: "noArt" | "noPot" | null | undefined;
  /** Beim Anlegen hinterlegte Erwartung; `null` bei Bestands-Epics. */
  intended?: IntendedClass;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const b = (c: ReactNode) => <strong className="font-semibold">{c}</strong>;
  const { epicClass, cost, threshold, overridden } = classification;
  const drift = classificationDrift(intended, epicClass);

  return (
    <div className="space-y-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
          epicClass == null
            ? "bg-muted text-muted-foreground"
            : epicClass === "portfolio"
              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {epicClass == null
          ? t("work.epic.nochNichtEingeordnet")
          : t(EPIC_CLASS_KEYS[epicClass] ?? epicClass)}
      </span>
      {intended != null && epicClass == null && (
        <p className="text-xs text-muted-foreground">
          {t("work.epic.erwartet")}{" "}
          <strong className="font-medium">{t(EPIC_CLASS_KEYS[intended] ?? intended)}</strong>
          {t("work.epic.dieEinordnungEntstehtMit")}
        </p>
      )}
      {drift !== "none" && intended != null && (
        <p className="rounded-r-md border-l-2 border-l-amber-600 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {t.rich(drift === "up" ? "work.epic.abweichungHoch" : "work.epic.abweichungRunter", {
            b,
          })}
        </p>
      )}
      {/**
       * **Ein Satz, nicht drei.** Solange nichts freigegeben ist, stand hier
       * dreimal dieselbe Auskunft: „Erwartet: … entsteht mit der Freigabe des
       * Business Case", darunter „Ohne freigegebenen Lean Business Case liegt
       * keine belastbare Kostenschätzung vor. Die Einordnung entsteht mit der
       * Freigabe an L2", und im Formular darunter noch „Erwartung — die Klasse
       * entsteht mit der Business-Case-Freigabe aus den Kosten."
       *
       * Jetzt gilt: gibt es eine Erwartung, sagt die Zeile darüber alles;
       * gibt es keine, tritt die Erklärung an ihre Stelle.
       */}
      <p className="text-xs text-muted-foreground">
        {overridden ? (
          <>{t("work.epic.ausnahmeDiesesEpicIst")}</>
        ) : epicClass == null ? (
          intended != null ? null : (
            <>{t("work.epic.ohneFreigegebenenLeanBusiness")}</>
          )
        ) : (
          <>
            {t(
              epicClass === "portfolio"
                ? "work.epic.kostenUeberLimit"
                : "work.epic.kostenUnterLimit",
              {
                cost: formatEUR(cost ?? 0, locale),
                limit: formatEUR(threshold, locale),
                source: t(GUARDRAIL_SOURCE_KEYS[source] ?? source),
              },
            )}
          </>
        )}
      </p>
      {fundingGap && (
        <p className="rounded-r-md border-l-2 border-l-amber-600 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {t.rich(
            fundingGap === "noArt"
              ? "work.epic.keinFinanzierungswegOhneArt"
              : "work.epic.keinFinanzierungswegOhneRahmen",
            { b },
          )}
        </p>
      )}
    </div>
  );
}
