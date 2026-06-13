import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadCockpitModel, type CockpitView } from "@/server/views/umsetzung-cockpit-view";
import { loadCockpitFeatureDetail } from "@/server/views/cockpit-feature-detail";
import { CockpitShell } from "@/features/umsetzung/components/cockpit-shell";

/**
 * Delivery-Cockpit (Umsetzungs-Modul-Redesign, Phase 1 — Skelett).
 *
 * Eine Page, drei Sichten (Board / Tabelle / Roadmap), eine konsolidierte
 * Datenquelle. Ersetzt die zuvor verstreuten Hub + PI-Workspace +
 * ART-Hub Pages (die werden in Phase 7 endgueltig entfernt und durch
 * Redirects hierher ersetzt).
 *
 * Aktuell sind die drei Sichten Platzhalter — die echten Render-
 * Komponenten kommen Schritt-fuer-Schritt mit P2 (Board), P3 (Tabelle)
 * und P4 (Roadmap).
 */
function parseView(raw: string | undefined): CockpitView {
  return raw === "table" || raw === "roadmap" ? raw : "board";
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UmsetzungCockpitPage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const params = await searchParams;
  const artParam = typeof params.art === "string" ? params.art : undefined;
  const viewParam = typeof params.view === "string" ? params.view : undefined;
  const featureIdParam = typeof params.featureId === "string" ? params.featureId : undefined;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [model, slideOverDetail] = await Promise.all([
    loadCockpitModel(db, principal, {
      artId: artParam,
      view: parseView(viewParam),
    }),
    featureIdParam
      ? loadCockpitFeatureDetail(db, principal, featureIdParam)
      : Promise.resolve(null),
  ]);

  return (
    <Suspense fallback={null}>
      <CockpitShell model={model} slideOverDetail={slideOverDetail} tenantId={principal.tenantId} />
    </Suspense>
  );
}
