import { useTranslations } from "next-intl";
import type { CockpitModel } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import type { CockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { PageHeader } from "@/components/layout";
import { CockpitToolbar } from "./cockpit-toolbar";
import { CockpitCreateFeature } from "./cockpit-create-feature";
import { CockpitArtPicker } from "./cockpit-art-picker";
import { CockpitEmpty } from "./cockpit-empty";
import { CockpitPiStrip } from "./cockpit-pi-strip";
import { CockpitPiContext } from "./cockpit-pi-context";
import { CockpitBoard } from "./cockpit-board";
import { CockpitTable } from "./cockpit-table";
import { CockpitRoadmap } from "./cockpit-roadmap";
import { CockpitNetworkLazy } from "./cockpit-network-lazy";
import { FeatureSlideOver } from "./feature-slide-over";
import { CockpitRealtimeSubscriber } from "./cockpit-realtime-subscriber";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Delivery-Cockpit-Shell — Komposition der drei stabilen Bestandteile
 * (Top-Bar, PI-Strip, Sicht-Toggle) plus Sicht-Slot. Server Component
 * uebergibt das vollstaendige Model; die Sub-Komponenten urteilen
 * client-seitig ueber URL-State (Sicht / Scope).
 *
 * Wenn `?featureId=` im URL gesetzt ist, laedt die Page parallel das
 * Feature-Detail-Bundle und gibt es als `slideOverDetail` herein —
 * der Slide-Over rendert dann ueber den drei Sichten.
 */
interface Props {
  model: CockpitModel;
  slideOverDetail: CockpitFeatureDetail | null;
  /** Tenant-Id fuer den Supabase-Realtime-Channel. */
  tenantId: string;
}

export function CockpitShell({ model, slideOverDetail, tenantId }: Props) {
  const t = useTranslations();
  const {
    availableArts,
    selectedArt,
    piStrip,
    piWindow,
    selectedPi,
    selectedPiId,
    allPiWindows,
    view,
    features,
    filters,
    filterOptions,
    dependencies,
    permissions,
  } = model;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-background">
      <CockpitRealtimeSubscriber tenantId={tenantId} />
      {/*
        **Wo bin ich.** Der Titel nannte den Scope nicht — er sagte statisch
        „Umsetzung · Delivery-Cockpit", während der ART-Wähler drei Bänder
        tiefer zwischen Sicht-Reitern und Filter-Chips stand. Jetzt trägt der
        Kopf den Scope: Wertstrom als Rubrik, ART als Titel, und der Wechsler
        steht daneben statt in der Filterleiste.
      */}
      <div className="border-b bg-surface-frame px-6 py-4">
        <PageHeader
          eyebrow={selectedArt?.valueStreamName ?? "Umsetzung"}
          title={selectedArt ? selectedArt.name : "Delivery-Cockpit"}
          subtitle={t("drumbeat.ui.boardTabelleFahrplanUnd")}
          actions={
            <>
              <CockpitArtPicker availableArts={availableArts} selectedArt={selectedArt} />
              {permissions.canCreate && selectedArt && (
                <CockpitCreateFeature
                  artId={selectedArt.id}
                  artValueStreamId={selectedArt.valueStreamId}
                />
              )}
            </>
          }
        />
      </div>
      {/*
        **Welcher Zeitraum** — und was mit ihm ist. Beides waren zwei eigene
        graue Bänder in Folge; sie handeln aber von derselben Sache: der
        gewählten PI. Ein Band, zwei Zeilen — oben die Wahl, darunter die Fakten
        und die Aktionen, die nur dieses PI betreffen.
      */}
      <div className="border-b bg-surface-frame">
        <CockpitPiStrip pis={piStrip} window={piWindow} selectedPiId={selectedPiId} />
        {selectedArt && selectedPi && (
          <CockpitPiContext
            pi={selectedPi}
            artId={selectedArt.id}
            canStart={permissions.canStart}
            canAdvance={permissions.canAdvance}
            canDelete={permissions.canDelete}
          />
        )}
      </div>
      <CockpitToolbar
        view={view}
        filters={filters}
        filterOptions={filterOptions}
        featureCount={features.length}
        hiddenBelowL3={model.hiddenBelowL3}
      />

      <main className="flex-1 px-6 pb-6 pt-4">
        {!selectedArt ? (
          <EmptyState
            title={t("drumbeat.ui.keinArtImScope")}
            body={t("drumbeat.ui.dirIstNochKein")}
            className="h-[420px]"
          />
        ) : features.length === 0 ? (
          /*
            Einmal für alle vier Sichten. Vorher hatte jede ihren eigenen
            Leerzustand — im Board waren es 28 gestrichelte Kästchen mit „leer" —
            und keiner sagte, ob Filter im Spiel sind.
          */
          <CockpitEmpty filters={filters} />
        ) : view === "board" ? (
          <CockpitBoard
            pis={piStrip}
            features={features}
            artId={selectedArt.id}
            canUpdate={permissions.canUpdate}
            canSetDelivery={permissions.canSetDelivery}
          />
        ) : view === "table" ? (
          <CockpitTable
            pis={piStrip}
            features={features}
            artId={selectedArt.id}
            canUpdate={permissions.canUpdate}
            canSetDelivery={permissions.canSetDelivery}
          />
        ) : view === "roadmap" ? (
          <CockpitRoadmap
            features={features}
            allPiWindows={allPiWindows}
            dependencies={dependencies}
            artId={selectedArt.id}
            canLinkDependency={permissions.canLinkDependency}
          />
        ) : (
          <CockpitNetworkLazy
            features={features}
            dependencies={dependencies}
            artId={selectedArt.id}
            canLinkDependency={permissions.canLinkDependency}
            canUpdate={permissions.canUpdate}
            savedPositions={model.graphPositions}
            pis={piStrip}
            selectedPiId={selectedPiId}
          />
        )}
      </main>

      {slideOverDetail && <FeatureSlideOver detail={slideOverDetail} />}
    </div>
  );
}
