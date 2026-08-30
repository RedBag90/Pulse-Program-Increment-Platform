import { AmpelPill } from "@/components/ui/ampel-pill";
import type { GoalStatusTier } from "@/modules/core/goals/domain/goal-status";
import type { GuardrailStatus } from "@/modules/work/server/views/portfolio-guardrails-view";

/** Der View spricht „red", der geteilte Ampel-Farbraum „rose". */
const TIER: Record<GuardrailStatus, GoalStatusTier> = {
  green: "green",
  amber: "amber",
  red: "rose",
  unknown: "neutral",
};

/** Was die Ampel *bedeutet* — nicht, welche Farbe sie hat. */
const LABEL: Record<GuardrailStatus, string> = {
  green: "Im Ziel",
  amber: "Abweichung",
  red: "Kritisch",
  unknown: "Keine Daten",
};

/** Status-Badge im Kopf einer Guardrail-Karte. Eine Ampelsprache fuer alle drei. */
export function GuardrailStatusBadge({ status }: { status: GuardrailStatus }) {
  return <AmpelPill tinted tier={TIER[status]} label={LABEL[status]} />;
}
