import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
} from "@/modules/core/org/server/services/structure";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";
import { StructureNav } from "@/modules/core/org/features/structure/components/structure-nav";

/**
 * Der Struktur-Bereich: links der Baum, rechts der gewählte Knoten.
 *
 * Der Baum steht **im Layout**, nicht in den Seiten. Next rendert ein Layout
 * beim Navigieren zwischen seinen Kindern nicht neu — nur so bleibt er beim
 * Wechsel von Knoten zu Knoten und von Reiter zu Reiter wirklich stehen, samt
 * Scroll-Position, und wird einmal geladen statt bei jedem Klick.
 *
 * Es liegt in der Routen-Gruppe `(organisation)` — die den Pfad nicht verändert,
 * aber `/structure/timelines` und `/structure/solutions` **aussparen** kann: das
 * sind eigene Flächen des Bereichs, keine Knoten des Baums. Der einzelne
 * Solution-Knoten (`/structure/solution/<id>`) gehört dagegen hierher.
 */
export default async function StructureLayout({ children }: { children: ReactNode }) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [tree, timeline, userLabels] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    // Nur für die Timeline-Anzeige am ART-Knoten — die Kadenz-Fläche selbst
    // lädt ihre Daten eigenständig.
    getStructureTimeline(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const model = buildStructurePageModel({ mode: "structure", tree, timeline, userLabels });

  return (
    <div className="p-6">
      <div className="grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <StructureNav
            rows={model.rows}
            kindCounts={model.kindCounts}
            availableKinds={["vs", "art", "solution"]}
            canCreateVs={hasCapability(principal, "value_stream.create")}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
