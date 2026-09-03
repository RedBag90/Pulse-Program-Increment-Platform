import { formatEUR } from "@/lib/formatting";
import { EPIC_CLASS_LABELS, type EpicClassification } from "@/modules/work/domain/pb-submission";
import {
  GUARDRAIL_SOURCE_LABELS,
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
}: {
  classification: EpicClassification;
  source: GuardrailTargetsSource;
  /** Warum dieses ART-Epic derzeit nirgends finanziert werden kann. */
  fundingGap?: "noArt" | "noPot" | null | undefined;
}) {
  const { epicClass, cost, threshold, overridden } = classification;

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
        {epicClass == null ? "Noch nicht eingeordnet" : EPIC_CLASS_LABELS[epicClass]}
      </span>
      <p className="text-xs text-muted-foreground">
        {overridden ? (
          <>Ausnahme: dieses Epic ist bewusst Portfolio-Sache, unabhängig von seinen Kosten.</>
        ) : epicClass == null ? (
          <>
            Ohne freigegebenen Lean Business Case liegt keine belastbare Kostenschätzung vor. Die
            Einordnung entsteht mit der Freigabe an L3.1.
          </>
        ) : (
          <>
            Kosten {formatEUR(cost ?? 0)} {epicClass === "portfolio" ? "über" : "unter"} dem
            Portfolio-Limit von {formatEUR(threshold)} ({GUARDRAIL_SOURCE_LABELS[source]}).{" "}
            {epicClass === "art"
              ? "Finanziert wird aus dem Rahmen des ARTs."
              : "Finanziert wird über eine Budget-Kachel."}
          </>
        )}
      </p>
      {fundingGap && (
        <p className="rounded-r-md border-l-2 border-l-amber-600 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-semibold">Kein Finanzierungsweg.</strong>{" "}
          {fundingGap === "noArt"
            ? "Das Epic trägt keinen ART und kann deshalb aus keinem Rahmen finanziert werden."
            : "Für den ART dieses Epics ist kein Veränderungsrahmen angelegt."}{" "}
          Als ART-Epic steht es auch nicht auf dem Portfolio-Ballot. Ausweg: einen Rahmen anlegen —
          oder das Epic mit Begründung bewusst zur Portfolio-Sache erklären.
        </p>
      )}
    </div>
  );
}
