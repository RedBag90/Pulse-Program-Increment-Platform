"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { LayoutGrid, Network } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";
import {
  saveBreakdownLayoutAction,
  clearBreakdownLayoutAction,
} from "@/modules/work/features/portfolio/actions/breakdown-layout";
import { useBreakdownRealtime } from "@/modules/work/features/portfolio/hooks/use-breakdown-realtime";
import type { EpicNetworkModel } from "@/modules/drumbeat/server/views/epic-network-view";
import { DependencyNetwork } from "@/modules/drumbeat/features/cockpit/components/dependency-network";

/**
 * **Der Netzplan des Epic-Reiters „Dependencies"** — ein Mantel um den
 * gemeinsamen `DependencyNetwork`, wie `CockpitNetwork` für die Umsetzung.
 *
 * Eigen sind ihm: die Positionen je Epic (`initiative_graph_positions`, Recht
 * `epic.update`), die Kartenzeile „ART ▸ Solution" (alle Karten tragen
 * dasselbe Epic), eigene URL-Parameter und die Live-Aktualisierung, wenn
 * jemand anderes am selben Epic arbeitet.
 */
export function EpicNetwork({
  epicId,
  tenantId,
  epicTitle,
  epicValueStreamId,
  model,
  savedPositions,
  canEditEpic,
}: {
  epicId: string;
  tenantId: string;
  epicTitle: string;
  epicValueStreamId: string | null;
  model: EpicNetworkModel;
  savedPositions: Record<string, { x: number; y: number }>;
  /** `epic.update` — Positionen speichern und verwerfen, erstes Feature anlegen. */
  canEditEpic: boolean;
}) {
  const t = useTranslations();
  useBreakdownRealtime(tenantId);

  const save = useCallback(
    async (positions: { initiativeId: string; x: number; y: number }[]) => {
      const fd = new FormData();
      fd.set("epicId", epicId);
      fd.set("positions", JSON.stringify(positions));
      const res = await saveBreakdownLayoutAction({}, fd);
      return res?.error ? { error: res.error } : undefined;
    },
    [epicId],
  );

  const persistence = useMemo(
    () => ({
      positions: savedPositions,
      canPersist: canEditEpic,
      save,
      clearButton: (
        <ConfirmMutateForm
          action={clearBreakdownLayoutAction}
          fields={{ epicId }}
          label={t("drumbeat.ui.neuAnordnen")}
          pendingLabel="…"
          confirmPrompt={t("drumbeat.ui.neuAnordnenFrage")}
          icon={<LayoutGrid className="mr-1 size-3.5" />}
          size="sm"
        />
      ),
    }),
    [savedPositions, canEditEpic, save, epicId, t],
  );

  return (
    <DependencyNetwork
      features={model.features}
      dependencies={model.dependencies}
      pis={model.pis}
      selectedPiId={model.selectedPiId}
      defaultArtId={model.artId ?? ""}
      permissions={model.permissions}
      persistence={persistence}
      paramPrefix="e"
      cardContext="art"
      exportName={epicTitle}
      emptyState={
        <EmptyState
          className="h-64"
          icon={<Network className="size-6" />}
          title={t("drumbeat.ui.nochKeineDeliverables")}
          body={t("drumbeat.ui.ohneDeliverablesGibtEs")}
          action={
            canEditEpic ? (
              <CreateFeatureDialog
                epics={[{ id: epicId, title: epicTitle, valueStreamId: epicValueStreamId }]}
                context={{ epicId }}
                {...(model.artId ? { artId: model.artId } : {})}
              />
            ) : undefined
          }
        />
      }
    />
  );
}
