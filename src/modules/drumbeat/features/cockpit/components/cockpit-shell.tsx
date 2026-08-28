import type { CockpitModel } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import type { CockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { PageHeader } from "@/components/layout";
import { CockpitToolbar } from "./cockpit-toolbar";
import { CockpitCreateFeature } from "./cockpit-create-feature";
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
      <div className="border-b bg-surface-frame px-6 py-4">
        <PageHeader
          title="Umsetzung · Delivery-Cockpit"
          subtitle="Board, Tabelle, Fahrplan und Netzwerk in einer Fläche."
          {...(permissions.canCreate && selectedArt
            ? { actions: <CockpitCreateFeature artId={selectedArt.id} /> }
            : {})}
        />
      </div>
      <CockpitPiStrip pis={piStrip} window={piWindow} selectedPiId={selectedPiId} />
      {selectedArt && selectedPi && (
        <CockpitPiContext
          pi={selectedPi}
          artId={selectedArt.id}
          artName={selectedArt.name}
          valueStreamName={selectedArt.valueStreamName}
          canStart={permissions.canStart}
          canAdvance={permissions.canAdvance}
          canDelete={permissions.canDelete}
        />
      )}
      <CockpitToolbar
        availableArts={availableArts}
        selectedArt={selectedArt}
        view={view}
        filters={filters}
        filterOptions={filterOptions}
        featureCount={features.length}
      />

      <main className="flex-1 px-6 pb-6 pt-4">
        {!selectedArt ? (
          <EmptyState
            title="Kein ART im Scope"
            body="Dir ist noch kein ART zugeordnet. Bitte wende dich an deinen Tenant-Admin."
            className="h-[420px]"
          />
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
          />
        )}
      </main>

      {slideOverDetail && <FeatureSlideOver detail={slideOverDetail} />}
    </div>
  );
}
