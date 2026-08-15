/**
 * Page-Model fuer die Feature-Detail-Surface (Roadmap-P1.A).
 *
 * Buendelt die rohen Initiative-/Parent-/PI-Felder zu einem
 * fertigen Render-Shape, beantwortet welche Delivery-Transitionen
 * der aktuelle Status zulaesst, und gruppiert die WSJF-Komponenten +
 * Acceptance-Criteria fuer den Overview-Tab.
 *
 * Reine Funktion — kein DB-Zugriff. Aufgerufen von der Page mit den
 * vorbgeladenen Rohdaten.
 */

import {
  DELIVERY_STATUSES,
  canDeliveryTransition,
  type DeliveryStatus,
} from "@/modules/core/kernel/domain/initiative-status";
import { wsjfTier, type WsjfTier } from "@/modules/drumbeat/domain/wsjf";

// Re-export so existing importers of feature-detail keep working.
export { wsjfTier, type WsjfTier };

export interface FeatureDetailInput {
  id: string;
  title: string;
  description: string | null;
  status: string;
  parentId: string | null;
  parentTitle: string | null;
  parentStageGate: string | null;
  artId: string | null;
  artName: string | null;
  valueStreamId: string | null;
  valueStreamName: string | null;
  piId: string | null;
  piName: string | null;
  ownerId: string | null;
  ownerLabel: string | null;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  wsjfComputed: number | null;
  acceptanceCriteria: string[];
  /** SAFe-Guardrails (Roadmap-G2): Feature/Enabler. */
  featureType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureDetailModel {
  id: string;
  title: string;
  description: string | null;
  status: string;
  parent: { id: string; title: string; stageGate: string | null } | null;
  art: { id: string; name: string } | null;
  valueStream: { id: string; name: string } | null;
  pi: { id: string; name: string } | null;
  /** Rohe Id — der Picker braucht sie als Auswahlwert, das Label nur zur Anzeige. */
  ownerId: string | null;
  ownerLabel: string | null;
  wsjf: {
    businessValue: number | null;
    timeCriticality: number | null;
    riskReduction: number | null;
    jobSize: number | null;
    computed: number | null;
    tier: WsjfTier;
  };
  acceptanceCriteria: string[];
  /** SAFe-Guardrails (Roadmap-G2): Feature/Enabler. */
  featureType: string | null;
  /** Erlaubte Delivery-Folgestatus aus der FSM, gefiltert auf das aktuell
   *  gehaltene `status`. Leer fuer Terminal-States oder QS-Phasen. */
  allowedTransitions: DeliveryStatus[];
  createdAt: Date;
  updatedAt: Date;
}

export function buildFeatureDetailModel(input: FeatureDetailInput): FeatureDetailModel {
  const allowed = (DELIVERY_STATUSES as readonly string[]).filter((to) =>
    canDeliveryTransition(input.status, to),
  ) as DeliveryStatus[];

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    status: input.status,
    parent:
      input.parentId && input.parentTitle != null
        ? { id: input.parentId, title: input.parentTitle, stageGate: input.parentStageGate }
        : null,
    art: input.artId && input.artName != null ? { id: input.artId, name: input.artName } : null,
    valueStream:
      input.valueStreamId && input.valueStreamName != null
        ? { id: input.valueStreamId, name: input.valueStreamName }
        : null,
    pi: input.piId && input.piName != null ? { id: input.piId, name: input.piName } : null,
    // Für den vorausgewählten Owner-Picker; `ownerLabel` allein reicht nicht.
    ownerId: input.ownerId,
    ownerLabel: input.ownerLabel,
    wsjf: {
      businessValue: input.wsjfBusinessValue,
      timeCriticality: input.wsjfTimeCriticality,
      riskReduction: input.wsjfRiskReduction,
      jobSize: input.wsjfJobSize,
      computed: input.wsjfComputed,
      tier: wsjfTier(input.wsjfComputed),
    },
    acceptanceCriteria: input.acceptanceCriteria,
    featureType: input.featureType,
    allowedTransitions: allowed,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
