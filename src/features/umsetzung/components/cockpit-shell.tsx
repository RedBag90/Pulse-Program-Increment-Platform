import type { CockpitModel } from "@/server/views/umsetzung-cockpit-view";
import { CockpitTopBar } from "./cockpit-top-bar";
import { CockpitPiStrip } from "./cockpit-pi-strip";
import { CockpitViewTabs } from "./cockpit-view-tabs";

/**
 * Delivery-Cockpit-Shell — Komposition der drei stabilen Bestandteile
 * (Top-Bar, PI-Strip, Sicht-Toggle) plus Sicht-Slot. Server Component
 * uebergibt das vollstaendige Model; die Sub-Komponenten urteilen
 * client-seitig ueber URL-State (Sicht / Scope).
 *
 * In Phase 1 ist der Sicht-Slot ein Platzhalter — Board (P2), Tabelle
 * (P3) und Roadmap (P4) ersetzen ihn jeweils durch die echte Render-
 * Komponente.
 */
interface Props {
  model: CockpitModel;
}

export function CockpitShell({ model }: Props) {
  const { availableArts, selectedArt, piStrip, view, features, permissions } = model;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-background">
      <CockpitTopBar
        availableArts={availableArts}
        selectedArt={selectedArt}
        canCreate={permissions.canCreate}
      />
      <CockpitPiStrip pis={piStrip} />
      <div className="flex items-center justify-between gap-3 px-6 py-3">
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
          <ViewPlaceholder name="Board" features={features.length} />
        ) : view === "table" ? (
          <ViewPlaceholder name="Tabelle" features={features.length} />
        ) : (
          <ViewPlaceholder name="Roadmap" features={features.length} />
        )}
      </main>
    </div>
  );
}

function ViewPlaceholder({ name, features }: { name: string; features: number }) {
  return (
    <div className="grid h-[420px] place-items-center rounded-lg border border-dashed bg-muted/10">
      <div className="text-center">
        <p className="font-medium">{name}-Sicht</p>
        <p className="text-xs text-muted-foreground">
          Skelett — kommt mit der naechsten Phase. ({features} Features im Scope)
        </p>
      </div>
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
