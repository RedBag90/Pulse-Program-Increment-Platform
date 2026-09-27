import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  loadCockpitModel,
  type CockpitView,
  type CockpitFilters,
  type FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { loadCockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { CockpitShell } from "@/modules/drumbeat/features/cockpit/components/cockpit-shell";
import { loadPiFeedbackPanel } from "@/modules/drumbeat/server/views/pi-feedback-view";
import { loadPiLage } from "@/modules/drumbeat/server/views/pi-lage-view";
import type { TenantId } from "@/modules/core/kernel/domain/types";

const FEATURE_STATUSES: readonly FeatureStatus[] = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

/** Liest die Filter aus den URL-Parametern (deep-linkbar). Der Loader honoriert
 *  status/owner/epic/blocker bereits; hier werden sie nur geparst. */
function parseFilters(
  params: Record<string, string | string[] | undefined>,
): Partial<CockpitFilters> {
  const csv = (v: string | string[] | undefined): string[] =>
    typeof v === "string" && v.length > 0 ? v.split(",").filter(Boolean) : [];
  const status = csv(params.status).filter((s): s is FeatureStatus =>
    (FEATURE_STATUSES as readonly string[]).includes(s),
  );
  return {
    status,
    ownerIds: csv(params.owner),
    epicIds: csv(params.epic),
    hasBlocker: params.blocker === "1" || params.blocker === "true",
    q: typeof params.q === "string" ? params.q : "",
  };
}

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
  return raw === "lage" || raw === "table" || raw === "roadmap" || raw === "network"
    ? raw
    : "board";
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
  const piParam = typeof params.pi === "string" ? params.pi : undefined;
  const piwParam = typeof params.piw === "string" ? Number.parseInt(params.piw, 10) : 0;
  const windowOffset = Number.isFinite(piwParam) ? piwParam : 0;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [model, slideOverDetail] = await Promise.all([
    loadCockpitModel(db, principal, {
      artId: artParam,
      view: parseView(viewParam),
      windowOffset,
      piId: piParam,
      filters: parseFilters(params),
    }),
    featureIdParam
      ? loadCockpitFeatureDetail(db, principal, featureIdParam)
      : Promise.resolve(null),
  ]);

  // PI-Feedback und Lage hängen am gewählten ART und PI — erst nach dem
  // Modell bekannt. Die Lage braucht die Sicht „Lage" oder, als Kurzfassung in
  // der Leiste, ein laufender PI.
  const art = model.selectedArt;
  const pi = model.selectedPi;
  const brauchtLage = pi != null && (model.view === "lage" || pi.status === "active");
  const [feedback, lage] = await Promise.all([
    art && pi && pi.status !== "planned"
      ? loadPiFeedbackPanel(db, principal, { piId: pi.id, artId: art.id })
      : Promise.resolve(null),
    art && pi && brauchtLage
      ? loadPiLage(db, principal.tenantId as TenantId, { piId: pi.id, artId: art.id })
      : Promise.resolve(null),
  ]);

  return (
    <Suspense fallback={null}>
      <CockpitShell
        model={model}
        slideOverDetail={slideOverDetail}
        tenantId={principal.tenantId}
        feedback={feedback}
        lage={lage}
      />
    </Suspense>
  );
}
