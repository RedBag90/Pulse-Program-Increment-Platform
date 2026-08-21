import type { CockpitModel } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import type { CockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { CockpitTopBar } from "./cockpit-top-bar";
import { CockpitPiStrip } from "./cockpit-pi-strip";
import { CockpitPiContext } from "./cockpit-pi-context";
import { CockpitViewTabs } from "./cockpit-view-tabs";
import { CockpitBoard } from "./cockpit-board";
import { CockpitTable } from "./cockpit-table";
import { CockpitRoadmap } from "./cockpit-roadmap";
import { CockpitNetworkLazy } from "./cockpit-network-lazy";
import { FeatureSlideOver } from "./feature-slide-over";
import { CockpitRealtimeSubscriber } from "./cockpit-realtime-subscriber";

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
    dependencies,
    permissions,
  } = model;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-background">
      <CockpitRealtimeSubscriber tenantId={tenantId} />
      <CockpitTopBar availableArts={availableArts} selectedArt={selectedArt} filters={filters} />
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
      <div className="flex items-center justify-between gap-3 border-b bg-surface-frame px-6 py-3">
        <CockpitViewTabs view={view} />
        <p className="text-xs text-muted-foreground">{features.length} Features im Scope</p>
      </div>

      <main className="flex-1 px-6 pb-6">
        {!selectedArt ? (
          <EmptyState
            title="Kein ART im Scope"
            body="Dir ist noch kein ART zugeordnet. Bitte wende dich an deinen Tenant-Admin."
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/20">
      <div className="max-w-md text-center">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
