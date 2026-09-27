"use client";

import { useTranslations } from "next-intl";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Der bestätigte Business Value an der Kachel** — nur bei abgeschlossenen
 * Features, denn nur sie gehen ins PI-Feedback. Grün, wenn der Business Owner
 * mehr Wert sieht als geplant, bernstein bei weniger.
 *
 * Unbestätigt bleibt die Kachel still: die Fusszeile ist schmal, und ein
 * „BV offen" auf jeder abgeschlossenen Karte verdrängte den Owner. Wie viele
 * bestätigt sind, sagen „Feedback einsehen" und die PI-Velocity.
 */
export function FeatureBvActual({ feature }: { feature: CockpitFeature }) {
  const t = useTranslations();
  if (feature.status !== "completed") return null;
  const plan = feature.wsjfBusinessValue;
  const ist = feature.wsjfBusinessValueActual;

  if (ist == null) return null;
  const ton =
    plan == null || ist === plan
      ? "bg-muted text-foreground"
      : ist > plan
        ? "bg-success-surface text-success"
        : "bg-warning-surface text-warning";
  return (
    <span
      className={`rounded-sm px-1 text-label font-semibold tabular-nums ${ton}`}
      title={t("drumbeat.feedback.badgeHinweis", { plan: plan ?? "—", ist })}
    >
      {plan != null && plan !== ist
        ? t("drumbeat.feedback.badgeAenderung", { plan, ist })
        : t("drumbeat.feedback.badgeBestaetigt", { ist })}
    </span>
  );
}
