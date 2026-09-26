"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import type {
  CockpitDependency,
  CockpitFeature,
  CockpitPiSlot,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import {
  saveArtGraphLayoutAction,
  clearArtGraphLayoutAction,
} from "@/modules/drumbeat/features/cockpit/actions/art-graph-layout";
import { DependencyNetwork } from "@/modules/drumbeat/features/cockpit/components/dependency-network";

export type { NetworkLayout } from "@/modules/drumbeat/features/cockpit/components/dependency-network";

/**
 * **Der Netzplan des Umsetzungs-Cockpits** — ein Mantel um den gemeinsamen
 * `DependencyNetwork`: ein ART, dessen Rechte, und die Positionen der
 * Topologie je ART (`art_graph_positions`).
 */
export function CockpitNetwork({
  features,
  dependencies,
  artId,
  canLinkDependency,
  canUpdate,
  canScoreWsjf = false,
  canCreateFeature = false,
  savedPositions,
  pis,
  selectedPiId,
}: {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
  artId: string;
  canLinkDependency: boolean;
  /** ART-scoped `feature.update` — Zug in ein anderes PI, Positionen speichern. */
  canUpdate: boolean;
  /** `feature.wsjf.set` — WSJF und Job Size auf der Karte öffnen den Dialog. */
  canScoreWsjf?: boolean;
  /** ART-scoped `feature.create` — „+" am Knoten und an der Kante. */
  canCreateFeature?: boolean;
  savedPositions: Record<string, { x: number; y: number }>;
  pis: CockpitPiSlot[];
  selectedPiId: string | null;
}) {
  const t = useTranslations();

  const save = useCallback(
    async (positions: { initiativeId: string; x: number; y: number }[]) => {
      const fd = new FormData();
      fd.set("artId", artId);
      fd.set("positions", JSON.stringify(positions));
      const res = await saveArtGraphLayoutAction({}, fd);
      return res?.error ? { error: res.error } : undefined;
    },
    [artId],
  );

  const persistence = useMemo(
    () => ({
      positions: savedPositions,
      canPersist: canUpdate,
      save,
      clearButton: (
        <ConfirmMutateForm
          action={clearArtGraphLayoutAction}
          fields={{ artId }}
          label={t("drumbeat.ui.neuAnordnen")}
          pendingLabel="…"
          confirmPrompt={t("drumbeat.ui.neuAnordnenFrage")}
          icon={<LayoutGrid className="mr-1 size-3.5" />}
          size="sm"
        />
      ),
    }),
    [savedPositions, canUpdate, save, artId, t],
  );

  const permissions = useMemo(
    () => ({
      canUpdate,
      canLink: canLinkDependency,
      canCreate: canCreateFeature,
      canScore: canScoreWsjf,
    }),
    [canUpdate, canLinkDependency, canCreateFeature, canScoreWsjf],
  );

  return (
    <DependencyNetwork
      features={features}
      dependencies={dependencies}
      pis={pis}
      selectedPiId={selectedPiId}
      defaultArtId={artId}
      permissions={permissions}
      persistence={persistence}
      paramPrefix=""
      cardContext="epic"
      exportName={features.find((f) => f.artId === artId)?.artName ?? "umsetzung"}
    />
  );
}
