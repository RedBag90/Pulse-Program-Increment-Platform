"use client";

import type { FeaturesOverviewModel } from "@/modules/work/server/views/features-overview";
import { FeaturesListView } from "@/modules/work/features/feature/components/features-table";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  model: FeaturesOverviewModel;
}

/**
 * Cross-VS/Cross-ART Features-Übersicht: Funnel-Header über die vier
 * Feature-Status + Filterleiste (VS · ART · PI · Epic · WSJF-Tier · Typ ·
 * Suche · Sortierung) + Tabelle.
 *
 * Die Darstellung selbst liegt seit dem Deliverables-Umbau in
 * `@/modules/work/features/feature/components/features-table` — derselbe
 * Baustein rendert die Feature-Liste im Epic. Diese Shell ist nur noch der
 * Seitenrahmen; Spalten, Filter und Parameter-Namen bleiben unverändert
 * (kein Präfix, alle Spalten), damit sich für Nutzer dieser Seite nichts ändert.
 *
 * Bewusst read-only: keine Bulk-PI-Reassign, weil die per-Item Auth-Resource
 * pro ART unterschiedlich ist und das ein eigener PR wert ist. Der
 * Deliverables-Reiter reicht seine Bearbeiten-Funktionen über die Slots der
 * geteilten Komponente herein.
 */
export function FeaturesOverviewShell({ model }: Props) {
  return (
    <Page>
      <PageHeader
        title="Features-Übersicht"
        subtitle="Alle Features im Zugriff — über Wertströme, ARTs und PIs hinweg."
      />
      <FeaturesListView model={model} />
    </Page>
  );
}
