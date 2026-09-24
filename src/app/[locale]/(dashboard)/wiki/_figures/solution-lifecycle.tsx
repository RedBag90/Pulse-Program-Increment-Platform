import { useTranslations } from "next-intl";
import {
  SOLUTION_STATUSES,
  SOLUTION_STATUS_STEP_KEYS,
  SOLUTION_TRANSITIONS,
  PROMOTION_CRITERIA,
} from "@/modules/core/org/domain/solution";

/**
 * Die Lebenszyklus-Leiste als Figur: fuenf Stufen, und je Stufe die Kanten, die
 * von ihr wegfuehren.
 *
 * **Genau eine Kante traegt ein Tor** — der Eintritt in den Kern. Dass es genau
 * eine ist, behauptet diese Datei nicht, sie liest es aus `gate` ab; und die
 * vier Kriterien darunter stehen nicht abgeschrieben da, sondern kommen aus
 * `PROMOTION_CRITERIA`. Aendert jemand das Tor, aendert sich die Anleitung mit.
 */
export function SolutionLifecycle() {
  const t = useTranslations();
  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
      {SOLUTION_STATUSES.map((s) => (
        <div key={s} className="space-y-2 p-4">
          <p className="font-heading text-sm font-semibold text-foreground">
            {t(SOLUTION_STATUS_STEP_KEYS[s])}
          </p>
          <ul className="space-y-1.5">
            {SOLUTION_TRANSITIONS[s].map((schritt) => (
              <li key={schritt.to} className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-mono text-muted-foreground/70">→</span> {schritt.label}
                {schritt.gate && (
                  <>
                    {" "}
                    <span className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 font-mono text-meta uppercase tracking-[0.1em] text-amber-900 dark:text-amber-200">
                      {t("wiki.ui.tor")}
                    </span>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
                      {PROMOTION_CRITERIA.map((c) => (
                        <li key={c.key}>{c.label}</li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
