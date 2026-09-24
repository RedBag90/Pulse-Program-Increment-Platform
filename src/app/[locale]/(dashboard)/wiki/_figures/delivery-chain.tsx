import { useTranslations } from "next-intl";
import { FEATURE_DELIVERY_STATUSES } from "@/modules/work/domain/feature-status";
import { canDeliveryTransition } from "@/modules/core/kernel/domain/initiative-status";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";

/**
 * Die **Schreibmaschine eines Features** — und zwar nicht abgezeichnet, sondern
 * **abgefragt**: fuer jedes Paar wird `canDeliveryTransition` aufgerufen, also
 * genau die Funktion, die die Aktion spaeter auch benutzt.
 *
 * Die Kanten-Tabelle selbst ist nicht exportiert, und das ist gut so. Eine
 * Figur, die den Waechter befragt, kann nicht anders sagen als er.
 */
export function DeliveryChain() {
  const t = useTranslations();
  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
      {FEATURE_DELIVERY_STATUSES.map((from) => {
        const to = FEATURE_DELIVERY_STATUSES.filter((t) => canDeliveryTransition(from, t));
        return (
          <div key={from} className="grid gap-2 p-4 sm:grid-cols-[190px_minmax(0,1fr)]">
            <p className="text-sm font-medium text-foreground">
              {STATUS_LABELS[from]}{" "}
              <code className="font-mono text-meta font-normal text-muted-foreground">{from}</code>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {to.length === 0 ? (
                <span className="text-muted-foreground/70">
                  {t("wiki.ui.endzustandKeineKanteHinaus")}
                </span>
              ) : (
                to.map((t, i) => (
                  <span key={t}>
                    {i > 0 && " · "}
                    <span aria-hidden className="text-muted-foreground/70">
                      →
                    </span>{" "}
                    {STATUS_LABELS[t]}
                  </span>
                ))
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
