"use client";

import type { CockpitView } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";

/**
 * Sicht-Toggle Board / Tabelle / Fahrplan / Netzwerk. URL-Param `?view=<sicht>`,
 * Default ist `board` (Entscheidung #1). Filter + Scope ueberleben den
 * Sicht-Wechsel automatisch, weil sie eigene Query-Params sind. Nutzt das
 * geteilte `ToggleGroup`-Primitive (kein Eigenbau-Tablist mehr); Labels folgen
 * dem Wireframe-Vokabular („Fahrplan"/„Netzwerk").
 */
const TABS: ReadonlyArray<ToggleGroupOption<CockpitView>> = [
  { id: "board", label: "Board" },
  { id: "table", label: "Tabelle" },
  { id: "roadmap", label: "Fahrplan" },
  { id: "network", label: "Netzwerk" },
];

interface Props {
  view: CockpitView;
}

export function CockpitViewTabs({ view }: Props) {
  const { setParam } = useUrlState();

  function setView(next: CockpitView) {
    // `board` ist Default → Param entfernen (leere URL); sonst setzen.
    setParam("view", next === "board" ? null : next);
  }

  return (
    <div data-tour="cockpit-view-tabs">
      <ToggleGroup
        value={view}
        options={TABS}
        onChange={setView}
        ariaLabel="Cockpit-Sicht"
        className="bg-card text-sm"
      />
    </div>
  );
}
