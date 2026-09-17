import { Suspense } from "react";
import { listSavedFilters } from "@/server/services/saved-filter";
import { GOAL_FILTER_KEYS } from "@/modules/core/goals/domain/goal-filter";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadStrategyTree, type ZieleSubTab } from "@/modules/core/goals/server/views/ziele-view";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { isZieleSetupDismissed } from "@/modules/core/goals/server/services/ziele-setup";
import { ZieleShell } from "@/modules/core/goals/features/components/ziele-shell";

/**
 * Ziele-Modul — **eine** Surface für Übersicht **und** Pflege (die frühere
 * Trennung /ziele read-only vs. /strategy edit ist zusammengelegt). Wer
 * `target.manage` hält, sieht die Edit-Affordances; alle anderen dieselbe
 * Seite read-only. KPI-Coverage + Bindungen leben weiter unter `/budgeting`.
 */
function parseTab(raw: string | undefined): ZieleSubTab {
  return raw === "money" ? raw : "strategie";
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ZielePage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const params = await searchParams;
  const tab = parseTab(typeof params.tab === "string" ? params.tab : undefined);
  // Filter sind Mehrfachauswahl → CSV in der URL, hier zu Arrays gesplittet.
  const splitCsv = (v: string | string[] | undefined): string[] =>
    typeof v === "string" && v ? v.split(",").filter(Boolean) : [];
  const periods = splitCsv(params.period);
  const valueStreamIds = splitCsv(params.vs);
  const artIds = splitCsv(params.art);
  const statuses = splitCsv(params.status);
  const layout =
    params.layout === "netzplan" || params.layout === "roadmap" || params.layout === "alignment"
      ? params.layout
      : "tabelle";

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const savedFilters = await listSavedFilters(db, principal, "goals", GOAL_FILTER_KEYS);

  // **Auto-Standard**: keine Filter-Parameter in der URL UND kein „leer"-Marker
  // → den als Standard markierten Filter anwenden, und zwar als **Redirect**,
  // damit die URL Single Source of Truth bleibt und teilbar ist. Dasselbe
  // Vorgehen wie auf der Portfolio-Übersicht.
  //
  // Ein Standard aus lauter leeren Mengen löst bewusst nichts aus — sonst
  // entstünde eine Umleitung, die nichts ändert.
  const anyFilterParam = Boolean(params.period || params.vs || params.art || params.status);
  if (!anyFilterParam && params.f !== "0") {
    const c = savedFilters.find((x) => x.isDefault)?.criteria;
    if (c && GOAL_FILTER_KEYS.some((k) => (c[k]?.length ?? 0) > 0)) {
      const qs = new URLSearchParams();
      if (typeof params.tab === "string") qs.set("tab", params.tab);
      if (typeof params.layout === "string") qs.set("layout", params.layout);
      for (const k of GOAL_FILTER_KEYS) if (c[k]?.length) qs.set(k, c[k]!.join(","));
      redirect(`/ziele?${qs.toString()}`);
    }
  }

  // Baum-Load und User-Labels (inkl. blockierendem Supabase-listUsers) laufen
  // unabhängig → parallel, statt seriell auf dem kritischen Renderpfad.
  const [tree, userLabels, setupDismissed] = await Promise.all([
    loadStrategyTree(db, principal.tenantId, {
      ...(periods.length ? { periods } : {}),
      ...(valueStreamIds.length ? { valueStreamIds } : {}),
      ...(artIds.length ? { artIds } : {}),
      ...(statuses.length ? { statuses } : {}),
    }),
    listTenantUserLabels(db, principal.tenantId),
    isZieleSetupDismissed(db, principal.tenantId),
  ]);

  // Edit-Affordances sind Capability-gesteuert (nicht mehr route-hart):
  // `target.manage` schaltet Strategie-Pflege frei, `kpi.bind` die KPI-Bewertung.
  const canEditStrategy = authorize(
    "target.manage",
    { tenantId: principal.tenantId },
    principal,
  ).allow;
  const canEditKpiValuation = authorize(
    "kpi.bind",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  const model = {
    ...tree,
    tab,
    permissions: { canEditStrategy, canEditKpiValuation },
    // Freemium: welche Premium-Quell-Module der Tenant freigeschaltet hat —
    // steuert 🔒-Upsell-Hinweise statt leerer Premium-Picker im Personal-Tenant.
    modules: {
      // Neue 4-Modul-Taxonomie: work (Epics/Portfolio), drumbeat (ARTs/Programm),
      // budgeting (Geld) — steuern die 🔒-Upsell-Hinweise im Ziele-Shell.
      portfolio: principal.enabledModules.includes("work"),
      program: principal.enabledModules.includes("drumbeat"),
      controlling: principal.enabledModules.includes("budgeting"),
    },
  };

  return (
    <Suspense fallback={null}>
      <ZieleShell
        savedFilters={savedFilters}
        model={model}
        layout={layout}
        userLabels={userLabels}
        setupDismissed={setupDismissed}
      />
    </Suspense>
  );
}
